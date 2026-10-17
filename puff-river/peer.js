const PREFIX="PUFF1",CODE_LIMIT=131072,SDP_LIMIT=90000,PACKET_LIMIT=65536;
const fail=text=>Object.assign(new Error(text),{puff:true});
const encode=value=>btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const decode=(input,kind)=>{
if(typeof input!=="string"||input.length>CODE_LIMIT*2)throw fail("That connection code is missing or too large. Copy the complete code again.");
const code=input.replace(/\s/g,"");
if(code.length>CODE_LIMIT)throw fail("That connection code is too large. Create a new invite.");
if(/^PUFF\d+:/.test(code)&&!code.startsWith(PREFIX+":"))throw fail("The phones have different game versions. Reload the game on both phones.");
const tag=kind==="offer"?"O":"A";
if(!code.startsWith(PREFIX+":"+tag+":"))throw fail(kind==="offer"?"Paste an invite code from the inviting phone.":"Paste the reply code from the joining phone.");
const body=code.slice(PREFIX.length+3);
if(!body||!/^[A-Za-z0-9_-]+$/.test(body)||body.length%4===1)throw fail("That connection code is damaged. Copy the complete code again.");
let data;
try{data=JSON.parse(decodeURIComponent(escape(atob(body.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-body.length%4)%4)))));}
catch{throw fail("That connection code is damaged. Copy the complete code again.");}
if(!data||Array.isArray(data)||typeof data!=="object"||Object.keys(data).sort().join(",")!=="kind,pair,sdp,v"||
data.v!==1||data.kind!==kind||typeof data.pair!=="string"||!/^[A-Za-z0-9_-]{22}$/.test(data.pair)||
typeof data.sdp!=="string"||data.sdp.length>SDP_LIMIT||!/^v=0\r?\n/.test(data.sdp)||
!/m=application /.test(data.sdp)||!/a=ice-ufrag:/.test(data.sdp)||!/a=ice-pwd:/.test(data.sdp)||!/a=candidate:/.test(data.sdp))
throw fail("That connection code is incomplete or from another game. Create a new invite.");
return data;
};
export class PeerLink{
constructor({onStatus=()=>{},onMessage=()=>{},onOpen=()=>{},onClose=()=>{},onInterrupted=()=>{},onRestored=()=>{}}={}){
this.callbacks={onStatus,onMessage,onOpen,onClose,onInterrupted,onRestored};
this.role=null;this.connected=false;this._s=null;
this._encoder=null;
}
get interrupted(){return !!this._s?.interrupted;}
_active(s){return this._s===s&&!s.closed;}
_guard(s){if(!this._active(s))throw fail("Connection setup was cancelled.");}
_emit(s,name,...args){if(this._active(s)){try{this.callbacks[name](...args);}catch{}}}
_fresh(role){
if(globalThis.isSecureContext===false)throw fail("Open the game from its secure HTTPS address before pairing.");
if(typeof RTCPeerConnection!=="function"||typeof TextEncoder!=="function"||!globalThis.crypto?.getRandomValues)
throw fail("This browser cannot make phone-to-phone connections. Try current Chrome or Safari.");
this.close();
let pc;
try{pc=new RTCPeerConnection({iceServers:[]});}
catch{throw fail("The browser could not create a connection. Reload the game and try again.");}
const s={pc,role,closed:false,ctrl:null,state:null,cancel:new Set(),lastRx:0,interrupted:false,
helloSent:false,helloReceived:false,ackSent:false,ackReceived:false,opened:false,applying:false,answered:false,
connectTimer:null,heartbeat:null,interruptTimer:null};
this._s=s;this.role=role;this.connected=false;this._encoder=new TextEncoder();
pc.onconnectionstatechange=()=>this._connection(s);
pc.oniceconnectionstatechange=()=>this._connection(s);
pc.ondatachannel=event=>{
if(!this._active(s)){try{event.channel.close();}catch{}return;}
if(role!=="guest"){try{event.channel.close();}catch{}return;}
this._channel(s,event.channel);
};
return s;
}
_stop(s){
if(!s||s.closed)return;
s.closed=true;
if(this._s===s){this._s=null;this.connected=false;this.role=null;}
clearTimeout(s.connectTimer);clearTimeout(s.interruptTimer);clearInterval(s.heartbeat);
for(const cancel of [...s.cancel])cancel();
s.cancel.clear();
s.pc.onconnectionstatechange=s.pc.oniceconnectionstatechange=s.pc.ondatachannel=null;
for(const ch of [s.ctrl,s.state])if(ch){
ch.onopen=ch.onmessage=ch.onclose=ch.onerror=null;try{ch.close();}catch{}
}
try{s.pc.close();}catch{}
}
close(){this._stop(this._s);}
send(data,reliable=true){const s=this._s;return !!(s?.opened&&this._wire(s,reliable?s.ctrl:s.state,{kind:"data",data}));}
_broken(s,reason){
if(!this._active(s))return;
const callback=this.callbacks.onClose;
this._emit(s,"onStatus",reason,true);
if(!this._active(s))return;
this._stop(s);
try{callback(reason);}catch{}
}
_error(error,fallback){return error?.puff?error:fail(fallback);}
async _gather(s){
this._guard(s);
if(s.pc.iceGatheringState!=="complete")await new Promise((resolve,reject)=>{
let timer;
const done=error=>{
clearTimeout(timer);s.pc.removeEventListener("icegatheringstatechange",change);s.cancel.delete(cancel);
error?reject(error):resolve();
};
const change=()=>{if(!this._active(s))done(fail("Connection setup was cancelled."));
else if(s.pc.iceGatheringState==="complete")done();};
const cancel=()=>done(fail("Connection setup was cancelled."));
s.cancel.add(cancel);s.pc.addEventListener("icegatheringstatechange",change);
timer=setTimeout(()=>done(fail("The browser could not finish gathering a connection. Keep this tab open and try again.")),20000);
change();
});
this._guard(s);
const description=s.pc.localDescription;
if(s.pc.iceGatheringState!=="complete"||!description?.sdp||description.sdp.length>SDP_LIMIT||
!/a=candidate:/.test(description.sdp))
throw fail("No local connection was found. Check Wi-Fi, keep this tab open, and create a new invite.");
return {v:1,kind:description.type,pair:s.pair,sdp:description.sdp};
}
async hostOffer(){
const s=this._fresh("host");
try{
const nonce=crypto.getRandomValues(new Uint8Array(16));
s.pair=btoa(String.fromCharCode(...nonce)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
this._channel(s,s.pc.createDataChannel("puff-control",{ordered:true}));
this._channel(s,s.pc.createDataChannel("puff-state",{ordered:false,maxRetransmits:0}));
const offer=await s.pc.createOffer();this._guard(s);
await s.pc.setLocalDescription(offer);this._guard(s);
const description=await this._gather(s);this._guard(s);
const code=PREFIX+":O:"+encode(description);
if(code.length>CODE_LIMIT)throw fail("The invite is too large. Reload the game and try again.");
this._emit(s,"onStatus","Invite ready. Copy it to the other phone.");
this._guard(s);return code;
}catch(error){
if(this._active(s))this._stop(s);
throw this._error(error,"Could not create the invite. Keep both phones on the same Wi-Fi and try again.");
}
}
async guestAnswer(invite){
const offer=decode(invite,"offer"),s=this._fresh("guest");s.pair=offer.pair;
try{
await s.pc.setRemoteDescription({type:"offer",sdp:offer.sdp});this._guard(s);
const answer=await s.pc.createAnswer();this._guard(s);
await s.pc.setLocalDescription(answer);this._guard(s);
const description=await this._gather(s);this._guard(s);
const code=PREFIX+":A:"+encode(description);
if(code.length>CODE_LIMIT)throw fail("The reply is too large. Reload the game and try again.");
this._watch(s);
this._emit(s,"onStatus","Reply ready. Copy it back to the inviting phone.");
this._guard(s);return code;
}catch(error){
if(this._active(s))this._stop(s);
throw this._error(error,"Could not use that invite. Create a fresh invite and copy it again.");
}
}
async finishHost(reply){
const s=this._s;
if(!s||s.role!=="host")throw fail("Create an invite before adding a reply.");
if(s.applying||s.answered)throw fail("This invite already has a reply. Create a new invite to pair again.");
const answer=decode(reply,"answer");
if(answer.pair!==s.pair)throw fail("That reply belongs to another invite. Use the reply to the current invite.");
s.applying=true;
try{
await s.pc.setRemoteDescription({type:"answer",sdp:answer.sdp});this._guard(s);
s.answered=true;s.applying=false;this._watch(s);
if(!s.opened)this._emit(s,"onStatus","Connecting to the other phone. Keep both tabs open.");
this._guard(s);
}catch(error){
if(this._active(s))s.applying=false;
throw this._error(error,"The reply does not match this invite or has expired. Create a fresh invite and pair again.");
}
}
_watch(s){
if(!this._active(s)||s.opened||s.connectTimer)return;
s.connectTimer=setTimeout(()=>this._broken(s,"The phones could not connect. Check the same Wi-Fi network and pair again."),90000);
}
_channel(s,ch){
if(!this._active(s))return;
const key=ch.label==="puff-control"?"ctrl":ch.label==="puff-state"?"state":null;
if(!key||s[key]||(key==="ctrl"&&(!ch.ordered||ch.maxRetransmits!=null||ch.maxPacketLifeTime!=null))||
(key==="state"&&(ch.ordered||ch.maxRetransmits!==0))){
try{ch.close();}catch{}return;
}
s[key]=ch;ch.binaryType="arraybuffer";
ch.onopen=()=>this._kick(s);
ch.onmessage=event=>this._receive(s,ch,event.data);
ch.onclose=()=>this._broken(s,"The connection closed. Pair the phones again.");
ch.onerror=()=>this._broken(s,"The connection had an error. Pair the phones again.");
this._kick(s);
}
_wire(s,ch,message){
if(!this._active(s)||ch?.readyState!=="open")return false;
try{
const text=JSON.stringify(message);
if(typeof text!=="string"||text.length>PACKET_LIMIT||text==='{"kind":"data"}')return false;
const bytes=this._encoder.encode(text).length,limit=ch===s.state?65536:131072;
if(bytes>PACKET_LIMIT||ch.bufferedAmount+bytes>limit)return false;
ch.send(text);return true;
}catch{return false;}
}
_kick(s){
if(!this._active(s)||s.ctrl?.readyState!=="open"||s.state?.readyState!=="open")return;
if(!s.helloSent){
s.helloSent=true;
if(!this._wire(s,s.ctrl,{kind:"hello",v:1,role:s.role})){
this._broken(s,"The connection handshake failed. Pair the phones again.");return;
}
}
if(s.helloReceived&&!s.ackSent){
s.ackSent=true;
if(!this._wire(s,s.ctrl,{kind:"hello-ack",v:1})){
this._broken(s,"The connection handshake failed. Pair the phones again.");return;
}
}
if(!s.opened&&s.helloSent&&s.helloReceived&&s.ackSent&&s.ackReceived){
s.opened=true;this.connected=true;s.lastRx=Date.now();s.interrupted=false;
clearTimeout(s.connectTimer);clearTimeout(s.interruptTimer);
s.heartbeat=setInterval(()=>{
if(!this._active(s))return;
const quiet=Date.now()-s.lastRx;
if(quiet>=15000){this._broken(s,"The other phone stopped responding. Keep both browsers open and pair again.");return;}
if(quiet>=6000)this._interrupt(s);
this._wire(s,s.ctrl,{kind:"ping"});
},2000);
this._emit(s,"onStatus","Both phones are connected.");
this._emit(s,"onOpen");
}
}
_receive(s,ch,text){
if(!this._active(s)||typeof text!=="string"||text.length>PACKET_LIMIT)return;
let message;
try{if(this._encoder.encode(text).length>PACKET_LIMIT)return;message=JSON.parse(text);}catch{return;}
if(!message||typeof message!=="object"||Array.isArray(message))return;
if(message.kind==="data"){
if(!s.opened||!Object.prototype.hasOwnProperty.call(message,"data"))return;
this._alive(s);this._emit(s,"onMessage",message.data);return;
}
if(ch!==s.ctrl)return;
if(message.kind==="hello"&&message.v===1&&message.role===(s.role==="host"?"guest":"host")){
s.helloReceived=true;this._kick(s);return;
}
if(message.kind==="hello-ack"&&message.v===1&&s.helloSent){
s.ackReceived=true;this._kick(s);return;
}
if(s.opened&&(message.kind==="ping"||message.kind==="pong")){
this._alive(s);if(message.kind==="ping")this._wire(s,s.ctrl,{kind:"pong"});
}
}
_alive(s){
s.lastRx=Date.now();
if(s.interrupted){
s.interrupted=false;clearTimeout(s.interruptTimer);s.interruptTimer=null;
this._emit(s,"onStatus","Connection restored.");this._emit(s,"onRestored");
}
}
_interrupt(s){
if(!this._active(s)||!s.opened||s.interrupted)return;
s.interrupted=true;
this._emit(s,"onStatus","Connection interrupted. Keep both browsers open.");this._emit(s,"onInterrupted");
if(!this._active(s))return;
s.interruptTimer=setTimeout(()=>this._broken(s,"The connection was lost. Keep both phones on the same Wi-Fi and pair again."),15000);
}
_connection(s){
if(!this._active(s))return;
const state=s.pc.connectionState,ice=s.pc.iceConnectionState;
if(state==="failed"||ice==="failed"){this._broken(s,"The phones could not stay connected. Check Wi-Fi and pair again.");return;}
if(state==="closed"||ice==="closed"){this._broken(s,"The connection closed. Pair the phones again.");return;}
if(s.opened&&(state==="disconnected"||ice==="disconnected"))this._interrupt(s);
else if(state==="connected"||ice==="connected"||ice==="completed"){
if(s.opened&&Date.now()-s.lastRx<6000)this._alive(s);
this._kick(s);
}
}
}
