import {UPGRADES,ATTACK,hasBuff} from './game-core-v6.js';
export class ArenaFX{
 constructor(T,scene){
  this.T=T;this.scene=scene;this.bars=[];this.items=[];this.materials=new Map();
  this.barBack=new T.SpriteMaterial({color:0x071018,depthTest:false,depthWrite:false});
  this.barGreen=new T.SpriteMaterial({color:0x77ffbe,depthTest:false,depthWrite:false});
  this.barRed=new T.SpriteMaterial({color:0xff9b72,depthTest:false,depthWrite:false});
  this.ringGeo=new T.RingGeometry(.48,.56,24);this.coreGeo=new T.OctahedronGeometry(.32);
  for(const u of UPGRADES){
   const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#081521';ctx.fillRect(0,0,256,64);ctx.font='bold 29px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=u.color;ctx.fillText(u.label,128,32);
   const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
   this.materials.set(u.key,{core:new T.MeshBasicMaterial({color:u.color}),label:new T.SpriteMaterial({map:tex,depthWrite:false,depthTest:false})});
  }
  for(let i=0;i<30;i++){const back=new T.Sprite(this.barBack),fill=new T.Sprite(i<2?this.barGreen:this.barRed);back.renderOrder=30;fill.renderOrder=31;scene.add(back,fill);this.bars.push({back,fill});}
  for(let i=0;i<3;i++){const g=new T.Group(),m=this.materials.get('double'),core=new T.Mesh(this.coreGeo,m.core),ring=new T.Mesh(this.ringGeo,m.core),label=new T.Sprite(m.label);ring.rotation.x=-Math.PI/2;label.scale.set(2.2,.55,1);label.position.y=1.35;label.renderOrder=25;g.add(core,ring,label);g.userData={core,ring,label};scene.add(g);this.items.push(g);}
 }
 update(s){
  this.bars.forEach(b=>b.back.visible=b.fill.visible=false);
  const all=[...s.players.map(p=>({...p,maxHp:100})),...s.enemies];
  all.forEach((a,i)=>{const b=this.bars[i];if(!b||a.hp<=0||!((a.bar||0)>0))return;const width=i<s.players.length?1.2:.95,ratio=Math.max(0,Math.min(1,a.hp/(a.maxHp||100)));b.fill.material=i<s.players.length?this.barGreen:this.barRed;b.back.visible=b.fill.visible=true;b.back.position.set(a.x,1.47,a.z);b.back.scale.set(width,.13,1);b.fill.position.set(a.x,1.475,a.z);b.fill.scale.set(width*ratio,.085,1);});
  this.items.forEach((g,i)=>{const p=s.pickups?.[i];g.visible=!!p;if(!p)return;const m=this.materials.get(p.key);g.position.set(p.x,0,p.z);g.userData.core.material=g.userData.ring.material=m.core;g.userData.label.material=m.label;g.userData.core.position.y=.55+Math.sin(s.time*3+p.id)*.12;g.userData.core.rotation.set(s.time,s.time*.7,0);g.scale.setScalar(p.ttl<4?.85+Math.sin(s.time*15)*.15:1);});
 }
 cast(mesh,p){
  const body=mesh.userData.body,charge=p.charging?Math.min(1,(p.charge||0)/ATTACK.charge):0,t=Math.max(0,p.castPulse||0),kick=t>0?Math.sin(Math.min(1,t/.22)*Math.PI):0;
  body.scale.set(1+charge*.1-kick*.16,1-charge*.14+kick*.25,1+charge*.1-kick*.16);body.rotation.x=charge*.12-kick*.28;body.position.y=kick*.08;
  const shield=hasBuff(p,'shield');mesh.userData.flash.visible=shield&&Math.floor((p.buffs.shield||0)*8)%2===0;
 }
}
