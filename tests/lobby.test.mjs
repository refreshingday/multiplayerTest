import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),strip=s=>s.replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
function makeEnv(source,hero='fire'){
 const clock={time:100},nodes=new Map(),sent=[],windowEvents={},documentEvents={},ctx={setTransform(){},fillRect(){}},saved=new Map([['neon-hero',hero]]);
 const node=()=>({style:{setProperty(k,v){this[k]=v}},children:[],firstElementChild:{style:{}},hidden:false,value:'',textContent:'',disabled:false,append(...items){this.children.push(...items)},focus(){},getContext:()=>ctx,setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({width:120,height:120,left:0,top:0}),setAttribute(k,v){this[k]=v}});
 const document={hidden:false,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:()=>node(),addEventListener:(n,f)=>documentEvents[n]=f};
 class Peer{constructor(callbacks){this.callbacks=callbacks;this.role='host';this.localId=0;this.connected=true;this.interrupted=false;this.pendingCount=0;this.code='123456';this.locked=false;this.down=new Set();}send(m,reliable=true,target=null){if(!this.connected||this.role==='host'&&this.down.has(target))return false;sent.push({m:JSON.parse(JSON.stringify(m)),target,reliable});return true;}close(){this.connected=false;}lock(){this.locked=true;}isConnected(id){return this.connected&&!this.down.has(id);}isInterrupted(id){return this.down.has(id);}requestReconnect(){}}
 const fn=new Function('document','performance','PeerLink','RoomLink','FireFX','ArenaFX','WizardModels','EnemyModels','WaveMap','navigator','location','addEventListener','requestAnimationFrame','localStorage','globalThis',source);
 const api=fn(document,{now:()=>clock.time},Peer,Peer,class{},class{},class{},class{},class{},{},{hash:'',href:'https://refreshingday.github.io/multiplayerTest/'},(n,f)=>windowEvents[n]=f,()=>{},{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},{matchMedia:()=>({matches:false})});api.disableRender();
 return {api,clock,sent,windowEvents,documentEvents,document,nodes,saved};
}
const appSource=['game-core-v19.js','prediction-v19.js','buff-icons-v14.js','network-v20.js'].map(p=>strip(read(p))).join('\n')+'\n'+strip(read('app-v20.js')).replace(/\nboot\(\);\s*$/,'')+'\n'+"\nreturn {safe,pendingPair:n=>link.pendingCount=n,chooseHero,heroHUD,receive,frame,hud,selectPerk,active,valid,wireState,menu,reconnecting,reconnected,networkBusy,networkPause,finishRecovery,snapshot:()=>snap(true),join:joined,leave:left,solo:()=>{loaded=true;$('solo').onclick();},open:(r,id=0,room=true)=>{link=room?roomLink:manualLink;link.role=r;link.localId=id;link.connected=true;opened();},ready:()=>$('ready').onclick(),restart:()=>$('restart').onclick(),pause:()=>$('pause').onclick(),state:()=>state,get:()=>({id:mine(),chosenHero,g,e,hold,ready:ready.slice(),pred:prediction.player,frames:prediction.frames.length,pending:[...pending.values()].map(p=>p.m),started:runStarted,recovery:recovery?{resume:recovery.resume}:null,guestRecovering,guestNetworkWait}),events:()=>prediction.drainEvents(),connection:(id,on)=>{if(role==='host'){if(on)link.down.delete(id);else link.down.add(id);}else{link.connected=on;link.interrupted=!on;}},disableRender:()=>{render=()=>{}}};";
test('a room starts with two, three or four connected players even with an unfinished extra pairing',()=>{
 for(let count=1;count<=4;count++){
  const e=makeEnv(appSource);e.api.open('host');
  for(let id=1;id<count;id++){e.api.join(id);e.api.receive({t:'hello',version:20,v:true,hero:'fire'},id);}
  e.api.pendingPair(1);e.api.hud();assert.equal(e.nodes.get('ready').disabled,count===1);
  e.api.ready();
  for(let id=1;id<count;id++){const k=e.api.get();e.api.receive({t:'action',a:1,g:k.g,e:k.e,type:'ready'},id);}
  assert.equal(e.api.get().started,count>=2);assert.equal(e.api.state().paused,count===1);
 }
});
test('all connected players must be ready and lobby build labels agree',()=>{
 const e=makeEnv(appSource);e.api.open('host');
 for(let id=1;id<=2;id++){e.api.join(id);e.api.receive({t:'hello',version:20,v:true,hero:'fire'},id);}
 e.api.ready();let k=e.api.get();e.api.receive({t:'action',a:1,g:k.g,e:k.e,type:'ready'},1);assert.equal(e.api.get().started,false);
 e.api.receive({t:'action',a:1,g:k.g,e:k.e,type:'ready'},2);assert.equal(e.api.get().started,true);
 for(const id of ['release-main','release-join','release-lobby'])assert.equal(e.nodes.get(id).textContent,'v20 · Updated 17 Oct 2026');
});
