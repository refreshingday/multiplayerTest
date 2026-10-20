import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as RealThree from '../vendor/three.module.js';
import * as core from '../core.js';
import {CAPTAINS,createCrew} from '../crew-core.js';
import {RiverSession} from '../multiplayer.js';
const nodes=new Map();
function element(id=''){
 const classes=new Set(),listeners=new Map();return {id,hidden:false,disabled:false,children:[],dataset:{},value:'',textContent:'',style:{setProperty(k,v){this[k]=v;}},classList:{add(...xs){xs.forEach(x=>classes.add(x));},remove(...xs){xs.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);},toggle(x,force){const on=force??!classes.has(x);on?classes.add(x):classes.delete(x);return on;}},clientWidth:1200,clientHeight:800,append(...xs){this.children.push(...xs);},appendChild(x){this.children.push(x);},replaceChildren(...xs){this.children=xs;},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},dispatch(name,event){for(const fn of listeners.get(name)||[])fn(event);},setAttribute(k,v){this[k]=v;},setPointerCapture(){},focus(){},getBoundingClientRect(){return {left:0,top:0,width:112,height:112};},querySelector(){return node(id+'-child');}};
}
function node(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);}
const document={hidden:false,getElementById:node,querySelector:node,createElement:()=>element(),addEventListener(){}};node('crew-size').value='1';
class Room{
 constructor(callbacks){this.callbacks=callbacks;this.localId=0;this.code='123456';this.connected=true;this.locked=false;}
 send(){return true;}lock(){this.locked=true;}close(){this.connected=false;}isConnected(){return true;}requestReconnect(){}
}
const THREE={...RealThree,WebGLRenderer:class{shadowMap={};domElement={};setPixelRatio(){}setClearColor(){}setSize(){}render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}}};
const context=vm.createContext({...core,THREE,CAPTAINS,RoomLink:Room,RiverSession,document,window:{addEventListener(){}},navigator:{},history:{replaceState(){}},location:{href:'https://puff.test/'},URL,performance,structuredClone,innerWidth:1200,devicePixelRatio:1,requestAnimationFrame(){},setTimeout(){return 1;},clearTimeout(){},console});
let source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
source+=`\nglobalThis.app={scene,camera,raft,captains,frame,input,start,room,voyage,leaveOnline,scenario(patch){Object.assign(state,patch);},crew(s,id=0){online=true;voyage.state=s;voyage.localId=id;voyage.role='guest';voyage.epoch=3;voyage.run=s.run;voyage.predicted=structuredClone(s.players.find(p=>p.id===id));lastDeckKey='';syncOnlineUI();},getState:()=>state};`;
vm.runInContext(source,context);const app=context.app;
test('single-player joystick and circular fart button still control a full-circle captain',()=>{
 app.start();const event={pointerId:9,clientX:110,clientY:56,preventDefault(){}};node('joystick').dispatch('pointerdown',event);assert.ok(Number.isFinite(app.input.aimAngle));node('fart-button').dispatch('pointerdown',{...event,pointerId:10});assert.equal(app.input.boost,true);node('fart-button').dispatch('pointerup',{pointerId:10});assert.equal(app.input.boost,false);node('joystick').dispatch('pointercancel',{pointerId:9});assert.equal(app.input.aimAngle,null);
});
test('four rounded human captains remain face down with submerged legs, rear emitters, and only the local aim marker',()=>{
 for(const count of [2,3,4]){
  const s=createCrew(Array.from({length:count},(_,i)=>i));s.run=1;s.phase='paused';app.crew(s,count-1);app.frame(performance.now());app.scene.updateMatrixWorld(true);
  assert.equal(app.captains.filter(c=>c.pip.visible).length,count);
  assert.equal(app.captains.filter(c=>c.aim.visible).length,1);assert.equal(app.captains[count-1].aim.visible,true);
  for(let id=0;id<count;id++){
   const c=app.captains[id],upper=c.upperBody.getWorldQuaternion(new RealThree.Quaternion()),lower=c.lowerBody.getWorldQuaternion(new RealThree.Quaternion());
   const face=new RealThree.Vector3(0,0,-1).applyQuaternion(upper),torso=new RealThree.Vector3(0,1,0).applyQuaternion(upper),legs=new RealThree.Vector3(0,-1,0).applyQuaternion(lower);
   assert.ok(face.y<-.99);assert.ok(legs.y<-.99);assert.ok(Math.abs(torso.dot(legs))<1e-7);assert.ok(c.lowerBody.localToWorld(new RealThree.Vector3(.19,-1.65,.28)).y<-.6);
   assert.ok(c.pip.worldToLocal(c.emitter.getWorldPosition(new RealThree.Vector3())).z>.5);
   assert.ok(Math.abs(Math.hypot(c.pip.position.x,c.pip.position.z)-core.PLAYER_RADIUS)<1e-9);
  }
 }
 assert.equal(node('crew-list').children.length,4);assert.equal(node('crew-hud').children.length,4);assert.equal(node('room-panel').hidden,false);
});
test('guest raft stays centered through the bends in portrait and landscape and uses its own fuel',()=>{
 for(const [width,height] of [[390,844],[844,390],[1440,900]])for(const distance of [0,24,48,96,192,360]){
  context.innerWidth=width;node('viewport').clientWidth=width;node('viewport').clientHeight=height;
  const s=createCrew([0,1,2,3]);s.run=1;s.phase='paused';s.distance=distance;s.players[3].fuel=37;app.crew(s,3);app.frame(performance.now());
  const view=context.window.puffRiver.getView();assert.ok(Math.abs(view.boardCenter.x-.5)<1e-7);assert.ok(Math.abs(view.boardCenter.y-.5)<1e-7);assert.equal(node('fuel-value').textContent,'37%');
 }
});
test('all four fart emitters create outward jets and effect objects stay bounded',()=>{
 const s=createCrew([0,1,2,3]);s.run=1;s.phase='playing';s.players.forEach(p=>p.boosting=true);app.crew(s,2);app.input.boost=true;let now=performance.now();
 for(let i=0;i<120;i++){now+=1000/60;app.voyage.lastStateAt=now;app.frame(now);}
 assert.ok(app.scene.children.length<700);app.scene.traverse(o=>{if(o.geometry)for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
 assert.ok(context.window.puffRiver.getPuffs().length>0);
 app.leaveOnline();app.frame(now+17);assert.equal(app.captains.filter(c=>c.pip.visible).length,1);assert.equal(node('room-panel').hidden,true);assert.equal(node('crew-menu').hidden,true);
});
