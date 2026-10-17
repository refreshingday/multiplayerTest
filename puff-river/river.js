// The same sampled shoreline drives the land meshes and circle/shore contact.
export const RIVER_HALF_WIDTH=12.5;
export const RAFT_RADIUS=2.47;
export const SHORE_STEP=1;
export const BEND_LENGTH=96;
export const BEND_AMPLITUDE=14;
export function riverFrame(distance){
 const k=2*Math.PI/BEND_LENGTH,a=distance*k;
 const x=BEND_AMPLITUDE*(Math.cos(a)-1),slope=-BEND_AMPLITUDE*k*Math.sin(a),length=Math.hypot(slope,1);
 return {x,z:-distance,nx:1/length,nz:slope/length,tx:slope/length,tz:-1/length,yaw:-Math.atan(slope)};
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
