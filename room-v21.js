import {rtcConfiguration} from './network-v21.js';
import {PeerLink} from './peer-v21.js';
import {loadRoomLibrary} from './room.js';
const PREFIX='neon-outpost-multiplayerTest-v21-',TAG='neon-room-v21',GRACE=120000;
const resumeToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export class RoomLink{
 constructor(callbacks={}){this.callbacks=callbacks;this.role=null;this.localId=0;this.code='';this.session=null;}
 active(s){return !!s&&this.session===s&&!s.closed;}
 current(s,r,c){return this.active(s)&&s.links.get(r.id)===r&&r.cycle===c&&!c.closed;}
 get connected(){return !!this.session&&[...this.session.links.values()].some(r=>r.connected&&r.direct?.connected);}
 get interrupted(){return !!this.session&&[...this.session.links.values()].some(r=>r.recovering||r.connected&&r.direct?.interrupted);}
 get locked(){return !!this.session?.locked;}
 get pendingCount(){return this.role==='host'?[...this.session?.links.values()||[]].filter(r=>!r.everOpened).length:0;}
 isInterrupted(id){const r=this.session?.links.get(id);return !!(r?.recovering||r?.direct?.interrupted);}
 isConnected(id){const r=this.session?.links.get(id);return !!(r?.connected&&r.direct?.connected&&!r.recovering);}
 send(m,reliable=true,target=null){
  const s=this.session;if(!this.active(s))return false;
  const send=r=>!!(r?.connected&&r.direct?.send(m,reliable));
  if(this.role==='guest')return send(s.links.get(0));
  if(Number.isInteger(target))return send(s.links.get(target));
  let sent=false;for(const r of s.links.values())sent=send(r)||sent;return sent;
 }
 cleanupCycle(r){
  const c=r.cycle;if(!c)return;c.closed=true;clearTimeout(c.timer);try{c.conn?.close();}catch{}c.direct?.close();r.cycle=null;r.direct=null;r.connected=false;
 }
 cleanupBroker(s){const p=s.peer;s.peer=null;s.peerReady=false;try{p?.destroy();}catch{}}
 close(){
  const s=this.session;if(!s)return;
  if(s.role==='guest')this.send({t:'room-leave'},true);else this.send({t:'room-ended'},true);
  this.session=null;this.role=null;this.localId=0;this.code='';s.closed=true;
  clearTimeout(s.openTimer);clearTimeout(s.brokerTimer);s.cancel?.();this.cleanupBroker(s);
  for(const r of s.links.values()){clearTimeout(r.retryTimer);clearTimeout(r.deadlineTimer);this.cleanupCycle(r);}s.links.clear();
 }
 fail(s,text){if(!this.active(s))return;this.callbacks.onDiagnostics?.({stage:'failed',error:text});this.close();this.callbacks.onClose?.(text);}
 discard(s,r,text){
  if(!this.active(s)||s.links.get(r.id)!==r)return;clearTimeout(r.retryTimer);clearTimeout(r.deadlineTimer);this.cleanupCycle(r);s.links.delete(r.id);
  if(s.role==='guest')this.fail(s,text||'The host is unavailable. Start a new room.');
  else if(r.everOpened)this.callbacks.onPeerLeave?.(r.id,text||'Reconnect time expired. Remaining players can continue.');
  else this.callbacks.onStatus?.(text||'A player could not join. They can try again.',true);
 }
 reject(conn,text){const send=()=>{try{conn.send({type:'reject',text});}catch{}setTimeout(()=>{try{conn.close();}catch{}},200);};conn.on('open',send);if(conn.open)send();}
 record(s,id,token=null){const r={id,token:token||resumeToken(),everOpened:false,connected:false,recovering:false,cycle:null,direct:null,retryTimer:null,deadlineTimer:null,attempt:0,deadline:0};s.links.set(id,r);return r;}
 requestReconnect(id=null){
  const s=this.session;if(!this.active(s))return;
  if(s.role==='guest'){const r=s.links.get(0);if(r?.everOpened&&!r.recovering)this.recover(s,r);}
  else if(Number.isInteger(id)){const r=s.links.get(id);if(r?.everOpened&&!r.recovering)this.recover(s,r);}
  else for(const r of s.links.values())if(r.everOpened&&!r.recovering&&(r.direct?.interrupted||!r.direct?.connected))this.recover(s,r);
 }
 recover(s,r){
  if(!this.active(s)||s.links.get(r.id)!==r||!r.everOpened)return;
  if(!r.recovering){
   r.recovering=true;r.deadline=Date.now()+GRACE;r.attempt=0;
   r.deadlineTimer=setTimeout(()=>this.discard(s,r,'Reconnect time expired. Keep the host open and start a new room.'),GRACE);
   this.callbacks.onReconnecting?.(s.role==='host'?r.id:this.localId);
  }
  this.cleanupCycle(r);this.ensureBroker(s);
  if(s.role==='guest')this.scheduleAttempt(s,r,0);
 }
 attemptFailed(s,r,c,text){
  if(!this.current(s,r,c))return;
  if(!r.everOpened){this.discard(s,r,text||'Pairing failed. Check internet access and run Test connection.');return;}
  this.cleanupCycle(r);
  if(!r.recovering){this.recover(s,r);return;}
  if(Date.now()>=r.deadline){this.discard(s,r,'Reconnect time expired. Start a new room.');return;}
  if(s.role==='guest')this.scheduleAttempt(s,r,Math.min(8000,1000*2**Math.min(3,r.attempt++)));
 }
 scheduleAttempt(s,r,delay){
  if(!this.active(s)||!r.recovering||s.role!=='guest'||r.retryTimer)return;
  r.retryTimer=setTimeout(()=>{r.retryTimer=null;this.attempt(s,r);},delay);
 }
 attempt(s,r){
  if(!this.active(s)||!r.recovering||r.cycle)return;
  if(Date.now()>=r.deadline){this.discard(s,r,'Reconnect time expired. Start a new room.');return;}
  if(!s.peerReady||!s.peer||s.peer.destroyed){this.ensureBroker(s);this.scheduleAttempt(s,r,1000);return;}
  try{
   const conn=s.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json',metadata:{game:TAG,resume:{slot:this.localId,token:r.token}},label:TAG});
   this.attach(s,r,conn,true);
  }catch{this.scheduleAttempt(s,r,Math.min(8000,1000*2**Math.min(3,r.attempt++)));}
 }
 lock(){
  const s=this.session;if(!this.active(s)||s.role!=='host'||s.locked)return;s.locked=true;
  for(const r of [...s.links.values()])if(!r.everOpened)this.discard(s,r,'Round started before pairing completed. Ask for a new room.');
  // Keep only the tiny matching connection alive, so authenticated players can rebuild a failed direct link.
 }
 async begin(role){
  this.close();this.role=role;this.localId=role==='host'?0:1;
  const s={role,closed:false,locked:false,peer:null,peerId:null,peerReady:false,Peer:null,links:new Map(),openTimer:null,brokerTimer:null,brokerBusy:false,cancel:null};this.session=s;
  const Peer=await loadRoomLibrary();if(!this.active(s))throw new Error('Room setup cancelled.');s.Peer=Peer;return{s,Peer};
 }
 scheduleBroker(s){
  if(!this.active(s)||s.brokerTimer)return;
  s.brokerTimer=setTimeout(()=>{s.brokerTimer=null;this.ensureBroker(s);},1500);
 }
 ensureBroker(s){
  if(!this.active(s)||s.peerReady||s.brokerBusy)return;
  const p=s.peer;
  if(p&&!p.destroyed){
   if(!s.brokerSince)s.brokerSince=Date.now();
   if(Date.now()-s.brokerSince<20000){try{if(p.disconnected)p.reconnect();}catch{}this.scheduleBroker(s);return;}
   this.cleanupBroker(s);s.brokerSince=Date.now();
  }
  s.brokerBusy=true;
  this.openPeer(s,s.Peer,s.peerId).catch(()=>{if(this.active(s)){this.cleanupBroker(s);this.scheduleBroker(s);}}).finally(()=>{s.brokerBusy=false;});
 }
 openPeer(s,Peer,id){
  return new Promise((resolve,reject)=>{
   let settled=false;const options={secure:true,debug:0,config:rtcConfiguration()},p=id?new Peer(id,options):new Peer(options);s.peer=p;s.peerReady=false;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(s.openTimer);s.cancel=null;error?reject(error):resolve(p);};
   s.cancel=()=>finish(new Error('Room setup cancelled.'));s.openTimer=setTimeout(()=>finish(new Error('Room matching did not respond. Check internet and try again.')),20000);
   p.on('open',()=>{if(!this.active(s)||s.peer!==p){try{p.destroy();}catch{}return;}s.peerReady=true;this.callbacks.onDiagnostics?.({stage:'matching',side:s.role});s.peerId=p.id;s.brokerSince=0;finish();});
   p.on('error',error=>{
    if(!this.active(s)||s.peer!==p)return;if(!settled){finish(error);return;}
    if(error.type==='peer-unavailable'&&s.role==='guest'){const r=s.links.get(0);if(r?.cycle&&!r.connected)this.attemptFailed(s,r,r.cycle,'Room not found. Check the code, keep the host open, and reload both phones to the same version.');return;}
    s.peerReady=!p.disconnected&&!p.destroyed;if(!s.peerReady)this.scheduleBroker(s);
   });
   p.on('disconnected',()=>{if(!this.active(s)||s.peer!==p)return;s.peerReady=false;this.scheduleBroker(s);});
   p.on('close',()=>{if(!this.active(s)||s.peer!==p)return;s.peerReady=false;s.peer=null;if(!settled)finish(new Error('Room matching closed. Check internet and try again.'));else this.scheduleBroker(s);});
   p.on('connection',conn=>{
    if(!this.active(s)||s.peer!==p||s.role!=='host'||conn.metadata?.game!==TAG){try{conn.close();}catch{}return;}
    const resume=conn.metadata.resume;
    if(resume){
     const r=s.links.get(resume.slot);
     if(!r?.everOpened||typeof resume.token!=='string'||resume.token!==r.token||r.recovering&&Date.now()>=r.deadline){this.reject(conn,'This player’s reconnect session has expired. Start a new room.');return;}
     if(r.cycle&&!r.connected){this.reject(conn,'Reconnect already in progress. Retrying shortly.');return;}
     if(!r.recovering)this.recover(s,r);
     this.attach(s,r,conn,true);return;
    }
    if(s.locked||s.links.size>=3){this.reject(conn,s.locked?'Round already started. Only returning players can reconnect.':'Room full. Four players are already connected or reserved.');return;}
    const slot=[1,2,3].find(id=>!s.links.has(id));this.attach(s,this.record(s,slot),conn,false);
   });
  });
 }
 async hostRoom(){
  const{s,Peer}=await this.begin('host');
  for(let attempt=0;attempt<6;attempt++){
   const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
   try{await this.openPeer(s,Peer,PREFIX+code);if(!this.active(s))throw new Error('Room setup cancelled.');this.code=code;this.callbacks.onOpen?.();return code;}
   catch(error){this.cleanupBroker(s);if(!this.active(s)||error.type!=='unavailable-id')throw error;}
  }
  throw new Error('Could not reserve a room. Try again.');
 }
 async joinRoom(code){
  const value=String(code).replace(/[\s-]/g,'');if(!/^\d{6}$/.test(value))throw new Error('Enter the host’s six-digit room code.');
  const{s,Peer}=await this.begin('guest');this.code=value;await this.openPeer(s,Peer);if(!this.active(s))throw new Error('Room setup cancelled.');
  const conn=s.peer.connect(PREFIX+value,{reliable:true,serialization:'json',metadata:{game:TAG},label:TAG});this.attach(s,this.record(s,0),conn,false);
 }
 attach(s,r,conn,resuming){
  this.cleanupCycle(r);const c={conn,direct:null,closed:false,offered:false,answered:false,handling:false,timer:null};r.cycle=c;
  const live=()=>this.current(s,r,c);
  this.callbacks.onDiagnostics?.({stage:'matching',side:s.role});this.callbacks.onStatus?.(s.role==='host'?'A friend is joining. Testing an internet route…':'Finding the host and testing an internet route…');
  c.direct=r.direct=new PeerLink({
   onDiagnostics:report=>{if(live())this.callbacks.onDiagnostics?.({...report,player:s.role==='host'?r.id:this.localId});},
   onStatus:(text,error)=>{if(live()&&error&&!r.everOpened)this.callbacks.onStatus?.(text,true);},
   onMessage:m=>{
    if(!live()||!r.connected)return;
    if(s.role==='host'&&m?.t==='room-leave'){this.discard(s,r,'Player left the room.');return;}
    if(s.role==='guest'&&m?.t==='room-ended'){this.fail(s,'Host ended the room. Create or join a new room.');return;}
    this.callbacks.onMessage?.(m,s.role==='host'?r.id:0);
   },
   onOpen:()=>{
    if(!live())return;const returning=r.everOpened;r.connected=true;r.everOpened=true;r.recovering=false;r.attempt=0;clearTimeout(r.deadlineTimer);clearTimeout(r.retryTimer);clearTimeout(c.timer);r.deadlineTimer=r.retryTimer=null;try{conn.close();}catch{}
    if(returning)this.callbacks.onReconnected?.(s.role==='host'?r.id:this.localId);
    else if(s.role==='guest')this.callbacks.onOpen?.();else this.callbacks.onPeerJoin?.(r.id);
   },
   onInterrupted:()=>{if(live()&&r.everOpened)this.recover(s,r);},
   onClose:text=>{if(live()){if(r.everOpened)this.recover(s,r);else this.attemptFailed(s,r,c,text);}}
  });
  c.timer=setTimeout(()=>this.attemptFailed(s,r,c,'Phone-to-phone pairing timed out. Run Test connection on both phones; mobile data may need a working relay.'),resuming?30000:60000);
  const opened=async()=>{
   if(live()){this.callbacks.onDiagnostics?.({stage:'pairing',side:s.role});this.callbacks.onStatus?.('Phones found. Opening the game connection…');}
   if(!live()||c.offered||s.role!=='host')return;c.offered=true;
   try{const code=await c.direct.hostOffer();if(live())conn.send({type:'offer',slot:r.id,token:r.token,code});}catch(error){this.attemptFailed(s,r,c,error.message);}
  };
  conn.on('open',opened);
  conn.on('data',async m=>{
   if(!live()||r.connected||!m||typeof m!=='object')return;
   if(m.type==='reject'){if(resuming)this.attemptFailed(s,r,c,m.text);else this.discard(s,r,typeof m.text==='string'?m.text.slice(0,180):'Room unavailable.');return;}
   if(typeof m.code!=='string'||m.code.length>131072||c.handling)return;
   if(s.role==='guest'&&m.type==='offer'&&!c.answered){
    if(!Number.isInteger(m.slot)||m.slot<1||m.slot>3||typeof m.token!=='string'||!/^[a-f0-9]{32}$/.test(m.token)||resuming&&(m.slot!==this.localId||m.token!==r.token)){this.discard(s,r,'Reconnect returned an invalid player seat. Start a new room.');return;}
    this.localId=m.slot;r.token=m.token;c.answered=true;c.handling=true;
    try{const code=await c.direct.guestAnswer(m.code);if(live())conn.send({type:'answer',code});}catch(error){this.attemptFailed(s,r,c,error.message);}finally{c.handling=false;}
   }else if(s.role==='host'&&m.type==='answer'&&c.offered&&!c.answered){
    c.answered=true;c.handling=true;try{await c.direct.finishHost(m.code);}catch(error){this.attemptFailed(s,r,c,error.message);}finally{c.handling=false;}
   }
  });
  conn.on('error',()=>{if(live()&&!r.connected)this.attemptFailed(s,r,c,'Pairing connection interrupted. Retrying.');});
  conn.on('close',()=>{if(live()&&!r.connected&&!c.answered)this.attemptFailed(s,r,c,'Pairing connection closed. Retrying.');});
  if(conn.open)opened();
 }
}
