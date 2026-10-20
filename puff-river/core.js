import {RIVER_HALF_WIDTH,RAFT_RADIUS,bankLimits} from './river.js';
export {RIVER_HALF_WIDTH,RAFT_RADIUS,bankLimits,riverFrame,riverPoint,shorePoint,BEND_LENGTH,BEND_AMPLITUDE} from './river.js';
export const COURSE_LENGTH = 400;
export const PLAYER_RADIUS = RAFT_RADIUS + .12;
// Shared with the renderer: contact begins when the visible rim reaches the visible shore.
export const BANK_CONTACT_X = RIVER_HALF_WIDTH - RAFT_RADIUS;
export const RAPIDS = [72, 157, 242, 327];
const TAU = Math.PI * 2;
export function territory(playerCount=1, playerIndex=0){
 const count=Math.max(1,Math.min(4,Math.floor(playerCount)||1));
 const index=Math.max(0,Math.min(count-1,Math.floor(playerIndex)||0));
 const arc=TAU/count,center=index*arc;
 return {count,index,arc,center,min:center-arc/2,max:center+arc/2,unrestricted:count===1};
}
export function outward(angle){return {x:Math.sin(angle),z:-Math.cos(angle)};}
export function facing(angle){const d=outward(angle);return {x:-d.x,z:-d.z};}
export function joystickAngle(x,y){const yaw=Math.atan2(8,21);const wx=x*Math.cos(yaw)-y*Math.sin(yaw),wz=-x*Math.sin(yaw)-y*Math.cos(yaw);return Math.atan2(wx,-wz);}
function angleDelta(from,to){return ((to-from+Math.PI)%TAU+TAU)%TAU-Math.PI;}
export function rapidStrength(distance){for(const start of RAPIDS){const t=(distance-start)/12;if(t>=0&&t<=1)return Math.sin(t*Math.PI);}return 0;}
export function createState(playerCount=1,playerIndex=0){
 const area=territory(playerCount,playerIndex);
 return {phase:'menu',playerCount:area.count,playerIndex:area.index,x:0,vx:0,distance:0,speed:0,angle:area.center,fuel:100,lives:3,beans:0,invincible:0,time:0,boosting:false,rollX:0,rollZ:0,rollVX:0,rollVZ:0,rapids:0};
}
export function normalizeInput(input={}){
 return {left:input?.left===true,right:input?.right===true,boost:input?.boost===true,aimAngle:Number.isFinite(input?.aimAngle)?Math.atan2(Math.sin(input.aimAngle),Math.cos(input.aimAngle)):null};
}
export function stepPuffPower(p,held,dt){
 // Holding an empty tank must never regenerate tiny, immediately usable bursts.
 if(!held){p.boosting=false;p.fuel=Math.min(100,p.fuel+14*dt);return;}
 const remaining=p.fuel-25*dt;p.fuel=remaining>1e-8?remaining:0;p.boosting=p.fuel>0;
}
export function stepCaptain(p,input,dt,count=1,index=0){
 input=normalizeInput(input);const area=territory(count,index);
 let next=p.angle+((input.right?1:0)-(input.left?1:0))*1.8*dt;
 if(Number.isFinite(input.aimAngle)){
  const target=area.unrestricted?input.aimAngle:Math.max(area.min,Math.min(area.max,area.center+angleDelta(area.center,input.aimAngle)));
  const delta=area.unrestricted?angleDelta(p.angle,target):target-p.angle;
  next=p.angle+Math.max(-1.8*dt,Math.min(1.8*dt,delta));
 }
 p.angle=area.unrestricted?((next+Math.PI)%TAU+TAU)%TAU-Math.PI:Math.max(area.min,Math.min(area.max,next));
 stepPuffPower(p,input.boost,dt);
}
export function step(s,input,dt,externalPlayers=[]){
 if(s.phase!=='playing')return;
 dt=Math.min(Math.max(0,dt),0.05);s.time+=dt;s.invincible=Math.max(0,s.invincible-dt);
 const captains=s.players?s.players.filter(p=>p.active):[s],count=s.playerCount;
 let thrustX=0,thrustZ=0,weightX=0,weightZ=0;
 for(const p of captains){
  if(!externalPlayers.includes(p.id))stepCaptain(p,s.players?input[p.id]||{}:input,dt,count,s.players?p.seat:s.playerIndex);
  const direction=facing(p.angle),lean=p.boosting?-.085:-.045;
  if(p.boosting){thrustX+=direction.x;thrustZ+=direction.z;}
  weightX+=Math.cos(p.angle)*lean;weightZ+=Math.sin(p.angle)*lean;
 }
 const divisor=s.players?Math.max(1,captains.length):1;
 s.vx+=thrustX/divisor*13*dt;s.vx*=Math.exp(-1.5*dt);s.x+=s.vx*dt;
 // Still water supplies no free current. Puffs accelerate the board; drag settles it.
 s.speed-=thrustZ/divisor*13*dt;s.speed*=Math.exp(-2.4*dt);
 if(Math.abs(s.speed)<.025&&Math.abs(thrustZ)<1e-8)s.speed=0;
 if(Math.abs(s.vx)<.025&&Math.abs(thrustX)<1e-8)s.vx=0;
 s.distance=Math.max(0,Math.min(COURSE_LENGTH,s.distance+s.speed*dt));
 if(s.distance===0&&s.speed<0)s.speed=0;
 s.rapids=rapidStrength(s.distance);
 const targetX=weightX/divisor+s.rapids*Math.sin(s.time*9)*.17;
 const targetZ=weightZ/divisor-s.vx*.012+s.rapids*Math.sin(s.time*7.5)*.21;
 s.rollVX+=((targetX-s.rollX)*30-s.rollVX*6)*dt;
 s.rollVZ+=((targetZ-s.rollZ)*30-s.rollVZ*6)*dt;
 s.rollX=Math.max(-.3,Math.min(.3,s.rollX+s.rollVX*dt));
 s.rollZ=Math.max(-.3,Math.min(.3,s.rollZ+s.rollVZ*dt));
 const banks=bankLimits(s.distance);
 if(s.x<banks.left||s.x>banks.right){
  const side=s.x<0?-1:1,impactSpeed=Math.abs(s.vx);
  s.x=side<0?banks.left:banks.right;hit(s,side);
  s.vx=-side*impactSpeed*.35;
 }
 if(s.distance>=COURSE_LENGTH&&s.lives>0)s.phase='won';
}
export function hit(s,side=1,front=1){
 if(s.phase!=='playing'||s.invincible>0)return false;
 s.lives--;s.invincible=2.2;s.vx*=-.4;
 s.rollVZ+=side*1.2;s.rollVX+=front*1.1;
 if(s.lives<=0)s.phase='lost';return true;
}
export function makeCourse(seed=712){
 let n=seed;const random=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
 const objects=[],lanes=[-5.7,0,5.7];let safe=0;
 for(let row=0;row<27;row++){
  const at=27+row*13;
  // Every row reserves a clear lane; its position shifts at most one lane per row.
  safe=Math.max(0,Math.min(2,safe+(random()>.5?1:-1)));
  const blocked=[0,1,2].filter(i=>i!==safe);if(row<4)blocked.splice(1,1);
  for(const i of blocked){const kind=row%5===3&&i===blocked[0]?'whirlpool':row%3===1?'log':'rock';objects.push({id:objects.length,at,x:lanes[i]+(random()-.5)*.6,kind,radius:kind==='log'?2.1:kind==='whirlpool'?1.9:1.25,hit:false});}
  objects.push({id:objects.length,at:at-6,x:lanes[safe],kind:'bean',radius:.65,hit:false});
 }return objects;
}
