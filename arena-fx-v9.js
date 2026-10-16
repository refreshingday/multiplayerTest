import {UPGRADES,ATTACK,hasBuff} from './game-core-v9.js';
import {paintIcon} from './buff-icons-v8.js';
export class ArenaFX{
 constructor(T,scene){
  this.T=T;this.scene=scene;this.bars=[];this.items=[];this.shields=[];this.spawns=[];this.materials=new Map();this.reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.barBack=new T.SpriteMaterial({color:0x071018,depthTest:false,depthWrite:false});
  this.barGreen=new T.SpriteMaterial({color:0x77ffbe,depthTest:false,depthWrite:false});
  this.barRed=new T.SpriteMaterial({color:0xffad78,depthTest:false,depthWrite:false});
  this.barLow=new T.SpriteMaterial({color:0xff5e68,depthTest:false,depthWrite:false});
  this.hitWhite=new T.MeshBasicMaterial({color:0xfff6ec});this.hitRed=new T.MeshBasicMaterial({color:0xff786b});
  this.ringGeo=new T.RingGeometry(.48,.56,24);this.coreGeo=new T.OctahedronGeometry(.32);this.spawnGeo=new T.RingGeometry(.62,.72,24);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const gc=glowCanvas.getContext('2d'),gradient=gc.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.6)');gradient.addColorStop(.3,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,0)');gc.fillStyle=gradient;gc.fillRect(0,0,64,64);this.glowTexture=new T.CanvasTexture(glowCanvas);this.glowTexture.colorSpace=T.SRGBColorSpace;
  for(const u of UPGRADES){
   const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');paintIcon(ctx,u.key,u.color,96);
   const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
   this.materials.set(u.key,{core:new T.MeshBasicMaterial({color:u.color}),glow:new T.SpriteMaterial({map:this.glowTexture,color:u.color,transparent:true,opacity:.65,blending:T.AdditiveBlending,depthWrite:false}),label:new T.SpriteMaterial({map:tex,depthWrite:false,depthTest:false})});
  }
  for(let i=0;i<40;i++){const back=new T.Sprite(this.barBack),fill=new T.Sprite(this.barGreen);back.renderOrder=30;fill.renderOrder=31;fill.center.set(0,.5);back.visible=fill.visible=false;scene.add(back,fill);this.bars.push({back,fill});}
  for(let i=0;i<3;i++){
   const g=new T.Group(),m=this.materials.get('double'),core=new T.Mesh(this.coreGeo,m.core),ring=new T.Mesh(this.ringGeo,m.core),label=new T.Sprite(m.label),glow=new T.Sprite(m.glow);
   ring.rotation.x=-Math.PI/2;ring.position.y=.035;glow.position.y=.5;glow.scale.setScalar(1.8);label.scale.set(.86,.86,1);label.position.y=1.3;label.renderOrder=25;g.add(glow,core,ring,label);g.userData={core,ring,label,glow};g.visible=false;scene.add(g);this.items.push(g);
  }
  for(let i=0;i<4;i++){
   const material=new T.MeshBasicMaterial({color:[0x8effe3,0xc3a3ff,0xffd46e,0xff8eb5][i],transparent:true,opacity:.6,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}),ring=new T.Mesh(this.spawnGeo,material);
   ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);this.shields.push(ring);
  }
  for(let i=0;i<36;i++){const ring=new T.Mesh(this.spawnGeo,new T.MeshBasicMaterial({color:0xff6a60,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);this.spawns.push(ring);}
 }
 update(s){
  this.bars.forEach(b=>b.back.visible=b.fill.visible=false);
  const players=s.players||[],all=[...players,...(s.enemies||[])];
  all.forEach((a,i)=>{
   const b=this.bars[i],player=i<players.length,maxHp=Math.max(1,a.maxHp||100),ratio=Math.max(0,Math.min(1,a.hp/maxHp));
   if(!b||a.active===false||a.hp<=0||!((a.bar||0)>0||player&&a.hp<maxHp))return;
   const width=player?1.3:1;b.fill.material=player?(ratio<.3?this.barLow:this.barGreen):this.barRed;b.back.visible=b.fill.visible=true;
   b.back.position.set(a.x,1.52,a.z);b.back.scale.set(width,.14,1);b.fill.position.set(a.x-width/2,1.525,a.z);b.fill.scale.set(width*ratio,.09,1);
  });
  this.items.forEach((g,i)=>{
   const p=s.pickups?.[i];g.visible=!!p;if(!p)return;const m=this.materials.get(p.key);if(!m){g.visible=false;return;}
   g.position.set(p.x,0,p.z);g.userData.core.material=g.userData.ring.material=m.core;g.userData.label.material=m.label;g.userData.glow.material=m.glow;
   g.userData.core.position.y=.55+(this.reduced?0:Math.sin(s.time*3+p.id)*.12);g.userData.core.rotation.set(this.reduced?0:s.time,this.reduced?0:s.time*.7,0);
   const pulse=this.reduced?1:1+Math.sin(s.time*3+p.id)*.12;g.userData.ring.scale.setScalar(1.35*pulse);g.userData.glow.scale.setScalar(1.8*pulse);g.scale.setScalar(p.ttl<4?(this.reduced?.9:.9+Math.sin(s.time*8)*.1):1);
  });
  this.shields.forEach((ring,i)=>{
   const p=players[i];ring.visible=!!(p&&p.active&&p.hp>0&&hasBuff(p,'shield'));if(!ring.visible)return;
   ring.position.set(p.x,.045,p.z);ring.scale.setScalar(1.28+(this.reduced?0:Math.sin(s.time*6+i)*.08));ring.material.opacity=.48+(this.reduced?0:Math.sin(s.time*4)*.14);
  });
  this.spawns.forEach((ring,i)=>{
   const e=s.enemies?.[i],pulse=Math.max(0,Math.min(1,Math.max((e?.spawn||0)/.35,(e?.wind||0)/.55)));ring.visible=pulse>0;if(!ring.visible)return;
   ring.material.color.set(e.type==='shooter'?0xc18cff:0xff6a60);ring.position.set(e.x,.04,e.z);ring.scale.setScalar(this.reduced?1.3:1.1+(1-pulse)*.8);ring.material.opacity=pulse*(this.reduced?.28:.65);
  });
 }
 cast(mesh,p){
  const body=mesh.userData.body,alive=p.hp>0,charge=alive&&p.charging?Math.min(1,(p.charge||0)/ATTACK.charge):0,t=alive?Math.max(0,p.castPulse||0):0,kick=t>0?Math.sin(Math.min(1,t/.22)*Math.PI):0;
  const phase=alive?Math.max(0,Math.min(1,Math.max((p.hitPulse||0)/.3,(p.pushPulse||0)/.25))):0,hit=this.reduced?phase*.35:phase,elapsed=1-phase,impact=hit*(.65+.35*Math.sin(elapsed*Math.PI*3)),rebound=this.reduced?0:Math.sin(elapsed*Math.PI*2)*hit;
  if(!mesh.userData.playerMaterials){const list=[];body.traverse(o=>{if(o.isMesh&&o!==mesh.userData.flash)list.push([o,o.material])});mesh.userData.playerMaterials=list;}
  const flash=alive&&p.hitPulse>0&&phase>.12?(phase>.73?this.hitWhite:this.hitRed):null;
  for(const [object,material] of mesh.userData.playerMaterials)object.material=flash||material;
  body.scale.set(Math.max(.65,1+charge*.1-kick*.16+impact*.26),Math.max(.55,1-charge*.14+kick*.25-impact*.32+rebound*.1),Math.max(.65,1+charge*.1-kick*.16+impact*.26));
  body.rotation.x=charge*.12-kick*.28-impact*.2;body.position.y=kick*.08+Math.max(0,rebound)*.1;
  const yaw=mesh.rotation.y||0,dx=(p.hitX||0)*hit*.16,dz=(p.hitZ||0)*hit*.16;
  body.position.x=Math.cos(yaw)*dx-Math.sin(yaw)*dz;body.position.z=Math.sin(yaw)*dx+Math.cos(yaw)*dz;
  if(mesh.userData.flash)mesh.userData.flash.visible=false;
 }
}
