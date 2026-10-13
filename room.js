import {PeerLink} from './peer.js';
let library;
export function loadRoomLibrary(){
 if(globalThis.Peer)return Promise.resolve(globalThis.Peer);
 if(library)return library;
 library=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let timer;
  const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error)}else resolve(globalThis.Peer)};
  script.src='https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';script.async=true;
  script.onload=()=>finish(globalThis.Peer?null:new Error('Room matching could not load. Try manual pairing.'));
  script.onerror=()=>finish(new Error('Room matching is unavailable. Check internet or use manual pairing.'));
  timer=setTimeout(()=>finish(new Error('Room matching timed out. Try again or use manual pairing.')),15000);
  document.head.appendChild(script);
 }).catch(error=>{library=null;throw error});
 return library;
}
const PREFIX='neon-outpost-multiplayerTest-v3-',TAG='neon-room-v3';
export class RoomLink{
 constructor(callbacks={}){
  this.callbacks=callbacks;this.role=null;this.session=null;
  this.direct=new PeerLink({
   onStatus:(...args)=>this.callbacks.onStatus?.(...args),
   onMessage:m=>this.callbacks.onMessage?.(m),
   onOpen:()=>{const s=this.session;if(!this.active(s))return;s.upgraded=true;clearTimeout(s.joinTimer);this.cleanupBroker(s);this.callbacks.onOpen?.()},
   onClose:text=>{const s=this.session;this.close();if(s)this.callbacks.onClose?.(text)}
  });
 }
 get connected(){return this.direct.connected}
 get interrupted(){return this.direct.interrupted}
 send(m,reliable=true){return this.direct.send(m,reliable)}
 active(s){return !!s&&this.session===s&&!s.closed}
 cleanupBroker(s){clearTimeout(s.openTimer);try{s.conn?.close()}catch{}try{s.peer?.destroy()}catch{}s.peer=null;s.conn=null}
 close(){
  const s=this.session;this.session=null;this.role=null;
  if(s){s.closed=true;clearTimeout(s.joinTimer);clearTimeout(s.openTimer);s.cancel?.();this.cleanupBroker(s)}
  this.direct.close();
 }
 fail(s,text){if(!this.active(s)||s.upgraded)return;this.close();this.callbacks.onClose?.(text)}
 async begin(role){
  this.close();const s={role,closed:false,upgraded:false,peer:null,conn:null,cancel:null,openTimer:null,joinTimer:null,handling:false};this.session=s;this.role=role;
  const Peer=await loadRoomLibrary();if(!this.active(s))throw new Error('Room setup cancelled.');return{s,Peer};
 }
 openPeer(s,Peer,id){
  return new Promise((resolve,reject)=>{
   let settled=false;const p=id?new Peer(id,{secure:true,debug:0,config:{iceServers:[]}}):new Peer({secure:true,debug:0,config:{iceServers:[]}});
   s.peer=p;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(s.openTimer);s.cancel=null;error?reject(error):resolve(p)};
   s.cancel=()=>finish(new Error('Room setup cancelled.'));
   s.openTimer=setTimeout(()=>finish(new Error('Room service did not respond. Check internet or use manual pairing.')),20000);
   p.on('open',()=>{if(this.active(s)&&s.peer===p)finish();else try{p.destroy()}catch{}});
   p.on('error',error=>{
    if(!this.active(s)||s.peer!==p||s.upgraded)return;
    if(!settled)finish(error);else this.fail(s,error.type==='peer-unavailable'?'Room not found. Ask your friend for their current six-digit code.':'Room connection failed. Try again or use manual pairing.');
   });
   p.on('connection',conn=>{
    if(!this.active(s)||s.peer!==p||s.role!=='host'||s.conn||conn.metadata?.game!==TAG){try{conn.close()}catch{}return}
    this.attach(s,conn);
   });
   p.on('close',()=>{if(this.active(s)&&s.peer===p&&!s.upgraded)this.fail(s,'Room service closed. Try again or use manual pairing.')});
   p.on('disconnected',()=>{if(this.active(s)&&s.peer===p&&!s.upgraded)this.fail(s,'Room service disconnected. Try again or use manual pairing.')});
  });
 }
 async hostRoom(){
  const {s,Peer}=await this.begin('host');
  for(let attempt=0;attempt<6;attempt++){
   const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
   try{await this.openPeer(s,Peer,PREFIX+code);if(!this.active(s))throw new Error('Room setup cancelled.');return code}
   catch(error){const old=s.peer;s.peer=null;try{old?.destroy()}catch{}if(!this.active(s)||error.type!=='unavailable-id')throw error}
  }
  throw new Error('Could not reserve a room. Try again.');
 }
 async joinRoom(code){
  const normalized=String(code).replace(/[\s-]/g,'');if(!/^\d{6}$/.test(normalized))throw new Error('Enter the six digits shown on your friend’s phone.');
  const {s,Peer}=await this.begin('guest');await this.openPeer(s,Peer);
  if(!this.active(s))throw new Error('Room setup cancelled.');
  const conn=s.peer.connect(PREFIX+normalized,{reliable:true,serialization:'json',metadata:{game:TAG},label:TAG});this.attach(s,conn);
 }
 attach(s,conn){
  s.conn=conn;s.joinTimer=setTimeout(()=>this.fail(s,'The phones did not connect. Check the same Wi-Fi and try a new room.'),90000);
  let offered=false,answered=false;
  const opened=async()=>{
   if(!this.active(s)||s.upgraded||s.role!=='host'||offered)return;offered=true;
   try{const code=await this.direct.hostOffer();if(this.active(s)&&!s.upgraded)conn.send({type:'offer',code})}
   catch(error){this.fail(s,error.message)}
  };
  conn.on('open',opened);
  conn.on('data',async m=>{
   if(!this.active(s)||s.upgraded||!m||typeof m!=='object'||typeof m.code!=='string'||m.code.length>131072||s.handling)return;
   if(s.role==='guest'&&m.type==='offer'&&!answered){
    answered=true;s.handling=true;
    try{const code=await this.direct.guestAnswer(m.code);if(this.active(s)&&!s.upgraded)conn.send({type:'answer',code})}catch(error){this.fail(s,error.message)}finally{s.handling=false}
   }else if(s.role==='host'&&m.type==='answer'&&offered&&!answered){
    answered=true;s.handling=true;
    try{await this.direct.finishHost(m.code)}catch(error){this.fail(s,error.message)}finally{s.handling=false}
   }
  });
  conn.on('error',()=>this.fail(s,'Pairing failed. Check Wi-Fi and try again.'));
  conn.on('close',()=>{if(!s.upgraded&&!answered)this.fail(s,'Pairing closed. Create a new room.')});
  if(conn.open)opened();
 }
}
