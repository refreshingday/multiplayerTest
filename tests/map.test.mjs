import test from 'node:test';import assert from 'node:assert/strict';
import {ARENA,arenaScale,arenaBounds,createGame,regenerateArena,stepGame,stepPlayer,moveCircle,choosePerk,circleHitsRect,LIMITS,stats} from '../game-core-v22.js';
import {LocalPrediction,RemoteInputs,TICK} from '../prediction-v22.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,String(a)+' != '+b);
function world(wave=1){const s=createGame('coop',[0,1,2,3],99);s.wave=wave;s.phase='combat';s.remaining=1;s.spawnIn=999;s.pickupIn=999;regenerateArena(s);return s;}
test('wave one grows both dimensions by 1.5 and each later wave compounds by 20 percent',()=>{
 assert.equal(ARENA.startScale,1.5);assert.equal(ARENA.waveGrowth,1.2);
 close(arenaBounds({wave:1}).x*2,36);close(arenaBounds({wave:1}).z*2,27);
 close(arenaBounds({wave:2}).x*2,43.2);close(arenaBounds({wave:2}).z*2,32.4);
 for(let wave=2;wave<=30;wave++){close(arenaScale(wave)/arenaScale(wave-1),1.2);close(arenaBounds({wave}).x/arenaBounds({wave:wave-1}).x,1.2);}
});
test('the actual upgrade transition expands the map once and a fresh game resets it',()=>{
 const s=world(),before=arenaBounds(s);s.remaining=0;s.enemies=[];
 for(let n=0;n<123;n++)stepGame(s,[],TICK);
 assert.equal(s.phase,'upgrade');
 for(let id=0;id<4;id++){assert.ok(choosePerk(s,id,s.upgrade.offers[id][0],1));if(id<3)assert.equal(s.wave,1);}
 assert.equal(s.wave,2);close(arenaBounds(s).x,before.x*1.2);assert.equal(s.phase,'starting');
 assert.deepEqual(arenaBounds(createGame()),{x:18,z:13.5});
});
test('authority, guest prediction, replay and presentation agree outside the former edges',()=>{
 for(const wave of [1,2,5,10]){
  const s=world(wave),b=arenaBounds(s);s.obstacles=[];const id=1,p=s.players[id];p.x=b.x-1;p.z=b.z-1;
  const prediction=new LocalPrediction(id),remote=new RemoteInputs(id);prediction.reconcile(structuredClone(s),0,true);
  for(let n=0;n<90;n++){assert.ok(prediction.step({x:1,z:1},TICK,true));assert.ok(remote.add(prediction.packet()));remote.consume(s,TICK);prediction.reconcile(structuredClone(s),remote.done);}
  const shown=prediction.view();close(shown.x,p.x);close(shown.z,p.z);close(p.x,b.x-.4);close(p.z,b.z-.4);assert.ok(shown.x>12&&shown.z>9);
  prediction.step({x:-1,z:0},TICK,true);const expected=p.x-stats(p).moveSpeed*TICK;prediction.reconcile(structuredClone(s),remote.done);close(prediction.player.x,expected);
 }
});
test('obstacles retain wide corridors and remain inside each expanded arena',()=>{
 for(const wave of [1,2,5,10])for(let seed=1;seed<=20;seed++){
  const s=world(wave);s.seed=seed;regenerateArena(s);const b=arenaBounds(s);assert.equal(s.obstacles.length,6);
  for(const o of s.obstacles){assert.ok(Math.abs(o.x)+o.w/2<b.x);assert.ok(Math.abs(o.z)+o.d/2<b.z);assert.ok(!circleHitsRect(0,0,2.7,o));assert.ok(s.players.every(p=>!circleHitsRect(p.x,p.z,1.2,o)));}
 }
});
test('enemies spawn at the expanded boundary and ordinary pickups use the new space',()=>{
 for(const wave of [1,3,8]){
  let outsideOldPickup=false;
  for(let seed=1;seed<=24;seed++){
   const s=world(wave);s.seed=seed;s.spawnIn=0;s.pickupIn=0;s.obstacles=[];stepGame(s,[],TICK,[0,1,2,3]);const b=arenaBounds(s),e=s.enemies[0];
   assert.ok(e);assert.ok(Math.abs(e.x)<=b.x-.36&&Math.abs(e.z)<=b.z-.36);
   assert.ok(Math.abs(Math.abs(e.x)-(b.x-.8))<1e-7||Math.abs(Math.abs(e.z)-(b.z-.8))<1e-7);
   assert.equal(s.pickups.length,1);const item=s.pickups[0];assert.ok(Math.abs(item.x)<=b.x-2&&Math.abs(item.z)<=b.z-2);
   if(Math.abs(item.x)>10||Math.abs(item.z)>7)outsideOldPickup=true;
  }assert.ok(outsideOldPickup);
 }
});
test('projectiles survive in the added space and still stop at the expanded boundary',()=>{
 const s=world(3),b=arenaBounds(s);s.obstacles=[];s.players.forEach(p=>{p.x=0;p.z=0;});
 const bullet=(id,x,vx,owner=0)=>({id,x,z:0,vx,vz:0,ttl:1,owner,element:'fire',damage:3,crit:false,pierce:0,nova:0});
 s.bullets=[bullet(901,13,13)];s.enemyShots=[bullet(902,14,5,-1)];stepGame(s,[],TICK,[0,1,2,3]);assert.equal(s.bullets.length,1);assert.equal(s.enemyShots.length,1);
 s.bullets=[bullet(903,b.x-.01,13)];s.enemyShots=[bullet(904,b.x-.01,5,-1)];stepGame(s,[],TICK,[0,1,2,3]);assert.equal(s.bullets.length,0);assert.equal(s.enemyShots.length,0);
});
test('enemy movement and friendly knockback do not snap actors to the former arena',()=>{
 const s=world(2),b=arenaBounds(s);s.obstacles=[];s.players.forEach(p=>{p.x=16;p.z=0;});s.players[1].x=18;
 s.enemies=[{id:100,type:'grunt',x:17,z:3,hp:100,maxHp:100,speed:1,spawn:0,attack:0,special:99,wind:0,dash:0}];
 s.bullets=[{id:900,owner:0,element:'fire',x:17.6,z:0,vx:13,vz:0,ttl:1,damage:3,crit:false,pierce:0,nova:0}];
 stepGame(s,[],TICK,[0,1,2,3]);assert.ok(s.enemies[0].x>12);assert.ok(s.players[1].x>18);assert.ok(s.players[1].x<=b.x-.4);assert.equal(s.players[1].hp,100);
});
test('wave completion preserves a player standing near the expanded outer edge',()=>{
 const s=world(4),p=s.players[0],b=arenaBounds(s);p.x=b.x-1;p.z=b.z-1;const position={x:p.x,z:p.z};s.remaining=0;s.enemies=[];
 for(let n=0;n<123;n++)stepGame(s,[],TICK);assert.equal(s.phase,'upgrade');close(p.x,position.x);close(p.z,position.z);
});
