import {LIMITS,ENEMY_TYPES} from './game-core-v11.js';

// Enemy-only creature silhouettes. Geometry and materials are shared; actor and part pools are bounded.
export class EnemyModels{
 constructor(T,scene,limit=LIMITS.enemies,reduced=false){
  this.T=T;this.scene=scene;this.limit=limit;this.reduced=reduced;this.models=[];
  this.geometry={shell:new T.SphereGeometry(1,8,6),spike:new T.ConeGeometry(1,1,5),limb:new T.CylinderGeometry(.7,1,1,5),wing:new T.TetrahedronGeometry(1),ring:new T.TorusGeometry(.5,.09,4,12)};
  this.shadowGeometry=new T.CircleGeometry(.52,12);this.shadowMaterial=new T.MeshBasicMaterial({color:0x03090f,transparent:true,opacity:.3,depthWrite:false});
  this.materials={dark:new T.MeshLambertMaterial({color:0x25202b}),bone:new T.MeshLambertMaterial({color:0xffe4ba}),eye:new T.MeshBasicMaterial({color:0xfff4bd}),mouth:new T.MeshBasicMaterial({color:0x160c20})};
  for(const type of ENEMY_TYPES)this.materials[type.key]=new T.MeshLambertMaterial({color:type.color,flatShading:true});
  this.shapes=this.descriptions();
 }
 descriptions(){
  const part=(g,m,s,p,r=[0,0,0],motion='')=>({g,m,s,p,r,motion});
  const stalker=[
   part('shell','grunt',[.48,.31,.55],[0,.46,0]),
   part('shell','dark',[.3,.22,.23],[0,.35,-.48]),
   part('shell','eye',[.22,.055,.07],[0,.43,-.66]),
   part('spike','bone',[.11,.35,.11],[-.19,.3,-.63],[-Math.PI/2,0,-.2]),
   part('spike','bone',[.11,.35,.11],[.19,.3,-.63],[-Math.PI/2,0,.2])
  ];
  for(const side of [-1,1])for(let n=0;n<3;n++)stalker.push(part('limb','dark',[.09,.46,.09],[side*.43,.22,(n-1)*.3],[0,0,side*1.0],'scuttle'));
  stalker.push(part('spike','bone',[.11,.3,.11],[0,.81,.1]));
  const runner=[
   part('shell','runner',[.23,.18,.51],[0,.59,0]),
   part('shell','dark',[.18,.14,.24],[0,.57,-.43]),
   part('shell','eye',[.13,.05,.06],[0,.62,-.62]),
   part('wing','runner',[.7,.09,.44],[-.47,.57,.05],[0,.35,.14],'leftWing'),
   part('wing','runner',[.7,.09,.44],[.47,.57,.05],[0,-.35,-.14],'rightWing'),
   part('spike','bone',[.09,.6,.09],[0,.54,.68],[Math.PI/2,0,0],'tail'),
   part('spike','dark',[.1,.38,.1],[-.17,.42,.29],[.8,0,-.6]),
   part('spike','dark',[.1,.38,.1],[.17,.42,.29],[.8,0,.6])
  ];
  const shooter=[
   part('shell','shooter',[.43,.43,.43],[0,.79,0]),
   part('ring','bone',[1.05,1.05,1.05],[0,.78,0],[Math.PI/2,0,0],'halo'),
   part('shell','dark',[.25,.21,.15],[0,.83,-.36]),
   part('shell','eye',[.17,.14,.08],[0,.85,-.49]),
   part('limb','shooter',[.19,.33,.19],[0,.57,-.45],[Math.PI/2,0,0]),
   part('shell','mouth',[.12,.12,.055],[0,.57,-.64])
  ];
  for(const side of [-1,1])for(const z of [-1,1])shooter.push(part('spike','shooter',[.12,.58,.12],[side*.26,.3,z*.2],[Math.PI+z*.2,0,side*.28],'tentacle'));
  const charger=[
   part('shell','charger',[.52,.37,.56],[0,.53,.1]),
   part('shell','dark',[.4,.28,.3],[0,.46,-.42]),
   part('shell','charger',[.43,.16,.4],[0,.8,.04]),
   part('shell','eye',[.23,.045,.07],[0,.55,-.68]),
   part('spike','bone',[.11,.58,.11],[-.29,.61,-.65],[-1.12,0,-.16]),
   part('spike','bone',[.11,.58,.11],[.29,.61,-.65],[-1.12,0,.16]),
   part('spike','dark',[.12,.33,.12],[0,.55,.74],[Math.PI/2,0,0],'tail')
  ];
  for(const side of [-1,1])for(const z of [-1,1])charger.push(part('limb','dark',[.16,.29,.16],[side*.34,.2,z*.33],[0,0,0],'stomp'));
  return {grunt:stalker,runner,shooter,charger};
 }
 begin(){for(const mesh of this.models){mesh.visible=false;mesh.userData.used=false;}}
 create(){
  const T=this.T,group=new T.Group(),body=new T.Group(),shadow=new T.Mesh(this.shadowGeometry,this.shadowMaterial);
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;group.add(shadow,body);
  const parts=Array.from({length:12},()=>{const p=new T.Mesh(this.geometry.shell,this.materials.dark);p.visible=false;body.add(p);return p;});
  group.userData={body,parts,flash:{visible:false},used:false,enemyType:null,originalMaterials:null};
  this.models.push(group);this.scene.add(group);return group;
 }
 configure(mesh,type){
  const definitions=this.shapes[type];mesh.userData.enemyType=type;mesh.userData.originalMaterials=null;
  mesh.userData.parts.forEach((part,index)=>{const def=definitions[index];part.visible=!!def;part.userData.definition=def;if(!def)return;
   part.geometry=this.geometry[def.g];part.material=this.materials[def.m];part.scale.set(...def.s);part.position.set(...def.p);part.rotation.set(...def.r);
  });
 }
 acquire(type){
  if(!this.shapes[type])type='grunt';
  let mesh=this.models.find(m=>!m.userData.used&&m.userData.enemyType===type)||this.models.find(m=>!m.userData.used);
  if(!mesh){if(this.models.length>=this.limit)return null;mesh=this.create();}
  if(mesh.userData.enemyType!==type)this.configure(mesh,type);
  mesh.userData.used=true;mesh.visible=true;return mesh;
 }
 animate(mesh,enemy,time){
  const phase=time*(enemy.type==='runner'?15:enemy.type==='charger'?8:11)+enemy.id*1.7,speed=this.reduced?0:Math.min(1,enemy.speed||0);
  for(let i=0;i<mesh.userData.parts.length;i++){
   const part=mesh.userData.parts[i],d=part.userData.definition;if(!d)continue;
   part.position.set(...d.p);part.rotation.set(...d.r);if(!speed)continue;
   const swing=Math.sin(phase+i*1.5)*speed;
   if(d.motion==='scuttle'){part.rotation.x+=swing*.28;part.position.y+=Math.max(0,swing)*.045;}
   else if(d.motion==='leftWing'||d.motion==='rightWing')part.rotation.z+=Math.sin(phase)*.22*(d.motion==='leftWing'?1:-1);
   else if(d.motion==='tentacle')part.rotation.z+=swing*.16;
   else if(d.motion==='stomp')part.position.y+=Math.max(0,swing)*.07;
   else if(d.motion==='tail')part.rotation.y+=swing*.16;
   else if(d.motion==='halo')part.rotation.z+=time*.5;
  }
 }
}
