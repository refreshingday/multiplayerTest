import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,step,hit,makeCourse,territory,facing,outward,joystickAngle,rapidStrength,COURSE_LENGTH,RIVER_HALF_WIDTH,RAFT_RADIUS,BANK_CONTACT_X,bankLimits,riverPoint,riverFrame,shorePoint,BEND_LENGTH,BEND_AMPLITUDE,PUFF,collectPowerUp} from '../core.js';
const run=(s,input,seconds)=>{for(let i=0;i<seconds*60;i++)step(s,input,1/60);};
test('golden beans double thrust temporarily without adding fuel or hearts',()=>{
 const normal=createState(),powered=createState();normal.phase=powered.phase='playing';normal.angle=powered.angle=Math.PI;normal.fuel=powered.fuel=40;
 collectPowerUp(powered);assert.equal(powered.fuel,40);assert.equal(powered.lives,3);assert.equal(powered.powerTime,8);assert.equal(powered.beans,1);
 step(normal,{boost:true},1/60);step(powered,{boost:true},1/60);
 assert.ok(Math.abs((powered.speed-PUFF.current)/(normal.speed-PUFF.current)-2)<1e-9);assert.equal(powered.fuel,normal.fuel);
 run(powered,{},3);assert.ok(powered.powerTime>4&&powered.powerTime<6);collectPowerUp(powered);assert.equal(powered.powerTime,8);
 powered.phase='paused';run(powered,{},3);assert.equal(powered.powerTime,8);powered.phase='playing';run(powered,{},8.1);assert.equal(powered.powerTime,0);
 const empty=createState();empty.phase='playing';empty.fuel=0;collectPowerUp(empty);step(empty,{boost:true},1/60);assert.equal(empty.fuel,0);assert.equal(empty.boosting,false);assert.equal(empty.speed,PUFF.current);
});
test('an idle raft drifts gently without sideways movement',()=>{
 const s=createState();s.phase='playing';run(s,{},60);assert.ok(Math.abs(s.distance-PUFF.current*60)<1e-8);assert.equal(s.x,0);assert.equal(s.speed,PUFF.current);assert.equal(s.vx,0);assert.equal(s.fuel,100);assert.equal(s.phase,'playing');
});
test('puffs supply forward motion and the raft settles back to the gentle current after release',()=>{
 const s=createState();s.phase='playing';s.angle=Math.PI;run(s,{boost:true},1);assert.ok(s.distance>1);assert.ok(s.speed>3);const powered=s.distance;
 run(s,{},3);assert.ok(s.distance>powered);assert.equal(s.speed,PUFF.current);assert.equal(s.vx,0);const stopped=s.distance;run(s,{},10);assert.ok(Math.abs(s.distance-stopped-PUFF.current*10)<1e-8);
});
test('solo wraps around the full circle in either direction',()=>{const s=createState();s.phase='playing';run(s,{right:true},3);assert.ok(s.angle<0);run(s,{left:true},3);assert.ok(Math.abs(s.angle)<1e-9);run(s,{left:true},3);assert.ok(s.angle>0);});
test('each crew has equal territories and all captains stay inside their own arc',()=>{for(const count of [2,3,4])for(let i=0;i<count;i++){const area=territory(count,i),s=createState(count,i);assert.ok(Math.abs(area.arc-2*Math.PI/count)<1e-9);s.phase='playing';run(s,{right:true},7);assert.equal(s.angle,area.max);run(s,{left:true},10);assert.equal(s.angle,area.min);}});
test('Pip faces the center and the gas jet points outward at every angle',()=>{for(let a=-Math.PI;a<=Math.PI;a+=.1){const d=facing(a);assert.ok(Math.abs(d.x*Math.sin(a)+d.z*(-Math.cos(a))+1)<1e-9);const jet=outward(a);assert.ok(Math.abs(d.x+jet.x)<1e-9);assert.ok(Math.abs(d.z+jet.z)<1e-9);}});
test('outward gas recoil moves the board inward and consumes regenerating fuel',()=>{const s=createState();s.phase='playing';run(s,{right:true},.3);run(s,{boost:true},1);assert.ok(s.x<0);assert.ok(s.speed<PUFF.current);assert.ok(s.fuel<80);const low=s.fuel;run(s,{},4);assert.ok(s.fuel>low);assert.equal(s.speed,PUFF.current);const left=createState();left.phase='playing';run(left,{left:true},.3);run(left,{boost:true},1);assert.ok(left.x>0);});
test('an empty tank stays empty while held, stops thrust, and recharges only after release',()=>{
 for(const dt of [1/60,.05]){const s=createState();s.phase='playing';s.angle=Math.PI;
  for(let i=0;i<10/dt;i++){step(s,{boost:true},dt);if(i*dt>4.1){assert.equal(s.fuel,0);assert.equal(s.boosting,false);if(i*dt>7)assert.equal(s.speed,PUFF.current);}}
  for(let i=0;i<1/dt;i++)step(s,{},dt);assert.ok(s.fuel>0);assert.equal(s.boosting,false);const fuel=s.fuel;step(s,{boost:true},dt);assert.ok(s.fuel<fuel);assert.equal(s.boosting,true);
 }
});
test('damage has a grace period and three distinct hits end the game',()=>{const s=createState();s.phase='playing';assert.ok(hit(s));assert.equal(s.lives,2);assert.equal(hit(s),false);run(s,{},2.3);assert.ok(hit(s));run(s,{},2.3);assert.ok(hit(s));assert.equal(s.phase,'lost');assert.equal(s.lives,0);});
test('pausing freezes gameplay, fuel, and progress',()=>{const s=createState();s.phase='paused';const before={...s};run(s,{boost:true,right:true},5);assert.deepEqual(s,before);});
test('course generation is deterministic and includes three hazard types and beans',()=>{assert.deepEqual(makeCourse(),makeCourse());assert.notDeepEqual(makeCourse(),makeCourse(2));assert.deepEqual(new Set(makeCourse().map(o=>o.kind)),new Set(['rock','log','whirlpool','bean']));});
test('finish triggers a win at 800 m',()=>{const s=createState();s.phase='playing';s.distance=COURSE_LENGTH-.02;s.angle=Math.PI;step(s,{},1/60);assert.equal(s.phase,'playing');assert.ok(s.distance<COURSE_LENGTH);step(s,{boost:true},.05);assert.equal(s.phase,'won');assert.equal(s.distance,COURSE_LENGTH);});
test('raft does not hit an invisible wall before reaching the visible shore',()=>{
 for(const side of [-1,1])for(const x of [8.3,9.2,BANK_CONTACT_X-.01]){
  const s=createState();s.phase='playing';s.x=side*x;step(s,{},1/60);
  assert.equal(s.lives,3);assert.equal(s.x,side*x);
  assert.ok(Math.abs(s.x)+RAFT_RADIUS<RIVER_HALF_WIDTH);
 }
});
test('both banks damage only at visible rim contact and rebound into the river',()=>{
 for(const side of [-1,1]){
  const s=createState();s.phase='playing';s.x=side*(BANK_CONTACT_X-.01);s.vx=side*2;
  step(s,{},1/60);assert.equal(s.lives,2);const banks=bankLimits(s.distance);assert.ok(Math.abs(s.x-(side<0?banks.left:banks.right))<1e-9);
  assert.ok(s.vx*side<0,'rebound must point away from the shore');
  const contact=s.x;step(s,{},1/60);assert.equal(s.lives,2);assert.ok(Math.abs(s.x)<Math.abs(contact));
 }
});
test('bank contact during the damage grace period still rebounds without another lost heart',()=>{
 for(const side of [-1,1]){
  const s=createState();s.phase='playing';s.invincible=1;s.x=side*(BANK_CONTACT_X+.02);s.vx=side*3;
  step(s,{},1/60);assert.equal(s.lives,3);const banks=bankLimits(s.distance);assert.equal(s.x,side<0?banks.left:banks.right);assert.ok(s.vx*side<0);
 }
});
test('every obstacle row has a full clear lane wide enough for the raft',()=>{const course=makeCourse();for(const bean of course.filter(o=>o.kind==='bean')){const hazards=course.filter(o=>o.at===bean.at+6&&o.kind!=='bean');assert.ok(hazards.every(o=>Math.abs(o.x-bean.x)>o.radius+1.65),`blocked safe lane at ${bean.at}`);}});

test('a front-side puff moves backward against a still river',()=>{const s=createState();s.phase='playing';s.distance=20;s.angle=0;run(s,{boost:true},1);assert.ok(s.speed<0);assert.ok(s.distance<20);});
test('boosts and player weight produce a damped tilt toward different targets',()=>{const s=createState();s.phase='playing';s.angle=Math.PI/2;run(s,{},1);assert.ok(s.rollZ<-.02);const weightRoll=s.rollZ;run(s,{boost:true},1);assert.ok(Math.abs(s.rollZ-weightRoll)>.02);s.angle=0;run(s,{},4);assert.ok(Math.abs(s.rollZ)<.002);});
test('choppy water produces more roll than quiet water',()=>{const calm=createState(),chop=createState();calm.phase=chop.phase='playing';chop.distance=78;let calmRoll=0,chopRoll=0;for(let i=0;i<90;i++){step(calm,{},1/60);step(chop,{},1/60);calmRoll=Math.max(calmRoll,Math.abs(calm.rollZ));chopRoll=Math.max(chopRoll,Math.abs(chop.rollZ));}assert.ok(chopRoll>calmRoll+.04);assert.equal(rapidStrength(0),0);assert.ok(rapidStrength(78)>.99);});
test('impact roll is bounded and settles after the hit',()=>{const s=createState();s.phase='playing';hit(s,-1,1);run(s,{},.2);assert.ok(s.rollZ<-.05);assert.ok(Math.abs(s.rollZ)<=.3);run(s,{},4);assert.ok(Math.abs(s.rollZ)<.002);});

test('joystick targets use the short path around the solo circle and stop at the target',()=>{const s=createState();s.phase='playing';s.angle=Math.PI-.05;run(s,{aimAngle:-Math.PI+.05},.1);assert.ok(Math.abs(s.angle-(-Math.PI+.05))<1e-9);const a=s.angle;run(s,{aimAngle:a},1);assert.ok(Math.abs(s.angle-a)<1e-9);});
test('joystick respects every crew territory even when pointed across the board',()=>{for(const count of [2,3,4])for(let i=0;i<count;i++){const s=createState(count,i),area=territory(count,i);s.phase='playing';for(let j=0;j<8;j++){run(s,{aimAngle:j*Math.PI/4},2);assert.ok(s.angle>=area.min-1e-9&&s.angle<=area.max+1e-9);}}});
test('joystick maps screen directions to the camera plane',()=>{const yaw=Math.atan2(8,21);assert.ok(Math.abs(joystickAngle(0,1)+yaw)<1e-9);assert.ok(Math.abs(joystickAngle(1,0)-(Math.PI/2-yaw))<1e-9);});

test('course has eight broad alternating bends rather than a straight channel',()=>{const xs=[];let previous=0,turns=0;for(let d=0;d<=COURSE_LENGTH;d++){const f=riverFrame(d);xs.push(f.x);const sign=Math.sign(f.tx);if(sign&&previous&&sign!==previous)turns++;if(sign)previous=sign;}assert.ok(Math.max(...xs)-Math.min(...xs)>25);assert.ok(turns>=7);assert.ok(BEND_LENGTH/2<=50);});
function shoreDistance(point,d,side){let best=Infinity;for(let t=Math.floor(d-10);t<d+10;t++){const a=shorePoint(t,side),b=shorePoint(t+1,side),dx=b.x-a.x,dz=b.z-a.z;const u=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(point.x-a.x-dx*u,point.z-a.z-dz*u));}return best;}
test('collision meets the same shoreline segments that are drawn through every bend',()=>{for(let d=0;d<=COURSE_LENGTH;d+=3){const limits=bankLimits(d);for(const side of [-1,1]){const offset=side<0?limits.left:limits.right,point=riverPoint(d,offset);assert.ok(Math.abs(shoreDistance(point,d,side)-RAFT_RADIUS)<1e-7,`bad contact at ${d}, side ${side}`);const safe=riverPoint(d,offset-side*.1);assert.ok(shoreDistance(safe,d,side)>RAFT_RADIUS+.09);}}});
test('a puff-propelled raft stays in the river through the complete winding route',()=>{const s=createState();s.phase='playing';s.angle=Math.PI;for(let i=0;i<6000&&s.phase==='playing';i++){s.fuel=100;step(s,{boost:true},1/60);}assert.equal(s.phase,'won');assert.equal(s.lives,3);});
