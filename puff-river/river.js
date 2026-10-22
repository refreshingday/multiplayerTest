// The same sampled shoreline drives the land meshes and circle/shore contact.
export const RIVER_HALF_WIDTH=12.5;
export const RAFT_RADIUS=2.47;
export const SHORE_STEP=1;
// Arc-length course: short S turns lead into alternating full U turns.
// A 16.5-unit turn radius leaves a visible, collision-safe inner bank.
export const BEND_LENGTH=16.5*Math.PI*5/3;
export const BEND_AMPLITUDE=33;
export const TURN_RADIUS=16.5;
const segments=[];let progress=0,cx=0,cz=0,heading=0;
function section(length,turn=0){
 const curve=turn/length;
 segments.push({start:progress,length,x:cx,z:cz,yaw:heading,curve});
 if(curve){cx+=(Math.cos(heading+turn)-Math.cos(heading))/curve;cz-=(Math.sin(heading+turn)-Math.sin(heading))/curve;}
 else{cx-=Math.sin(heading)*length;cz-=Math.cos(heading)*length;}
 progress+=length;heading+=turn;
}
function wiggle(side){for(const turn of [Math.PI/6,-Math.PI/3,Math.PI/6])section(TURN_RADIUS*Math.abs(turn),turn*side);}
section(18);
for(let i=0;i<2;i++){const side=i%2?1:-1;section(TURN_RADIUS*Math.PI,side*Math.PI);wiggle(side);}
// Climb clear of the first switchbacks, then fold east and west: all four
// territories get a forward-facing stretch without crossing another channel.
section(40);section(TURN_RADIUS*Math.PI/2,-Math.PI/2);wiggle(-1);
section(TURN_RADIUS*Math.PI,Math.PI);wiggle(1);
section(TURN_RADIUS*Math.PI/2,-Math.PI/2);section(100);
export function riverFrame(distance){
 const seg=distance<0?{start:0,length:0,x:0,z:0,yaw:0,curve:0}:segments.find(s=>distance<s.start+s.length)||segments.at(-1);
 const d=distance-seg.start,a=seg.yaw+seg.curve*d;
 const x=seg.curve?seg.x+(Math.cos(a)-Math.cos(seg.yaw))/seg.curve:seg.x-Math.sin(a)*d;
 const z=seg.curve?seg.z-(Math.sin(a)-Math.sin(seg.yaw))/seg.curve:seg.z-Math.cos(a)*d;
 return {x,z,nx:Math.cos(a),nz:-Math.sin(a),tx:-Math.sin(a),tz:-Math.cos(a),yaw:a};
}
export function riverPoint(distance,offset=0,reference=0){const f=riverFrame(distance);return {x:f.x+f.nx*offset,z:4+reference+f.z+f.nz*offset};}
export function shorePoint(distance,side){return riverPoint(distance,side*RIVER_HALF_WIDTH);}
export function bankLimits(distance){
 const f=riverFrame(distance),bounds={};
 for(const side of [-1,1]){
  let limit=Infinity;
  const local=d=>{const p=shorePoint(d,side),dx=p.x-f.x,dz=p.z-(4+f.z);return {x:side*(dx*f.nx+dz*f.nz),y:dx*f.tx+dz*f.tz};};
  for(let d=Math.floor(distance-10);d<distance+10;d+=SHORE_STEP){
   const a=local(d),b=local(d+SHORE_STEP);
   for(const p of [a,b])if(Math.abs(p.y)<=RAFT_RADIUS)limit=Math.min(limit,p.x-Math.sqrt(Math.max(0,RAFT_RADIUS**2-p.y**2)));
   const dy=b.y-a.y;if(Math.abs(dy)<1e-8)continue;
   const slope=(b.x-a.x)/dy,intercept=a.x-slope*a.y,norm=Math.hypot(1,slope);
   const foot=-slope*RAFT_RADIUS/norm;
   if(foot>=Math.min(a.y,b.y)&&foot<=Math.max(a.y,b.y))limit=Math.min(limit,intercept-RAFT_RADIUS*norm);
  }
  bounds[side<0?'left':'right']=side*limit;
 }
 return bounds;
}
