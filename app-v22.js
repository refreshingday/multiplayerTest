import {RELEASE,probeNetwork,diagnosticText,diagnosticReport} from './network-v22.js';
import {WizardModels} from './wizard-models-v22.js';
import {EnemyModels} from './enemy-models-v12.js';
import {WaveMap} from './wave-map-v22.js';
import {BUFFS,buffDuration,arenaBounds,arenaScale,HEROES,heroFor,setHero,LIMITS,ARENA_THEMES,obstaclesFor,createGame,stepGame,normalizeInput,UPGRADES,PERKS,choosePerk,stats,ENEMY_TYPES,setPlayerActive} from './game-core-v22.js';
import {PeerLink} from './peer-v22.js';
import {RoomLink} from './room-v22.js';
import {LocalPrediction,RemoteInputs,SmoothWorld,TICK} from './prediction-v22.js';
import {FireFX} from './fire-fx-v22.js';
import {ArenaFX} from './arena-fx-v22.js';
import {iconSVG} from './buff-icons-v22.js';
const $=id=>document.getElementById(id),clock=()=>performance.now(),empty=()=>({x:0,z:0,ax:0,az:-1,fire:false});
let mode='menu',role='host',state=null,g=0,e=0,q=0,iq=0,seq=0,seen=0,remoteQ=0,remoteAt=0,remoteVisible=null,lastQ=-1,lastStateAt=0,why='',hold=false,ready=[false,false],votes=[false,false],ack=[],pending=new Map(),remote=empty(),pairKind='',token=0,loaded=false;
let T,renderer,scene,camera,lastFrame=clock(),inputAt=0,stateAt=0,hudAt=0;
let lastRadar=0;let lastWave=-1,bannerUntil=0,lastPickup=0,runRecorded=false;const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;let wizardModels=null;let enemyModels=null;let waveMap=null;let arenaFX=null;let fireFX=null,lastVisual=clock();
const keys=new Set(),sticks={aim:{x:0,z:0,id:null}};
const callbacks={onStatus:text=>{if(mode==='menu')say(text)},onMessage:m=>receive(m,role==='host'?1:0),onOpen:opened,onDiagnostics:recordNetwork,onClose:text=>{menu();say(text)}};
const manualLink=new PeerLink(callbacks),roomLink=new RoomLink({...callbacks,onMessage:receive,onPeerJoin:joined,onPeerLeave:left,onReconnecting:reconnecting,onReconnected:reconnected});
let link=manualLink,roomCode='',hostAccumulator=0;
const prediction=new LocalPrediction(),remoteInputs=Array.from({length:4},(_,id)=>new RemoteInputs(id)),smoothWorld=new SmoothWorld();
const PLAYER_NAMES=['Cyan','Violet','Gold','Rose'],PLAYER_KEYS=['cyan','violet','gold','rose'],PLAYER_HEX=['#61f7dc','#c6a1ff','#ffd46e','#ff8eb5'];
const freshRemote=()=>({q:0,at:0,visible:null,seen:0,ack:[],input:empty()});
let remotes=Array.from({length:4},freshRemote),runStarted=false;
let recovery=null,guestRecovering=false,guestNetworkWait=false;
let networkReport={stage:'idle'},networkTesting=false;
function recordNetwork(report){
 if(report.stage==='matching')networkReport={stage:'matching',side:report.side,route:'unknown'};
 else networkReport={...networkReport,...report};
 for(const area of ['main','join','lobby'])$('network-'+area).textContent=diagnosticText(networkReport);
}
async function testNetwork(){
 if(networkTesting)return;networkTesting=true;for(const area of ['main','join','lobby'])$('network-test-'+area).disabled=true;
 recordNetwork({stage:'testing',error:null});
 try{recordNetwork(await probeNetwork());}catch(error){recordNetwork({stage:'failed',error:error.message});}
 finally{networkTesting=false;for(const area of ['main','join','lobby'])$('network-test-'+area).disabled=false;}
}
async function copyNetwork(){
 const report=diagnosticReport(networkReport);
 try{await navigator.clipboard.writeText(report);say('Connection report copied.');}
 catch{$('url').value=report;$('url').hidden=false;$('url').focus();$('url').select();say('Report selected. Use Copy.');}
}
for(const area of ['main','join','lobby']){$('network-test-'+area).onclick=testNetwork;$('network-copy-'+area).onclick=copyNetwork;}
for(const id of ['release-main','release-join','release-lobby'])$(id).textContent=RELEASE.label;
recordNetwork({stage:'idle'});

function say(text){if($('status').textContent!==text)$('status').textContent=text}
function mine(){return role==='guest'?(link.localId||1):0}
function activeIds(){return state?state.players.filter(p=>p.active).map(p=>p.id):[];}
function allVoted(list){return activeIds().every(id=>list[id]);}
function anyVote(){return activeIds().some(id=>votes[id]);}
function roomMode(){return link===roomLink;}
function resetInputs(){clear();for(const input of remoteInputs)input.reset();for(const r of remotes){r.q=0;r.input=empty();}hostAccumulator=0;}
function active(){return !networkBusy()&&!!state&&!state.paused&&!state.over&&!state.upgrade&&state.phase==='combat'&&!hold&&!document.hidden}
function clear(){
 keys.clear();
 for(const name of ['aim']){const s=sticks[name],el=$(name);if(s.id!==null)try{el.releasePointerCapture(s.id)}catch{}s.id=null;s.x=0;s.z=0;el.firstElementChild.style.transform='translate(-50%,-50%)'}
}
function phase(){return state?state.phase+':'+state.wave:'menu';}
function phaseBarrier(before){
 if(before===phase())return;
 e++;resetInputs();lastFrame=clock();fireFX?.audio.stop();snap(true);hud();
}
function resetPresentation(){lastWave=-1;lastPickup=0;bannerUntil=0;runRecorded=false;cameraX=cameraZ=0;}
function phaseText(id,text){const el=$(id);if(el.textContent!==text)el.textContent=text;}
function banner(text){$('wave-banner').textContent=text;bannerUntil=clock()+2000;$('wave-banner').hidden=false;}
let chosenHero='fire';try{chosenHero=heroFor(localStorage.getItem('neon-hero')).key;}catch{}
const heroButtons=[];
for(const id of ['hero-menu','hero-lobby'])for(const hero of HEROES){
 const button=document.createElement('button');button.className='hero-choice';button.style.setProperty('--hero-color',hero.color);button.setAttribute('aria-label',hero.name+' · '+hero.description);
 const icon=document.createElement('span');icon.className='hero-icon';icon.innerHTML=iconSVG(hero.key);const label=document.createElement('strong');label.textContent=hero.name;const detail=document.createElement('small');detail.textContent=hero.description;button.append(icon,label,detail);
 button.onclick=()=>chooseHero(hero.key);$(id).append(button);heroButtons.push({button,key:hero.key});
}
function heroHUD(){
 const locked=!!state&&(runStarted||state.time>0||state.phase!=='starting'||state.over),waiting=[...pending.values()].some(p=>p.m.type==='hero');
 for(const item of heroButtons){item.button.setAttribute('aria-pressed',String(item.key===chosenHero));item.button.disabled=locked||waiting;}
 $('hero-lobby-wrap').hidden=!state||locked;
}
function chooseHero(key){
 if(!HEROES.some(h=>h.key===key)||state&&(runStarted||state.time>0||state.phase!=='starting'||state.over)||[...pending.values()].some(p=>p.m.type==='hero'))return;
 chosenHero=key;try{localStorage.setItem('neon-hero',key);}catch{}
 if(state){if(role==='guest')action('hero',key);else{setHero(state,mine(),key);ready[mine()]=false;snap(true);}}heroHUD();if(state)hud();
}
heroHUD();

const perkButtons=new Map();
for(const perk of PERKS){
 const button=document.createElement('button');button.className='perk-card';button.style.setProperty('--perk-color',perk.color);
 const icon=document.createElement('span');icon.className='perk-icon';icon.innerHTML=iconSVG('perk-'+perk.key);const name=document.createElement('strong'),desc=document.createElement('span'),rank=document.createElement('small');name.textContent=perk.name;desc.textContent=perk.description;button.append(icon,name,desc,rank);button.onclick=()=>selectPerk(perk.key);$('perk-grid').append(button);perkButtons.set(perk.key,{button,rank});
}
const buffNodes=new Map(),buildNodes=new Map(),tempEffects={double:'+1 projectile',haste:'Move speed ×2',power:'Damage ×2',rapid:'Cast speed ×2',pierce:'Pierce all enemies',nova:'Explosive hits',shield:'No enemy damage'};
let shownBuff=null;
function makeBuff(key,color,iconKey,container){
 const button=document.createElement('button');button.className='buff-circle';button.style.setProperty('--buff-color',color);
 const art=document.createElement('span');art.className='buff-art';art.innerHTML=iconSVG(iconKey);const badge=document.createElement('small');button.append(art,badge);button.hidden=true;button.onclick=()=>{shownBuff={key,permanent:container==='build-line'};updateBuffIcons();};$(container).append(button);return {button,badge};
}
for(const u of UPGRADES)buffNodes.set(u.key,makeBuff(u.key,u.color,u.key,'buffs'));
for(const p of PERKS)buildNodes.set(p.key,makeBuff(p.key,p.color,'perk-'+p.key,'build-line'));
const emptyBuild=document.createElement('small');emptyBuild.textContent='Clear a wave to earn a permanent upgrade';$('build-line').append(emptyBuild);
$('buff-close').onclick=()=>{shownBuff=null;$('buff-detail').hidden=true;};
function updateBuffIcons(){
 if(!state)return;const p=state.players[mine()];let count=0,owned=0;
 for(const u of UPGRADES){const n=buffNodes.get(u.key),left=p.buffs?.[u.key]||0;n.button.hidden=left<=0;if(left>0){count++;n.badge.textContent=Math.ceil(left);n.button.title=u.name+' · '+tempEffects[u.key];n.button.setAttribute('aria-label',n.button.title+' · '+Math.ceil(left)+' seconds');n.button.style.setProperty('--remaining',Math.min(360,left/buffDuration(u.key)*360)+'deg');}}
 for(const perk of PERKS){const n=buildNodes.get(perk.key),rank=p.perks?.[perk.key]||0;n.button.hidden=rank<=0;if(rank>0){owned++;n.badge.textContent=rank;n.button.title=perk.name+' · '+perk.description;n.button.setAttribute('aria-label',n.button.title+' · Rank '+rank);n.button.style.setProperty('--remaining','360deg');}}
 $('buffs').hidden=!count;emptyBuild.hidden=owned>0;
 $('buff-detail').hidden=!shownBuff;
 if(shownBuff){const item=(shownBuff.permanent?PERKS:UPGRADES).find(p=>p.key===shownBuff.key),amount=shownBuff.permanent?p.perks?.[shownBuff.key]:p.buffs?.[shownBuff.key];if(!item||!amount){shownBuff=null;$('buff-detail').hidden=true;}else $('buff-description').textContent=item.name+' · '+(shownBuff.permanent?item.description:tempEffects[item.key]);}
}
function choiceSafe(){return !document.hidden&&(mode==='solo'||(role==='host'?activeIds().every(id=>id===0||(remotes[id].visible===true&&(roomMode()?link.isConnected(id):link.connected))):link.connected&&!link.interrupted&&remoteVisible===true));}
function selectPerk(key){
 if(!state?.upgrade||state.paused||hold||state.over||state.upgrade.chosen[mine()]||!choiceSafe()||[...pending.values()].some(p=>p.m.type==='perk'))return;
 if(role==='guest')action('perk',{key,wave:state.upgrade.wave});
 else {const before=phase();if(choosePerk(state,mine(),key,state.upgrade.wave)){clear();phaseBarrier(before);snap(true);hud();}}
}
function upgradeHUD(){
 const phase=state.upgrade,show=!!phase&&!state.paused&&!hold&&!state.over,wasHidden=$('upgrade').hidden;$('upgrade').hidden=!show;
 if(!show)return;
 const chosen=phase.chosen[mine()],waiting=[...pending.values()].some(p=>p.m.type==='perk');
 $('upgrade-title').textContent='Wave '+phase.wave+' cleared';
 $('upgrade-help').textContent=chosen?'Your upgrade is locked. Waiting for your friend…':waiting?'Locking your selection…':'Choose 1 of 3. Permanent for this run.';
 phaseText('upgrade-status',mode==='coop'?activeIds().map(id=>PLAYER_NAMES[id]+' '+(phase.chosen[id]?'✓':'choosing')).join(' · '):'Choose your next advantage.');
 for(const perk of PERKS){const {button,rank}=perkButtons.get(perk.key),level=state.players[mine()].perks?.[perk.key]||0,maxed=Number.isFinite(perk.maxRank)&&level>=perk.maxRank;button.hidden=!phase.offers[mine()].includes(perk.key);button.disabled=chosen||waiting||maxed;rank.textContent=maxed?'MAX':'Lv '+level+' → '+(level+1);}
 if(wasHidden){const first=[...perkButtons.values()].find(p=>!p.button.disabled&&!p.button.hidden);first?.button.focus({preventScroll:true});$('upgrade').scrollTop=0;}
}
function scoreHUD(){
 for(let id=0;id<4;id++){const p=state.players[id],row=$('player-'+id);row.hidden=!p||!p.active;if(!p||!p.active)continue;
 $('player-name-'+id).textContent=PLAYER_NAMES[id].toUpperCase()+' · '+heroFor(p.hero).name+(id===mine()?' · YOU':'');
 $('player-score-'+id).textContent=p.score||0;
 $('player-detail-'+id).textContent=(p.kills||0)+' kills · '+Math.round(p.damage||0)+' damage'+(p.hp<=0?' · DOWN':'');
 }
 updateBuffIcons();
}
function radar(s){
 if(clock()-lastRadar<150)return;lastRadar=clock();const canvas=$('minimap'),ctx=canvas.getContext('2d');if(!ctx)return;const bounds=arenaBounds(s),zoom=Math.min(canvas.width/(bounds.x*2),canvas.height/(bounds.z*2));ctx.setTransform(zoom,0,0,zoom,canvas.width/2,canvas.height/2);ctx.fillStyle='#06141f';ctx.fillRect(-bounds.x,-bounds.z,bounds.x*2,bounds.z*2);ctx.fillStyle='#355260';for(const o of obstaclesFor(s))ctx.fillRect(o.x-o.w/2,o.z-o.d/2,o.w,o.d);for(const enemy of s.enemies){ctx.fillStyle='#'+(ENEMY_TYPES.find(t=>t.key===enemy.type)?.color||0xf5a345).toString(16).padStart(6,'0');ctx.fillRect(enemy.x-.8/zoom,enemy.z-.8/zoom,1.6/zoom,1.6/zoom);}ctx.fillStyle='#ffe782';for(const item of s.pickups||[]){ctx.fillStyle=item.key==='heart'?'#ff668b':'#ffe782';ctx.fillRect(item.x-1.5/zoom,item.z-1.5/zoom,3/zoom,3/zoom);}for(const p of s.players){if(!p.active||p.hp<=0)continue;ctx.fillStyle=p.id===mine()?'#ffffff':PLAYER_HEX[p.id];ctx.fillRect(p.x-1.8/zoom,p.z-1.8/zoom,3.6/zoom,3.6/zoom);}
}
function presentation(s,dt){
 if(!state){$('hit-vignette').style.opacity='0';$('phase-card').hidden=true;return;}
 radar(s);const p=s.players[mine()];$('hit-vignette').style.opacity=String(Math.min(.6,(p.hitPulse||0)*1.9)+(p.hp>0&&p.hp/stats(p).maxHp<.25?.08:0));
 if(s.phase==='combat'&&s.wave!==lastWave){banner('WAVE '+s.wave+' · '+(s.remaining+s.enemies.length)+' INCOMING');lastWave=s.wave;}
 for(const event of s.events||[])if(event.type==='pickup'&&event.owner===mine()&&event.id>lastPickup){lastPickup=event.id;const pickup=UPGRADES.find(u=>u.key===event.key);if(s.time-event.t<.4){if(event.key==='heart')banner('HEALED +'+event.heal+' HP');else if(pickup)banner(pickup.name+' · '+buffDuration(event.key)+' SECONDS');}}
 const transitional=(s.phase==='clear'||s.phase==='starting')&&!s.paused&&!hold;
 $('phase-card').hidden=!transitional;
 if(transitional){phaseText('phase-title',s.phase==='clear'?'WAVE '+s.wave+' CLEARED':'WAVE '+s.wave);phaseText('phase-subtitle',s.phase==='clear'?'Upgrade choices in '+Math.ceil(s.phaseLeft)+'s':ARENA_THEMES[s.theme].name+' · MAP ×'+arenaScale(s).toFixed(2)+' · '+(s.wave<=4?'New: '+ENEMY_TYPES[s.wave-1].name:'Get ready')+' · '+Math.ceil(s.phaseLeft)+'s');}
 if(clock()>bannerUntil||s.phase!=='combat')$('wave-banner').hidden=true;
 if(s.over&&!runRecorded){runRecorded=true;try{const best=JSON.parse(localStorage.getItem('neon-best')||'{}'),own=state.players[mine()];localStorage.setItem('neon-best',JSON.stringify({wave:Math.max(best.wave||0,s.wave),score:Math.max(best.score||0,own.score||0)}));}catch{}}
}
function input(){if(!active())return empty();return normalizeInput({x:sticks.aim.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),z:sticks.aim.z+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)})}
function networkBusy(){return !!recovery||guestRecovering||guestNetworkWait;}
function networkPause(id){
 if(!state||role!=='host'||!roomMode())return;
 const first=!recovery;
 if(first){recovery={resume:!state.paused&&!state.over&&!anyVote(),ready:ready.slice(),missing:new Set()};for(const r of remotes)r.synced=-1;}
 if(!first&&recovery.missing.has(id))return;
 if(Number.isInteger(id)&&remotes[id]){remotes[id].synced=-1;recovery.missing.add(id);}
 if(first)pause('Reconnecting automatically. Keep every game tab open.',true,true);
 else{why='Reconnecting automatically. Keep every game tab open.';snap(true);hud();}
}
function guestReconnect(){
 if(!state||role!=='guest'||!roomMode())return;
 guestRecovering=true;clear();hold=true;pending.clear();fireFX?.audio.stop();why='Reconnecting automatically. Keep this game tab open.';hud();
}
function reconnecting(id){if(role==='host')networkPause(id);else guestReconnect();}
function reconnected(id){
 if(!state||mode!=='coop')return;
 if(role==='host'){
  networkPause(id);remotes[id].q=0;remotes[id].at=clock();remotes[id].visible=null;remotes[id].synced=-1;remoteInputs[id].reset();snap(true);
 }else{
  guestReconnect();link.send({t:'hello',version:22,hero:chosenHero,v:!document.hidden,reconnect:true},true);
 }
}
function finishRecovery(){
 if(role!=='host'||!recovery||!safe()||!activeIds().every(id=>id===0||remotes[id].synced===e))return;
 const saved=recovery;recovery=null;
 ready=saved.resume?state.players.map(p=>p.active):saved.ready.map((v,id)=>!!(v&&state.players[id]?.active));
 why=saved.resume?'':'Connection restored. Tap Ready when your squad is ready.';lastFrame=clock();resume();snap(true);hud();
}
function safe(){
 if(document.hidden)return false;if(mode==='solo')return true;if(role==='guest')return link.connected&&!link.interrupted&&remoteVisible===true&&lastStateAt>0&&clock()-lastStateAt<1000;
 if(!runStarted&&activeIds().length<2)return false;
 return activeIds().every(id=>id===0||(remotes[id].visible===true&&clock()-remotes[id].at<1000&&(roomMode()?link.isConnected(id):link.connected)));
}
const preciseKeys=new Set(['charge','cool',...UPGRADES.map(u=>u.key)]);
function wireState(s){return JSON.parse(JSON.stringify(s,(key,value)=>typeof value==='number'&&Number.isFinite(value)&&!Number.isInteger(value)&&!preciseKeys.has(key)?Math.round(value*1000)/1000:value));}
function snap(reliable=false){
 if(mode!=='coop'||role!=='host'||!state)return;const snapshot=wireState(state),number=++q;
 for(const id of activeIds())if(id!==0)link.send({t:'state',g,e,q:number,s:snapshot,r:ready,v:votes,visible:!document.hidden,why,recovering:!!recovery,ack:remotes[id].ack.slice(),moveAck:remoteInputs[id].done,you:id,locked:runStarted,version:22},reliable,id);
}
function pause(text,force=false,network=false){
 if(recovery&&!network){recovery.resume=false;recovery.ready=Array(4).fill(false);}
 if(!state||role==='guest')return;
 const changed=!state.paused||force||(text!==why&&activeIds().some(id=>ready[id])),changedText=text!==why;
 if(changed){e++;ready=Array(4).fill(false);resetInputs();fireFX?.audio.stop();}
 state.paused=true;why=text;if(changed||changedText)snap(true);hud();
}
function resume(){
 if(!state||role==='guest'||recovery||state.over||!state.paused||!safe()||!allVoted(ready)||anyVote())return;
 if(mode==='coop'&&!runStarted){runStarted=true;if(roomMode())link.lock();}
 clear();state.paused=false;why='';lastFrame=clock();snap(true);hud();
}
function reset(){
 const heroes=state.players.map(p=>p.hero),members=activeIds();resetPresentation();fireFX?.reset();g++;e=0;q=0;state=createGame(mode,members);state.players.forEach((p,id)=>setHero(state,id,heroes[id]));state.paused=true;ready=Array(4).fill(false);votes=Array(4).fill(false);remotes.forEach(r=>{r.q=0;r.seen=0;r.ack=[];});resetInputs();why='New round. Everyone tap Ready.';snap(true);hud();
}
function action(type,value){
 if(mode!=='coop'||role!=='guest'||!state||!link.connected)return;if([...pending.values()].some(p=>p.m.type===type&&p.m.value===value))return;
 const m={t:'action',g,e,a:++seq,type,value};pending.set(m.a,{m,start:clock(),sent:clock()});link.send(m,true);hud();
}
function stop(text){if(recovery)recovery.resume=false;clear();if(!state)return;if(role==='host')pause(text,activeIds().some(id=>ready[id]));else{hold=true;why=text;action('pause',text);hud();}}
function sendInput(reliable=false){if(mode==='coop'&&role==='guest'&&state&&link.connected)link.send({t:'input',g,e,q:++iq,v:!document.hidden,i:input(),frames:prediction.packet()},reliable);}
function valid(s){
 return s&&Number.isSafeInteger(s.mapId)&&Number.isSafeInteger(s.mapSeed)&&Number.isInteger(s.theme)&&s.theme>=0&&s.theme<ARENA_THEMES.length&&Array.isArray(s.obstacles)&&s.obstacles.length<=6&&s.obstacles.every(o=>o&&['crate','wall'].includes(o.type)&&['x','z','w','d','h'].every(k=>Number.isFinite(o[k]))&&o.w>0&&o.w<=4&&o.d>0&&o.d<=4&&o.h>0&&o.h<=2&&Math.abs(o.x)+o.w/2<arenaBounds(s).x&&Math.abs(o.z)+o.d/2<arenaBounds(s).z)&&s.mode==='coop'&&Array.isArray(s.players)&&s.players.length===4&&s.players.every((p,id)=>p&&p.id===id&&typeof p.active==='boolean'&&HEROES.some(h=>h.key===p.hero))&&s.players[0].active&&s.players[mine()]?.active&&Array.isArray(s.pickups)&&s.pickups.length<=LIMITS.pickups&&Array.isArray(s.enemies)&&s.enemies.length<=LIMITS.enemies&&Array.isArray(s.bullets)&&s.bullets.length<=LIMITS.bullets&&
 (s.upgrade===null||(s.upgrade&&Number.isSafeInteger(s.upgrade.wave)&&Array.isArray(s.upgrade.chosen)&&s.upgrade.chosen.length===4&&s.upgrade.chosen.every(x=>typeof x==='boolean')&&Array.isArray(s.upgrade.offers)&&s.upgrade.offers.length===4&&s.upgrade.offers.every((o,id)=>Array.isArray(o)&&o.length===(s.players[id].active?3:0)&&o.every(k=>PERKS.some(p=>p.key===k)))))&&
 ['starting','combat','clear','upgrade'].includes(s.phase)&&Number.isFinite(s.phaseLeft)&&Array.isArray(s.enemyShots)&&s.enemyShots.length<=LIMITS.enemyShots&&typeof s.paused==='boolean'&&typeof s.over==='boolean'&&Number.isSafeInteger(s.wave)&&s.wave>=1&&Number.isFinite(arenaBounds(s).x)&&Number.isFinite(arenaBounds(s).z)&&Number.isFinite(s.score)&&[...s.players,...s.enemies,...s.bullets,...s.enemyShots].every(x=>x&&Number.isFinite(x.x)&&Number.isFinite(x.z));
}
function receive(m,from=1){
 if(mode!=='coop'||!m||typeof m!=='object')return;
 if((m.t==='hello'||m.t==='state')&&m.version!==22){if(role==='guest'){menu();say('Players have different game versions. Reload every phone.');}return;}
 if(role==='host'){
  if(!Number.isInteger(from)||from<1||from>3||!state?.players[from]?.active)return;const r=remotes[from];
  if(m.t==='hello'&&typeof m.v==='boolean'){r.visible=m.v;r.at=clock();if(!runStarted&&setHero(state,from,m.hero))ready[from]=false;snap(true);return;}
  if(m.t==='input'){
   if(m.g!==g||m.e!==e||!Number.isSafeInteger(m.q)||m.q<=r.q||typeof m.v!=='boolean'||!remoteInputs[from].add(m.frames))return;
   r.q=m.q;r.at=clock();r.synced=e;r.input=normalizeInput(m.i);const wasVisible=r.visible;r.visible=m.v;if(!recovery&&!m.v&&wasVisible!==false)pause(PLAYER_NAMES[from]+' left the game tab. Everyone tap Ready after returning.');resume();return;
  }
  if(m.t!=='action'||!Number.isSafeInteger(m.a)||m.a<1)return;
  if(r.ack.includes(m.a)){snap(true);return;}
  if(m.g!==g||(!['visible','restart'].includes(m.type)&&m.e!==e)||m.a<=r.seen){snap(true);return;}
  if(!['ready','pause','restart','visible','perk','hero'].includes(m.type)||(m.type==='visible'&&typeof m.value!=='boolean'))return;
  r.seen=m.a;r.ack.push(m.a);if(r.ack.length>32)r.ack.shift();
  if(m.type==='visible'){const changed=r.visible!==m.value;r.visible=m.value;if(!recovery&&changed&&!m.value)pause(PLAYER_NAMES[from]+' left the game tab. Everyone tap Ready after returning.',activeIds().some(id=>ready[id]));}
  if(m.type==='hero'&&!runStarted&&setHero(state,from,m.value))ready[from]=false;
  if(m.type==='pause')pause(PLAYER_NAMES[from]+' paused. Everyone tap Ready.',true);
  if(m.type==='ready'&&!state.over&&!anyVote()&&r.visible===true){ready[from]=true;resume();}
  if(m.type==='perk'&&state.upgrade&&!state.paused&&!hold&&!state.over&&choiceSafe()&&m.value&&typeof m.value==='object'){const before=phase();if(choosePerk(state,from,m.value.key,m.value.wave))phaseBarrier(before);}
  if(m.type==='restart'){votes[from]=true;if(allVoted(votes))reset();else pause(PLAYER_NAMES[from]+' requested a restart. Everyone tap Restart to agree.',activeIds().some(id=>ready[id]));}
  snap(true);hud();return;
 }
 if(m.t!=='state'||m.you!==mine()||!Number.isSafeInteger(m.g)||m.g<1||!Number.isSafeInteger(m.e)||m.e<0||!Number.isSafeInteger(m.q)||!valid(m.s)||!Array.isArray(m.r)||m.r.length!==4||!Array.isArray(m.v)||m.v.length!==4||typeof m.visible!=='boolean'||typeof m.recovering!=='boolean')return;
 if(m.g<g||(m.g===g&&(m.e<e||(m.e===e&&m.q<=lastQ))))return;
 const changed=m.g!==g||m.e!==e;if(changed){clear();pending.clear();}
 if(m.g!==g){resetPresentation();fireFX?.reset();}
 prediction.reconcile(m.s,m.moveAck,changed);smoothWorld.push(m.s,clock(),changed);
 g=m.g;e=m.e;lastQ=m.q;lastStateAt=clock();state=m.s;guestNetworkWait=m.recovering;guestRecovering=false;ready=m.r.map(Boolean);votes=m.v.map(Boolean);remoteVisible=m.visible;runStarted=!!m.locked;why=typeof m.why==='string'?m.why.slice(0,180):'Paused';
 if(Array.isArray(m.ack))for(const a of m.ack)pending.delete(a);
 if(state.paused||!guestRecovering&&!guestNetworkWait)hold=false;if(changed){action('visible',!document.hidden);sendInput(true);if(!runStarted&&state.time===0&&state.players[mine()].hero!==chosenHero)action('hero',chosenHero);}
 if(hold&&!state.paused)action('pause');hud();
}
function opened(){
 recovery=null;guestRecovering=guestNetworkWait=false;
 resetPresentation();fireFX?.reset();mode='coop';role=link.role;g=role==='host'?1:0;e=q=iq=seq=0;lastQ=-1;remoteVisible=null;lastStateAt=0;ready=Array(4).fill(false);votes=Array(4).fill(false);remotes=Array.from({length:4},freshRemote);pending.clear();hold=false;runStarted=false;resetInputs();prediction.setPlayerId(mine());smoothWorld.reset();
 state=role==='host'?createGame('coop',roomMode()?[0]:[0,1]):null;if(state){setHero(state,0,chosenHero);state.paused=true;}
 if(roomMode())roomCode=link.code||roomCode;
 why=role==='host'&&roomMode()?'Play with 2–4 people. Invite at least one friend, then everyone connected taps Ready.':'Connected. Everyone tap Ready.';lastFrame=clock();
 $('panel').hidden=true;$('hud').hidden=false;
 if(role==='host')snap(true);else link.send({t:'hello',version:22,hero:chosenHero,v:!document.hidden},true);hud();say(why);
}
function joined(id){
 if(mode!=='coop'||role!=='host'||!state||runStarted)return;
 remotes[id]=freshRemote();remotes[id].at=clock();setPlayerActive(state,id,true);votes=Array(4).fill(false);pause(PLAYER_NAMES[id]+' joined. Invite your group, then everyone tap Ready.',true);snap(true);hud();
}
function left(id,text){
 if(mode!=='coop'||role!=='host'||!state)return;
 const before=phase();setPlayerActive(state,id,false);ready[id]=votes[id]=false;remotes[id]=freshRemote();phaseBarrier(before);
 pause(PLAYER_NAMES[id]+' disconnected. Remaining players tap Ready to continue.',true);if(anyVote()&&allVoted(votes))reset();snap(true);hud();
}
function menu(){
 recovery=null;guestRecovering=guestNetworkWait=false;
 resetPresentation();fireFX?.reset();token++;link.close();mode='menu';state=null;pending.clear();hold=false;runStarted=false;resetInputs();prediction.reset();smoothWorld.reset();$('room-code').hidden=true;$('room-in').hidden=true;$('share-room').hidden=true;roomCode='';$('url').hidden=true;$('panel').hidden=false;$('choices').hidden=false;$('pair').hidden=true;
 for(const id of ['hud','gate','controls','buffs','telemetry','loadout','upgrade','wave-banner','phase-card'])$(id).hidden=true;$('hit-vignette').style.opacity='0';heroHUD();
}
function hud(){
 heroHUD();
 if(!state){$('gate').hidden=mode==='menu';$('controls').hidden=true;$('ready').disabled=true;$('restart').disabled=true;$('gate-title').textContent='Receiving the arena';$('why').textContent='Keep every game tab open.';$('lobby-info').hidden=true;return;}
 $('telemetry').hidden=false;$('loadout').hidden=false;$('controls').hidden=state.phase!=='combat'||state.paused||hold;$('controls').style.opacity=active()?'1':'.35';upgradeHUD();scoreHUD();
 $('wave').textContent=state.wave;$('score').textContent=state.score;const own=state.players[mine()];$('health').textContent=Math.ceil(own.hp)+'/'+stats(own).maxHp;$('health-fill').style.width=Math.max(0,own.hp/stats(own).maxHp*100)+'%';$('role').textContent=mode==='solo'?'SOLO':role.toUpperCase();
 $('gate').hidden=!state.paused&&!hold;$('gate-title').textContent=state.over?'Outpost overrun':networkBusy()?'Reconnecting automatically':mode==='coop'&&!runStarted&&roomMode()?'Assemble your squad':hold?'Safety pause':'Ready to defend?';
 $('why').textContent=(networkBusy()?'Reconnecting automatically. Your place is reserved. Keep every game tab open.':why)+(mode==='coop'?' '+activeIds().map(id=>PLAYER_NAMES[id]+' '+(ready[id]?'ready':'waiting')).join(' · ')+'.':'');
 if(state.over){const leader=state.players.filter(p=>p.active).reduce((a,b)=>(b.score||0)>(a.score||0)?b:a);$('why').textContent='Wave '+state.wave+' · Team '+state.score+' points. '+(mode==='coop'?PLAYER_NAMES[leader.id]+' leads with '+(leader.score||0)+' points. ':'')+'Restart for a new build.';}
 const waiting=[...pending.values()].some(p=>p.m.type==='ready'),restarting=[...pending.values()].some(p=>p.m.type==='restart');
 $('ready').disabled=networkBusy()||state.over||!safe()||ready[mine()]||waiting||anyVote()||restarting||[...pending.values()].some(p=>p.m.type==='hero')||state.players[mine()].hero!==chosenHero;$('ready').textContent=networkBusy()?'Reconnecting…':ready[mine()]||waiting?'Waiting for squad':mode==='coop'&&!runStarted?(activeIds().length<2?'Waiting for a friend':'Ready · '+activeIds().length+' players'):'Ready';
 $('restart').disabled=networkBusy()||mode==='coop'&&(votes[mine()]||restarting);$('restart').textContent=votes[mine()]||restarting?'Restart requested':anyVote()?'Confirm restart':'Restart';
 $('lobby-info').hidden=mode!=='coop';$('lobby-info').textContent=activeIds().length+' connected · 2–4 players'+(!runStarted?(activeIds().length<2?' · One friend needed to start.':' · Everyone connected taps Ready.'):'');
 const code=roomCode||(roomMode()?link.code:'');$('lobby-code').hidden=$('lobby-share').hidden=mode!=='coop'||!roomMode()||runStarted||!code;$('lobby-code').textContent=code?code.slice(0,3)+' '+code.slice(3):'';
 if(state.upgrade&&!state.paused&&!hold)say(state.upgrade.chosen[mine()]?'Upgrade locked. Waiting for your squad.':'Wave cleared · choose a permanent upgrade');else say(mode==='solo'?'Solo · '+heroFor(own.hero).name+' · move right / auto attack':(role==='host'?'Host':'Player')+' · '+PLAYER_NAMES[mine()]+' · '+activeIds().length+' players');
}
$('ready').onclick=()=>{if(!state||networkBusy()||!safe()||state.over||anyVote()||[...pending.values()].some(p=>p.m.type==='hero')||state.players[mine()].hero!==chosenHero)return;if(role==='guest')action('ready');else{ready[0]=true;resume();snap(true);hud();}};
$('restart').onclick=()=>{if(!state)return;if(mode==='solo')reset();else if(role==='guest')action('restart');else{votes[0]=true;if(allVoted(votes))reset();else pause('Restart requested. Everyone tap Restart to agree.',activeIds().some(id=>ready[id]));snap(true);hud();}};
$('pause').onclick=()=>stop('Paused. Everyone tap Ready.');$('upgrade-pause').onclick=()=>stop('Paused during upgrade selection. Everyone tap Ready.');$('upgrade-menu').onclick=()=>{$('menu').onclick();};$('menu').onclick=()=>{menu();say('You left the room. Create or join a room to play again.');};
$('lobby-share').onclick=()=>{const code=roomCode||link.code;if(!code)return;const url=new URL(location.href);url.hash='room='+code;return shareUrl(url.href);};
$('solo').onclick=()=>{if(!loaded)return;menu();mode='solo';role='host';g=1;e=0;state=createGame('solo');setHero(state,0,chosenHero);ready=[true,false,false,false];votes=Array(4).fill(false);$('panel').hidden=true;$('hud').hidden=false;lastFrame=clock();hud()};
async function manualPair(kind){
 if(!loaded)return;menu();link=manualLink;pairKind=kind;$('choices').hidden=true;$('pair').hidden=false;$('in').value='';$('out').value='';$('out').hidden=true;$('copy').hidden=true;$('connect').hidden=false;$('connect').disabled=false;
 $('pair-title').textContent=kind==='host'?'Invite your friend':'Join your friend';
 $('help').textContent=kind==='host'?'Send your invite to your friend. Paste their reply below, connect, then everyone tap Ready.':'Paste your friend’s invite, create a reply, and send it back. Keep this tab open.';
 $('in').placeholder=kind==='host'?'Paste reply code':'Paste invite code';$('connect').textContent=kind==='host'?'Connect phones':'Create reply';
 if(kind==='host'){const t=token;$('connect').disabled=true;try{const code=await link.hostOffer();if(t!==token)return;$('out').value=code;$('out').hidden=false;$('copy').hidden=false;$('connect').disabled=false}catch(err){if(t===token)say(err.message)}}
}
async function roomPair(kind){
 if(!loaded)return;menu();link=roomLink;pairKind='room-'+kind;
 $('choices').hidden=true;$('pair').hidden=false;$('in').hidden=true;$('out').hidden=true;$('copy').hidden=true;
 $('room-in').hidden=kind!=='join';$('room-code').hidden=kind!=='host';$('share-room').hidden=true;
 $('connect').hidden=kind==='host';$('connect').disabled=false;
 $('pair-title').textContent=kind==='host'?'Your room code':'Join your friend';
 $('help').textContent=kind==='host'?'Send these six digits, or share the room link. Start with 2–4 players after everyone connected taps Ready.':'Enter the six digits shown on your friend’s phone.';
 $('connect').textContent='Join game';
 if(kind==='host'){
  const t=token;$('room-code').textContent='··· ···';say('Creating a room…');
  try{const code=await roomLink.hostRoom();if(t!==token||mode!=='menu')return;roomCode=code;$('room-code').textContent=code.slice(0,3)+' '+code.slice(3);$('share-room').hidden=false;say('Room ready. Waiting for your friend.')}
  catch(err){if(t===token){menu();say(err.message)}}
 }else{$('room-in').value='';$('room-in').focus();say('Wi-Fi or mobile data. Keep the host open; use matching versions on both phones.')}
}
$('host').onclick=()=>roomPair('host');$('join').onclick=()=>roomPair('join');
$('manual-host').onclick=()=>{$('in').hidden=false;manualPair('host')};$('manual-join').onclick=()=>{$('in').hidden=false;manualPair('join')};
$('back').onclick=()=>menu();
$('connect').onclick=async()=>{const t=token;$('connect').disabled=true;try{if(pairKind==='room-join'){await roomLink.joinRoom($('room-in').value);if(t===token&&mode==='menu')say('Connecting to your friend…')}else if(pairKind==='host')await link.finishHost($('in').value);else{const code=await link.guestAnswer($('in').value);if(t!==token)return;$('out').value=code;$('out').hidden=false;$('copy').hidden=false;$('connect').hidden=true;$('help').textContent='Send this reply to your friend. They paste it and connect. Keep every game tab open, then everyone tap Ready.'}}catch(err){if(t===token){say(err.message);$('connect').disabled=false}}};
async function copy(field){try{await navigator.clipboard.writeText(field.value);say('Copied. Send it to your friend.')}catch{field.hidden=false;field.focus();field.select();say('Text selected. Use Copy.')}}
$('copy').onclick=()=>copy($('out'));
async function shareUrl(url){if(navigator.share)try{await navigator.share({title:'Neon Outpost',url});return}catch(err){if(err.name==='AbortError')return}$('url').value=url;await copy($('url'))}
$('share').onclick=()=>{const url=new URL(location.href);url.hash='';return shareUrl(url.href)};
$('share-room').onclick=()=>{if(!roomCode)return;const url=new URL(location.href);url.hash='room='+roomCode;return shareUrl(url.href)};
$('room-in').onkeydown=ev=>{if(ev.key==='Enter')$('connect').click()};
$('room-in').oninput=()=>{$('room-in').value=$('room-in').value.replace(/\D/g,'').slice(0,6)};

for(const name of ['aim']){
 const el=$(name),s=sticks[name],knob=el.firstElementChild;
 const move=ev=>{if(s.id!==ev.pointerId||!active())return;const r=el.getBoundingClientRect(),radius=r.width*.32;let x=(ev.clientX-r.left-r.width/2)/radius,z=(ev.clientY-r.top-r.height/2)/radius,n=Math.hypot(x,z);if(n>1){x/=n;z/=n}s.x=n>.08?x:0;s.z=n>.08?z:0;knob.style.transform='translate(-50%,-50%) translate('+x*radius+'px,'+z*radius+'px)';ev.preventDefault()};
 el.onpointerdown=ev=>{if(!active()||s.id!==null)return;s.id=ev.pointerId;el.setPointerCapture(s.id);move(ev)};el.onpointermove=move;
 const end=ev=>{if(s.id!==ev.pointerId)return;s.id=null;s.x=0;s.z=0;knob.style.transform='translate(-50%,-50%)'};
 el.onpointerup=end;el.onlostpointercapture=end;el.onpointercancel=()=>clear();
}
addEventListener('keydown',ev=>{if(/INPUT|TEXTAREA/.test(ev.target.tagName))return;const k=ev.key.toLowerCase();if(k==='escape'&&state&&!ev.repeat)stop('Paused. Tap Ready.');if(active()&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){ev.preventDefault();keys.add(k)}});
addEventListener('keyup',ev=>keys.delete(ev.key.toLowerCase()));addEventListener('pointercancel',()=>clear());
addEventListener('pointerdown',()=>fireFX?.audio.unlock(),{capture:true});
addEventListener('keydown',()=>fireFX?.audio.unlock(),{capture:true});
$('sound').onclick=()=>{if(!fireFX)return;const enabled=fireFX.audio.toggle();$('sound').textContent=enabled?'🔊':'🔇';$('sound').setAttribute('aria-label',enabled?'Mute attack sounds':'Enable attack sounds');$('sound').setAttribute('aria-pressed',String(!enabled));};
addEventListener('blur',()=>clear());
document.addEventListener('visibilitychange',()=>{clear();if(document.hidden)fireFX?.audio.stop();if(!state)return;if(role==='guest'){if(document.hidden)stop('Return to the game, then everyone tap Ready.');action('visible',!document.hidden);sendInput(true)}else{if(document.hidden)pause('Return to the game, then everyone tap Ready.',ready.some(Boolean));snap(true)}hud()});
const pool={players:[],enemies:[],bullets:[]},preview=createGame('coop');let geometry,materials,shadowGeometry,shadowMaterial,ballGeometry,bulletMaterials;
function box(w,h,d,mat,x=0,y=0,z=0){const m=new T.Mesh(geometry,mat);m.scale.set(w,h,d);m.position.set(x,y,z);return m}
function robot(color){return wizardModels.create(PLAYER_KEYS.indexOf(color));}

function render(){
 const s=mode==='coop'&&role==='guest'&&state?(smoothWorld.view(clock(),prediction.view())||state):(state||preview);
 const visualNow=clock(),visualDelta=Math.max(0,(visualNow-lastVisual)/1000);lastVisual=visualNow;
 waveMap?.update(s);
 if(arenaFX)arenaFX.update(s);
 presentation(s,visualDelta);
 updateCamera(s,visualDelta);
 if(fireFX){if(role==='guest')fireFX.predicted(prediction.drainEvents());fireFX.update(s,visualDelta,mine(),active());}
 enemyModels.begin();
 for(const kind of ['players','enemies']){
  const list=s[kind],items=pool[kind];items.forEach(x=>x.visible=false);
  list.forEach((a,i)=>{if(a.active===false)return;let mesh=kind==='enemies'?enemyModels.acquire(a.type):items[i];if(!mesh&&kind==='enemies')return;if(!mesh){mesh=robot(PLAYER_KEYS[i]);items[i]=mesh}
   mesh.visible=true;mesh.position.set(a.x,kind==='bullets'?.57:0,a.z);
   if(kind==='bullets'){mesh.material=bulletMaterials[a.owner||0];return}
   const p=s.players.find(p=>p.active&&p.hp>0),ax=kind==='players'?a.ax:p?p.x-a.x:0,az=kind==='players'?a.az:p?p.z-a.z:-1;mesh.rotation.y=Math.atan2(-ax,-az);mesh.userData.flash.visible=false;mesh.userData.body.rotation.z=a.hp<=0?Math.PI/2:0;mesh.userData.body.visible=true;if(kind==='enemies'){
 const type=ENEMY_TYPES.find(t=>t.key===a.type)||ENEMY_TYPES[0];
 enemyModels.animate(mesh,a,s.time);
 mesh.scale.setScalar(type.scale);if(a.wind>0)mesh.rotation.y=Math.atan2(-a.ax,-a.az);fireFX?.react(mesh,a);
 }else{wizardModels.configure(mesh,a.hero);arenaFX?.cast(mesh,a);}
  });
 }renderer.render(scene,camera);
}
let cameraX=0,cameraZ=0;
function updateCamera(s,dt=1){
 if(!camera)return;const aspect=innerWidth/innerHeight,playing=!!state,h=playing?(aspect<1?8.5:6.8)*1.3*1.2:Math.max(10.5,13.5/aspect);
 const bounds=arenaBounds(s),limitX=Math.max(0,bounds.x-5),limitZ=Math.max(0,bounds.z-4.5),p=s.players[mine()]||s.players[0],cx=playing?Math.max(-limitX,Math.min(limitX,p.x)):0,cz=playing?Math.max(-limitZ,Math.min(limitZ,p.z)):0;
 const ease=reducedMotion||!playing?1:1-Math.exp(-Math.min(.1,dt)/.10);cameraX+=(cx-cameraX)*ease;cameraZ+=(cz-cameraZ)*ease;const shake=active()&&!reducedMotion?(fireFX?.shake||0):0,sx=shake*Math.sin(clock()*.09),sz=shake*Math.cos(clock()*.12);camera.position.set(cameraX+sx,26,cameraZ+18+sz);camera.lookAt(cameraX+sx,0,cameraZ+sz);camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.updateProjectionMatrix();
}
function resize(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.25:1.5));renderer.setSize(innerWidth,innerHeight,false);updateCamera(state||preview);}

function frame(time){
 const gap=(time-lastFrame)/1000;lastFrame=time;
 if(state){
  if(gap>2&&!state.paused&&!hold&&!networkBusy())stop('Game interrupted for more than two seconds. Everyone tap Ready.');
  if(role==='host'){
   if(mode==='coop'){
    if(document.hidden)pause('Return to this game, then everyone tap Ready.');
    else for(const id of activeIds())if(id!==0){
     const interrupted=roomMode()?(!link.isConnected(id)||link.isInterrupted(id)):link.interrupted;
     if(interrupted||time-remotes[id].at>2000){
      if(roomMode()){networkPause(id);link.requestReconnect(id);}
      else pause('Connection interrupted. Keep every game tab open.');
     }else if(remotes[id].visible!==true&&!recovery){pause('Waiting for '+PLAYER_NAMES[id]+' to return.');break;}
    }
   }
   finishRecovery();
   resume();
   if(!state.paused&&!state.upgrade){
    // Preserve elapsed time: discarding hitches eventually fills the guest input history.
    hostAccumulator+=Math.max(0,gap);
    if(hostAccumulator>2)pause('Host performance stalled. Everyone tap Ready.');
    let steps=0;
    while(hostAccumulator+1e-9>=TICK&&!state.paused&&!state.upgrade&&steps++<30){
     hostAccumulator-=TICK;
     if(mode==='coop'&&state.phase==='combat')for(const id of activeIds())if(id!==0)remoteInputs[id].consume(state,TICK);
     const beforePhase=phase();stepGame(state,[input(),...remotes.slice(1).map(r=>r.input)],TICK,mode==='coop'?activeIds().filter(id=>id!==0):[]);phaseBarrier(beforePhase);
     if(state.over)pause('Outpost overrun. Restart to try again.',true);
    }
   }
   if(time-stateAt>=50){stateAt=time;snap()}
  }else{
   if(!document.hidden&&(link.interrupted||time-lastStateAt>2000)&&!guestRecovering){if(roomMode()){guestReconnect();link.requestReconnect();}else if(!hold)stop('Arena updates stopped. Keep every game tab open.');}
   if(!prediction.step(input(),gap,active())){if(roomMode()){guestReconnect();link.requestReconnect();}else stop('Movement acknowledgments stopped for two seconds. Everyone tap Ready.');}
   if(time-inputAt>=40){inputAt=time;sendInput()}
   for(const [a,p] of pending){if(p.m.g!==g||p.m.e!==e){pending.delete(a);continue}if(time-p.start>5000){pending.delete(a);stop('Control unconfirmed. Keep every game tab open.');break}if(time-p.sent>=250){p.sent=time;link.send(p.m,true)}}
  }
  if(time-hudAt>=100){hudAt=time;hud()}
 }
 try{render()}catch{menu();loaded=false;for(const id of ['solo','host','join','manual-host','manual-join'])$(id).disabled=true;say('3D rendering stopped. Reload this page.');return}requestAnimationFrame(frame);
}
async function boot(){try{
 T=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');renderer=new T.WebGLRenderer({canvas:$('view'),antialias:false,powerPreference:'low-power'});renderer.setClearColor('#0b1723');renderer.outputColorSpace=T.SRGBColorSpace;scene=new T.Scene();scene.add(new T.HemisphereLight(0xd6f3ff,0x26303c,2));const sun=new T.DirectionalLight(0xffebd0,2);sun.position.set(-6,16,5);scene.add(sun);camera=new T.OrthographicCamera(-15,15,11,-11,.1,100);camera.position.set(0,26,18);camera.lookAt(0,0,0);geometry=new T.BoxGeometry(1,1,1);
 materials=Object.fromEntries(Object.entries({cyan:0x53f2e0,violet:0xb28aff,orange:0xf5a345,gold:0xffd46e,rose:0xff8eb5,dark:0x152531,...Object.fromEntries(ENEMY_TYPES.map(t=>[t.key,t.color]))}).map(([k,color])=>[k,new T.MeshLambertMaterial({color})]));materials.flash=new T.MeshBasicMaterial({color:0xfff3bc});shadowGeometry=new T.CircleGeometry(.55,12);shadowMaterial=new T.MeshBasicMaterial({color:0x03090f,transparent:true,opacity:.3,depthWrite:false});ballGeometry=new T.SphereGeometry(.09,6,4);bulletMaterials=[new T.MeshBasicMaterial({color:0xa4ffed}),new T.MeshBasicMaterial({color:0xd8b5ff})];
 wizardModels=new WizardModels(T,scene);
 enemyModels=new EnemyModels(T,scene,LIMITS.enemies,reducedMotion);
 waveMap=new WaveMap(T,scene);waveMap.update(preview);
 fireFX=new FireFX(T,scene,camera);arenaFX=new ArenaFX(T,scene);lastVisual=clock();
 resize();addEventListener('resize',resize);loaded=true;for(const id of ['solo','host','join','manual-host','manual-join'])$(id).disabled=false;say('2–4 players · host a room / join with six digits');requestAnimationFrame(frame);
 const roomMatch=location.hash.match(/^#room=(\d{6})$/);if(roomMatch){await roomPair('join');$('room-in').value=roomMatch[1];$('connect').click()}
 }catch{say('3D view unavailable. Check internet, use current Chrome or Safari, and reload.')}
}
for(const id of ['solo','host','join','manual-host','manual-join'])$(id).disabled=true;
try{const best=JSON.parse(localStorage.getItem('neon-best')||'{}');if(best.wave)$('best').textContent='YOUR BEST · WAVE '+best.wave+' · '+(best.score||0)+' POINTS';}catch{}
boot();