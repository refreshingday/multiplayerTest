import {normalizeInput,stepCaptain,stepPuffPower,territory,COURSE_LENGTH,PUFF} from './core.js?v=1.2.0';
import {createCrew,stepVoyage,voyageCourse} from './crew-core.js?v=1.2.0';
export const PROTOCOL=4,TICK=1/60,MAX_FRAMES=120;
const copy=value=>structuredClone(value),empty=()=>normalizeInput();
export class RemoteCaptain{
 constructor(now=0){this.done=0;this.frames=new Map();this.at=now;this.appliedAt=now;this.held=false;}
 add(frames,now){
  if(!Array.isArray(frames)||frames.length>MAX_FRAMES)return false;
  for(const f of frames)if(f&&Number.isSafeInteger(f.n)&&f.n>this.done&&f.n<=this.done+MAX_FRAMES)this.frames.set(f.n,normalizeInput(f.input));
  this.at=now;return true;
 }
 consume(p,count,now){
  const input=this.frames.get(this.done+1);
  if(input){this.frames.delete(++this.done);this.appliedAt=now;this.held=input.boost;stepCaptain(p,input,TICK,count,p.seat);}
  else{
   if(now-this.appliedAt>250||now-this.at>250)this.held=false;
   stepPuffPower(p,this.held,TICK);
  }
  if(now-this.at>250)p.boosting=false;
 }
}
export function validSnapshot(s){
 if(!s||!['lobby','playing','paused','won','lost'].includes(s.phase)||!Number.isInteger(s.playerCount)||s.playerCount<1||s.playerCount>4||!Array.isArray(s.players)||s.players.length<1||s.players.length>4)return false;
 if(!['x','vx','distance','speed','lives','beans','time','invincible','rollX','rollZ','rollVX','rollVZ','rapids','seed','run'].every(k=>Number.isFinite(s[k])))return false;
 if(Math.abs(s.x)>13||s.distance<0||s.distance>COURSE_LENGTH||s.lives<0||s.lives>3||!Number.isInteger(s.run)||s.run<1)return false;
 const ids=new Set(),seats=new Set();
 for(const p of s.players){
  if(!p||!Number.isInteger(p.id)||p.id<0||p.id>3||ids.has(p.id)||!Number.isInteger(p.seat)||p.seat<0||p.seat>=s.playerCount||seats.has(p.seat)||!Number.isFinite(p.angle)||!Number.isFinite(p.fuel)||p.fuel<0||p.fuel>100||!Number.isFinite(p.powerTime)||p.powerTime<0||p.powerTime>PUFF.powerDuration)return false;
  if(!['active','connected','visible','ready','restart','boosting'].every(k=>typeof p[k]==='boolean'))return false;
  const area=territory(s.playerCount,p.seat);if(!area.unrestricted&&(p.angle<area.min-1e-6||p.angle>area.max+1e-6))return false;
  ids.add(p.id);seats.add(p.seat);
 }
 return ids.has(0)&&Array.isArray(s.hitIds)&&s.hitIds.length<=100&&s.hitIds.every(id=>Number.isInteger(id)&&id>=0&&id<100)&&Array.isArray(s.events)&&s.events.length<=12&&s.events.every(e=>e&&Number.isSafeInteger(e.id)&&['hit','bean'].includes(e.type));
}
// The host owns the raft and collisions. Guests replay only their own unacknowledged captain ticks.
export class RiverSession{
 constructor({transport,now=()=>performance.now(),onChange=()=>{},onStatus=()=>{}}={}){
  this.transport=transport;this.now=now;this.onChange=onChange;this.onStatus=onStatus;this.reset();
 }
 reset(){this.role=null;this.localId=0;this.state=null;this.course=[];this.epoch=0;this.run=0;this.q=0;this.lastQ=-1;this.acc=0;this.sendAt=-Infinity;this.snapshotAt=-Infinity;this.lastStateAt=this.now();this.helloAt=-Infinity;this.seq=0;this.frames=[];this.predicted=null;this.rendered=null;this.remotes=new Map();this.controlAck={};this.actionSeq=0;this.pending=new Map();this.recovering=new Set();this.syncNeeds=new Map();this.autoResume=false;this.waiting=false;this.recoveringLocal=false;this.visible=true;this.stopped=false;}
 get local(){return this.state?.players.find(p=>p.id===this.localId);}
 get members(){return this.state?.players.filter(p=>p.active)||[];}
 prepare(role){this.reset();this.role=role;if(role==='host'){this.state=createCrew();this.state.run=++this.run;this.course=voyageCourse(this.state);this.epoch=1;}this.changed();}
 changed(){this.onChange(this);}
 opened(){if(this.role==='guest'){this.localId=this.transport.localId;this.hello(true);}this.changed();}
 hello(force=false){const at=this.now();if(this.role==='guest'&&(force||at-this.helloAt>=500)){this.helloAt=at;this.transport.send({t:'hello',v:PROTOCOL,visible:this.visible},true);}}
 advanceEpoch(){
  this.epoch++;this.acc=0;this.frames=[];this.seq=0;this.remotes.clear();this.syncNeeds.clear();
  for(const p of this.members){p.boosting=false;if(p.id!==0)this.remotes.set(p.id,new RemoteCaptain(this.now()));}
  for(const id of this.recovering)if(this.members.some(p=>p.id===id&&p.connected))this.sync(id);
 }
 joined(id){
  if(this.role!=='host'||!Number.isInteger(id)||id<1||id>3||this.state.players.some(p=>p.id===id&&p.active))return;
  if(this.state.phase!=='lobby'||this.transport.locked)return;
  const ids=[...this.members.map(p=>p.id),id];this.state=createCrew(ids,this.state.seed);this.state.run=this.run;this.advanceEpoch();this.controlAck[id]=0;this.broadcast(true);this.changed();
 }
 left(id){
  if(this.role!=='host')return;const p=this.state.players.find(p=>p.id===id);if(!p)return;
  p.active=p.connected=p.ready=p.boosting=false;this.recovering.delete(id);this.syncNeeds.delete(id);this.autoResume=false;
  if(this.state.phase==='lobby'&&!this.transport.locked){this.state=createCrew(this.members.map(p=>p.id),this.state.seed);this.state.run=this.run;}
  else if(this.state.phase==='playing'||this.state.phase==='paused'){this.state.phase='paused';this.state.reason='A captain left. Remaining crew, tap Ready to continue.';}
  for(const member of this.members)member.ready=false;this.advanceEpoch();this.broadcast(true);this.changed();
 }
 snapshot(reliable=false,target=null,sync=false){
  if(this.role!=='host'||!this.state)return;
  const q=++this.q,ack=Object.fromEntries([...this.remotes].map(([id,r])=>[id,r.done]));
  for(const p of this.members){if(p.id===0||target!==null&&target!==p.id||!p.connected)continue;
   if(sync)this.syncNeeds.set(p.id,{epoch:this.epoch,q});
   this.transport.send({t:'state',v:PROTOCOL,epoch:this.epoch,q,you:p.id,s:copy(this.state),ack,controlAck:{...this.controlAck},sync},reliable,p.id);
  }
 }
 broadcast(reliable=false){this.snapshotAt=this.now();this.snapshot(reliable);}
 sync(id){this.snapshot(true,id,true);}
 connected(){return this.members.every(p=>p.connected&&p.visible)&&!this.recovering.size&&!this.syncNeeds.size;}
 pause(reason='A captain paused. Everyone tap Ready to resume.',manual=true){
  if(this.role==='guest'){this.action('pause');return;}
  if(this.role!=='host'||!['playing','paused'].includes(this.state.phase))return;
  if(manual)this.autoResume=false;this.state.phase='paused';this.state.reason=reason;for(const p of this.members)p.ready=false;
  this.advanceEpoch();this.broadcast(true);this.changed();
 }
 action(type){
  if(!['ready','pause','restart'].includes(type)||!this.state)return;
  if(this.role==='host'){this.applyAction(0,type);return;}
  if(this.waiting||!this.transport.connected||[...this.pending.values()].some(p=>p.message.type===type))return;
  const a=++this.actionSeq,message={t:'action',v:PROTOCOL,epoch:this.epoch,a,type};this.pending.set(a,{message,at:this.now()});this.transport.send(message,true);this.changed();
 }
 applyAction(id,type){
  const p=this.state.players.find(p=>p.id===id&&p.active);if(!p||!p.connected||!p.visible)return;
  if(type==='pause'){this.pause();return;}
  if(type==='ready'&&['lobby','paused'].includes(this.state.phase)&&!this.recovering.size&&!this.syncNeeds.size){
   p.ready=true;
   if(this.connected()&&this.members.every(p=>p.ready)){
    this.state.phase='playing';this.state.reason='';this.autoResume=false;this.transport.lock();this.advanceEpoch();for(const member of this.members)member.ready=false;
   }
  }
  if(type==='restart'&&['won','lost','paused'].includes(this.state.phase)&&this.connected()){
   p.restart=true;
   if(this.members.every(p=>p.restart)){
    const ids=this.members.map(p=>p.id),seed=this.state.seed;this.state=createCrew(ids,seed);this.state.run=++this.run;this.course=voyageCourse(this.state);this.advanceEpoch();this.autoResume=false;
   }
  }
  this.broadcast(true);this.changed();
 }
 visibility(visible){
  const changed=this.visible!==visible;this.visible=visible;
  if(this.role==='host'&&this.local){this.local.visible=visible;if(!visible&&changed)this.pause('Host tab is hidden. Everyone tap Ready when back.');else if(changed)this.broadcast(true);}
  if(this.role==='guest'&&changed)this.transport.send({t:'visible',v:PROTOCOL,visible},true);
 }
 reconnecting(id){
  if(this.role==='guest'){this.waiting=this.recoveringLocal=true;this.frames=[];this.predicted=null;this.changed();return;}
  const p=this.state?.players.find(p=>p.id===id&&p.active);if(!p||this.recovering.has(id))return;
  if(!this.recovering.size)this.autoResume=this.state.phase==='playing';this.recovering.add(id);p.connected=p.boosting=false;
  if(['playing','paused'].includes(this.state.phase))this.pause('Waiting for a captain to reconnect. Keep every game tab open.',false);
  else {for(const member of this.members)member.ready=false;this.advanceEpoch();this.broadcast(true);this.changed();}
  for(const other of this.syncNeeds.keys())if(this.members.some(p=>p.id===other&&p.connected))this.sync(other);
 }
 reconnected(id){
  if(this.role==='guest'){this.localId=this.transport.localId;this.waiting=this.recoveringLocal=true;this.hello(true);this.changed();return;}
  const p=this.state?.players.find(p=>p.id===id&&p.active);if(!p)return;p.connected=true;this.sync(id);this.changed();
 }
 tryRecovery(){
  if(this.role!=='host')return;
  if(this.autoResume&&this.connected()&&this.state.phase==='paused'){
   this.state.phase='playing';this.state.reason='';this.autoResume=false;this.advanceEpoch();for(const p of this.members)p.ready=false;this.broadcast(true);this.changed();
  }
 }
 receive(m,from=0){
  if(!m||typeof m!=='object'||m.v!==PROTOCOL)return;
  if(this.role==='host'){
   const p=this.state?.players.find(p=>p.id===from&&p.active);if(!p||from===0)return;
   if(m.t==='hello'){
    if(typeof m.visible==='boolean')p.visible=m.visible;
    if(this.transport.isConnected(from)){p.connected=true;this.sync(from);}return;
   }
   if(m.t==='synced'){
    const need=this.syncNeeds.get(from);
    if(!need||m.epoch!==this.epoch||m.epoch!==need.epoch||!Number.isSafeInteger(m.q)||m.q<need.q||m.q>this.q)return;
    if(typeof m.visible==='boolean')p.visible=m.visible;this.syncNeeds.delete(from);this.recovering.delete(from);p.connected=true;
    this.tryRecovery();this.broadcast(true);this.changed();return;
   }
   if(m.t==='visible'||m.t==='input'){
    if(typeof m.visible!=='boolean')return;const was=p.visible;p.visible=m.visible;
    if(was&&!p.visible&&this.state.phase==='playing')this.pause('A captain switched tabs. Everyone tap Ready when back.');
    if(m.t==='visible'){this.tryRecovery();this.broadcast(true);this.changed();return;}
    if(m.epoch!==this.epoch||!p.connected||this.recovering.has(from)||this.syncNeeds.has(from))return;
    let remote=this.remotes.get(from);if(!remote){remote=new RemoteCaptain(this.now());this.remotes.set(from,remote);}remote.add(m.frames,this.now());return;
   }
   if(m.t==='action'&&m.epoch===this.epoch&&Number.isSafeInteger(m.a)&&m.a>0&&['ready','pause','restart'].includes(m.type)){
    if(m.a>(this.controlAck[from]||0)){this.controlAck[from]=m.a;this.applyAction(from,m.type);}else this.snapshot(true,from);
   }
   return;
  }
  if(this.role!=='guest'||from!==0||m.t!=='state'||!Number.isSafeInteger(m.epoch)||m.epoch<this.epoch||!Number.isSafeInteger(m.q)||m.q<1||!Number.isInteger(m.you)||m.you<1||m.you>3||!validSnapshot(m.s)||!m.s.players.some(p=>p.id===m.you&&p.active))return;
  if(m.q<=this.lastQ){if(m.sync&&m.epoch===this.epoch)this.transport.send({t:'synced',v:PROTOCOL,epoch:this.epoch,q:this.lastQ,visible:this.visible},true);return;}
  const ack=m.ack?.[m.you]??0;if(!Number.isSafeInteger(ack)||ack<0||ack>this.seq&&m.epoch===this.epoch)return;
  const epochChanged=m.epoch!==this.epoch,runChanged=this.state?.run!==m.s.run;
  if(epochChanged){this.frames=[];this.seq=0;this.acc=0;this.pending.clear();}
  this.epoch=m.epoch;this.lastQ=m.q;this.localId=m.you;this.state=copy(m.s);this.lastStateAt=this.now();this.helloAt=this.now();
  if(runChanged)this.course=voyageCourse(this.state);
  this.frames=this.frames.filter(f=>f.n>ack);
  this.predicted=copy(this.local);if(this.state.phase==='playing')for(const f of this.frames)stepCaptain(this.predicted,f.input,TICK,this.state.playerCount,this.predicted.seat);
  for(const a of this.pending.keys())if(a<=(m.controlAck?.[this.localId]||0))this.pending.delete(a);
  if(m.sync){this.waiting=this.recoveringLocal=false;this.transport.send({t:'synced',v:PROTOCOL,epoch:this.epoch,q:m.q,visible:this.visible},true);}
  else if(!this.recoveringLocal)this.waiting=false;
  this.changed();
 }
 update(dt,input={},visible=true){
  if(!this.role)return;this.visibility(visible);const at=this.now();
  if(this.role==='guest'){
   if(!this.state||this.recoveringLocal)this.hello();
   if(this.state?.phase==='playing'&&at-this.lastStateAt>1500&&!this.waiting){this.waiting=true;this.frames=[];this.predicted=null;this.changed();}
   if(this.state&&at-this.lastStateAt>3000){this.transport.requestReconnect();this.hello();}
   if(this.state?.phase==='playing'&&!this.waiting&&visible){
    this.acc+=Math.min(2,Math.max(0,dt));let loops=0;
    while(this.acc+1e-9>=TICK&&loops++<12){
     if(this.frames.length>=MAX_FRAMES){this.waiting=true;this.predicted=null;this.changed();break;}
     const frame={n:++this.seq,input:normalizeInput(input)};this.frames.push(frame);this.predicted??=copy(this.local);stepCaptain(this.predicted,frame.input,TICK,this.state.playerCount,this.predicted.seat);this.acc-=TICK;
    }
   }else this.acc=0;
   if(this.state&&at-this.sendAt>=50){this.sendAt=at;this.transport.send({t:'input',v:PROTOCOL,epoch:this.epoch,visible,frames:this.frames.slice(-MAX_FRAMES)},false);}
   for(const item of this.pending.values())if(at-item.at>=300){item.at=at;this.transport.send(item.message,true);}
   return;
  }
  if(this.state.phase==='playing'){
   for(const p of this.members)if(p.id!==0&&p.connected&&!this.syncNeeds.has(p.id)&&at-(this.remotes.get(p.id)?.at??at)>1500){this.reconnecting(p.id);this.transport.requestReconnect(p.id);break;}
   if(dt>2)this.pause('The game stopped responding briefly. Everyone tap Ready to continue.');
   if(this.state.phase==='playing'){
    this.acc+=Math.max(0,Math.min(2,dt));let loops=0;
    while(this.acc+1e-9>=TICK&&loops++<12&&this.state.phase==='playing'){
     const external=[];for(const p of this.members)if(p.id!==0){this.remotes.get(p.id)?.consume(p,this.state.playerCount,at);external.push(p.id);}
     stepVoyage(this.state,{0:visible?normalizeInput(input):empty()},this.course,TICK,external);this.acc-=TICK;
    }
    if(['won','lost'].includes(this.state.phase)){this.advanceEpoch();this.broadcast(true);this.changed();}
   }
  }else this.acc=0;
  if(at-this.snapshotAt>=66)this.broadcast();
 }
 renderState(dt){
  if(!this.state)return null;
  if(this.role==='host')return this.state;
  // Boat motion is smoothed; the local captain uses reconciled immediate prediction.
  const next=copy(this.state);
  if(this.rendered&&next.phase==='playing'&&this.rendered.run===next.run&&this.rendered.epoch===this.epoch&&!this.waiting){
   const blend=1-Math.exp(-18*Math.min(.1,Math.max(0,dt)));
   for(const key of ['x','distance','rollX','rollZ'])next[key]=this.rendered[key]+(next[key]-this.rendered[key])*blend;
   for(const p of next.players)if(p.id!==this.localId){const old=this.rendered.players.find(x=>x.id===p.id);if(old){const delta=Math.atan2(Math.sin(p.angle-old.angle),Math.cos(p.angle-old.angle));p.angle=old.angle+delta*blend;}}
  }
  if(this.predicted&&next.phase==='playing'&&!this.waiting)Object.assign(next.players.find(p=>p.id===this.localId),this.predicted);
  next.epoch=this.epoch;this.rendered=next;return next;
 }
}
