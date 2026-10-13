import {moveCircle,normalizeInput,LIMITS} from './game-core.js';
export const TICK=1/60;
export class RemoteInputs{
 constructor(){this.reset()}
 reset(){this.done=0;this.queue=new Map();this.budget=.08}
 add(frames){
  if(!Array.isArray(frames)||frames.length>60)return false;
  for(const f of frames)if(!f||!Number.isSafeInteger(f.n)||f.n<1||!f.i||typeof f.i!=='object')return false;
  for(const f of frames)if(f.n>this.done&&f.n<=this.done+120&&!this.queue.has(f.n))this.queue.set(f.n,normalizeInput(f.i));
  return true;
 }
 consume(state,dt){
  this.budget=Math.min(.12,this.budget+Math.max(0,dt));
  while(this.budget+1e-9>=TICK&&this.queue.has(this.done+1)){
   const i=this.queue.get(++this.done);this.queue.delete(this.done);this.budget-=TICK;
   const p=state.players[1];if(p?.hp>0)moveCircle(p,i.x*4.4*TICK,i.z*4.4*TICK,.4);
  }
 }
}
export class LocalPrediction{
 constructor(){this.reset()}
 reset(){this.player=null;this.frames=[];this.n=0;this.acc=0;this.offset={x:0,z:0};this.flash=0;this.latest=null}
 reconcile(state,done=0,changed=false){
  const p=state.players[1];if(!p)return;
  if(changed){this.reset();this.player={...p};this.latest=state;return}
  const before=this.player&&{x:this.player.x+this.offset.x,z:this.player.z+this.offset.z},oldHp=this.player?.hp;
  if(Number.isSafeInteger(done)&&done>=0&&done<=this.n)this.frames=this.frames.filter(f=>f.n>done);
  this.player={...p};this.latest=state;
  for(const f of this.frames)if(this.player.hp>0){moveCircle(this.player,f.i.x*4.4*TICK,f.i.z*4.4*TICK,.4);this.player.ax=f.i.ax;this.player.az=f.i.az}
  const dx=before?before.x-this.player.x:0,dz=before?before.z-this.player.z:0;
  this.offset=!state.paused&&oldHp>0&&p.hp>0&&Math.hypot(dx,dz)<.8?{x:dx,z:dz}:{x:0,z:0};
 }
 step(i,dt,running){
  this.flash=Math.max(0,this.flash-dt);this.offset.x*=Math.exp(-dt/ .075);this.offset.z*=Math.exp(-dt/ .075);
  if(!this.player||!running){this.acc=0;return true}
  this.acc+=Math.min(.15,Math.max(0,dt));const normalized=this.player.hp>0?normalizeInput(i):normalizeInput({});
  while(this.acc+1e-9>=TICK){
   if(this.frames.length>=60)return false;
   this.acc-=TICK;this.frames.push({n:++this.n,i:{...normalized}});
   this.player.cool=Math.max(0,(this.player.cool||0)-TICK);
   if(this.player.hp>0){
    moveCircle(this.player,normalized.x*4.4*TICK,normalized.z*4.4*TICK,.4);
    this.player.ax=normalized.ax;this.player.az=normalized.az;
    if(normalized.fire&&this.player.cool<=0){this.flash=.08;this.player.cool=.14}
   }
  }
  return true;
 }
 packet(){return this.frames.map(f=>({n:f.n,i:{...f.i}}))}
 view(){if(!this.player)return null;return{...this.player,x:Math.max(-LIMITS.x+.4,Math.min(LIMITS.x-.4,this.player.x+this.offset.x)),z:Math.max(-LIMITS.z+.4,Math.min(LIMITS.z-.4,this.player.z+this.offset.z))}}
}
export class SmoothWorld{
 constructor(){this.reset()}
 reset(){this.previous=null;this.latest=null;this.at=0;this.interval=50}
 push(s,time,changed=false){
  this.interval=this.at?Math.max(25,Math.min(120,time-this.at)):50;
  this.previous=changed?null:this.latest;this.latest=s;this.at=time;
 }
 view(time,own){
  const s=this.latest;if(!s)return null;
  const mix=Math.min(1,Math.max(0,(time-this.at)/this.interval)),old=this.previous;
  const blend=(list,previous)=>{const byId=new Map((previous||[]).map(x=>[x.id,x]));return list.map(x=>{const p=byId.get(x.id);return p?{...x,x:p.x+(x.x-p.x)*mix,z:p.z+(x.z-p.z)*mix}:{...x}})};
  const players=blend(s.players,old?.players);if(own)players[1]=own;
  const age=s.paused?0:Math.min(.1,Math.max(0,(time-this.at)/1000));
  return{...s,players,enemies:blend(s.enemies,old?.enemies),bullets:s.bullets.map(b=>({...b,x:b.x+b.vx*age,z:b.z+b.vz*age}))};
 }
}
