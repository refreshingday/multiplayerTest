import {isLight,segmentRect,arenaBounds,movePlayer,obstaclesFor,autoAttackInput,normalizeInput,LIMITS,stepPlayer,advanceAttack,handPosition,ATTACK,hasBuff,projectiles,stats} from './game-core-v23.js';
export const TICK=1/60;
export class RemoteInputs{
 constructor(playerId=1){this.playerId=playerId;this.reset()}
 reset(){this.done=0;this.queue=new Map();this.budget=.08}
 add(frames){
  if(!Array.isArray(frames)||frames.length>120)return false;
  for(const f of frames)if(!f||!Number.isSafeInteger(f.n)||f.n<1||!f.i||typeof f.i!=='object')return false;
  for(const f of frames)if(f.n>this.done&&f.n<=this.done+240&&!this.queue.has(f.n))this.queue.set(f.n,normalizeInput(f.i));
  return true;
 }
 consume(state,dt){
  if(state.paused||state.over||state.upgrade||state.phase!=='combat')return;
  this.budget=Math.min(.12,this.budget+Math.max(0,dt));
  while(this.budget+1e-9>=TICK&&this.queue.has(this.done+1)){
   const i=this.queue.get(++this.done);this.queue.delete(this.done);this.budget-=TICK;
   const p=state.players[this.playerId];if(p?.active&&p.hp>0)stepPlayer(state,p,i,TICK);
  }
 }
}
export class LocalPrediction{
 constructor(playerId=1){this.playerId=playerId;this.reset()}
 setPlayerId(id){this.playerId=id;this.reset();}
 reset(){this.player=null;this.frames=[];this.n=0;this.acc=0;this.offset={x:0,z:0};this.flash=0;this.latest=null;this.events=[]}
 reconcile(state,done=0,changed=false){
  const p=state.players[this.playerId];if(!p)return;
  if(changed){this.reset();this.player={...p,buffs:{...p.buffs},perks:{...p.perks}};this.latest=state;return}
  const before=this.player&&{x:this.player.x+this.offset.x,z:this.player.z+this.offset.z},oldHp=this.player?.hp,oldPush=this.player?.pushId;
  if(Number.isSafeInteger(done)&&done>=0&&done<=this.n)this.frames=this.frames.filter(f=>f.n>done);
  this.player={...p,buffs:{...p.buffs},perks:{...p.perks}};this.latest=state;
  for(const f of this.frames)if(!state.paused&&!state.over&&!state.upgrade&&state.phase==='combat'&&this.player.hp>0&&!isLight(this.player)){movePlayer(this.player,f.i,TICK,obstaclesFor(state),arenaBounds(state));const combat=autoAttackInput(state,this.player,f.i);this.player.ax=combat.ax;this.player.az=combat.az;advanceAttack(this.player,combat,TICK)}
  const dx=before?before.x-this.player.x:0,dz=before?before.z-this.player.z:0;
  this.offset=oldPush===p.pushId&&!state.paused&&!state.upgrade&&state.phase==='combat'&&oldHp>0&&p.hp>0&&Math.hypot(dx,dz)<.8?{x:dx,z:dz}:{x:0,z:0};
 }
 step(i,dt,running){
  this.flash=Math.max(0,this.flash-dt);this.offset.x*=Math.exp(-dt/ .075);this.offset.z*=Math.exp(-dt/ .075);
  if(!this.player||!this.player.active||!running||this.latest?.paused||this.latest?.over||this.latest?.upgrade||this.latest?.phase!=='combat'){this.acc=0;return true}
  this.acc+=Math.min(2,Math.max(0,dt));const normalized=this.player.hp>0?normalizeInput(i):normalizeInput({});
  while(this.acc+1e-9>=TICK){
   if(this.frames.length>=120)return false;
   this.acc-=TICK;this.frames.push({n:++this.n,i:{...normalized}});
   if(this.player.hp>0&&!isLight(this.player)){
    this.player.pushPulse=Math.max(0,(this.player.pushPulse||0)-TICK);movePlayer(this.player,normalized,TICK,obstaclesFor(this.latest),arenaBounds(this.latest));
    const combat=autoAttackInput(this.latest,this.player,normalized);this.player.ax=combat.ax;this.player.az=combat.az;
    advanceAttack(this.player,combat,TICK,(type,caster)=>{if(type==='charge'||type==='cast'){const pos=handPosition(caster);this.events.push({type,owner:this.playerId,element:caster.hero,a:caster.attackId,ax:caster.ax,az:caster.az,...pos,shots:projectiles(caster),predicted:true});if(type==='cast')this.flash=.08;}})
   }
  }
  return true;
 }
 drainEvents(){const events=this.events;this.events=[];return events;}
 packet(){return this.frames.map(f=>({n:f.n,i:{...f.i}}))}
 view(){if(!this.player)return null;const bounds=arenaBounds(this.latest);return{...this.player,x:Math.max(-bounds.x+.4,Math.min(bounds.x-.4,this.player.x+this.offset.x)),z:Math.max(-bounds.z+.4,Math.min(bounds.z-.4,this.player.z+this.offset.z))}}
}
export class SmoothWorld{
 constructor({minimumDelay=80,maximumDelay=220}={}){this.minimumDelay=minimumDelay;this.maximumDelay=maximumDelay;this.reset();}
 reset(){this.frames=[];this.latest=null;this.at=0;this.interval=50;this.jitter=0;this.delay=this.minimumDelay;this.cursor=null;}
 push(s,time,changed=false){
  const old=this.latest;
  if(changed||old&&(old.wave!==s.wave||old.mapId!==s.mapId||old.phase!==s.phase||old.paused!==s.paused)){this.reset();}
  if(this.latest){const gap=time-this.at;if(gap>0){const error=Math.abs(gap-this.interval);this.interval+=.15*(Math.max(15,Math.min(300,gap))-this.interval);this.jitter+=.15*(error-this.jitter);}}
  this.latest=s;this.at=time;
  const last=this.frames.at(-1);if(last&&last.time===time)last.s=s;else this.frames.push({s,time});
  while(this.frames.length>24||this.frames.length>2&&time-this.frames[0].time>1200)this.frames.shift();
 }
 view(time,own){
  const s=this.latest;if(!s)return null;
  const targetDelay=Math.max(this.minimumDelay,Math.min(this.maximumDelay,this.interval*1.5+this.jitter*2));
  this.delay+=.08*(targetDelay-this.delay);
  const wanted=time-this.delay;this.cursor=this.cursor===null?wanted:Math.max(this.cursor,wanted);
  const frames=this.frames;let a=frames[0],b=a;
  for(let i=1;i<frames.length;i++){b=frames[i];if(b.time>=this.cursor)break;a=b;}
  if(this.cursor>=frames.at(-1).time){b=frames.at(-1);a=frames.length>1?frames.at(-2):b;}
  const span=Math.max(1,b.time-a.time),mix=Math.max(0,Math.min(1,(this.cursor-a.time)/span));
  const running=!s.paused&&!s.over&&s.phase==='combat',extra=running?Math.min(.12,Math.max(0,(this.cursor-b.time)/1000)):0;
  const simSpan=b.s.time-a.s.time,velocityDt=simSpan>0?simSpan:span/1000,bounds=arenaBounds(s);
  const blend=(key,radius)=>{
   const oldById=new Map((a.s[key]||[]).map(e=>[e.id,e])),newById=new Map((b.s[key]||[]).map(e=>[e.id,e]));
   return(s[key]||[]).map(current=>{
    const from=oldById.get(current.id),to=newById.get(current.id);
    if(!from||!to||current.active===false||current.hp<=0||from.hp<=0||to.hp<=0||from.active!==to.active||isLight(current)||isLight(from)||isLight(to)||from.pushId!==to.pushId||Math.hypot(to.x-from.x,to.z-from.z)>4)return{...current};
    let x=from.x+(to.x-from.x)*mix,z=from.z+(to.z-from.z)*mix;
    if(extra>0&&velocityDt>0){let vx=(to.x-from.x)/velocityDt,vz=(to.z-from.z)/velocityDt;const speed=Math.hypot(vx,vz),limit=key==='players'?stats(current).moveSpeed:Math.max(current.speed||0,current.dash>0?6.8:0);if(speed>limit&&speed>0){vx*=limit/speed;vz*=limit/speed;}
     let dx=vx*extra,dz=vz*extra,t=1;
     for(const o of obstaclesFor(s)){const hit=segmentRect(to.x,to.z,dx,dz,o,radius);if(hit!==null)t=Math.min(t,Math.max(0,hit-.01));}
     x=Math.max(-bounds.x+radius,Math.min(bounds.x-radius,to.x+dx*t));z=Math.max(-bounds.z+radius,Math.min(bounds.z-radius,to.z+dz*t));
    }
    const out={...current,x,z};
    if(Number.isFinite(from.ax)&&Number.isFinite(to.ax)){const ax=from.ax+(to.ax-from.ax)*mix,az=from.az+(to.az-from.az)*mix,n=Math.hypot(ax,az);if(n>.001){out.ax=ax/n;out.az=az/n;}}
    return out;
   });
  };
  const age=running?Math.min(.12,Math.max(0,(time-this.at)/1000)):0,players=blend('players',.4).map(p=>p.charging?{...p,charge:Math.min(ATTACK.charge,(p.charge||0)+age*stats(p).castRate)}:p);
  if(own)players[own.id]=own;
  return{...s,players,enemies:blend('enemies',.36).map(e=>({...e,hit:Math.max(0,(e.hit||0)-age),spawn:Math.max(0,(e.spawn||0)-age),poison:Math.max(0,(e.poison||0)-age),slow:Math.max(0,(e.slow||0)-age)})),
   enemyShots:(s.enemyShots||[]).map(b=>({...b,x:b.x+b.vx*age,z:b.z+b.vz*age})),bullets:(s.bullets||[]).map(b=>({...b,x:b.x+b.vx*age,z:b.z+b.vz*age}))};
 }
}
