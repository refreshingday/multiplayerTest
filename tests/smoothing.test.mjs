import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,LIMITS} from '../game-core-v23.js';import {SmoothWorld} from '../prediction-v23.js';import {packSnapshot,unpackSnapshot} from '../snapshot-v23.js';
function sample(t){const s=createGame('coop',[0,1,2,3],12);s.phase='combat';s.time=t/1000;s.obstacles=[];s.players.forEach(p=>{p.x=t/500;p.z=0;});s.enemies=[{id:100,x:t/500,z:3,hp:100,maxHp:100,type:'grunt',speed:2,pushId:0}];return s;}
test('buffered remote players and monsters move monotonically through jitter and missing packets',()=>{
 const smooth=new SmoothWorld(),arrivals=[0,50,120,145,240,255,330,400,470,495,600,645,760,800,880,950,1000],frames=arrivals.map((at,i)=>({at,s:sample(i*60)}));let at=0,previous=null,largestFreeze=0,freeze=0;
 for(let t=0;t<=1100;t+=1000/60){while(at<frames.length&&frames[at].at<=t){smooth.push(frames[at].s,frames[at].at);at++;}const v=smooth.view(t,null);if(!v)continue;
  assert.ok(Number.isFinite(v.players[1].x));assert.equal(v.players[1].x,v.enemies[0].x);
  if(previous!==null&&t>250){assert.ok(v.players[1].x>=previous-1e-8);assert.ok(v.players[1].x-previous<.3);freeze=Math.abs(v.players[1].x-previous)<1e-8?freeze+1:0;largestFreeze=Math.max(largestFreeze,freeze);}
  previous=v.players[1].x;
 }assert.ok(largestFreeze<9);assert.ok(smooth.frames.length<=24);
});
test('own movement remains immediate, and stale remote extrapolation stops after a bounded distance',()=>{
 const smooth=new SmoothWorld();smooth.push(sample(0),0);smooth.push(sample(50),50);const own={...sample(50).players[1],x:8};assert.equal(smooth.view(70,own).players[1].x,8);
 const later=smooth.view(2000,null),latest=sample(50);assert.ok(later.enemies[0].x<=latest.enemies[0].x+2*.12+1e-8);
 const paused=sample(100);paused.paused=true;smooth.push(paused,2050);assert.equal(smooth.view(2500,null).enemies[0].x,paused.enemies[0].x);
});
test('phase, map, knockback and light-form barriers prevent stale interpolation',()=>{
 const smooth=new SmoothWorld();smooth.push(sample(0),0);const changed=sample(50);changed.mapId++;changed.players[1].x=12;smooth.push(changed,50);assert.equal(smooth.view(60,null).players[1].x,12);
 const light=sample(100);light.mapId=changed.mapId;light.players[1].choice={id:1,left:10,offers:['might','swift','focus'],level:2};light.players[1].x=10;smooth.push(light,100);assert.equal(smooth.view(110,null).players[1].x,10);
});
test('compact dense snapshots round-trip authority and materially reduce bytes',()=>{
 const s=sample(100);s.enemies=Array.from({length:LIMITS.enemies},(_,i)=>({id:100+i,type:'grunt',x:i%9,z:Math.floor(i/9),maxHp:100,hp:100,bar:2,speed:2,attack:0,hit:0,slow:0,poison:3,poisonTick:.5,poisonTicks:2,poisonPower:1,poisonOwner:0,spawn:0,special:2,wind:0,dash:0,ax:0,az:-1}));
 s.bullets=Array.from({length:LIMITS.bullets},(_,i)=>({id:900+i,a:1,shot:0,x:0,z:0,vx:13,vz:0,ttl:1.8,owner:i%4,element:'electric',crit:false,damage:1,pierce:1,nova:0,chains:2,hitIds:[100]}));
 const packed=JSON.parse(JSON.stringify(packSnapshot(s))),decoded=unpackSnapshot(packed);assert.deepEqual(decoded,s);
 const rawBytes=new TextEncoder().encode(JSON.stringify(s)).length,bytes=new TextEncoder().encode(JSON.stringify(packed)).length;assert.ok(bytes<rawBytes*.6);assert.ok(bytes<65536);
 const bad=packSnapshot(s);bad.enemies[0]=['broken'];assert.equal(unpackSnapshot(bad),null);assert.equal(unpackSnapshot({...packed,compact:2}),null);
});
