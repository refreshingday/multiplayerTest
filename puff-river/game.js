import * as THREE from './vendor/three.module.js';
import {COURSE_LENGTH,PLAYER_RADIUS,RIVER_HALF_WIDTH,RAFT_RADIUS,riverFrame,riverPoint,shorePoint,bankLimits,RAPIDS,territory,facing,joystickAngle,createState,step,hit,makeCourse} from './core.js?v=1.1.0';
import {RoomLink} from './room.js?v=1.1.0';
import {RiverSession} from './multiplayer.js?v=1.1.0';
import {CAPTAINS} from './crew-core.js?v=1.1.0';
const $=id=>document.getElementById(id), game=$('game'), view=$('viewport');
const input={left:false,right:false,boost:false,aimAngle:null};let joystickPointer=null,boostPointer=null;let state=createState(),course=[],world=[],particles=[],last=performance.now(),elapsed=0,puffTimer=0,modalMode='',returnPhase='menu',soundOn=false,audio=null,shake=0,toastTimer;
state.angle=2.3;
let online=false,onlineStatus='',lastOnlineRun=0,lastDeckKey='',lastEvent=0,lastHUD=0,onlineToken=0;
const localCaptain=()=>online?(state.players?.find(p=>p.id===voyage.localId)||state):state;
const room=new RoomLink({onOpen:()=>{voyage.visibility(!document.hidden);voyage.opened();},onPeerJoin:id=>voyage.joined(id),onPeerLeave:id=>voyage.left(id),onMessage:(message,from)=>voyage.receive(message,from),onReconnecting:id=>voyage.reconnecting(id),onReconnected:id=>voyage.reconnected(id),onStatus:text=>{onlineStatus=text;syncOnlineUI();},onClose:text=>leaveOnline(text)});
const voyage=new RiverSession({transport:room,onChange:()=>syncOnlineUI(),onStatus:text=>{onlineStatus=text;syncOnlineUI();}});

const mobile=()=>innerWidth<=700;
let renderer;
try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){$('loading').textContent='This little river needs WebGL. Please try a browser with hardware acceleration enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#bee4cf');view.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#c8e8cc');scene.fog=new THREE.Fog('#c8e8cc',49,115);
const camera=new THREE.PerspectiveCamera(38,1,.1,180);
scene.add(new THREE.HemisphereLight('#fffbe7','#639e82',2.5));const sun=new THREE.DirectionalLight('#fff5d9',3);sun.position.set(-18,30,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-35;sun.shadow.camera.far=90;sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;scene.add(sun);scene.add(sun.target);
const materials=new Map();function mat(c,roughness=.85){if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness}));return materials.get(c);}
function mesh(geo,c,parent=scene){const m=new THREE.Mesh(geo,mat(c));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function sphere(c,x,y,z,sx,sy= sx,sz=sx,parent=scene,detail=14){const m=mesh(new THREE.SphereGeometry(1,detail,10),c,parent);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;}
function box(c,x,y,z,sx,sy,sz,parent=scene){const m=mesh(new THREE.BoxGeometry(sx,sy,sz),c,parent);m.position.set(x,y,z);return m;}
function cylinder(c,x,y,z,rt,rb,h,parent=scene,n=24){const m=mesh(new THREE.CylinderGeometry(rt,rb,h,n),c,parent);m.position.set(x,y,z);return m;}
function torus(c,r,t,parent=scene,arc=Math.PI*2){const m=mesh(new THREE.TorusGeometry(r,t,8,64,arc),c,parent);m.rotation.x=Math.PI/2;return m;}
const water=mesh(new THREE.PlaneGeometry(240,200,48,100),'#71cbbb');water.rotation.x=-Math.PI/2;water.position.set(0,-.26,-55);water.castShadow=false;water.material.transparent=true;water.material.opacity=.78;water.material.depthWrite=false;
const waterPositions=water.geometry.attributes.position,baseWater=waterPositions.array.slice();
const riverBed=box('#64bcaa',-15,-3,-55,240,.8,200);riverBed.castShadow=false;
const banks=[];
function bank(side){
 const positions=[];
 for(let d=-180;d<600;d++){
  const a=shorePoint(d,side),b=shorePoint(d+1,side),outer=side*120;
  positions.push(a.x,-.1,a.z,b.x,-.1,b.z,outer,-.1,a.z,b.x,-.1,b.z,outer,-.1,b.z,outer,-.1,a.z);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:'#b7d68a',roughness:.85,side:THREE.DoubleSide});
 const land=new THREE.Mesh(geo,material);land.receiveShadow=true;land.name='riverbank-'+side;scene.add(land);banks.push(land);
}
bank(-1);bank(1);
// Shoreline is deliberately built from soft, chunky shapes.
function tree(x,z,scale=1){const g=new THREE.Group();cylinder('#a48455',0,1,0,.17,.24,2.1,g,7);sphere('#779e55',0,2.6,0,1.2,1.6,1.1,g,8);sphere('#91b764',-.55,2.1,.1,.85,.95,.9,g,8);sphere('#9fbe69',.45,2.8,.3,.85,1.15,.8,g,8);g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);return g;}
let seed=99;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
for(let i=0;i<110;i++){const side=i%2?1:-1,z=28-rand()*145,x=side*(13.7+rand()*15);let obj;if(i<75)obj=tree(x,z,.65+rand()*.8);else{obj=new THREE.Group();for(let j=0;j<4;j++)sphere(['#7fa355','#8fb45b','#aac477'][j%3],(rand()-.5)*1.5,.3,(rand()-.5)*1.5,.5,.45,.5,obj,8);obj.position.set(x,0,z);scene.add(obj);}world.push({obj,startZ:z});}
for(let i=0;i<35;i++){const g=new THREE.Group(),side=i%2?1:-1;cylinder('#75a85b',0,.16,0,.15,.04,.35,g,6);for(let j=0;j<5;j++){const a=j/5*Math.PI*2;sphere('#fff8d8',Math.cos(a)*.16,.36,Math.sin(a)*.16,.14,.06,.14,g,8);}sphere('#efc45b',0,.39,0,.1,.06,.1,g,8);g.position.set(side*(12.7+rand()*3),0,25-rand()*140);scene.add(g);world.push({obj:g,startZ:g.position.z});}
for(let i=0;i<20;i++){const g=new THREE.Group();cylinder('#78b483',0,0,0,.45,.45,.035,g,14);if(i%3===0){sphere('#ffe2c7',0,.14,0,.16,.14,.16,g,8);sphere('#fff5d9',.1,.1,0,.16,.08,.16,g,8);}g.position.set((i%2?1:-1)*(9.5+rand()*1.2),-.16,24-rand()*120);scene.add(g);world.push({obj:g,startZ:g.position.z});}
const streamLines=[];for(let i=0;i<110;i++){const line=mesh(new THREE.PlaneGeometry(.03+rand()*.05,.3+rand()*1.5),i%3?'#a0e0c6':'#e0efc9');line.rotation.x=-Math.PI/2;line.position.set((rand()-.5)*23,-.14,25-rand()*125);line.castShadow=false;line.receiveShadow=false;streamLines.push({obj:line,startZ:line.position.z});}
// Bake scenery along the entire winding course; only nearby chunks render.
const sceneryChunks=[],batches=new Map();
for(let repeat=-1;repeat<4;repeat++)for(const {obj,startZ} of [...world,...streamLines]){
 const d=-startZ+repeat*150;if(d< -170||d>560)continue;
 const clone=obj.clone(true),offset=obj.position.x,frame=riverFrame(d);
 let p=riverPoint(d,offset);
 if(Math.abs(offset)>RIVER_HALF_WIDTH){const side=Math.sign(offset);p=shorePoint(d,side);p.x+=side*(Math.abs(offset)-RIVER_HALF_WIDTH);}
 clone.position.set(p.x,obj.position.y,p.z);clone.rotation.order="YXZ";clone.rotation.y+=frame.yaw;clone.updateMatrixWorld(true);
 const bucket=Math.floor(d/40);
 clone.traverse(m=>{if(!m.isMesh)return;const key=bucket+':'+m.material.uuid;let batch=batches.get(key);if(!batch){batch={material:m.material,positions:[],normals:[],cast:false,bucket};batches.set(key,batch);}const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrixWorld);batch.positions.push(...geo.attributes.position.array);batch.normals.push(...geo.attributes.normal.array);batch.cast ||= m.castShadow;geo.dispose();});
}
for(const {obj} of [...world,...streamLines])scene.remove(obj);
for(const b of batches.values()){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));const m=new THREE.Mesh(geo,b.material);m.castShadow=b.cast;m.receiveShadow=true;scene.add(m);sceneryChunks.push({obj:m,at:b.bucket*40+20});}
// The round raft divides into equal territories for the chosen practice crew.
batches.clear();for(const {obj} of [...world,...streamLines])obj.traverse(m=>{if(m.geometry)m.geometry.dispose();});world.length=0;streamLines.length=0;
const raft=new THREE.Group();raft.rotation.order="YXZ";scene.add(raft);cylinder('#a77947',0,.04,0,2.44,2.42,.38,raft,64);cylinder('#e7bf7d',0,.25,0,2.41,2.41,.12,raft,64);
const deck=new THREE.Group();raft.add(deck);
function configureDeck(){
 for(const child of [...deck.children]){deck.remove(child);child.geometry.dispose();}
 const area=territory(state.playerCount,state.playerIndex),colors=['#b3dca5','#f4b0a5','#f4d68d','#a9cbd2'];
 for(let i=0;i<area.count;i++){
  const positions=[],start=i*area.arc-area.arc/2;
  for(let j=0;j<64;j++){const a=start+j/64*area.arc,b=start+(j+1)/64*area.arc;positions.push(0,.323,0,Math.sin(b)*2.29,.323,-Math.cos(b)*2.29,Math.sin(a)*2.29,.323,-Math.cos(a)*2.29);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();const wedge=mesh(geo,state.players?CAPTAINS[state.players.find(p=>p.seat===i)?.id||0].color:colors[i],deck);wedge.castShadow=false;
  if(area.count>1){const a=start,divider=box('#f6e4b4',Math.sin(a)*1.1,.35,-Math.cos(a)*1.1,.045,.055,2.2,deck);divider.rotation.y=-a;}
 }
 for(let z=-2;z<=2;z+=.36){const length=2*Math.sqrt(2.26*2.26-z*z);box('#ae8d5b',0,.327,z,length,.009,.016,deck);}
 const points=[];for(let i=0;i<=80;i++){const a=area.min+i/80*area.arc;points.push(new THREE.Vector3(Math.sin(a)*2.07,.365,-Math.cos(a)*2.07));}
 mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),80,.025,5,false),'#fff6ce',deck);
}
configureDeck();
const rope=torus('#f5dca3',RAFT_RADIUS-.09,.09,raft);rope.position.y=.36;const rope2=torus('#c39459',2.43,.035,raft);rope2.position.y=.04;
for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const tie=box('#c19c65',Math.sin(a)*2.4,.3,Math.cos(a)*2.4,.14,.17,.16,raft);tie.rotation.y=a;}
cylinder('#f7e9bf',0,.37,0,.27,.29,.1,raft,20);cylinder('#cbab74',0,.43,0,.11,.11,.07,raft,16);
// Pip lies over the rim: face-down upper body, vertical submerged hindquarters.
const pip=new THREE.Group();pip.name='pip';raft.add(pip);
const waist=new THREE.Group();waist.name='waist';waist.position.set(0,.72,0);pip.add(waist);
const upperBody=new THREE.Group();upperBody.name='prone-upper-body';upperBody.rotation.x=-Math.PI/2;waist.add(upperBody);
const lowerBody=new THREE.Group();lowerBody.name='hanging-lower-body';waist.add(lowerBody);
// Soft human stick figures: ball head, capsule torso and pill-shaped limbs.
// Anatomy is built upright, then the upper body folds 90 degrees onto the board.
const bodyColor=CAPTAINS[0].color,faceColor='#fff0d6';
function softLimb(name,color,from,to,radius,parent){
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),axis=b.clone().sub(a);
 const part=mesh(new THREE.CapsuleGeometry(radius,axis.length(),6,16),color,parent);
 part.name=name;part.position.copy(a).add(b).multiplyScalar(.5);
 part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());return part;
}
const torso=softLimb('human-torso',bodyColor,[0,.24,0],[0,.62,0],.255,upperBody);
torso.scale.z=1.35;
softLimb('human-neck',faceColor,[0,.81,0],[0,.95,0],.125,upperBody);
const head=sphere(faceColor,0,1.19,0,.365,.385,.355,upperBody,20);head.name='human-head';
for(const side of [-1,1]){
 const label=side<0?'left':'right';
 softLimb(label+'-upper-arm',bodyColor,[side*.25,.70,-.055],[side*.48,.73,-.13],.115,upperBody);
 softLimb(label+'-forearm',bodyColor,[side*.48,.73,-.13],[side*.51,1.03,-.20],.105,upperBody);
 const hand=sphere(bodyColor,side*.51,1.10,-.20,.14,.17,.135,upperBody,16);hand.name=label+'-hand';
 sphere('#34483f',side*.125,1.24,-.331,.035,.043,.022,upperBody,12);
 sphere('#fffdf3',side*.117,1.252,-.35,.011,.013,.007,upperBody,10);
}
// Rounded hips and long, simple legs hang outside the rim without clipping it.
const hips=sphere(bodyColor,0,-.16,.20,.28,.25,.245,lowerBody,18);hips.name='human-hips';
for(const side of [-1,1]){
 const label=side<0?'left':'right';
 sphere(bodyColor,side*.145,-.17,.34,.175,.22,.17,lowerBody,16);
 softLimb(label+'-thigh',bodyColor,[side*.18,-.28,.22],[side*.19,-.91,.24],.135,lowerBody);
 softLimb(label+'-calf',bodyColor,[side*.19,-.91,.24],[side*.19,-1.57,.28],.115,lowerBody);
 const foot=sphere(bodyColor,side*.19,-1.65,.30,.155,.12,.245,lowerBody,16);foot.name=label+'-foot';
}
const fartEmitter=new THREE.Object3D();fartEmitter.name='outward-fart-emitter';fartEmitter.position.set(0,-.18,.55);waist.add(fartEmitter);
// Small surface rings make the submerged half easy to read without extra HUD.
const bodyRipple=new THREE.Group();scene.add(bodyRipple);
for(let i=0;i<2;i++){const ring=torus('#c7edcd',.44+i*.20,.015,bodyRipple,Math.PI*1.7);ring.castShadow=false;ring.receiveShadow=false;ring.position.y=i*.006;ring.rotation.z=i*1.4;}
const aim=new THREE.Group();raft.add(aim);for(let i=0;i<3;i++){const a=new THREE.Shape();a.moveTo(-.19,.1);a.lineTo(0,-.13);a.lineTo(.19,.1);a.lineTo(.19,.22);a.lineTo(0,-.01);a.lineTo(-.19,.22);const arrow=mesh(new THREE.ShapeGeometry(a),'#f2f4c2',aim);arrow.rotation.x=-Math.PI/2;arrow.position.set(0,.4,-1.45+i*.35);arrow.castShadow=false;}
const captains=[{pip,upperBody,lowerBody,emitter:fartEmitter,ripple:bodyRipple,aim,puffTimer:0}];
for(let id=1;id<4;id++){
 const person=pip.clone(true);person.name='captain-'+id;raft.add(person);
 person.traverse(m=>{if(m.isMesh&&m.material===mat(bodyColor))m.material=mat(CAPTAINS[id].color);});
 const ripple=bodyRipple.clone(true);scene.add(ripple);const arrow=aim.clone(true);raft.add(arrow);
 captains.push({pip:person,upperBody:person.getObjectByName('prone-upper-body'),lowerBody:person.getObjectByName('hanging-lower-body'),emitter:person.getObjectByName('outward-fart-emitter'),ripple,aim:arrow,puffTimer:0});person.visible=ripple.visible=arrow.visible=false;
}
function rock(){const g=new THREE.Group();const m=mesh(new THREE.DodecahedronGeometry(1,0),'#7e9992',g);m.scale.set(1.25,.9,1);m.rotation.set(.1,.4,.12);m.position.y=.38;const top=mesh(new THREE.DodecahedronGeometry(.72,0),'#a0b5a3',g);top.position.set(-.25,.8,-.1);top.scale.y=.5;sphere('#789f69',.25,.78,.22,.52,.14,.45,g,7);return g;}
function log(){const g=new THREE.Group();const body=cylinder('#a98258',0,.22,0,.45,.49,3.2,g,12);body.rotation.z=Math.PI/2;for(const side of [-1,1]){const end=cylinder('#e6bd7d',side*1.61,.22,0,.4,.4,.04,g,12);end.rotation.z=Math.PI/2;for(let i=1;i<3;i++){const r=torus('#ba925c',i*.13,.017,g);r.rotation.set(0,Math.PI/2,0);r.position.set(side*1.64,.22,0);}}const branch=cylinder('#a98258',.6,.7,.05,.12,.18,.7,g,7);branch.rotation.z=-.4;g.rotation.y=.2;return g;}
function whirlpool(){const g=new THREE.Group();for(let i=0;i<5;i++){const ring=torus(i%2?'#a4e3cf':'#3b9f9b',.3+i*.32,.065,g,Math.PI*1.85);ring.position.y=-.16+i*.004;ring.rotation.z=i*.55;}const center=cylinder('#348e90',0,-.19,0,.35,.2,.03,g);center.castShadow=false;return g;}
function bean(){const g=new THREE.Group();sphere('#f8dd76',-.12,0,0,.22,.29,.2,g);sphere('#eed168',.12,.16,0,.23,.3,.2,g);const seam=torus('#c39b50',.16,.015,g,Math.PI);seam.rotation.set(0,0,-.6);seam.position.set(0,.06,-.185);g.rotation.z=-.5;g.position.y=.8;return g;}
function buildCourse(){for(const o of course){scene.remove(o.mesh);o.mesh.traverse(m=>{if(m.geometry)m.geometry.dispose();});}course=makeCourse(state.seed);for(const o of course){o.mesh=o.kind==='rock'?rock():o.kind==='log'?log():o.kind==='whirlpool'?whirlpool():bean();const p=riverPoint(o.at,o.x);o.mesh.position.x=p.x;o.mesh.position.z=p.z;scene.add(o.mesh);}}
buildCourse();
const finish=new THREE.Group();for(const side of [-1,1]){cylinder('#f6e8b9',side*10,2,0,.12,.12,4,finish,10);sphere('#e6b394',side*10,4.1,0,.22,.22,.22,finish);}
const banner=box('#fff4ce',0,3.65,0,20,.7,.07,finish);for(let i=-9;i<10;i++){const flag=mesh(new THREE.ConeGeometry(.25,.55,3),'#dd9288',finish);flag.rotation.z=Math.PI;flag.position.set(i,3.1,0);}scene.add(finish);
const rapidMeshes=RAPIDS.map(at=>{
 const group=new THREE.Group();
 const tint=new THREE.Mesh(new THREE.PlaneGeometry(22,12),new THREE.MeshBasicMaterial({color:'#e5f5c6',transparent:true,opacity:.12,depthWrite:false}));tint.rotation.x=-Math.PI/2;tint.position.set(0,-.12,-6);group.add(tint);
 for(let row=0;row<5;row++){const pts=[];for(let i=0;i<=40;i++)pts.push(new THREE.Vector3(-10+i*.5,-.1,-row*2.6+Math.sin(i*.8+row)*.23));const foam=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.035,4,false),'#d9f0d3',group);foam.castShadow=false;}
 group.updateMatrixWorld(true);group.traverse(m=>{if(!m.isMesh)return;m.geometry.applyMatrix4(m.matrixWorld);const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i++){const p=riverPoint(at-pos.getZ(i),pos.getX(i));pos.setXYZ(i,p.x,pos.getY(i),p.z);}m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();m.position.set(0,0,0);m.rotation.set(0,0,0);});scene.add(group);return {at,group};
});
function puff(visual=captains[0],actor=state){
 raft.updateMatrixWorld(true);const origin=visual.emitter.getWorldPosition(new THREE.Vector3());const local=facing(actor.angle),frame=riverFrame(state.distance),direction={x:frame.nx*local.x-frame.tx*local.z,z:frame.nz*local.x-frame.tz*local.z};
 for(let i=0;i<5;i++){const p=sphere(i%2?'#e3ebb1':'#f2edc4',origin.x,origin.y,origin.z,.22);p.castShadow=false;particles.push({obj:p,vx:-direction.x*(1.5+rand()*2)+(rand()-.5),vz:-direction.z*(1.5+rand()),life:0,duration:.8+rand()*.4});}
 if(soundOn)tone(70+rand()*35,.12,.035,'sawtooth');
}
function splash(){for(let i=0;i<14;i++){const a=rand()*Math.PI*2;const p=sphere('#dbf6df',riverPoint(state.distance,state.x,state.distance).x,.3,riverPoint(state.distance,state.x,state.distance).z,.1);p.castShadow=false;particles.push({obj:p,vx:Math.sin(a)*(2+rand()*3),vz:Math.cos(a)*(2+rand()*3),vy:2+rand()*3,life:0,duration:.65});}}
function disposeParticle(p){scene.remove(p.obj);p.obj.geometry.dispose();}
function tone(freq,duration=.12,volume=.05,type='sine'){if(!soundOn)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200);}
function resetJoystick(){joystickPointer=null;input.aimAngle=null;$('joystick-thumb').style.transform='translate(0px,0px)';$('joystick').classList.remove('active');}
function clearInput(){input.left=false;input.right=false;input.boost=false;resetJoystick();boostPointer=null;$('fart-button').classList.remove('active');}
function updateHUD(){const captain=localCaptain();$('distance').textContent=`${Math.floor(state.distance*2)} / 800 m`;$('progress').style.width=state.distance/COURSE_LENGTH*100+'%';$('beans').textContent=String(state.beans).padStart(2,'0');$('fuel').style.width=captain.fuel+'%';$('fuel-value').textContent=Math.round(captain.fuel)+'%';$('fart-button').classList.toggle('empty',captain.fuel===0);$('fart-button').classList.toggle('active',captain.boosting&&state.phase==='playing');$('fart-button').setAttribute('aria-label',captain.fuel===0?'Puff power empty. Release to recharge.':'Hold to fart');$('fuel-hint').textContent=captain.fuel===0?'Release to recharge':captain.fuel<5?'Catching your breath…':captain.boosting?'Pfffft! That’s the spirit.':'Hold the fart button';game.classList.toggle('low-fuel',captain.fuel<22);$('hearts').textContent='♥ '.repeat(state.lives)+'♡ '.repeat(3-state.lives);$('hearts').setAttribute('aria-label',`${state.lives} lives`);if(online)for(const chip of $('crew-hud').children){const p=state.players?.find(p=>p.id===Number(chip.dataset.id));if(p)chip.textContent=CAPTAINS[p.id].name+(p.id===voyage.localId?' · YOU':'')+' '+Math.round(p.fuel)+'%';}}
function start(){if(online){voyage.action('restart');syncOnlineUI();return;}state=createState(Number($('crew-size').value));if(state.playerCount===1)state.angle=Math.PI;configureDeck();state.phase='playing';clearInput();buildCourse();particles.forEach(disposeParticle);particles=[];game.classList.add('playing');$('hud').hidden=false;$('fuel-panel').hidden=false;$('pause').hidden=false;$('modal').hidden=true;modalMode='';updateHUD();toast(state.playerCount===1?'Drag the joystick to move Pip. Hold the puff icon to fart!':`${Math.round(360/state.playerCount)}° of raft is yours. Aim, then puff!`);tone(420,.15);}
function openModal(mode){if(online&&mode==='pause'){clearInput();voyage.pause();syncOnlineUI();return;}if(online&&mode==='help')voyage.pause();clearInput();returnPhase=state.phase;if(state.phase==='playing')state.phase='paused';modalMode=mode;$('modal').hidden=false;$('close-modal').hidden=mode==='result';const b=$('modal-body'),title=$('modal-title'),action=$('modal-action');if(mode==='help'){$('modal-eyebrow').textContent='CAPTAIN’S HANDBOOK';title.innerHTML='A crash course.<br>Minus the crash.';b.innerHTML='<div class="instruction"><span>↔</span><div><b>Move around your slice</b>Drag the joystick toward the part of the edge where you want Pip to rest. Pip always faces the board’s center. Arrow keys and A / D also work. Solo gets 360°. Two captains get 180° each, three get 120°, and four get 90°. Invite friends to control the other seats, or try each layout in solo practice.</div></div><div class="instruction"><span>☁</span><div><b>Aim, then let it rip</b>Hold the round puff button (or Space) to fart outward. The recoil pushes the raft inward, in the direction Pip faces. Move to the rear to go forward, the front to reverse, or a side to steer. Calm water will not carry you along; after a puff, the board coasts briefly and settles. Your weight and puffs tilt the board; foamy rapids and collisions rock it harder.</div></div><div class="instruction"><span>◒</span><div><b>Beans mean more breeze</b>Pick up golden beans for puff power. Release the fart button to recharge. Avoid rocks, logs, whirlpools, and the banks.</div></div><p>Reach the finish at <b>800 m</b> with at least one heart. Three splashes and your voyage is over.</p>';action.innerHTML='Got it. Let’s float <span>↗</span>';}else if(mode==='pause'){$('modal-eyebrow').textContent='A LITTLE BREATHER';title.innerHTML='Just floating.';b.innerHTML='<p>Your voyage is paused. Pip is taking a well-deserved sniff of the fresh river air.</p>';action.innerHTML='Keep floating <span>↗</span>';}else{const won=state.phase==='won';$('modal-eyebrow').textContent=won?'VOYAGE COMPLETE':'A SMALL SPLASH';title.innerHTML=won?'You absolute<br>wind beneath us.':'Oh, captain.<br>Overboard!';b.innerHTML=`<p>${won?'Pip made it down the Lazy River. A tiny captain, a mighty breeze.':'The river got the last laugh. Take another float — aim early, and save a little puff for tight spots.'}</p><div class="result-stats"><div><b>${Math.floor(state.distance*2)}<small> m</small></b><small>DISTANCE</small></div><div><b>${state.beans}</b><small>BEANS</small></div><div><b>${Math.floor(state.time)}<small> s</small></b><small>TIME</small></div></div>`;action.innerHTML='One more float <span>↗</span>';}}
function closeModal(){if(online&&modalMode!=='result'){$('modal').hidden=true;modalMode='';clearInput();syncOnlineUI();return;}if(modalMode==='result'){start();return;}$('modal').hidden=true;if(state.phase==='paused')state.phase=returnPhase==='playing'?'playing':'menu';modalMode='';clearInput();}
function syncOnlineUI(){
 if(!online)return;
 const current=voyage.state,joining=voyage.role==='guest'&&!current;
 $('room-panel').hidden=!!current&&current.phase==='playing'&&!voyage.waiting;
 $('room-title').textContent=voyage.waiting?'Finding your crew…':!current?'Hop aboard.':current.phase==='paused'?'A little breather.':'All aboard?';
 $('room-code-display').textContent=room.code?room.code.slice(0,3)+' '+room.code.slice(3):'··· ···';
 $('room-code-wrap').hidden=!room.code;$('join-form').hidden=!!current||!!room.code;
 $('room-message').textContent=voyage.waiting?'Reconnecting automatically. Your seat is reserved for two minutes. Keep every game tab open.':joining?'Connecting to your captain…':current?.reason||onlineStatus||'Same Wi-Fi. One raft. Up to four captains.';
 $('room-ready').hidden=!current||['won','lost'].includes(current.phase);
 $('room-ready').disabled=!room.code||!current||!voyage.visible||voyage.waiting||voyage.recovering.size>0||voyage.syncNeeds.size>0||!!voyage.local?.ready||[...voyage.pending.values()].some(p=>p.message.type==='ready');
 $('room-ready').textContent=voyage.local?.ready?'Waiting for the crew…':current?.phase==='paused'?'Ready to keep floating':'Ready to float';
 $('room-copy').disabled=!room.code;$('room-share').disabled=!room.code;
 $('crew-menu').hidden=false;$('room-restart').hidden=!current||current.phase!=='paused';
 $('crew-list').replaceChildren();$('crew-hud').replaceChildren();
 for(let id=0;id<4;id++){
  const p=current?.players.find(p=>p.id===id&&p.active),row=document.createElement('div');row.className='crew-seat';row.style.setProperty('--seat',CAPTAINS[id].color);
  const name=document.createElement('strong'),detail=document.createElement('span');name.textContent=p?CAPTAINS[id].name+(id===voyage.localId?' · YOU':''):'Empty seat';detail.textContent=p?(!p.connected?'Reconnecting…':!p.visible?'Tab hidden':p.ready?'Ready ✓':Math.round(360/current.playerCount)+'° territory'):'Invite a friend';row.append(name,detail);$('crew-list').append(row);
  if(p){const chip=document.createElement('span');chip.className='crew-chip';chip.dataset.id=String(id);chip.style.setProperty('--seat',CAPTAINS[id].color);chip.textContent=CAPTAINS[id].name+(id===voyage.localId?' · YOU':'')+' '+Math.round(p.fuel)+'%';$('crew-hud').append(chip);}
 }
 $('crew-hud').hidden=!current||!['playing','paused'].includes(current.phase);
 if(current){
  state=voyage.renderState(0)||current;
  const local=localCaptain();state.playerIndex=local.seat;
  const key=current.run+':'+current.playerCount+':'+local.seat;
  if(lastDeckKey!==key){lastDeckKey=key;configureDeck();}
  if(lastOnlineRun!==current.run){lastOnlineRun=current.run;lastEvent=0;buildCourse();particles.forEach(disposeParticle);particles=[];for(const c of captains)c.puffTimer=0;}
  const underway=current.phase!=='lobby';game.classList.toggle('playing',underway);game.classList.toggle('online-running',current.phase==='playing'&&!voyage.waiting&&!document.hidden);
  $('hud').hidden=$('fuel-panel').hidden=!underway;$('pause').hidden=!underway;
  if(['won','lost'].includes(current.phase)){
   if(modalMode!=='result')openModal('result');$('room-panel').hidden=!voyage.waiting;
   $('modal-action').textContent=voyage.local?.restart?'Waiting for the crew…':'Vote for another float';$('modal-action').disabled=!!voyage.local?.restart||voyage.waiting||[...voyage.pending.values()].some(p=>p.message.type==='restart');
  }else if(modalMode==='result'){$('modal').hidden=true;modalMode='';$('modal-action').disabled=false;}
  if(current.phase!=='playing'||voyage.waiting)clearInput();updateHUD();
 }
}
function leaveOnline(message=''){
 ++onlineToken;room.close();voyage.reset();online=false;onlineStatus='';lastOnlineRun=0;lastDeckKey='';lastEvent=0;clearInput();
 state=createState(Number($('crew-size').value));state.angle=2.3;configureDeck();buildCourse();game.classList.remove('online','playing','online-running');
 for(const id of ['room-panel','crew-hud','crew-menu','hud','fuel-panel','pause','modal'])$(id).hidden=true;
 $('modal-action').disabled=false;modalMode='';particles.forEach(disposeParticle);particles=[];if(message)toast(message);
 const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
}
async function hostOnline(){
 if(online)leaveOnline();online=true;onlineStatus='Reserving a six-digit room…';game.classList.add('online');voyage.prepare('host');const attempt=++onlineToken;
 try{await room.hostRoom();if(attempt!==onlineToken)return;onlineStatus='Share the six digits. Everyone taps Ready.';syncOnlineUI();}catch(error){if(attempt===onlineToken){onlineStatus=error.message;syncOnlineUI();}}
}
function openJoin(){if(online)leaveOnline();online=true;onlineStatus='Enter the host’s six digits.';game.classList.add('online');voyage.prepare('guest');$('join-form').hidden=false;$('join-code').focus();}
async function joinOnline(code){
 if(!online||voyage.role!=='guest')openJoin();const attempt=++onlineToken;onlineStatus='Finding your raft…';$('join-submit').disabled=true;
 try{await room.joinRoom(code);if(attempt!==onlineToken)return;syncOnlineUI();}catch(error){if(attempt===onlineToken){onlineStatus=error.message;syncOnlineUI();}}finally{if(attempt===onlineToken)$('join-submit').disabled=false;}
}
$('host-room').onclick=hostOnline;$('join-room').onclick=openJoin;
$('join-form').onsubmit=e=>{e.preventDefault();joinOnline($('join-code').value);};
$('room-ready').onclick=()=>voyage.action('ready');$('room-restart').onclick=()=>voyage.action('restart');$('room-leave').onclick=()=>leaveOnline();
$('crew-menu').onclick=()=>{if(voyage.state?.phase==='playing')voyage.pause();syncOnlineUI();};
$('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);toast('Room code copied. Invite your crew!');}catch{toast('Room code: '+room.code);}};
$('room-share').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',room.code);try{if(navigator.share)await navigator.share({title:'Puff River · join my raft',text:'Room '+room.code+' · same Wi-Fi',url:url.href});else{await navigator.clipboard.writeText(url.href);toast('Invite link copied.');}}catch(error){if(error.name!=='AbortError')toast('Share room code '+room.code);}};
$('crew-size').onchange=()=>{if(state.phase!=='menu')return;state=createState(Number($('crew-size').value));state.angle=state.playerCount===1?2.3:0;configureDeck();$('arc-label').textContent=Math.round(360/state.playerCount)+'°';document.querySelector('.mode-detail small').textContent=state.playerCount===1?'The whole circle is yours.':'Practice one captain’s equal territory.';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Already filling your screen. Hide browser bars for more room.');}catch{toast('Fullscreen isn’t available here. The game still fills the window.');}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');resize();});
$('start').onclick=start;$('help').onclick=()=>{if(!$('modal').hidden)return;openModal('help');};$('pause').onclick=()=>openModal('pause');$('close-modal').onclick=closeModal;$('modal-action').onclick=closeModal;$('sound').onclick=()=>{soundOn=!soundOn;$('sound').querySelector('span').style.display=soundOn?'none':'';$('sound').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');tone(600,.1);};
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'boost'};
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;if(e.repeat&&['Escape','Enter','KeyP'].includes(e.code))return;if(keyMap[e.code]){e.preventDefault();if(state.phase==='playing')input[keyMap[e.code]]=true;}if(e.code==='Enter'&&!online&&state.phase==='menu'&&$('modal').hidden){e.preventDefault();start();}else if(e.code==='Enter'&&modalMode==='result'){e.preventDefault();start();}if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!$('modal').hidden&&modalMode!=='result')closeModal();else if(state.phase==='playing')openModal('pause');}});
window.addEventListener('keyup',e=>{if(keyMap[e.code]){e.preventDefault();input[keyMap[e.code]]=false;}});window.addEventListener('blur',()=>{clearInput();if(state.phase==='playing')openModal('pause');});document.addEventListener('visibilitychange',()=>{if(online)voyage.visibility(!document.hidden);if(document.hidden&&state.phase==='playing')openModal('pause');});
const joystick=$('joystick'),fartButton=$('fart-button');
function moveJoystick(e){
 if(e.pointerId!==joystickPointer)return;
 const r=joystick.getBoundingClientRect(),radius=r.width*.32;
 let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const length=Math.hypot(x,y);
 if(length>radius){x=x/length*radius;y=y/length*radius;}
 $('joystick-thumb').style.transform=`translate(${x}px,${y}px)`;
 input.aimAngle=length>radius*.18?joystickAngle(x/radius,-y/radius):null;
}
joystick.addEventListener('pointerdown',e=>{if(state.phase!=='playing'||joystickPointer!==null)return;e.preventDefault();joystickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);joystick.classList.add('active');moveJoystick(e);});
joystick.addEventListener('pointermove',moveJoystick);
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(e.pointerId===joystickPointer)resetJoystick();});
fartButton.addEventListener('pointerdown',e=>{if(state.phase!=='playing'||boostPointer!==null)return;e.preventDefault();boostPointer=e.pointerId;fartButton.setPointerCapture(e.pointerId);input.boost=true;fartButton.classList.add('active');});
for(const type of ['pointerup','pointercancel','lostpointercapture'])fartButton.addEventListener(type,e=>{if(e.pointerId===boostPointer){boostPointer=null;input.boost=false;fartButton.classList.remove('active');}});
function resize(){const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();$('loading').hidden=true;
function frame(now){requestAnimationFrame(frame);const gap=(now-last)/1000,dt=Math.min(gap,.05);last=now;elapsed+=dt;if(online){voyage.update(gap,input,!document.hidden);const view=voyage.renderState(dt);if(view)state=view;game.classList.toggle('online-running',state.phase==='playing'&&!voyage.waiting&&!document.hidden);}
const active=state.phase==='playing'&&(!online||!voyage.waiting);const before=state.phase;let emitPuff=false;
if(active&&!online){const lives=state.lives,wasRapid=state.rapids;step(state,input,dt);if(wasRapid===0&&state.rapids>0)toast('Choppy water! Hang on, Pip.');if(lives!==state.lives){toast('Watch the riverbank!');splash();shake=.35;tone(110,.25,.07,'triangle');}for(const o of course){if(o.hit)continue;const dz=o.at-state.distance,obstaclePoint=riverPoint(o.at,o.x,state.distance),raftPoint=riverPoint(state.distance,state.x,state.distance),separation=Math.hypot(obstaclePoint.x-raftPoint.x,obstaclePoint.z-raftPoint.z);if(o.kind==='whirlpool'&&Math.abs(dz)<5){const dx=o.x-state.x,d=separation;if(d<5&&d>0.1){state.vx+=dx/d*(5-d)*dt*.6;state.rollVZ-=dx*dt*.25;state.rollVX+=dz*dt*.15;}}const collision=separation<(o.kind==='bean'?2.45:o.radius+1.65);if(collision&&o.kind==='bean'){o.hit=true;o.mesh.visible=false;state.beans++;state.fuel=Math.min(100,state.fuel+30);tone(740,.12);toast('A little bean. A lot of potential. +30 puff');}else if(collision&&hit(state,Math.sign(state.x-o.x)||1,Math.sign(dz)||1)){o.hit=true;splash();shake=.4;tone(100,.25,.08,'triangle');toast(o.kind==='whirlpool'?'Caught in a swirl!':o.kind==='log'?'Log jam! Aim early, captain.':'Rocky waters! Keep on puffing.');}}if(state.boosting){puffTimer-=dt;if(puffTimer<=0){puffTimer=.13;emitPuff=true;}}else puffTimer=0;updateHUD();}
if(!online&&before==='playing'&&['won','lost'].includes(state.phase)){input.boost=false;setTimeout(()=>openModal('result'),400);if(state.phase==='won'){tone(800,.4);toast('800 m of pure puff power. You made it!');}else toast('Three splashes. One brave little captain.');}
const moving=state.distance;
for(const land of banks)land.position.z=moving;
for(const {obj,at} of sceneryChunks){obj.position.z=moving;obj.visible=Math.abs(at-moving)<110;}
for(let i=0;i<waterPositions.count;i++){const x=baseWater[i*3],y=baseWater[i*3+1];waterPositions.setZ(i,Math.sin(x*.8+y*.3+elapsed*.25)*.008+Math.sin(y*1.4+elapsed*.18)*.004);}waterPositions.needsUpdate=true;water.geometry.computeVertexNormals();
if(online){const hits=new Set(state.hitIds||[]);for(const o of course)o.hit=hits.has(o.id);if(now-lastHUD>100){lastHUD=now;updateHUD();}for(const event of state.events||[])if(event.id>lastEvent){lastEvent=event.id;if(event.type==='bean'){tone(740,.12);toast('+30 puff power for the whole crew!');}else if(event.type==='hit'){splash();shake=.35;tone(110,.25,.07,'triangle');toast(event.kind==='bank'?'Watch the riverbank!':'A splash for the whole crew. Steer together!');}}}
for(const o of course){const p=riverPoint(o.at,o.x,state.distance);o.mesh.position.x=p.x;o.mesh.position.z=p.z;if(o.kind==='log')o.mesh.rotation.y=riverFrame(o.at).yaw+.2;o.mesh.visible=!o.hit&&o.mesh.position.z<25&&o.mesh.position.z>-100;if(o.kind==='bean'){o.mesh.position.y=.9+Math.sin(elapsed*2+o.id)*.17;o.mesh.rotation.y=elapsed*1.3;}if(o.kind==='whirlpool')o.mesh.rotation.y=-elapsed*1.4;}
const finishPoint=riverPoint(COURSE_LENGTH,0,state.distance);finish.position.set(finishPoint.x,0,finishPoint.z);finish.rotation.y=riverFrame(COURSE_LENGTH).yaw;
for(const {at,group} of rapidMeshes){group.position.z=state.distance;group.visible=at-state.distance<95&&at-state.distance>-35;}
const pathFrame=riverFrame(state.distance),raftPoint=riverPoint(state.distance,state.x,state.distance);
sun.position.set(raftPoint.x-18,30,raftPoint.z+12);sun.target.position.set(raftPoint.x,0,raftPoint.z);
raft.position.set(raftPoint.x,.08+Math.sin(elapsed*.8)*.015,raftPoint.z);raft.rotation.y=pathFrame.yaw;
raft.rotation.z=state.rollZ+Math.sin(elapsed*.8)*.004;raft.rotation.x=state.rollX+Math.sin(elapsed*.7)*.003;
raft.scale.setScalar(1);
for(let id=0;id<captains.length;id++){
 const visual=captains[id],actor=online?state.players?.find(p=>p.id===id&&p.active):id===0?state:null;
 if(!actor){visual.pip.visible=visual.ripple.visible=visual.aim.visible=false;continue;}
 const a=actor.angle;visual.pip.position.set(Math.sin(a)*PLAYER_RADIUS,Math.sin(elapsed*3+id)*.008,-Math.cos(a)*PLAYER_RADIUS);visual.pip.rotation.set(0,Math.PI-a,0);visual.upperBody.rotation.x=-Math.PI/2;visual.lowerBody.rotation.z=actor.boosting?Math.sin(elapsed*18+id)*.025:0;visual.pip.visible=state.invincible<=0||Math.floor(elapsed*12)%2===0;
 visual.aim.rotation.y=-a;visual.aim.visible=(!online||id===voyage.localId)&&state.phase!=='menu'&&state.phase!=='lost';
 visual.puffTimer-=dt;if(active&&actor.boosting&&visual.puffTimer<=0&&particles.length<220){visual.puffTimer=.13;raft.updateMatrixWorld(true);puff(visual,actor);}else if(!actor.boosting)visual.puffTimer=0;
}
raft.updateMatrixWorld(true);for(const visual of captains){if(!visual.pip.visible){visual.ripple.visible=false;continue;}const ripplePoint=visual.lowerBody.localToWorld(new THREE.Vector3(0,-1,.2));visual.ripple.position.set(ripplePoint.x,-.195,ripplePoint.z);visual.ripple.scale.setScalar(1+Math.sin(elapsed*1.2)*.03);visual.ripple.visible=true;}

for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life+=dt;p.obj.position.x+=p.vx*dt;p.obj.position.z+=(p.vz+(active?state.speed:0))*dt;p.obj.position.y+=(p.vy??.6)*dt;if(p.vy)p.vy-=9*dt;p.obj.scale.multiplyScalar(1+dt*1.4);if(p.life>p.duration){disposeParticle(p);particles.splice(i,1);}}
// Follow the board itself. Its center stays at the viewport center, including during a turn.
const cameraScale=mobile()?1.08:1;
camera.position.set(raftPoint.x+(pathFrame.nx*8-pathFrame.tx*21)*cameraScale,19*cameraScale,raftPoint.z+(pathFrame.nz*8-pathFrame.tz*21)*cameraScale);
camera.lookAt(raftPoint.x,.3,raftPoint.z);
if(shake>0)shake=Math.max(0,shake-dt);
renderer.render(scene,camera);
}
camera.position.set(8,19,25);camera.lookAt(0,.3,4);requestAnimationFrame(frame);
// Read-only state for deterministic QA and future replay tooling.
window.puffRiver={getView:()=>{const center=riverPoint(state.distance,state.x,state.distance),p=new THREE.Vector3(center.x,.3,center.z).project(camera),d=pip.getWorldDirection(new THREE.Vector3()).negate();return {boardCenter:{x:(p.x+1)/2,y:(1-p.y)/2},facing:{x:d.x,z:d.z},roll:{x:raft.rotation.x,z:raft.rotation.z}};},getState:()=>({...state}),getCourse:()=>course.map(({mesh,...o})=>({...o})),getInput:()=>({...input}),getPuffs:()=>particles.filter(p=>!p.vy).map(p=>({x:p.obj.position.x,z:p.obj.position.z,vx:p.vx,vz:p.vz})),getRiver:()=>({frame:riverFrame(state.distance),limits:bankLimits(state.distance),ahead:[0,12,24,36,48,60,72].map(d=>riverPoint(state.distance+d,0,state.distance))}),getNetwork:()=>({online,role:voyage.role,localId:voyage.localId,room:room.code,epoch:voyage.epoch,waiting:voyage.waiting}),version:'1.1.0'};

const invite=new URL(location.href).searchParams.get('room');if(invite&&/^\d{6}$/.test(invite)){openJoin();$('join-code').value=invite;joinOnline(invite);}

document.querySelector('.brand').onclick=e=>{if(online){e.preventDefault();leaveOnline();}};
