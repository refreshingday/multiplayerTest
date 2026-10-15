export const LIMITS=Object.freeze({x:12,z:9,enemies:28,bullets:32,events:48,pickups:3});
export const OBSTACLES=Object.freeze([{x:-5,z:-3,w:2.4,d:1.8,h:1.3,type:'crate'},{x:4.6,z:3.2,w:2.6,d:1.8,h:1.3,type:'crate'},{x:4.6,z:-3.5,w:2,d:2,h:1.7,type:'crate'},{x:-4.7,z:3.7,w:2,d:2,h:1.7,type:'crate'},{x:0,z:-5.7,w:4,d:.6,h:1.3,type:'wall'},{x:0,z:5.7,w:4,d:.6,h:1.3,type:'wall'}]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const finite=v=>Number.isFinite(v)?v:0;
export function normalizeInput(i={}){if(!i||typeof i!=='object')i={};let x=clamp(finite(i.x),-1,1),z=clamp(finite(i.z),-1,1),ax=finite(i.ax),az=finite(i.az);let n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}const scale=Math.max(Math.abs(ax),Math.abs(az));if(scale>.001){ax/=scale;az/=scale;n=Math.hypot(ax,az);ax/=n;az/=n;}else{ax=0;az=-1;}return {x,z,ax,az,fire:i.fire===true};}
export function circleHitsRect(x,z,r,o){const dx=x-clamp(x,o.x-o.w/2,o.x+o.w/2),dz=z-clamp(z,o.z-o.d/2,o.z+o.d/2);return dx*dx+dz*dz<r*r;}
export function moveCircle(e,dx,dz,r){let x=clamp(e.x+dx,-LIMITS.x+r,LIMITS.x-r);if(!OBSTACLES.some(o=>circleHitsRect(x,e.z,r,o)))e.x=x;let z=clamp(e.z+dz,-LIMITS.z+r,LIMITS.z-r);if(!OBSTACLES.some(o=>circleHitsRect(e.x,z,r,o)))e.z=z;}
export function segmentRect(x,z,dx,dz,o,pad=0){let lo=0,hi=1;for(const [a,b,min,max] of [[x,dx,o.x-o.w/2-pad,o.x+o.w/2+pad],[z,dz,o.z-o.d/2-pad,o.z+o.d/2+pad]]){if(Math.abs(b)<1e-8){if(a<min||a>max)return null;}else{let t1=(min-a)/b,t2=(max-a)/b;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;}}return lo;}
function segmentCircle(x,z,dx,dz,e,r){let rx=x-e.x,rz=z-e.z,a=dx*dx+dz*dz,c=rx*rx+rz*rz-r*r;if(c<=0)return 0;if(a<1e-9)return null;let b=2*(rx*dx+rz*dz),disc=b*b-4*a*c;if(disc<0)return null;let t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;}
function random(s){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
export const ATTACK=Object.freeze({charge:.30,cooldown:.24,speed:13,damage:3,critDamage:6,critChance:.2,burn:1.2,burnTick:.35});
export const UPGRADES=Object.freeze([
 {key:'double',name:'TWIN FIRE',label:'2× SHOTS',color:'#61f7dc'},
 {key:'haste',name:'HASTE',label:'2× SPEED',color:'#6bbcff'},
 {key:'power',name:'INFERNO',label:'2× DAMAGE',color:'#ff9355'},
 {key:'rapid',name:'RAPID CAST',label:'2× CAST',color:'#ffe16b'},
 {key:'pierce',name:'PIERCING',label:'PIERCE',color:'#d5a1ff'},
 {key:'nova',name:'BLAST WAVE',label:'EXPLOSIVE',color:'#ff83c1'},
 {key:'shield',name:'AEGIS',label:'INVINCIBLE',color:'#a6f57a'}
]);
export function hasBuff(p,key){return (p.buffs?.[key]||0)>0;}
export function movePlayer(p,i,dt){moveCircle(p,i.x*4.4*(hasBuff(p,'haste')?2:1)*dt,i.z*4.4*(hasBuff(p,'haste')?2:1)*dt,.4);}
export function tickBuffs(p,dt){if(p.buffs)for(const key of Object.keys(p.buffs))p.buffs[key]=Math.max(0,p.buffs[key]-dt);}
export function projectiles(p){const pos=handPosition(p);return (hasBuff(p,'double')?[-.16,.16]:[0]).map((angle,shot)=>{const cs=Math.cos(angle),sn=Math.sin(angle);return {...pos,ax:p.ax*cs-p.az*sn,az:p.ax*sn+p.az*cs,shot};});}
export function handPosition(p){return{x:p.x+p.ax*.68-p.az*.24,z:p.z+p.az*.68+p.ax*.24};}
export function advanceAttack(p,input,dt,emit=()=>{}){
 tickBuffs(p,dt);const rapid=hasBuff(p,'rapid')?2:1;p.cool=Math.max(0,(p.cool||0)-dt*rapid);p.castPulse=Math.max(0,(p.castPulse||0)-dt);
 if(p.hp<=0){p.charging=false;p.charge=0;return;}
 if(!input.fire){if(p.charging)emit('cancel',p);p.charging=false;p.charge=0;return;}
 if(!p.charging&&p.cool<=0){p.charging=true;p.charge=0;p.attackId=(p.attackId||0)+1;emit('charge',p);}
 if(p.charging){p.charge=Math.min(ATTACK.charge,(p.charge||0)+dt*rapid);if(p.charge+1e-9>=ATTACK.charge){p.charging=false;p.charge=0;p.cool=ATTACK.cooldown;p.castPulse=.22;emit('cast',p);}}
}
function event(s,type,data){const item={id:s.nextEvent++,t:s.time,type,...data};s.events.push(item);if(s.events.length>LIMITS.events)s.events.shift();return item;}
export function createGame(mode='solo'){return {mode:mode==='coop'?'coop':'solo',players:[0,...(mode==='coop'?[1]:[])].map(id=>({id,x:id?1:-1,z:0,ax:0,az:-1,hp:100,hurt:0,cool:0,charging:false,charge:0,attackId:0,castPulse:0,buffs:{}})),enemies:[],bullets:[],pickups:[],pickupIn:3,pickupType:0,events:[],nextEvent:1,score:0,wave:0,remaining:0,spawnIn:0,breakIn:1.4,time:0,over:false,paused:false,nextId:1,seed:173921};}
function nextWave(s){s.wave++;s.remaining=Math.min(32,5+s.wave*3);s.spawnIn=.25;for(const p of s.players){if(p.hp<=0){p.hp=55;p.x=p.id?1:-1;p.z=0;p.charging=false;p.charge=0;}else if(s.wave>1)p.hp=Math.min(100,p.hp+12);}}
function spawnEnemy(s){const side=Math.floor(random(s)*4),a=random(s)*2-1;s.enemies.push({id:s.nextId++,x:side<2?(side===0?-11.2:11.2):a*10.8,z:side>=2?(side===2?-8.2:8.2):a*7.7,maxHp:6+Math.floor(s.wave/2),hp:6+Math.floor(s.wave/2),bar:0,speed:1.25+Math.min(1.25,s.wave*.07)+random(s)*.3,attack:0,hit:0,burn:0,burnTick:0,burnOwner:0});s.remaining--;s.spawnIn=Math.max(.42,1.25-s.wave*.055);}
export function stepPlayer(s,p,input={},dt=0){
 if(!p||p.hp<=0)return;const i=normalizeInput(input);p.ax=i.ax;p.az=i.az;
 movePlayer(p,i,dt);
 advanceAttack(p,i,dt,(type,caster)=>{
  const pos=handPosition(caster);
  if(type==='charge')event(s,'charge',{...pos,owner:p.id,a:p.attackId,ax:p.ax,az:p.az});
  if(type==='cast'&&s.bullets.length<LIMITS.bullets){
   const crit=random(s)<ATTACK.critChance,shots=projectiles(p);
   for(const shot of shots){if(s.bullets.length>=LIMITS.bullets)break;s.bullets.push({id:s.nextId++,a:p.attackId,shot:shot.shot,x:shot.x,z:shot.z,vx:shot.ax*ATTACK.speed,vz:shot.az*ATTACK.speed,ttl:1.8,owner:p.id,crit,damage:(crit?ATTACK.critDamage:ATTACK.damage)*(hasBuff(p,'power')?2:1),pierce:hasBuff(p,'pierce'),nova:hasBuff(p,'nova'),hitIds:[]});}
   event(s,'cast',{...pos,owner:p.id,a:p.attackId,ax:p.ax,az:p.az,crit});

  }
 });
}
function damageEnemy(s,e,damage,crit,owner,kind,ax=0,az=0){
 if(e.hp<=0)return;e.hp=Math.max(0,e.hp-damage);e.bar=2.5;e.hit=kind==='impact'?.12:.055;
 if(kind==='impact'){moveCircle(e,ax*(crit?.3:.18),az*(crit?.3:.18),.36);e.burn=ATTACK.burn;e.burnTick=e.burnTick>0?Math.min(e.burnTick,ATTACK.burnTick):ATTACK.burnTick;e.burnOwner=owner;}
 const dead=e.hp<=0;if(dead)s.score+=10;
 event(s,'hit',{x:e.x,z:e.z,target:e.id,owner,damage,crit,kind,dead,ax,az});
}
export function stepGame(s,inputs=[],dt=0,externalPlayer=-1){
 dt=clamp(finite(dt),0,.05);if(!dt||s.paused||s.over)return s;if(!Array.isArray(inputs))inputs=[];s.time+=dt;
 s.events=s.events.filter(e=>s.time-e.t<1.6);
 if(!s.remaining&&!s.enemies.length){s.breakIn-=dt;if(s.breakIn<=0){nextWave(s);s.breakIn=3;}}else if(s.remaining){s.spawnIn-=dt;if(s.spawnIn<=0&&s.enemies.length<LIMITS.enemies)spawnEnemy(s);}
 for(const p of s.players){if(p.hp<=0)tickBuffs(p,dt);p.bar=Math.max(0,(p.bar||0)-dt);p.hurt=Math.max(0,p.hurt-dt);if(p.id!==externalPlayer)stepPlayer(s,p,inputs[p.id],dt);}
 s.pickupIn-=dt;
 for(const item of s.pickups)item.ttl-=dt;
 s.pickups=s.pickups.filter(item=>item.ttl>0);
 if(s.pickupIn<=0&&s.pickups.length<LIMITS.pickups){
  for(let tries=0;tries<40;tries++){const x=(random(s)*2-1)*10,z=(random(s)*2-1)*7;
   if(OBSTACLES.some(o=>circleHitsRect(x,z,.7,o))||s.pickups.some(p=>Math.hypot(p.x-x,p.z-z)<2))continue;
   const key=UPGRADES[s.pickupType++%UPGRADES.length].key;s.pickups.push({id:s.nextId++,x,z,key,ttl:25});s.pickupIn=6;break;
  }
 }
 for(const p of s.players)if(p.hp>0)for(const item of s.pickups)if(item.ttl>0&&Math.hypot(item.x-p.x,item.z-p.z)<.95){p.buffs[item.key]=18;item.ttl=0;event(s,'pickup',{x:item.x,z:item.z,owner:p.id,key:item.key});}
 s.pickups=s.pickups.filter(item=>item.ttl>0);
 const alive=s.players.filter(p=>p.hp>0);
 for(const e of s.enemies){
  e.bar=Math.max(0,(e.bar||0)-dt);e.hit=Math.max(0,(e.hit||0)-dt);
  if(e.burn>0){e.burn=Math.max(0,e.burn-dt);e.burnTick-=dt;if(e.burnTick<=0){e.burnTick+=ATTACK.burnTick;damageEnemy(s,e,1,false,e.burnOwner,'burn');}}
  if(e.hp<=0||!alive.length)continue;
  e.attack=Math.max(0,e.attack-dt);const p=alive.reduce((a,b)=>Math.hypot(e.x-a.x,e.z-a.z)<Math.hypot(e.x-b.x,e.z-b.z)?a:b);
  let dx=p.x-e.x,dz=p.z-e.z,n=Math.hypot(dx,dz)||1;const ox=e.x,oz=e.z,speed=e.speed*(e.hit>0?.25:1);
  moveCircle(e,dx/n*speed*dt,dz/n*speed*dt,.36);
  if(Math.hypot(e.x-ox,e.z-oz)<speed*dt*.1){const sign=e.id%2?1:-1;moveCircle(e,-dz/n*speed*dt*sign,dx/n*speed*dt*sign,.36);}
  if(n<.82&&e.attack<=0&&p.hurt<=0&&!hasBuff(p,'shield')){p.hp=Math.max(0,p.hp-14);p.hurt=.48;p.bar=3;e.attack=.8;if(p.hp<=0){p.charging=false;p.charge=0;}}
 }
 const bullets=[];
 for(const b of s.bullets){
  b.ttl-=dt;if(b.ttl<=0)continue;const dx=b.vx*dt,dz=b.vz*dt;let hit=2,target=null;
  for(const o of OBSTACLES){const t=segmentRect(b.x,b.z,dx,dz,o,.17);if(t!==null&&t<hit){hit=t;target=null;}}
  for(const e of s.enemies){if(e.hp<=0||b.hitIds?.includes(e.id))continue;const t=segmentCircle(b.x,b.z,dx,dz,e,.53);if(t!==null&&t<hit){hit=t;target=e;}}
  if(hit<=1){const x=b.x+dx*hit,z=b.z+dz*hit;
   if(target){
    damageEnemy(s,target,b.damage||(b.crit?ATTACK.critDamage:ATTACK.damage),b.crit,b.owner,'impact',b.vx/ATTACK.speed,b.vz/ATTACK.speed);
    if(b.nova){for(const other of s.enemies)if(other!==target&&other.hp>0&&Math.hypot(other.x-x,other.z-z)<2.5)damageEnemy(s,other,Math.max(1,Math.ceil((b.damage||3)*.75)),false,b.owner,'blast');event(s,'nova',{x,z,owner:b.owner});}
    if(b.pierce){b.hitIds.push(target.id);b.x+=dx;b.z+=dz;bullets.push(b);continue;}
   }
   else event(s,'wall',{x,z,owner:b.owner,crit:b.crit});continue;
  }
  b.x+=dx;b.z+=dz;if(Math.abs(b.x)>LIMITS.x||Math.abs(b.z)>LIMITS.z)continue;bullets.push(b);
 }
 s.bullets=bullets;s.enemies=s.enemies.filter(e=>e.hp>0);
 if(s.players.every(p=>p.hp<=0)){s.over=true;s.paused=true;}return s;
}
