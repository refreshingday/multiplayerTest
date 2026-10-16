import {ARENA_THEMES,obstaclesFor,LIMITS} from './game-core-v11.js';

// Fixed mesh pools and cached procedural textures: no mesh churn as waves change.
export class WaveMap{
 constructor(T,scene){
  this.T=T;this.scene=scene;this.key='';this.styles=new Map();this.geometry=new T.BoxGeometry(1,1,1);
  this.floor=new T.Mesh(new T.PlaneGeometry(LIMITS.x*2,LIMITS.z*2),null);this.floor.rotation.x=-Math.PI/2;scene.add(this.floor);
  this.obstacles=Array.from({length:6},()=>{const body=new T.Mesh(this.geometry,null),cap=new T.Mesh(this.geometry,null);body.visible=cap.visible=false;scene.add(body,cap);return{body,cap};});
  this.border=Array.from({length:4},()=>{const mesh=new T.Mesh(this.geometry,null);scene.add(mesh);return mesh;});
  this.edges=Array.from({length:4},()=>{const mesh=new T.Mesh(this.geometry,null);scene.add(mesh);return mesh;});
 }
 texture(theme,kind,index){
  const T=this.T,canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),base=kind==='crate'?theme.crate:kind==='wall'?theme.stone:theme.floor;
  ctx.fillStyle=base;ctx.fillRect(0,0,128,128);
  for(let n=0;n<360;n++){ctx.fillStyle=n%2?'#ffffff0a':'#00000018';ctx.fillRect(n*53%128,n*31%128,2,2);}
  ctx.strokeStyle=kind==='floor'?theme.grid:'#16212a88';ctx.lineWidth=kind==='floor'?2:4;ctx.strokeRect(3,3,122,122);
  if(kind==='floor'){
   ctx.lineWidth=1;
   if(index%3===0){ctx.strokeRect(12,12,104,104);for(let n=20;n<110;n+=32){ctx.fillStyle=theme.grid;ctx.fillRect(n,6,12,2);}}
   else if(index%3===1){ctx.beginPath();ctx.moveTo(64,10);ctx.lineTo(118,64);ctx.lineTo(64,118);ctx.lineTo(10,64);ctx.closePath();ctx.stroke();}
   else{ctx.beginPath();ctx.arc(64,64,34,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(64,12);ctx.lineTo(64,116);ctx.moveTo(12,64);ctx.lineTo(116,64);ctx.stroke();}
  }else if(kind==='crate'){
   ctx.fillStyle=theme.accent;ctx.fillRect(0,48,128,32);ctx.fillStyle='#1c2735';
   for(let n=-32;n<160;n+=28){ctx.beginPath();ctx.moveTo(n,48);ctx.lineTo(n+14,48);ctx.lineTo(n-4,80);ctx.lineTo(n-18,80);ctx.closePath();ctx.fill();}
  }else{ctx.fillStyle='#17243155';ctx.fillRect(8,40,112,4);ctx.fillRect(8,84,112,4);ctx.fillStyle=theme.accent;ctx.fillRect(12,12,20,4);}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;if(kind==='floor')tex.repeat.set(12,9);return tex;
 }
 style(index){
  if(this.styles.has(index))return this.styles.get(index);
  const T=this.T,theme=ARENA_THEMES[index],style={
   floor:new T.MeshLambertMaterial({map:this.texture(theme,'floor',index)}),
   wall:new T.MeshLambertMaterial({map:this.texture(theme,'wall',index)}),
   crate:new T.MeshLambertMaterial({map:this.texture(theme,'crate',index)}),
   accent:new T.MeshBasicMaterial({color:theme.accent})
  };this.styles.set(index,style);return style;
 }
 place(mesh,w,h,d,x,y,z,material){mesh.material=material;mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.visible=true;}
 update(s){
  const index=s.theme||0,key=s.mapSeed+':'+s.mapId+':'+s.wave+':'+index;if(key===this.key)return;this.key=key;
  const style=this.style(index),theme=ARENA_THEMES[index],obstacles=obstaclesFor(s);this.floor.material=style.floor;
  if(this.scene.background?.set)this.scene.background.set(theme.floor);else this.scene.background=new this.T.Color(theme.floor);
  this.obstacles.forEach(({body,cap},i)=>{const o=obstacles[i];body.visible=cap.visible=!!o;if(!o)return;
   this.place(body,o.w,o.h,o.d,o.x,o.h/2,o.z,o.type==='crate'?style.crate:style.wall);
   this.place(cap,o.w*.7,.025,o.d*.12,o.x,o.h+.018,o.z,style.accent);
  });
  for(let i=0;i<4;i++){
   const horizontal=i<2,sign=i%2?-1:1;
   this.place(this.border[i],horizontal?24.8:.5,.5,horizontal?.5:18,horizontal?0:sign*12.25,.25,horizontal?sign*9.25:0,style.wall);
   this.place(this.edges[i],horizontal?23.6:.045,.035,horizontal?.045:17.9,horizontal?0:sign*11.96,.035,horizontal?sign*8.96:0,style.accent);
  }
 }
}
