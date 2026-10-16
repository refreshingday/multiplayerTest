import {PeerLink} from './peer.js';
import {loadRoomLibrary} from './room.js';
const PREFIX='neon-outpost-multiplayerTest-v9-',TAG='neon-room-v9';
export class RoomLink{
 constructor(callbacks={}){this.callbacks=callbacks;this.role=null;this.localId=0;this.code='';this.session=null;}
 active(s){return !!s&&this.session===s&&!s.closed;}
 get connected(){const s=this.session;return !!s&&[...s.links.values()].some(r=>r.opened&&r.direct.connected);}
 get interrupted(){const s=this.session;return !!s&&[...s.links.values()].some(r=>r.opened&&r.direct.interrupted);}
 get locked(){return !!this.session?.locked;}
 get pendingCount(){return this.role==='host'?[...this.session?.links.values()||[]].filter(r=>!r.opened).length:0;}
 isConnected(id){return !!this.session?.links.get(id)?.direct.connected;}
 send(m,reliable=true,target=null){
  const s=this.session;if(!this.active(s))return false;
  if(this.role==='guest')return !!s.links.get(0)?.direct.send(m,reliable);
  if(Number.isInteger(target))return !!s.links.get(target)?.direct.send(m,reliable);
  let sent=false;for(const r of s.links.values())if(r.opened)sent=r.direct.send(m,reliable)||sent;return sent;
 }
 close(){
  const s=this.session;this.session=null;this.role=null;this.localId=0;this.code='';
  if(!s)return;s.closed=true;clearTimeout(s.openTimer);clearTimeout(s.reconnectTimer);s.cancel?.();this.cleanupBroker(s);
  for(const r of s.links.values()){clearTimeout(r.timer);r.closed=true;try{r.conn?.close();}catch{}r.direct.close();}s.links.clear();
 }
 cleanupBroker(s){const peer=s.peer;s.peer=null;try{peer?.destroy();}catch{}}
 drop(s,id,text){
  if(!this.active(s))return;const r=s.links.get(id);if(!r||r.closed)return;r.closed=true;s.links.delete(id);clearTimeout(r.timer);try{r.conn?.close();}catch{}r.direct.close();
  if(s.role==='guest'){this.close();this.callbacks.onClose?.(text||'Host left. Create a new room.');}
  else if(r.opened)this.callbacks.onPeerLeave?.(id,text||'Player disconnected.');
  else this.callbacks.onStatus?.(text||'A player could not join. They can try the room again.',true);
 }
 fail(s,text){if(!this.active(s))return;this.close();this.callbacks.onClose?.(text);}
 lock(){
  const s=this.session;if(!this.active(s)||s.role!=='host'||s.locked)return;s.locked=true;
  for(const [id,r] of [...s.links])if(!r.opened)this.drop(s,id,'Round started before pairing completed. Ask for a new room.');
  this.cleanupBroker(s);
 }
 async begin(role){
  this.close();this.role=role;this.localId=role==='host'?0:1;
  const s={role,closed:false,locked:false,peer:null,links:new Map(),openTimer:null,reconnectTimer:null,cancel:null};this.session=s;
  const Peer=await loadRoomLibrary();if(!this.active(s))throw new Error('Room setup cancelled.');return {s,Peer};
 }
 openPeer(s,Peer,id){
  return new Promise((resolve,reject)=>{
   let settled=false;const options={secure:true,debug:0,config:{iceServers:[]}},p=id?new Peer(id,options):new Peer(options);s.peer=p;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(s.openTimer);s.cancel=null;error?reject(error):resolve(p);};
   s.cancel=()=>finish(new Error('Room setup cancelled.'));s.openTimer=setTimeout(()=>finish(new Error('Room matching did not respond. Check internet and try again.')),20000);
   p.on('open',()=>{if(this.active(s)&&s.peer===p)finish();else try{p.destroy();}catch{}});
   p.on('error',error=>{
    if(!this.active(s)||s.peer!==p)return;if(!settled){finish(error);return;}
    if(s.role==='guest')this.fail(s,error.type==='peer-unavailable'?'Room not found or already started. Ask the host for a new room.':'Room matching failed. Try joining again.');
    else if(!s.locked)this.callbacks.onStatus?.('Room matching was interrupted. Connected players can still start.',true);
   });
   p.on('connection',conn=>{
    if(!this.active(s)||s.peer!==p||s.role!=='host'||conn.metadata?.game!==TAG){try{conn.close();}catch{}return;}
    if(s.locked||s.links.size>=3){const reject=()=>{try{conn.send({type:'reject',text:s.locked?'The round already started. Ask the host for a new room.':'Room full. Four players are already connected or joining.'});}catch{}setTimeout(()=>{try{conn.close();}catch{}},200);};conn.on('open',reject);if(conn.open)reject();return;}
    const slot=[1,2,3].find(id=>!s.links.has(id));this.attach(s,conn,slot);
   });
   p.on('disconnected',()=>{if(!this.active(s)||s.peer!==p||s.locked)return;if(s.role==='host'){clearTimeout(s.reconnectTimer);s.reconnectTimer=setTimeout(()=>{if(this.active(s)&&s.peer===p)try{p.reconnect();}catch{}},500);}else if(!this.connected)this.fail(s,'Room matching disconnected. Try joining again.');});
   p.on('close',()=>{if(this.active(s)&&s.peer===p&&!s.locked&&!this.connected)this.fail(s,'Room matching closed. Create or join a new room.');});
  });
 }
 async hostRoom(){
  const {s,Peer}=await this.begin('host');
  for(let attempt=0;attempt<6;attempt++){
   const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
   try{await this.openPeer(s,Peer,PREFIX+code);if(!this.active(s))throw new Error('Room setup cancelled.');this.code=code;this.callbacks.onOpen?.();return code;}
   catch(error){this.cleanupBroker(s);if(!this.active(s)||error.type!=='unavailable-id')throw error;}
  }
  throw new Error('Could not reserve a room. Try again.');
 }
 async joinRoom(code){
  const value=String(code).replace(/[\s-]/g,'');if(!/^\d{6}$/.test(value))throw new Error('Enter the host’s six-digit room code.');
  const {s,Peer}=await this.begin('guest');this.code=value;await this.openPeer(s,Peer);if(!this.active(s))throw new Error('Room setup cancelled.');
  const conn=s.peer.connect(PREFIX+value,{reliable:true,serialization:'json',metadata:{game:TAG},label:TAG});this.attach(s,conn,0);
 }
 attach(s,conn,id){
  const r={conn,direct:null,opened:false,upgraded:false,closed:false,offered:false,answered:false,handling:false,timer:null};s.links.set(id,r);
  r.direct=new PeerLink({
   onStatus:(text,error)=>{if(this.active(s)&&!r.closed&&error)this.callbacks.onStatus?.(text,true);},
   onMessage:m=>{if(this.active(s)&&!r.closed)this.callbacks.onMessage?.(m,s.role==='host'?id:0);},
   onOpen:()=>{
    if(!this.active(s)||r.closed)return;r.opened=r.upgraded=true;clearTimeout(r.timer);try{r.conn.close();}catch{}
    if(s.role==='guest'){this.cleanupBroker(s);this.callbacks.onOpen?.();}
    else this.callbacks.onPeerJoin?.(id);
   },
   onClose:text=>this.drop(s,id,text)
  });
  r.timer=setTimeout(()=>this.drop(s,id,'Pairing timed out. Keep every phone on the same Wi-Fi and join again.'),90000);
  const opened=async()=>{
   if(!this.active(s)||r.closed||r.offered||s.role!=='host')return;r.offered=true;
   try{const code=await r.direct.hostOffer();if(this.active(s)&&!r.closed)conn.send({type:'offer',slot:id,code});}catch(error){this.drop(s,id,error.message);}
  };
  conn.on('open',opened);
  conn.on('data',async m=>{
   if(!this.active(s)||r.closed||r.upgraded||!m||typeof m!=='object')return;
   if(m.type==='reject'){this.drop(s,id,typeof m.text==='string'?m.text.slice(0,180):'Room unavailable. Try a new room.');return;}
   if(typeof m.code!=='string'||m.code.length>131072||r.handling)return;
   if(s.role==='guest'&&m.type==='offer'&&!r.answered){
    if(!Number.isInteger(m.slot)||m.slot<1||m.slot>3){this.drop(s,id,'The room returned an invalid player seat. Reload and join again.');return;}
    this.localId=m.slot;r.answered=true;r.handling=true;
    try{const code=await r.direct.guestAnswer(m.code);if(this.active(s)&&!r.closed)conn.send({type:'answer',code});}catch(error){this.drop(s,id,error.message);}finally{r.handling=false;}
   }else if(s.role==='host'&&m.type==='answer'&&r.offered&&!r.answered){
    r.answered=true;r.handling=true;try{await r.direct.finishHost(m.code);}catch(error){this.drop(s,id,error.message);}finally{r.handling=false;}
   }
  });
  conn.on('error',()=>{if(!r.upgraded&&!r.answered)this.drop(s,id,'Pairing failed. Check Wi-Fi and join again.');});
  conn.on('close',()=>{if(!r.upgraded&&!r.closed&&!r.answered)this.drop(s,id,'Pairing closed before the phones connected. Try joining again.');});
  if(conn.open)opened();
 }
}
