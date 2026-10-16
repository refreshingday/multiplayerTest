import {ATTACK,OBSTACLES,segmentRect,handPosition} from './game-core-v9.js';
export class FeedbackGate{
 constructor(){this.seen=new Map()}
 reset(){this.seen.clear()}
 accept(e,time=Date.now()){
  const key=e.type==='charge'||e.type==='cast'?e.type+':'+e.owner+':'+e.a:'event:'+e.id;
  const old=this.seen.get(key);
  if(old){if(!e.predicted){old.predicted=false;return false;}if(!old.predicted||time-old.time<1500)return false;}
  this.seen.set(key,{predicted:!!e.predicted,time});
  if(this.seen.size>512)this.seen.delete(this.seen.keys().next().value);
  return true;
 }
}
export class SpellAudio{
 constructor(){this.enabled=true;this.ctx=null;this.master=null;this.voices=new Set();this.noise=null}
 unlock(){
  if(!this.enabled)return;
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
  try{
   if(!this.ctx){
    this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=.16;
    const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-18;limiter.ratio.value=8;this.master.connect(limiter);limiter.connect(this.ctx.destination);
    this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   }
   if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
  }catch{}
 }
 toggle(){this.enabled=!this.enabled;if(!this.enabled)this.stop();else this.unlock();return this.enabled}
 stop(){for(const v of [...this.voices]){try{v.stop()}catch{}this.voices.delete(v)}}
 play(kind,crit=false){
  const c=this.ctx;if(!this.enabled||!c||c.state!=='running'||this.voices.size>=8)return;
  try{
   const start=c.currentTime;
   if(kind==='pickup'){
    const osc=c.createOscillator(),g=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(660,start);osc.frequency.setValueAtTime(880,start+.08);osc.frequency.setValueAtTime(1320,start+.16);g.gain.setValueAtTime(.001,start);g.gain.exponentialRampToValueAtTime(.35,start+.015);g.gain.exponentialRampToValueAtTime(.001,start+.32);osc.connect(g);g.connect(this.master);this.voices.add(osc);osc.onended=()=>{this.voices.delete(osc);osc.disconnect();g.disconnect()};osc.start(start);osc.stop(start+.34);return;
   }
   const duration=kind==='hurt'?.18:kind==='impact'?.27:kind==='cast'?.2:.16;
   const gain=c.createGain(),filter=c.createBiquadFilter();gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(kind==='hurt'?.32:kind==='impact'?.8:kind==='cast'?.34:.075,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
   filter.type=kind==='impact'||kind==='hurt'?'lowpass':'bandpass';filter.frequency.setValueAtTime(kind==='hurt'?480:kind==='impact'?(crit?800:1200):kind==='cast'?2100:600,start);filter.frequency.exponentialRampToValueAtTime(kind==='impact'?100:kind==='cast'?300:1400,start+duration);
   const noise=c.createBufferSource();noise.buffer=this.noise;noise.connect(filter);filter.connect(gain);gain.connect(this.master);this.voices.add(noise);
   noise.onended=()=>{this.voices.delete(noise);noise.disconnect();filter.disconnect();gain.disconnect()};noise.start(start);noise.stop(start+duration+.01);
   if(kind==='impact'&&this.voices.size<8){
    const osc=c.createOscillator(),low=c.createGain();osc.type='triangle';osc.frequency.setValueAtTime(crit?100:150,start);osc.frequency.exponentialRampToValueAtTime(35,start+.22);low.gain.setValueAtTime(.5,start);low.gain.exponentialRampToValueAtTime(.001,start+.24);osc.connect(low);low.connect(this.master);this.voices.add(osc);osc.onended=()=>{this.voices.delete(osc);osc.disconnect();low.disconnect()};osc.start(start);osc.stop(start+.25);
   }
  }catch{}
 }
}
export class FireFX{
 constructor(T,scene,camera){
  this.T=T;this.scene=scene;this.camera=camera;this.audio=new SpellAudio();this.gate=new FeedbackGate();this.ghosts=new Map();this.blends=new Map();this.orbs=[];this.charges=[];this.trails=new Map();this.bursts=[];this.numbers=[];this.afters=[];this.cursor=0;this.numberCursor=0;this.burstCursor=0;this.shake=0;this.reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.maxParticles=384;this.parts=Array.from({length:this.maxParticles},()=>({life:0}));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,225,1)');gradient.addColorStop(.2,'rgba(255,210,80,.95)');gradient.addColorStop(.48,'rgba(255,85,8,.55)');gradient.addColorStop(1,'rgba(180,20,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  this.glow=new T.CanvasTexture(canvas);this.glow.colorSpace=T.SRGBColorSpace;
  this.glowMat=new T.SpriteMaterial({map:this.glow,color:0xffad42,transparent:true,blending:T.AdditiveBlending,depthWrite:false});
  this.enemyMat=new T.MeshBasicMaterial({color:0xff486a});this.enemyGlow=new T.SpriteMaterial({map:this.glow,color:0xff2854,transparent:true,blending:T.AdditiveBlending,depthWrite:false});this.enemyTail=new T.MeshBasicMaterial({map:this.glow,color:0xff2854,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
  this.whiteMat=new T.MeshBasicMaterial({color:0xfffee4});this.orangeMat=new T.MeshBasicMaterial({color:0xff8b13});this.reactionMat=new T.MeshBasicMaterial({color:0xffffff});
  this.sphere=new T.SphereGeometry(1,8,6);this.plane=new T.PlaneGeometry(1,1);this.ringGeometry=new T.RingGeometry(.65,1,24);
  this.tailMat=new T.MeshBasicMaterial({map:this.glow,color:0xff6307,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
  this.positions=new Float32Array(this.maxParticles*3);this.colors=new Float32Array(this.maxParticles*3);this.sizes=new Float32Array(this.maxParticles);this.alphas=new Float32Array(this.maxParticles);
  this.geometry=new T.BufferGeometry();this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3));this.geometry.setAttribute('aColor',new T.BufferAttribute(this.colors,3));this.geometry.setAttribute('aSize',new T.BufferAttribute(this.sizes,1));this.geometry.setAttribute('aAlpha',new T.BufferAttribute(this.alphas,1));
  this.particleMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uPixels:{value:500}},
   vertexShader:'attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uPixels; varying vec3 vColor; varying float vAlpha; void main(){vColor=aColor;vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(aSize*uPixels*projectionMatrix[1][1],1.0,28.0);}',
   fragmentShader:'varying vec3 vColor; varying float vAlpha; void main(){float r=length(gl_PointCoord-vec2(0.5));float a=(1.0-smoothstep(0.05,0.5,r))*vAlpha;if(a<0.01)discard;gl_FragColor=vec4(vColor,a);}'});
  this.points=new T.Points(this.geometry,this.particleMaterial);this.points.frustumCulled=false;scene.add(this.points);
  this.numberTextures=new Map();for(const label of ['1','2','3','5','6','6!','9','12!'])this.numberTextures.set(label,this.numberTexture(label));
  for(let i=0;i<4;i++){const orb=this.makeOrb();this.charges.push(orb);scene.add(orb)}
  for(let i=0;i<56;i++){const orb=this.makeOrb();this.orbs.push(orb);scene.add(orb)}
  for(let i=0;i<16;i++){
   const mat=new T.SpriteMaterial({map:this.glow,color:0xffe7a3,transparent:true,blending:T.AdditiveBlending,depthWrite:false}),sprite=new T.Sprite(mat);
   const ring=new T.Mesh(this.ringGeometry,new T.MeshBasicMaterial({color:0xffa13b,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));ring.rotation.x=-Math.PI/2;scene.add(sprite,ring);this.bursts.push({sprite,ring,life:0,total:1});
  }
  for(let i=0;i<24;i++){const sprite=new T.Sprite(new T.SpriteMaterial({map:this.numberTextures.get('3'),transparent:true,depthWrite:false,depthTest:false}));sprite.visible=false;sprite.renderOrder=50;scene.add(sprite);this.numbers.push({sprite,life:0,total:.65})}
  this.reset();
 }
 numberTexture(label){
  const c=document.createElement('canvas');c.width=192;c.height=128;const ctx=c.getContext('2d');ctx.font='900 '+(label.length>5?52:label.length>3?68:88)+'px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle='#32170d';ctx.lineWidth=12;ctx.strokeText(label,96,66);ctx.fillStyle=label.startsWith('−')?'#ff8e87':label.endsWith('!')?'#ffde65':label==='1'?'#ffad49':'#fff5d4';ctx.fillText(label,96,66);const t=new this.T.CanvasTexture(c);t.colorSpace=this.T.SRGBColorSpace;return t;
 }
 getNumberTexture(label){
  if(this.numberTextures.has(label))return this.numberTextures.get(label);
  if(this.numberTextures.size>=64){
   const used=new Set(this.numbers.filter(n=>n.life>0).map(n=>n.sprite.material.map));
   for(const [key,texture] of this.numberTextures)if(!used.has(texture)){this.numberTextures.delete(key);texture.dispose();break;}
  }
  const texture=this.numberTexture(label);this.numberTextures.set(label,texture);return texture;
 }
 makeOrb(){
  const T=this.T,g=new T.Group(),glow=new T.Sprite(this.glowMat),core=new T.Mesh(this.sphere,this.whiteMat),shell=new T.Mesh(this.sphere,this.orangeMat),tail1=new T.Mesh(this.plane,this.tailMat),tail2=new T.Mesh(this.plane,this.tailMat);
  core.scale.setScalar(.11);shell.scale.setScalar(.18);glow.scale.set(1,1,1);tail1.rotation.x=tail2.rotation.x=-Math.PI/2;tail1.position.z=-.34;tail2.position.z=-.65;tail1.scale.set(.45,.8,1);tail2.scale.set(.25,.55,1);g.add(glow,shell,core,tail1,tail2);g.userData={glow,core,shell,tail1,tail2};g.visible=false;return g;
 }
 reset(){
  this.shake=0;this.audio.stop();this.gate.reset();this.ghosts.clear();this.blends.clear();this.trails.clear();this.afters=[];
  for(const p of this.parts)p.life=0;
  for(const x of [...this.orbs,...this.charges])x.visible=false;
  for(const b of this.bursts){b.life=0;b.sprite.visible=b.ring.visible=false}
  for(const n of this.numbers){n.life=0;n.sprite.visible=false}
  this.alphas.fill(0);if(this.geometry)this.geometry.attributes.aAlpha.needsUpdate=true;
 }
 particle(x,y,z,vx,vy,vz,life,size,color=[1,.35,.02],pull=-1){
  const p=this.parts[this.cursor++%this.maxParticles];Object.assign(p,{x,y,z,vx,vy,vz,life,total:life,size,color,pull});
 }
 sparks(x,z,count,crit=false){
  for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=(crit?3:2)+Math.random()*4;this.particle(x,.65,z,Math.cos(angle)*speed,.6+Math.random()*3,Math.sin(angle)*speed,.18+Math.random()*.3,.12+Math.random()*.16,Math.random()<.35?[1,1,.7]:[1,.22+Math.random()*.3,.015]);}
 }
 burst(e){
  const b=this.bursts[this.burstCursor++%this.bursts.length];b.life=b.total=e.crit?.3:.22;b.x=e.x;b.z=e.z;b.size=e.crit?1.7:1.05;b.sprite.position.set(e.x,.7,e.z);b.ring.position.set(e.x,.025,e.z);b.sprite.visible=b.ring.visible=true;b.sprite.material.color.set(e.tint||0xffe7a3);b.ring.material.color.set(e.tint||0xffa13b);this.sparks(e.x,e.z,this.reduced?8:e.crit?28:16,e.crit);
 }
 number(e){
  const n=this.numbers[this.numberCursor++%this.numbers.length],label=(e.type==='playerHit'?'−':'')+String(Math.max(0,Math.round(Number(e.damage)||0)))+(e.crit?'!':'');n.life=0;n.life=n.total=e.crit?.85:.65;n.x=e.x+(Math.random()-.5)*.25;n.z=e.z;n.y=.9;n.crit=e.crit;n.small=e.kind==='burn';n.sprite.material.map=this.getNumberTexture(label);n.sprite.material.needsUpdate=true;n.sprite.visible=true;
 }
 predicted(events){for(const e of events||[])this.handle(e)}
 handle(e){
  if(!this.gate.accept(e))return;
  if(e.type==='charge')this.audio.play('charge');
  if(e.type==='cast'){
   this.audio.play('cast',e.crit);if(e.owner===this.own&&!this.reduced)this.shake=Math.max(this.shake,.018);
   if(e.predicted)for(const shot of e.shots||[{...e,shot:0}]){const key=e.owner+':'+e.a+':'+shot.shot;this.ghosts.set(key,{...e,...shot,id:'pred-'+key,vx:shot.ax*ATTACK.speed,vz:shot.az*ATTACK.speed,ttl:.45,crit:false});while(this.ghosts.size>8)this.ghosts.delete(this.ghosts.keys().next().value);}
  }
  if(e.type==='push'||e.type==='block'){this.burst({...e,tint:0x63ffe4,crit:false});if(e.target===this.own&&!this.reduced)this.shake=Math.max(this.shake,.04);}
  if(e.type==='playerHit'){this.number(e);this.burst({...e,tint:0xff665b,crit:false});if(e.owner===this.own){this.audio.play('hurt');if(!this.reduced)this.shake=Math.max(this.shake,.11);}}
  if(e.type==='pickup'){this.burst({...e,tint:0x75ffe4,crit:false});if(e.owner===this.own)this.audio.play('pickup');}
  if(e.type==='hit'){this.number(e);if(e.owner===this.own&&e.kind==='impact'&&!this.reduced)this.shake=Math.max(this.shake,e.crit?.055:.028);if(e.kind==='impact'){this.burst(e);this.audio.play('impact',e.crit)}if(e.dead){this.afters.push({x:e.x,z:e.z,life:1.2,carry:0});if(this.afters.length>16)this.afters.shift();}}
  if(e.type==='nova')this.burst({...e,crit:true});
  if(e.type==='wall')this.burst({...e,crit:false});
 }
 react(mesh,enemy){
  const body=mesh.userData.body,hit=enemy.hit||0,flash=hit>.025;
  if(!mesh.userData.originalMaterials){const list=[];body.traverse(o=>{if(o.isMesh)list.push([o,o.material])});mesh.userData.originalMaterials=list;}
  for(const [object,material] of mesh.userData.originalMaterials)object.material=flash?this.reactionMat:material;
  const strength=Math.min(1,hit/.12),wind=Math.min(1,(enemy.wind||0)/.55);body.scale.set(1+strength*.13+wind*.09,1-strength*.1-wind*.12,1+strength*.13+wind*.09);body.rotation.x=-strength*.2+(enemy.type==='runner'?.15:wind*.16);body.position.y=strength*.07;
 }
 update(s,dt,own,running){
  dt=Math.min(.1,Math.max(0,dt));this.own=own;this.shake=this.reduced?0:this.shake*Math.exp(-18*dt);
  const canonical=s.bullets||[],canonicalIds=new Set(canonical.map(b=>b.id));
  for(const id of this.blends.keys())if(!canonicalIds.has(id))this.blends.delete(id);
  for(const b of canonical){const key=b.owner+':'+b.a+':'+(b.shot||0),ghost=this.ghosts.get(key);if(ghost){this.blends.set(b.id,{x:ghost.x-b.x,z:ghost.z-b.z,life:.09});this.ghosts.delete(key);}}
  for(const e of s.events||[]){if(s.time-e.t<.45)this.handle(e);else this.gate.accept(e);if(e.type==='cast'&&!e.predicted){for(const key of this.ghosts.keys())if(key.startsWith(e.owner+':'+e.a+':'))this.ghosts.delete(key);}}
  if(!running){this.ghosts.clear();this.audio.stop();}
  for(const [key,b] of this.ghosts){
   b.ttl-=dt;const dx=b.vx*dt,dz=b.vz*dt;
   if(b.ttl<=0||OBSTACLES.some(o=>{const t=segmentRect(b.x,b.z,dx,dz,o,.17);return t!==null&&t<=1;})){this.ghosts.delete(key);continue;}
   b.x+=dx;b.z+=dz;
  }
  const visible=canonical.map(b=>{const blend=this.blends.get(b.id);if(!blend)return b;blend.life-=dt;if(blend.life<=0){this.blends.delete(b.id);return b}const f=blend.life/.09;return{...b,x:b.x+blend.x*f,z:b.z+blend.z*f}});
  visible.push(...(s.enemyShots||[]).map(b=>({...b,id:'enemy-'+b.id,enemy:true})),...this.ghosts.values());this.orbs.forEach(o=>o.visible=false);
  const live=new Set();
  visible.slice(0,this.orbs.length).forEach((b,i)=>{
   const orb=this.orbs[i],scale=b.enemy?.65:b.crit?1.28:1;orb.userData.core.material=b.enemy?this.enemyMat:this.whiteMat;orb.userData.shell.material=b.enemy?this.enemyMat:this.orangeMat;orb.userData.glow.material=b.enemy?this.enemyGlow:this.glowMat;orb.userData.tail1.material=orb.userData.tail2.material=b.enemy?this.enemyTail:this.tailMat;orb.visible=true;orb.position.set(b.x,.67,b.z);orb.rotation.y=Math.atan2(b.vx,b.vz);orb.scale.setScalar(scale);const pulse=1+Math.sin(s.time*32+i)*.08;orb.userData.glow.scale.setScalar(pulse);orb.userData.tail1.scale.set(.45,.8*pulse,1);orb.userData.tail2.scale.set(.25,.55/pulse,1);
   const key=b.id;live.add(key);const previous=this.trails.get(key)||{x:b.x,z:b.z,carry:0};previous.carry+=running?dt*(this.reduced?24:42):0;
   let count=Math.min(5,Math.floor(previous.carry));previous.carry-=count;
   while(count-->0){const mix=Math.random();this.particle(previous.x+(b.x-previous.x)*mix,.6+(Math.random()-.5)*.14,previous.z+(b.z-previous.z)*mix,-b.vx*.05+(Math.random()-.5),.5+Math.random(),-b.vz*.05+(Math.random()-.5),.17+Math.random()*.18,.12+Math.random()*.2,[1,.18+Math.random()*.5,.01]);}
   previous.x=b.x;previous.z=b.z;this.trails.set(key,previous);
  });
  for(const key of this.trails.keys())if(!live.has(key))this.trails.delete(key);
  for(let i=0;i<4;i++){
   const p=s.players[i],orb=this.charges[i];orb.visible=!!(p&&p.active&&p.hp>0&&p.charging&&running);if(!orb.visible)continue;
   const pos=handPosition(p),power=Math.min(1,(p.charge||0)/ATTACK.charge),size=.3+power*.95;orb.position.set(pos.x,.68,pos.z);orb.scale.setScalar(size);orb.userData.tail1.visible=orb.userData.tail2.visible=false;
   if(Math.random()<dt*(this.reduced?20:40)){const angle=Math.random()*Math.PI*2,r=.7+Math.random()*.65;this.particle(pos.x+Math.cos(angle)*r,.7+Math.random()*.6,pos.z+Math.sin(angle)*r,0,0,0,.18+Math.random()*.13,.14,[1,.5,.04],i);}
  }
  if(running)for(const e of s.enemies)if(e.burn>0&&Math.random()<dt*(this.reduced?4:8))this.particle(e.x+(Math.random()-.5)*.5,.35+Math.random()*.4,e.z+(Math.random()-.5)*.5,(Math.random()-.5)*.3,1.5+Math.random(),(Math.random()-.5)*.3,.25+Math.random()*.2,.15+Math.random()*.12,[1,.25+Math.random()*.35,.015]);
  for(const a of this.afters){a.life-=dt;a.carry+=dt*18;while(a.carry>=1){a.carry--;this.particle(a.x+(Math.random()-.5)*.45,.1,a.z+(Math.random()-.5)*.45,(Math.random()-.5)*.3,.8+Math.random(),(Math.random()-.5)*.3,.3+Math.random()*.35,.15,[1,.18+Math.random()*.3,.01]);}}this.afters=this.afters.filter(a=>a.life>0);
  for(let i=0;i<this.parts.length;i++){
   const p=this.parts[i];p.life-=dt;
   if(p.life>0){
    if(p.pull>=0){const caster=s.players[p.pull];if(caster){const pos=handPosition(caster);p.vx+=(pos.x-p.x)*85*dt;p.vz+=(pos.z-p.z)*85*dt;p.vy+=(.7-p.y)*60*dt;}}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.pull<0)p.vy-=2*dt;
    this.positions[i*3]=p.x;this.positions[i*3+1]=p.y;this.positions[i*3+2]=p.z;this.colors.set(p.color,i*3);this.sizes[i]=p.size;this.alphas[i]=Math.min(1,p.life/p.total*2);
   }else this.alphas[i]=0;
  }
  for(const attribute of Object.values(this.geometry.attributes))attribute.needsUpdate=true;
  this.particleMaterial.uniforms.uPixels.value=(globalThis.innerHeight||800)*Math.min(globalThis.devicePixelRatio||1,1.5)*.5;
  for(const b of this.bursts){b.life-=dt;const ratio=Math.max(0,b.life/b.total);b.sprite.visible=b.ring.visible=ratio>0;if(ratio>0){b.sprite.scale.setScalar(b.size*(.5+(1-ratio)*.9));b.sprite.material.opacity=Math.min(1,ratio*2);b.ring.scale.setScalar(b.size*(.3+(1-ratio)*1.25));b.ring.material.opacity=ratio*.6;}}
  for(const n of this.numbers){n.life-=dt;n.sprite.visible=n.life>0;if(n.life>0){const t=1-n.life/n.total,size=(n.crit?1.55:n.small?.72:1)*(1+.25*Math.exp(-t*12));n.sprite.position.set(n.x,n.y+t*.85,n.z);n.sprite.scale.set(size,size*.67,1);n.sprite.material.opacity=Math.min(1,n.life*4);}}
 }
}
