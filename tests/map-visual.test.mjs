import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {WaveMap} from '../wave-map-v22.js';import {createGame,regenerateArena,arenaBounds} from '../game-core-v22.js';
const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
function resources(scene){const geometry=new Set(),material=new Set();let count=0;scene.traverse(o=>{count++;if(o.geometry)geometry.add(o.geometry.uuid);if(o.material)material.add(o.material.uuid);});return{count,geometry:geometry.size,material:material.size};}
test('floor, texture tiles and perimeter match growing collision bounds without mesh churn',()=>{
 const scene=new THREE.Scene(),map=new WaveMap(THREE,scene),s=createGame('coop',[0,1,2,3],123);let baseline;
 for(let wave=1;wave<=25;wave++){
  s.wave=wave;regenerateArena(s);map.update(s);const b=arenaBounds(s);
  assert.ok(Math.abs(map.floor.geometry.parameters.width*map.floor.scale.x-b.x*2)<1e-7);
  assert.ok(Math.abs(map.floor.geometry.parameters.height*map.floor.scale.y-b.z*2)<1e-7);
  assert.equal(map.floor.material.map.repeat.x,b.x);assert.equal(map.floor.material.map.repeat.y,b.z);
  assert.equal(Math.abs(map.border[3].position.x),b.x+.25);assert.equal(Math.abs(map.border[1].position.z),b.z+.25);
  assert.equal(map.obstacles.length,6);if(wave===10)baseline=resources(scene);if(wave>10)assert.deepEqual(resources(scene),baseline);
 }
 assert.ok(map.styles.size<=6);
});
