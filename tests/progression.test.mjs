import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,stepGame,stepPlayer,choosePerk,killsForLevel,isLight,stats,PERKS,LEVELS} from '../game-core-v23.js';
import {LocalPrediction,RemoteInputs,TICK} from '../prediction-v23.js';
function arena(){const s=createGame('coop',[0,1,2,3],12);s.phase='combat';s.remaining=1;s.spawnIn=s.pickupIn=999;s.obstacles=[];s.players.forEach((p,i)=>{p.x=7+i;p.z=5;});return s;}
function foe(id,x=0,z=-3,hp=1){return{id,type:'grunt',x,z,hp,maxHp:hp,speed:0,bar:0,attack:0,hit:0,spawn:0,special:999,wind:0,dash:0,slow:0,poison:0,poisonTick:0,poisonTicks:0,poisonPower:1,poisonOwner:0};}
function kill(s,owner=0){const e=foe(s.nextId++);s.enemies.push(e);s.bullets.push({id:s.nextId++,owner,element:'fire',x:0,z:-2.4,vx:0,vz:-13,ttl:1,damage:3,crit:false,pierce:0,nova:0});stepGame(s,[],TICK,[0,1,2,3]);}
function run(s,seconds){for(let n=0;n<Math.ceil(seconds/TICK);n++)stepGame(s,[],TICK,[0,1,2,3]);}
test('the killer levels after three kills and each subsequent level requires more kills',()=>{
 const s=arena(),p=s.players[1];kill(s,1);kill(s,1);assert.equal(p.level,1);assert.equal(p.xp,2);kill(s,1);
 assert.equal(p.level,2);assert.equal(p.xp,0);assert.ok(isLight(p));assert.equal(p.choice.offers.length,3);assert.equal(new Set(p.choice.offers).size,3);assert.equal(s.players[0].level,1);assert.equal(s.players[0].xp,0);
 for(let level=1;level<25;level++)assert.ok(killsForLevel(level+1)>killsForLevel(level));
 const c=p.choice;assert.ok(choosePerk(s,1,c.offers[0],c.id));assert.equal(p.perks[c.offers[0]],1);
 for(let n=0;n<killsForLevel(2);n++)kill(s,1);assert.equal(p.level,3);assert.equal(p.choice.level,3);
});
test('the host auto-selects the first displayed offer at ten seconds, once only',()=>{
 const s=arena();for(let i=0;i<3;i++)kill(s);const p=s.players[0],c=p.choice,key=c.offers[0];
 run(s,9.9);assert.ok(isLight(p));assert.ok(!p.perks[key]);run(s,.1);assert.equal(p.choice,null);assert.equal(p.perks[key],1);
 assert.equal(choosePerk(s,0,key,c.id),false);run(s,2);assert.equal(p.perks[key],1);
});
test('manual selections reject stale choice IDs and unoffered powers without affecting teammates',()=>{
 const s=arena();for(let n=0;n<3;n++){kill(s,0);kill(s,1);}const p=s.players[0],q=s.players[1],c=p.choice,other=q.choice;
 const invalid=PERKS.find(k=>!c.offers.includes(k.key)).key;assert.equal(choosePerk(s,0,invalid,c.id),false);assert.equal(choosePerk(s,0,c.offers[1],c.id+1),false);
 assert.ok(choosePerk(s,0,c.offers[1],c.id));assert.equal(p.choice,null);assert.equal(q.choice,other);assert.equal(s.paused,false);assert.equal(s.phase,'combat');
});
test('light form is not targeted or hit by monsters, enemy shots or friendly knockback',()=>{
 const s=arena();for(let n=0;n<3;n++)kill(s);const p=s.players[0];p.x=0;p.z=0;s.players[1].x=5;s.players[1].z=0;
 s.players[2].hp=s.players[3].hp=0;const e=foe(900,.3,0,100);e.speed=1;s.enemies=[e];
 s.enemyShots=[{id:901,x:0,z:.1,vx:0,vz:-5.4,ttl:1,owner:-1}];
 s.bullets=[{id:902,owner:1,element:'fire',x:0,z:.1,vx:0,vz:-13,ttl:1,damage:3,pierce:0,nova:0}];
 const position={x:p.x,z:p.z};stepGame(s,[],TICK,[0,1,2,3]);
 assert.equal(p.hp,100);assert.equal(p.pushId,0);assert.ok(e.x>.3);assert.deepEqual({x:p.x,z:p.z},position);
 stepPlayer(s,p,{x:1,z:0},.05);assert.deepEqual({x:p.x,z:p.z},position);assert.equal(p.charging,false);
 s.players[1].hp=0;const before=e.x;run(s,1);assert.equal(e.x,before);
});
test('guests do not predict movement or casts during protected choices',()=>{
 const s=arena();for(let n=0;n<3;n++)kill(s,1);const p=s.players[1],local=new LocalPrediction(1),remote=new RemoteInputs(1);
 local.reconcile(structuredClone(s),0,true);for(let n=0;n<30;n++)local.step({x:1,z:0},TICK,true);
 assert.equal(local.player.x,p.x);assert.equal(local.drainEvents().length,0);assert.ok(remote.add(local.packet()));remote.consume(s,.05);local.reconcile(structuredClone(s),remote.done);
 assert.equal(local.player.x,p.x);assert.ok(isLight(local.player));
});
test('queued levels get distinct choice IDs and a fresh timer without losing earned XP',()=>{
 const s=arena(),p=s.players[0];for(let n=0;n<8;n++)kill(s);assert.equal(p.level,3);assert.equal(p.levelQueue.length,1);const first=p.choice;
 assert.ok(choosePerk(s,0,first.offers[0],first.id));assert.ok(p.choice.id>first.id);assert.equal(p.choice.level,3);assert.equal(p.choice.left,10);assert.equal(p.levelQueue.length,0);
});
test('pause and recovery preserve choices; clearing a wave advances without waiting for the squad',()=>{
 const s=arena();for(let n=0;n<3;n++)kill(s);const p=s.players[0],left=p.choice.left;s.paused=true;run(s,20);assert.equal(p.choice.left,left);s.paused=false;
 s.remaining=0;s.enemies=[];run(s,2.1);assert.equal(s.wave,2);assert.equal(s.phase,'starting');assert.equal(s.upgrade,null);assert.ok(p.choice);assert.ok(p.choice.left<8);
});
test('poison finishers earn XP and restart resets levels and choices',()=>{
 const s=arena(),p=s.players[2];const e=foe(900,0,-3,1);e.poison=1;e.poisonTick=0;e.poisonOwner=2;e.poisonPower=1;s.enemies=[e];
 stepGame(s,[],TICK,[0,1,2,3]);assert.equal(p.xp,1);assert.equal(p.kills,1);
 const fresh=createGame('coop',[0,1,2,3],12);assert.ok(fresh.players.every(p=>p.level===1&&p.xp===0&&p.choice===null&&p.levelQueue.length===0));
});
