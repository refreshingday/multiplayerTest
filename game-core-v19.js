export const LIMITS=Object.freeze({x:12,z:9,enemies:72,bullets:32,events:26,pickups:6,enemyShots:12});
export const OBSTACLES=Object.freeze([{x:-5,z:-3,w:2.4,d:1.8,h:1.3,type:'crate'},{x:4.6,z:3.2,w:2.6,d:1.8,h:1.3,type:'crate'},{x:4.6,z:-3.5,w:2,d:2,h:1.7,type:'crate'},{x:-4.7,z:3.7,w:2,d:2,h:1.7,type:'crate'},{x:0,z:-5.7,w:4,d:.6,h:1.3,type:'wall'},{x:0,z:5.7,w:4,d:.6,h:1.3,type:'wall'}]);
export const ARENA_THEMES=Object.freeze([
 {name:'TIDAL STATION',floor:'#16343c',grid:'#2d626b',stone:'#648d96',crate:'#e0b05f',accent:'#64ffe0'},
 {name:'EMBER FOUNDRY',floor:'#392b2a',grid:'#6a4540',stone:'#988178',crate:'#ee9048',accent:'#ffad63'},
 {name:'VIOLET VAULT',floor:'#29263d',grid:'#534b78',stone:'#857aa3',crate:'#b69aeb',accent:'#d0a6ff'},
 {name:'MOSS REACTOR',floor:'#24352d',grid:'#436b4e',stone:'#7b9582',crate:'#c5bc66',accent:'#b4f590'},
 {name:'POLAR DEPOT',floor:'#243844',grid:'#476777',stone:'#96aab5',crate:'#779fca',accent:'#92e1ff'},
 {name:'ROSE TERMINAL',floor:'#382a38',grid:'#6b4865',stone:'#a38098',crate:'#e69eac',accent:'#ff9fcf'}
]);
export const obstaclesFor=s=>s?.obstacles||OBSTACLES;
export const enemiesPerWave=wave=>Math.round(.8*12*Math.min(32,5+wave*3));
// Disjoint islands with wide corridors and an open spawn plaza; never build over a player or pickup.
export function regenerateArena(s){ const snap=value=>Math.round(value*1000)/1000;
 s.mapId=(s.mapId||0)+1;s.mapSeed=s.seed;
 const oldTheme=s.theme;s.theme=Number.isInteger(oldTheme)?(oldTheme+1+Math.floor(random(s)*(ARENA_THEMES.length-1)))%ARENA_THEMES.length:Math.floor(random(s)*ARENA_THEMES.length);
 let best=[];
 for(let layout=0;layout<16;layout++){
  const obstacles=[];
  for(let index=0;index<6;index++){
   const type=index<4?'crate':'wall',long=type==='wall'?2.6+random(s)*.6:1.7+random(s)*.7,short=type==='wall'?.6:1.6+random(s)*.5,turned=random(s)>.5;
   const shape={w:snap(turned?short:long),d:snap(turned?long:short),h:snap(type==='wall'?1.3:1.05+random(s)*.6),type};
   for(let attempt=0;attempt<96;attempt++){
    const o={...shape,x:snap((random(s)*2-1)*8.7),z:snap((random(s)*2-1)*5.7)};
    if(circleHitsRect(0,0,2.7,o)||s.players.some(p=>p.active&&circleHitsRect(p.x,p.z,1.2,o))||(s.pickups||[]).some(p=>circleHitsRect(p.x,p.z,.95,o)))continue;
    if(obstacles.some(p=>Math.abs(p.x-o.x)<(p.w+o.w)/2+1.35&&Math.abs(p.z-o.z)<(p.d+o.d)/2+1.35))continue;
    obstacles.push(o);break;
   }
  }
  if(obstacles.length>best.length)best=obstacles;
  if(best.length===6)break;
 }
 s.obstacles=best;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const finite=v=>Number.isFinite(v)?v:0;
export function normalizeInput(i={}){if(!i||typeof i!=='object')i={};let x=clamp(finite(i.x),-1,1),z=clamp(finite(i.z),-1,1),ax=finite(i.ax),az=finite(i.az);let n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}const scale=Math.max(Math.abs(ax),Math.abs(az));if(scale>.001){ax/=scale;az/=scale;n=Math.hypot(ax,az);ax/=n;az/=n;}else{ax=0;az=-1;}return {x,z,ax,az,fire:i.fire===true};}
export function circleHitsRect(x,z,r,o){const dx=x-clamp(x,o.x-o.w/2,o.x+o.w/2),dz=z-clamp(z,o.z-o.d/2,o.z+o.d/2);return dx*dx+dz*dz<r*r;}
export function moveCircle(e,dx,dz,r,obstacles=OBSTACLES){let x=clamp(e.x+dx,-LIMITS.x+r,LIMITS.x-r);if(!obstacles.some(o=>circleHitsRect(x,e.z,r,o)))e.x=x;let z=clamp(e.z+dz,-LIMITS.z+r,LIMITS.z-r);if(!obstacles.some(o=>circleHitsRect(e.x,z,r,o)))e.z=z;}
export function segmentRect(x,z,dx,dz,o,pad=0){let lo=0,hi=1;for(const [a,b,min,max] of [[x,dx,o.x-o.w/2-pad,o.x+o.w/2+pad],[z,dz,o.z-o.d/2-pad,o.z+o.d/2+pad]]){if(Math.abs(b)<1e-8){if(a<min||a>max)return null;}else{let t1=(min-a)/b,t2=(max-a)/b;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;}}return lo;}
function segmentCircle(x,z,dx,dz,e,r){let rx=x-e.x,rz=z-e.z,a=dx*dx+dz*dz,c=rx*rx+rz*rz-r*r;if(c<=0)return 0;if(a<1e-9)return null;let b=2*(rx*dx+rz*dz),disc=b*b-4*a*c;if(disc<0)return null;let t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;}
function random(s){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
export const BUFFS=Object.freeze({duration:9,interval:3,first:1.5});
export const HEROES=Object.freeze([
 {key:'fire',name:'Fire',description:'Heavy impact · no burn',color:'#ff9248',rgb:[1,.35,.04]},
 {key:'electric',name:'Electric',description:'1 dmg · 2× cast · shots + 1 targets',color:'#ffe65b',rgb:[1,.88,.15]},
 {key:'ice',name:'Ice',description:'Slow 45% · pierce 1',color:'#78ddff',rgb:[.3,.8,1]},
 {key:'grass',name:'Grass',description:'2 impact · ramping poison',color:'#8eee89',rgb:[.28,1,.35]}
]);
export const heroFor=key=>HEROES.find(h=>h.key===key)||HEROES[0];
export function setHero(s,id,key){
 const p=s?.players[id];if(!p?.active||s.over||s.wave!==1||s.phase!=='starting'||s.time!==0||!HEROES.some(h=>h.key===key))return false;
 p.hero=key;return true;
}
export const ATTACK=Object.freeze({charge:.30,cooldown:.24,speed:13,damage:3,critDamage:6,critChance:.2});
export const POISON=Object.freeze({impact:2,critImpact:4,duration:3,interval:.5,maxTicks:6});
export function impactDamage(p,crit=false){return (p.hero==='electric'?(crit?2:1):p.hero==='grass'?(crit?POISON.critImpact:POISON.impact):(crit?ATTACK.critDamage:ATTACK.damage))*stats(p).damageMult;}
export const UPGRADES=Object.freeze([
 {key:'double',name:'TWIN FIRE',label:'2× SHOTS',color:'#61f7dc'},
 {key:'haste',name:'HASTE',label:'2× SPEED',color:'#6bbcff'},
 {key:'power',name:'INFERNO',label:'2× DAMAGE',color:'#ff9355'},
 {key:'rapid',name:'RAPID CAST',label:'2× CAST',color:'#ffe16b'},
 {key:'pierce',name:'PIERCING',label:'PIERCE',color:'#d5a1ff'},
 {key:'nova',name:'BLAST WAVE',label:'EXPLOSIVE',color:'#ff83c1'},
 {key:'shield',name:'AEGIS',label:'INVINCIBLE',color:'#a6f57a'}
]);
export const PERKS=Object.freeze([
 {key:'might',name:'EMBER MIGHT',description:'+25% damage',color:'#ff9355'},
 {key:'swift',name:'WIND WALKER',description:'+10% move speed',color:'#6bbcff',maxRank:6},
 {key:'focus',name:'QUICK CAST',description:'+15% cast; max ×2',color:'#ffe16b',maxRank:7},
 {key:'vitality',name:'PHOENIX HEART',description:'+25 max HP; heal 25',color:'#ff83a5'},
 {key:'armor',name:'STONE SKIN',description:'10% less damage',color:'#a6b9d9',maxRank:6},
 {key:'fortune',name:'WILD SPARK',description:'+10% critical chance',color:'#ffe16b',maxRank:6},
 {key:'multishot',name:'FORKED FLAME',description:'+1 fireball',color:'#61f7dc',maxRank:4},
 {key:'pierce',name:'SOUL SPEAR',description:'+1 enemy pierced',color:'#d5a1ff'},
 {key:'blast',name:'SUNBURST',description:'75% splash damage',color:'#ff83c1',maxRank:5},
 {key:'leech',name:'LIFE SIPHON',description:'+1 HP per kill',color:'#a6f57a',maxRank:10}
]);
export const ENEMY_TYPES=Object.freeze([
 {key:'grunt',name:'Stalker',color:0xf5a345,scale:1},
 {key:'runner',name:'Runner',color:0x72e5b5,scale:.8},
 {key:'shooter',name:'Spitter',color:0xc18cff,scale:.95},
 {key:'charger',name:'Charger',color:0xff685e,scale:1.12}
]);
const rank=(p,key)=>Math.max(0,Math.min(1000,Math.floor(finite(p.perks?.[key]))));
export function hasBuff(p,key){return (p.buffs?.[key]||0)>0;}
export function stats(p){
 const blast=rank(p,'blast'),shots=Math.min(5,1+rank(p,'multishot'))+(hasBuff(p,'double')?1:0);
 return {maxHp:100+25*rank(p,'vitality'),
  moveSpeed:4.4*(1+Math.min(.6,.1*rank(p,'swift')))*(hasBuff(p,'haste')?2:1),
  castRate:(1+Math.min(1,.15*rank(p,'focus')))*(hasBuff(p,'rapid')?2:1)*(p.hero==='electric'?2:1),
  damageMult:(1+.25*rank(p,'might'))*(hasBuff(p,'power')?2:1),
  critChance:Math.min(.8,ATTACK.critChance+.1*rank(p,'fortune')),
  reduction:Math.min(.6,.1*rank(p,'armor')),
  shots,
  pierceCount:hasBuff(p,'pierce')?LIMITS.enemies:rank(p,'pierce')+(p.hero==='ice'?1:0),
  blastRadius:hasBuff(p,'nova')?2.5:(blast?Math.min(2.5,1.4+.25*blast):0),
  healOnKill:Math.min(10,rank(p,'leech'))};
}
export function movePlayer(p,i,dt,obstacles=OBSTACLES){const speed=stats(p).moveSpeed;moveCircle(p,i.x*speed*dt,i.z*speed*dt,.4,obstacles);}
export function tickBuffs(p,dt){if(p.buffs)for(const key of Object.keys(p.buffs)){p.buffs[key]=Math.max(0,p.buffs[key]-dt);if(!p.buffs[key])delete p.buffs[key];}}
export function projectiles(p){
 const pos=handPosition(p),count=stats(p).shots,spread=count===1?0:Math.min(.18,.8/(count-1));
 return Array.from({length:count},(_,shot)=>{const angle=(shot-(count-1)/2)*spread,cs=Math.cos(angle),sn=Math.sin(angle);return {...pos,ax:p.ax*cs-p.az*sn,az:p.ax*sn+p.az*cs,shot};});
}
export function handPosition(p){return{x:p.x+p.ax*.68-p.az*.24,z:p.z+p.az*.68+p.ax*.24};}
export function advanceAttack(p,input,dt,emit=()=>{}){
 p.shieldPulse=Math.max(0,(p.shieldPulse||0)-dt);tickBuffs(p,dt);const rate=stats(p).castRate;p.cool=Math.max(0,(p.cool||0)-dt*rate);p.castPulse=Math.max(0,(p.castPulse||0)-dt);
 if(p.hp<=0){p.charging=false;p.charge=0;return;}
 if(!input.fire){if(p.charging)emit('cancel',p);p.charging=false;p.charge=0;return;}
 if(!p.charging&&p.cool<=0){p.charging=true;p.charge=0;p.attackId=(p.attackId||0)+1;emit('charge',p);}
 if(p.charging){p.charge=Math.min(ATTACK.charge,(p.charge||0)+dt*rate);if(p.charge+1e-9>=ATTACK.charge){p.charging=false;p.charge=0;p.cool=ATTACK.cooldown;p.castPulse=.22;emit('cast',p);}}
}
function event(s,type,data){const item={id:s.nextEvent++,t:s.time,type,...data};s.events.push(item);if(s.events.length>LIMITS.events)s.events.shift();return item;}
export function createPlayer(id,active=true){const positions=[[-1.4,-.8],[1.4,-.8],[-1.4,.8],[1.4,.8]];return {id,active,hero:'fire',shieldPulse:0,x:positions[id][0],z:positions[id][1],ax:0,az:-1,hp:100,maxHp:100,hurt:0,cool:0,charging:false,charge:0,attackId:0,castPulse:0,hitPulse:0,hitX:0,hitZ:0,buffs:{},perks:{},score:0,kills:0,damage:0,pushPulse:0,pushCool:0,pushId:0};}
export function createGame(mode='solo',members=null,seed=Math.floor(Math.random()*4294967296)){const coop=mode==='coop',ids=members||(coop?[0,1]:[0]);const s={mode:coop?'coop':'solo',players:Array.from({length:coop?4:1},(_,id)=>createPlayer(id,ids.includes(id))),enemies:[],bullets:[],enemyShots:[],pickups:[],pickupIn:BUFFS.first,pickupType:0,events:[],nextEvent:1,score:0,wave:1,remaining:enemiesPerWave(1),spawned:0,spawnIn:.25,breakIn:0,phase:'starting',phaseLeft:2,upgrade:null,time:0,over:false,paused:false,nextId:1,seed:seed>>>0};regenerateArena(s);return s;}
export function setPlayerActive(s,id,active){
 const p=s?.players[id];if(!p||id===0||p.active===active)return false;
 if(active){Object.assign(p,createPlayer(id,true));}
 else{p.active=false;p.charging=false;p.charge=0;p.castPulse=0;s.bullets=s.bullets.filter(b=>b.owner!==id);if(s.upgrade){s.upgrade.chosen[id]=true;s.upgrade.offers[id]=[];if(s.upgrade.chosen.every(Boolean)){s.upgrade=null;nextWave(s);}}}
 return true;
}
function nextWave(s){s.wave++;s.spawned=0;s.remaining=enemiesPerWave(s.wave);s.spawnIn=.25;s.phase='starting';s.phaseLeft=2;s.breakIn=0;regenerateArena(s);}
function offersFor(s,p){const eligible=PERKS.filter(perk=>!perk.maxRank||rank(p,perk.key)<perk.maxRank).map(p=>p.key);for(let i=eligible.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}return eligible.slice(0,3);}
function finishWave(s){if(s.phase!=='combat'||s.remaining>0||s.enemies.some(e=>e.hp>0))return;s.phase='clear';s.phaseLeft=2;s.bullets=[];s.enemyShots=[];for(const p of s.players){p.charging=false;p.charge=0;p.castPulse=0;p.pushPulse=0;p.pushCool=0;p.hitPulse=0;}event(s,'waveClear',{wave:s.wave});}
function waveUpgrade(s){
 if(s.upgrade||s.wave<1)return;
 s.phase='upgrade';s.phaseLeft=0;s.upgrade={wave:s.wave,chosen:s.players.map(p=>!p.active),offers:s.players.map(p=>p.active?offersFor(s,p):[])};s.bullets=[];s.enemyShots=[];s.breakIn=0;
 for(const p of s.players){if(!p.active)continue;p.maxHp=stats(p).maxHp;p.hp=p.hp>0?Math.min(p.maxHp,p.hp+12):Math.min(p.maxHp,Math.max(55,Math.round(p.maxHp*.55*100)/100));p.hurt=0;p.hitPulse=0;p.charging=false;p.charge=0;p.cool=0;p.castPulse=0;if(p.hp>0){p.x=clamp(p.x,-11.6,11.6);p.z=clamp(p.z,-8.6,8.6);}}

}
export function choosePerk(s,playerId,key,wave){
 if(!s||s.over||s.paused||!s.upgrade||!Number.isSafeInteger(playerId)||!Number.isSafeInteger(wave)||s.upgrade.wave!==wave||s.wave!==wave)return false;
 const p=s.players.find(p=>p.id===playerId),perk=PERKS.find(p=>p.key===key);
 if(!p||!p.active||!perk||s.upgrade.chosen[playerId]||!s.upgrade.offers[playerId]?.includes(key))return false;
 p.perks||={};const level=rank(p,key);if(perk.maxRank&&level>=perk.maxRank)return false;
 p.perks[key]=level+1;p.maxHp=stats(p).maxHp;if(key==='vitality')p.hp=Math.min(p.maxHp,p.hp+25);
 s.upgrade.chosen[playerId]=true;event(s,'perk',{owner:playerId,key,rank:level+1,x:p.x,z:p.z});
 if(s.upgrade.chosen.every(Boolean)){s.upgrade=null;nextWave(s);}
 return true;
}
function spawnEnemy(s){
 const side=Math.floor(random(s)*4),a=random(s)*2-1,hp=6+Math.floor(s.wave/2),available=ENEMY_TYPES.slice(0,Math.min(4,s.wave)),type=(s.spawned++===0?available[available.length-1]:available[Math.floor(random(s)*available.length)]).key;
 const e={id:s.nextId++,type,x:side<2?(side===0?-11.2:11.2):a*10.8,z:side>=2?(side===2?-8.2:8.2):a*7.7,maxHp:hp,hp,bar:0,speed:1.15*(1.25+Math.min(1.25,s.wave*.07)+random(s)*.3)*(type==='runner'?1.6:type==='charger'?.8:1),attack:0,hit:0,slow:0,poison:0,poisonTick:0,poisonTicks:0,poisonPower:1,poisonOwner:0,spawn:.35,special:.8+random(s),wind:0,dash:0,ax:0,az:-1};
 s.enemies.push(e);event(s,'spawn',{x:e.x,z:e.z,target:e.id});s.remaining--;s.spawnIn=.25*Math.max(.42,1.25-s.wave*.055);
}
// Both authority and local prediction derive combat from the world, never a fire button.
export function autoAttackInput(s,p,input={}){
 const i=normalizeInput({...input,ax:p.ax,az:p.az,fire:false});
 if(!p.active||p.hp<=0||s.paused||s.over||s.upgrade||s.phase!=='combat')return i;
 let target=null,best=(ATTACK.speed*1.8-.8)**2;
 for(const enemy of s.enemies||[]){
  if(enemy.hp<=0||enemy.spawn>0)continue;
  const dx=enemy.x-p.x,dz=enemy.z-p.z,d2=dx*dx+dz*dz;
  if(d2<.000001||d2>best||(d2===best&&target&&enemy.id>=target.id))continue;
  const n=Math.sqrt(d2),aim={...p,ax:dx/n,az:dz/n},hand=handPosition(aim);
  if(obstaclesFor(s).some(o=>segmentRect(p.x,p.z,hand.x-p.x,hand.z-p.z,o,.17)!==null||segmentRect(hand.x,hand.z,enemy.x-hand.x,enemy.z-hand.z,o,.17)!==null))continue;
  target=enemy;best=d2;
 }
 if(target){const dx=target.x-p.x,dz=target.z-p.z,n=Math.hypot(dx,dz);i.ax=dx/n;i.az=dz/n;i.fire=true;}
 return i;
}
export function stepPlayer(s,p,input={},dt=0){
 if(!p||!p.active||p.hp<=0||s.paused||s.over||s.upgrade||s.phase!=='combat')return;const movement=normalizeInput(input);
 movePlayer(p,movement,dt,obstaclesFor(s));const i=autoAttackInput(s,p,movement);p.ax=i.ax;p.az=i.az;
 advanceAttack(p,i,dt,(type,caster)=>{
  const pos=handPosition(caster);
  if(type==='charge')event(s,'charge',{...pos,owner:p.id,element:p.hero,a:p.attackId,ax:p.ax,az:p.az});
  if(type==='cast'&&s.bullets.length<LIMITS.bullets){
   const attributes=stats(p),crit=random(s)<attributes.critChance,quota=Math.max(8,Math.floor(LIMITS.bullets/s.players.filter(p=>p.active).length));let owned=s.bullets.filter(b=>b.owner===p.id).length;
   for(const shot of projectiles(p)){if(s.bullets.length>=LIMITS.bullets||owned++>=quota)break;const b={id:s.nextId++,a:p.attackId,shot:shot.shot,x:shot.x,z:shot.z,vx:shot.ax*ATTACK.speed,vz:shot.az*ATTACK.speed,ttl:1.8,owner:p.id,element:p.hero,crit,damage:impactDamage(p,crit),pierce:attributes.pierceCount,nova:attributes.blastRadius};if(p.hero==='electric')b.chains=attributes.shots;if(b.pierce)b.hitIds=[];s.bullets.push(b);}
   event(s,'cast',{...pos,owner:p.id,element:p.hero,a:p.attackId,ax:p.ax,az:p.az,crit});
  }
 });
}
function damageEnemy(s,e,damage,crit,owner,kind,ax=0,az=0,element='fire'){
 if(e.hp<=0)return;const actual=Math.min(e.hp,Math.max(0,damage));e.hp=Math.max(0,e.hp-actual);e.bar=2.5;e.hit=kind==='impact'?.12:.055;
 const player=s.players.find(p=>p.id===owner);if(player)player.damage=Math.round((player.damage+actual)*1000)/1000;
 if(kind==='impact'){
  moveCircle(e,ax*(crit?.3:.18),az*(crit?.3:.18),.36,obstaclesFor(s));
  if(element==='ice')e.slow=2;
  if(element==='grass'&&e.hp>0){
   const fresh=!(e.poison>0);e.poison=POISON.duration;e.poisonOwner=owner;
   if(fresh){e.poisonTick=POISON.interval;e.poisonTicks=0;}
   // Refresh duration without resetting the ramp or postponing the next tick.
   e.poisonPower=damage/(crit?POISON.critImpact:POISON.impact);
  }
 }
 const dead=e.hp<=0;if(dead&&player){player.score+=10;player.kills++;player.maxHp=stats(player).maxHp;if(player.hp>0)player.hp=Math.min(player.maxHp,player.hp+stats(player).healOnKill);s.score=s.players.reduce((sum,p)=>sum+p.score,0);}
 event(s,'hit',{x:e.x,z:e.z,target:e.id,owner,damage:actual,crit,kind,dead,ax,az,element});
}
function chainLightning(s,source,owner,damage,hops=1){
 const hit=new Set([source.id]);let from=source;
 for(let count=0;count<Math.min(LIMITS.enemies-1,hops);count++){
  const next=s.enemies.filter(e=>e.hp>0&&!e.spawn&&!hit.has(e.id)&&Math.hypot(e.x-from.x,e.z-from.z)<=3&&!obstaclesFor(s).some(o=>segmentRect(from.x,from.z,e.x-from.x,e.z-from.z,o,.05)!==null)).sort((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z)||a.id-b.id)[0];
  if(!next)break;
  event(s,'lightning',{x:from.x,z:from.z,tx:next.x,tz:next.z,owner,element:'electric'});damageEnemy(s,next,damage,false,owner,'chain',0,0,'electric');hit.add(next.id);from=next;
 }
}
function damagePlayer(s,p,raw,ax,az){
 if(p.hp<=0||p.hurt>0||hasBuff(p,'shield'))return false;
 const damage=Math.min(p.hp,Math.round(raw*(1-stats(p).reduction)*100)/100);p.hp=Math.max(0,p.hp-damage);p.hurt=.48;p.bar=3;p.hitPulse=.3;p.hitX=ax;p.hitZ=az;
 event(s,'playerHit',{owner:p.id,x:p.x,z:p.z,damage,ax,az});if(p.hp<=0){p.charging=false;p.charge=0;}return true;
}
function pushPlayer(s,p,b){
 if(p.pushCool>0||p.hp<=0)return;
 const n=Math.hypot(b.vx,b.vz)||1,ax=b.vx/n,az=b.vz/n;moveCircle(p,ax*.68,az*.68,.4,obstaclesFor(s));p.pushCool=.18;p.pushPulse=.25;p.pushId++;p.hitX=ax;p.hitZ=az;
 event(s,'push',{owner:b.owner,target:p.id,x:p.x,z:p.z,ax,az});
}
export function stepGame(s,inputs=[],dt=0,externalPlayer=-1){
 dt=clamp(finite(dt),0,.05);if(!dt||s.paused||s.over||s.upgrade)return s;if(!Array.isArray(inputs))inputs=[];s.time+=dt;s.events=s.events.filter(e=>s.time-e.t<1.6);
 if(s.phase==='starting'||s.phase==='clear'){
  s.phaseLeft=Math.max(0,s.phaseLeft-dt);
  if(s.phaseLeft<=1e-8){s.phaseLeft=0;if(s.phase==='clear')waveUpgrade(s);else{s.phase='combat';event(s,'waveStart',{wave:s.wave});}}
  return s;
 }
 if(s.phase!=='combat')return s;
 if(!s.remaining&&!s.enemies.some(e=>e.hp>0)){if(s.players.filter(p=>p.active).every(p=>p.hp<=0)){s.over=true;s.paused=true;}else finishWave(s);return s;}
 if(s.remaining){s.spawnIn-=dt;if(s.spawnIn<=0&&s.enemies.length<LIMITS.enemies)spawnEnemy(s);}
 for(const p of s.players){if(!p.active)continue;if(p.hp<=0)tickBuffs(p,dt);p.bar=Math.max(0,(p.bar||0)-dt);p.hurt=Math.max(0,p.hurt-dt);p.hitPulse=Math.max(0,(p.hitPulse||0)-dt);p.pushPulse=Math.max(0,(p.pushPulse||0)-dt);p.pushCool=Math.max(0,(p.pushCool||0)-dt);p.maxHp=stats(p).maxHp;if(!(Array.isArray(externalPlayer)?externalPlayer.includes(p.id):p.id===externalPlayer))stepPlayer(s,p,inputs[p.id],dt);}
 s.pickupIn-=dt;for(const item of s.pickups)item.ttl-=dt;s.pickups=s.pickups.filter(item=>item.ttl>0);
 if(s.pickupIn<=0&&s.pickups.length<LIMITS.pickups){
  for(let tries=0;tries<40;tries++){const x=(random(s)*2-1)*10,z=(random(s)*2-1)*7;
   if(obstaclesFor(s).some(o=>circleHitsRect(x,z,.7,o))||s.pickups.some(p=>Math.hypot(p.x-x,p.z-z)<2))continue;
   const key=UPGRADES[s.pickupType++%UPGRADES.length].key;s.pickups.push({id:s.nextId++,x,z,key,ttl:25});s.pickupIn=BUFFS.interval;break;
  }
 }
 for(const p of s.players)if(p.active&&p.hp>0)for(const item of s.pickups)if(item.ttl>0&&Math.hypot(item.x-p.x,item.z-p.z)<.95){p.buffs[item.key]=BUFFS.duration;if(item.key==='shield')p.shieldPulse=.65;item.ttl=0;event(s,'pickup',{x:item.x,z:item.z,owner:p.id,key:item.key});}
 s.pickups=s.pickups.filter(item=>item.ttl>0);
 for(const e of s.enemies){
  e.bar=Math.max(0,(e.bar||0)-dt);e.hit=Math.max(0,(e.hit||0)-dt);e.spawn=Math.max(0,(e.spawn||0)-dt);
  e.slow=Math.max(0,(e.slow||0)-dt);
  if(e.poison>0){
   const elapsed=Math.min(dt,e.poison);e.poison=Math.max(0,e.poison-dt);e.poisonTick-=elapsed;
   while(e.poisonTick<=1e-8&&e.hp>0){
    e.poisonTick+=POISON.interval;e.poisonTicks=Math.min(POISON.maxTicks,(e.poisonTicks||0)+1);
    const tickDamage=Math.min(3,1+Math.floor((e.poisonTicks-1)/2))*(e.poisonPower||1);
    damageEnemy(s,e,tickDamage,false,e.poisonOwner,'poison',0,0,'grass');
   }
  }
  const alive=s.players.filter(p=>p.active&&p.hp>0);if(e.hp<=0||e.spawn>0||!alive.length)continue;
  e.attack=Math.max(0,e.attack-dt);e.special=Math.max(0,(e.special||0)-dt);
  const p=alive.reduce((a,b)=>Math.hypot(e.x-a.x,e.z-a.z)<Math.hypot(e.x-b.x,e.z-b.z)?a:b);
  const dx=p.x-e.x,dz=p.z-e.z,n=Math.hypot(dx,dz)||1,ox=e.x,oz=e.z;let mx=dx/n,mz=dz/n,speed=e.speed*(e.hit>0?.25:1);
  if(e.wind>0){
   e.wind=Math.max(0,e.wind-dt);speed=0;
   if(e.wind<=1e-8){e.wind=0;if(e.type==='charger')e.dash=.4;else if(e.type==='shooter'&&s.enemyShots.length<LIMITS.enemyShots){s.enemyShots.push({id:s.nextId++,x:e.x+e.ax*.65,z:e.z+e.az*.65,vx:e.ax*5.4,vz:e.az*5.4,ttl:3,owner:-1});event(s,'enemyCast',{x:e.x,z:e.z,ax:e.ax,az:e.az});}}
  }else if(e.type==='charger'&&e.dash>0){e.dash=Math.max(0,e.dash-dt);mx=e.ax;mz=e.az;speed=6.8;}
  else if((e.type==='charger'||e.type==='shooter')&&e.special<=0&&n<8){e.ax=dx/n;e.az=dz/n;e.wind=e.type==='charger'?.55:.45;e.special=e.type==='charger'?2.6:1.8;speed=0;}
  else if(e.type==='shooter'){if(n<3.8){mx=-mx;mz=-mz;}else if(n<5.5)speed=0;}
  speed*=e.slow>0?.55:1;
  moveCircle(e,mx*speed*dt,mz*speed*dt,.36,obstaclesFor(s));
  if(speed>0&&Math.hypot(e.x-ox,e.z-oz)<speed*dt*.1&&!(e.type==='charger'&&e.dash>0)){const sign=e.id%2?1:-1;moveCircle(e,-mz*speed*dt*sign,mx*speed*dt*sign,.36,obstaclesFor(s));}
  if(Math.hypot(p.x-e.x,p.z-e.z)<.82&&e.attack<=0){if(damagePlayer(s,p,e.type==='charger'?18:e.type==='runner'||e.type==='shooter'?10:14,dx/n,dz/n))e.attack=.8;}
 }
 const bullets=[];
 for(const b of s.bullets){
  b.ttl-=dt;if(b.ttl<=0)continue;const dx=b.vx*dt,dz=b.vz*dt;let wall=2;
  for(const o of obstaclesFor(s)){const t=segmentRect(b.x,b.z,dx,dz,o,.17);if(t!==null&&t<wall)wall=t;}
  const targets=[];
  for(const e of s.enemies){if(e.hp<=0||e.spawn>0||b.hitIds?.includes(e.id))continue;const t=segmentCircle(b.x,b.z,dx,dz,e,.53);if(t!==null&&t<wall)targets.push({e,t});}
  for(const p of s.players){if(!p.active||p.hp<=0||p.id===b.owner)continue;const t=segmentCircle(b.x,b.z,dx,dz,p,.56);if(t!==null&&t<wall)targets.push({e:p,t,player:true});}
  targets.sort((a,b)=>a.t-b.t);let spent=false;
  for(const {e:target,t,player} of targets){
   if(target.hp<=0)continue;if(player){pushPlayer(s,target,b);spent=true;break;}
   const x=b.x+dx*t,z=b.z+dz*t;damageEnemy(s,target,b.damage??impactDamage({hero:b.element},b.crit),b.crit,b.owner,'impact',b.vx/ATTACK.speed,b.vz/ATTACK.speed,b.element);
   if(b.element==='electric')chainLightning(s,target,b.owner,b.damage||1,b.chains??1);
   if(b.nova){for(const other of s.enemies)if(other!==target&&other.hp>0&&!other.spawn&&Math.hypot(other.x-x,other.z-z)<b.nova)damageEnemy(s,other,Math.max(1,(b.damage||3)*.75),false,b.owner,'blast',0,0,b.element);event(s,'nova',{x,z,owner:b.owner,element:b.element});}
   if(b.pierce>0){b.hitIds||=[];b.hitIds.push(target.id);b.pierce--;}else{spent=true;break;}
  }
  if(spent)continue;if(wall<=1){event(s,'wall',{x:b.x+dx*wall,z:b.z+dz*wall,owner:b.owner,element:b.element,crit:b.crit});continue;}
  b.x+=dx;b.z+=dz;if(Math.abs(b.x)>LIMITS.x||Math.abs(b.z)>LIMITS.z)continue;bullets.push(b);
 }
 s.bullets=bullets;
 const enemyShots=[];
 for(const b of s.enemyShots){
  b.ttl-=dt;if(b.ttl<=0)continue;const dx=b.vx*dt,dz=b.vz*dt;let hit=2,target=null;
  for(const o of obstaclesFor(s)){const t=segmentRect(b.x,b.z,dx,dz,o,.12);if(t!==null&&t<hit){hit=t;target=null;}}
  for(const p of s.players){if(!p.active||p.hp<=0)continue;const t=segmentCircle(b.x,b.z,dx,dz,p,.52);if(t!==null&&t<hit){hit=t;target=p;}}
  if(hit<=1){if(target){const n=Math.hypot(b.vx,b.vz)||1;if(!damagePlayer(s,target,10,b.vx/n,b.vz/n))event(s,'block',{x:target.x,z:target.z,owner:target.id});}else event(s,'wall',{x:b.x+dx*hit,z:b.z+dz*hit,owner:-1});continue;}
  b.x+=dx;b.z+=dz;if(Math.abs(b.x)<=LIMITS.x&&Math.abs(b.z)<=LIMITS.z)enemyShots.push(b);
 }
 s.enemyShots=enemyShots;s.enemies=s.enemies.filter(e=>e.hp>0);
 if(s.players.filter(p=>p.active).every(p=>p.hp<=0)){s.over=true;s.paused=true;}
 else if(!s.remaining&&!s.enemies.length)finishWave(s);
 return s;
}
