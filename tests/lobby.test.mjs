import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),strip=s=>s.replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
function makeEnv(source,hero='fire'){
 const clock={time:100},nodes=new Map(),sent=[],windowEvents={},documentEvents={},ctx={setTransform(){},fillRect(){}},saved=new Map([['neon-hero',hero]]);
 const node=()=>({style:{setProperty(k,v){this[k]=v}},children:[],firstElementChild:{style:{}},hidden:false,value:'',textContent:'',disabled:false,append(...items){this.children.push(...items)},focus(){},getContext:()=>ctx,setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect:()=>({width:120,height:120,left:0,top:0}),setAttribute(k,v){this[k]=v}});
 const document={hidden:false,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:()=>node(),addEventListener:(n,f)=>documentEvents[n]=f};
 class Peer{constructor(callbacks){this.callbacks=callbacks;this.role='host';this.localId=0;this.connected=true;this.interrupted=false;this.pendingCount=0;this.code='123456';this.locked=false;this.down=new Set();}send(m,reliable=true,target=null){if(!this.connected||this.role==='host'&&this.down.has(target))return false;sent.push({m:JSON.parse(JSON.stringify(m)),target,reliable});return true;}close(){this.connected=false;}lock(){this.locked=true;}isConnected(id){return this.connected&&!this.down.has(id);}isInterrupted(id){return this.down.has(id);}requestReconnect(){}}
 const fn=new Function('document','performance','PeerLink','RoomLink','FireFX','ArenaFX','WizardModels','EnemyModels','WaveMap','navigator','location','addEventListener','requestAnimationFrame','localStorage','globalThis','innerWidth','innerHeight',source);
 const api=fn(document,{now:()=>clock.time},Peer,Peer,class{},class{},class{},class{},class{},{},{hash:'',href:'https://refreshingday.github.io/multiplayerTest/'},(n,f)=>windowEvents[n]=f,()=>{},{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},{matchMedia:()=>({matches:false})},400,800);api.disableRender();
 return {api,clock,sent,windowEvents,documentEvents,document,nodes,saved};
}
const appSource=['game-core-v22.js','prediction-v22.js','buff-icons-v22.js','network-v22.js'].map(p=>strip(read(p))).join('\n')+'\n'+strip(read('app-v22.js')).replace(/\nboot\(\);\s*$/,'')+'\n'+"\nreturn {safe,pendingPair:n=>link.pendingCount=n,chooseHero,heroHUD,receive,frame,hud,selectPerk,active,valid,wireState,menu,reconnecting,reconnected,networkBusy,networkPause,finishRecovery,snapshot:()=>snap(true),join:joined,leave:left,solo:()=>{loaded=true;$('solo').onclick();},open:(r,id=0,room=true)=>{link=room?roomLink:manualLink;link.role=r;link.localId=id;link.connected=true;opened();},ready:()=>$('ready').onclick(),restart:()=>$('restart').onclick(),pause:()=>$('pause').onclick(),state:()=>state,get:()=>({id:mine(),chosenHero,g,e,hold,ready:ready.slice(),pred:prediction.player,frames:prediction.frames.length,pending:[...pending.values()].map(p=>p.m),started:runStarted,recovery:recovery?{resume:recovery.resume}:null,guestRecovering,guestNetworkWait}),events:()=>prediction.drainEvents(),connection:(id,on)=>{if(role==='host'){if(on)link.down.delete(id);else link.down.add(id);}else{link.connected=on;link.interrupted=!on;}},disableRender:()=>{render=()=>{}}};";
test('a room starts with two, three or four connected players even with an unfinished extra pairing',()=>{
 for(let count=1;count<=4;count++){
  const e=makeEnv(appSource);e.api.open('host');
  for(let id=1;id<count;id++){e.api.join(id);e.api.receive({t:'hello',version:22,v:true,hero:'fire'},id);}
  e.api.pendingPair(1);e.api.hud();assert.equal(e.nodes.get('ready').disabled,count===1);
  e.api.ready();
  for(let id=1;id<count;id++){const k=e.api.get();e.api.receive({t:'action',a:1,g:k.g,e:k.e,type:'ready'},id);}
  assert.equal(e.api.get().started,count>=2);assert.equal(e.api.state().paused,count===1);
 }
});
test('all connected players must be ready and lobby build labels agree',()=>{
 const e=makeEnv(appSource);e.api.open('host');
 for(let id=1;id<=2;id++){e.api.join(id);e.api.receive({t:'hello',version:22,v:true,hero:'fire'},id);}
 e.api.ready();let k=e.api.get();e.api.receive({t:'action',a:1,g:k.g,e:k.e,type:'ready'},1);assert.equal(e.api.get().started,false);
 e.api.receive({t:'action',a:1,g:k.g,e:k.e,type:'ready'},2);assert.equal(e.api.get().started,true);
 for(const id of ['release-main','release-join','release-lobby'])assert.equal(e.nodes.get(id).textContent,'v22 · Updated 18 Oct 2026');
});

test('guests accept bounded heart drops and authoritative healing with the new protocol',()=>{
 const host=makeEnv(appSource),guest=makeEnv(appSource);
 host.api.open('host');host.api.join(1);guest.api.open('guest',1);
 const pump=()=>{for(let n=0;n<12;n++){const h=host.sent.splice(0),g=guest.sent.splice(0);for(const x of h)if(x.target===1)guest.api.receive(x.m,0);for(const x of g)host.api.receive(x.m,1);}};
 pump();const s=host.api.state();s.players[1].hp=60;s.pickups=Array.from({length:12},(_,i)=>({id:800+i,key:i<6?'heart':'shield',x:i-6,z:0,ttl:15}));s.players[1].buffs.shield=4.5;
 host.api.snapshot();pump();assert.equal(guest.api.state().players[1].hp,60);assert.equal(guest.api.state().players[1].buffs.shield,4.5);assert.equal(guest.api.state().pickups.length,12);assert.equal(guest.api.state().pickups.filter(p=>p.key==='heart').length,6);
});

test('three guests and host validate the same larger wave and obstacle coordinates',()=>{
 const host=makeEnv(appSource),guests=[1,2,3].map(id=>makeEnv(appSource));
 host.api.open('host');for(let id=1;id<=3;id++)host.api.join(id);guests.forEach((g,i)=>g.api.open('guest',i+1));
 const pump=()=>{for(let n=0;n<12;n++){for(const x of host.sent.splice(0))if(x.target>=1&&x.target<=3)guests[x.target-1].api.receive(x.m,0);guests.forEach((g,i)=>{for(const x of g.sent.splice(0))host.api.receive(x.m,i+1);});}};
 pump();const s=host.api.state();s.wave=4;s.obstacles=[{x:24,z:14,w:2,d:2,h:1.3,type:'crate'}];s.players.forEach((p,i)=>{p.x=18+i;p.z=10;});
 host.api.snapshot();pump();
 for(const g of guests){assert.ok(g.api.valid(g.api.state()));assert.equal(g.api.state().wave,4);assert.equal(g.api.state().obstacles[0].x,24);assert.equal(g.api.get().pred.x,g.api.state().players[g.api.get().id].x);}
});
test('the radar fits the full growing arena and the camera follows players beyond old limits',()=>{
 const source=appSource.replace('return {safe,','return {radar,cameraUpdate:updateCamera,cameraForTest:c=>{camera=c},safe,');
 const env=makeEnv(source);env.api.solo();const s=env.api.state(),canvas=env.document.getElementById('minimap');canvas.width=120;canvas.height=90;const ctx=canvas.getContext('2d'),transforms=[],rects=[];
 ctx.setTransform=(...a)=>transforms.push(a);ctx.fillRect=(...a)=>rects.push(a);
 for(const wave of [1,2,5]){s.wave=wave;env.clock.time+=200;env.api.radar(s);const scale=1.5*Math.pow(1.2,wave-1),b={x:12*scale,z:9*scale},last=transforms.at(-1);assert.ok(Math.abs(last[0]-120/(2*b.x))<1e-8);assert.equal(last[4],60);assert.equal(last[5],45);assert.ok(rects.some(r=>r[0]===-b.x&&r[1]===-b.z));}
 s.wave=3;s.players[0].x=20;s.players[0].z=12;const positions=[],camera={position:{set:(...a)=>positions.push(a)},lookAt(){},updateProjectionMatrix(){}};
 env.api.cameraForTest(camera);env.api.cameraUpdate(s,1);assert.ok(positions[0][0]>7);assert.ok(positions[0][2]>22.5);
});
