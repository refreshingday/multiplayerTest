import {createState,territory,step,makeCourse,stepHazards} from './core.js?v=1.3.0';
export const CAPTAINS=Object.freeze([
 {name:'Pip',color:'#b3dca5',scarf:'#a9c281'},
 {name:'Peach',color:'#f4b0a5',scarf:'#e39892'},
 {name:'Sunny',color:'#f4d68d',scarf:'#dfbd59'},
 {name:'Bubbles',color:'#a9cbd2',scarf:'#7eb7c6'}
]);
export function createCrew(ids=[0],seed=712){
 const members=[...new Set(ids)].filter(id=>Number.isInteger(id)&&id>=0&&id<4).sort();
 if(!members.length)members.push(0);
 const s=createState(members.length);s.phase='lobby';s.seed=seed;s.players=members.map((id,seat)=>({id,seat,active:true,connected:true,visible:true,ready:false,restart:false,angle:members.length===1?Math.PI:territory(members.length,seat).center,fuel:100,powerTime:0,boosting:false}));
 s.hitIds=[];s.events=[];s.nextEvent=1;s.reason='Everyone aboard? Tap Ready.';return s;
}
export function crewEvent(s,type,data={}){s.events.push({id:s.nextEvent++,type,...data});if(s.events.length>12)s.events.shift();}
export function stepVoyage(s,inputs,course,dt,externalPlayers=[]){
 if(s.phase!=='playing')return;const lives=s.lives;step(s,inputs,dt,externalPlayers);
 if(s.lives!==lives)crewEvent(s,'hit',{kind:'bank'});
 for(const event of stepHazards(s,course,dt)){const {type,...data}=event;crewEvent(s,type,data);}
}

export function voyageCourse(s){const course=makeCourse(s.seed),hits=new Set(s.hitIds);for(const o of course)o.hit=hits.has(o.id);return course;}
