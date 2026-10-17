import {heroFor} from './game-core-v21.js';
export class WizardModels{
 constructor(T,scene){
  this.T=T;this.scene=scene;this.geometry={robe:new T.ConeGeometry(1,1,8),sphere:new T.SphereGeometry(1,8,6),crystal:new T.OctahedronGeometry(1),staff:new T.CylinderGeometry(1,1,1,5),ring:new T.RingGeometry(.42,.48,20)};
  this.skin=new T.MeshLambertMaterial({color:0xf3d0b2});this.dark=new T.MeshLambertMaterial({color:0x18293a});
  this.styles=new Map();this.seats=[0x61f7dc,0xc6a1ff,0xffd46e,0xff8eb5].map(color=>new T.MeshBasicMaterial({color,side:T.DoubleSide}));
 }
 style(key){if(this.styles.has(key))return this.styles.get(key);const hero=heroFor(key),T=this.T,value={robe:new T.MeshLambertMaterial({color:hero.color}),gem:new T.MeshBasicMaterial({color:hero.color})};this.styles.set(key,value);return value;}
 create(id){
  const T=this.T,group=new T.Group,body=new T.Group,seat=new T.Mesh(this.geometry.ring,this.seats[id]||this.seats[0]);seat.rotation.x=-Math.PI/2;seat.position.y=.025;group.add(seat,body);
  const parts=Array.from({length:12},()=>{const m=new T.Mesh(this.geometry.sphere,this.dark);body.add(m);return m;});
  group.userData={body,parts,flash:{visible:false},hero:null,playerMaterials:null};this.scene.add(group);this.configure(group,'fire');return group;
 }
 configure(group,key){
  key=heroFor(key).key;if(group.userData.hero===key)return;group.userData.hero=key;group.userData.playerMaterials=null;
  const style=this.style(key),P=(g,m,s,p,r=[0,0,0])=>({g,m,s,p,r});
  const parts=[
   P('robe',style.robe,[.39,.65,.39],[0,.4,0]),
   P('sphere',this.skin,[.18,.18,.18],[0,.89,-.03]),
   P('robe',style.robe,[.36,.07,.36],[0,1.04,0]),
   P('robe',style.robe,[.24,.42,.24],[0,1.22,.02]),
   P('staff',this.dark,[.035,.8,.035],[.3,.65,-.2]),
   P(key==='fire'?'robe':key==='electric'||key==='ice'?'crystal':'sphere',style.gem,[.13,.19,.13],[.3,1.1,-.2]),
   P('sphere',this.skin,[.09,.09,.09],[-.26,.61,-.08]),
   P('sphere',this.skin,[.09,.09,.09],[.3,.68,-.17]),
   P('sphere',this.dark,[.115,.045,.04],[0,.92,-.19])
  ];
  if(key==='electric')for(const side of [-1,1])parts.push(P('crystal',style.gem,[.055,.27,.055],[side*.2,1.22,0],[0,0,-side*.4]));
  if(key==='ice')for(const side of [-1,0,1])parts.push(P('crystal',style.gem,[.065,.23,.065],[side*.17,1.31,-.04],[0,0,-side*.3]));
  if(key==='grass')for(const side of [-1,1])parts.push(P('sphere',style.robe,[.12,.065,.32],[side*.2,1.17,.05],[.2,side*.65,-side*.35]));
  if(key==='fire')parts.push(P('robe',style.gem,[.1,.24,.1],[.12,1.39,.02],[0,0,-.3]));
  group.userData.parts.forEach((mesh,i)=>{const p=parts[i];mesh.visible=!!p;if(!p)return;mesh.geometry=this.geometry[p.g];mesh.material=p.m;mesh.scale.set(...p.s);mesh.position.set(...p.p);mesh.rotation.set(...p.r);});
 }
}
