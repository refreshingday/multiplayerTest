import {LIMITS} from './game-core-v23.js';
const schema=Object.freeze({
 enemies:['id','type','x','z','maxHp','hp','bar','speed','attack','hit','slow','poison','poisonTick','poisonTicks','poisonPower','poisonOwner','spawn','special','wind','dash','ax','az'],
 bullets:['id','a','shot','x','z','vx','vz','ttl','owner','element','crit','damage','pierce','nova','chains','hitIds'],
 enemyShots:['id','x','z','vx','vz','ttl','owner'],
 pickups:['id','x','z','key','ttl']
});
const caps={enemies:LIMITS.enemies,bullets:LIMITS.bullets,enemyShots:LIMITS.enemyShots,pickups:LIMITS.pickups};
export function packSnapshot(s){
 const out={...s,compact:1};
 for(const [key,keys]of Object.entries(schema))out[key]=(s[key]||[]).map(item=>keys.map(k=>item[k]??null));
 return out;
}
export function unpackSnapshot(s){
 if(!s||s.compact!==1)return null;const out={...s};delete out.compact;
 for(const [key,keys]of Object.entries(schema)){
  if(!Array.isArray(s[key])||s[key].length>caps[key])return null;const list=[];
  for(const row of s[key]){
   if(!Array.isArray(row)||row.length!==keys.length)return null;const item={};
   for(let i=0;i<keys.length;i++){const value=row[i];if(value===null)continue;
    if(keys[i]==='hitIds'){if(!Array.isArray(value)||value.length>LIMITS.enemies||value.some(x=>!Number.isSafeInteger(x)))return null;}
    else if(!['number','string','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value)||typeof value==='string'&&value.length>40)return null;
    item[keys[i]]=value;
   }list.push(item);
  }out[key]=list;
 }
 return out;
}
