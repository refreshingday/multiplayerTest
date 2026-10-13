import {LIMITS,OBSTACLES,createGame,stepGame,normalizeInput} from './game-core.js';
import {PeerLink} from './peer.js';
import {RoomLink} from './room.js';
import {LocalPrediction,RemoteInputs,SmoothWorld,TICK} from './prediction.js';
const $=id=>document.getElementById(id),clock=()=>performance.now(),empty=()=>({x:0,z:0,ax:0,az:-1,fire:false});
let mode='menu',role='host',state=null,g=0,e=0,q=0,iq=0,seq=0,seen=0,remoteQ=0,remoteAt=0,remoteVisible=null,lastQ=-1,lastStateAt=0,why='',hold=false,ready=[false,false],votes=[false,false],ack=[],pending=new Map(),remote=empty(),pairKind='',token=0,loaded=false;
let T,renderer,scene,camera,ray,plane,lastFrame=clock(),inputAt=0,stateAt=0,hudAt=0;
const keys=new Set(),sticks={move:{x:0,z:0,fire:false,id:null},aim:{x:0,z:-1,fire:false,id:null}},mouse={ax:0,az:-1,fire:false};
const callbacks={onStatus:text=>{if(mode==='menu')say(text)},onMessage:receive,onOpen:opened,onClose:text=>{menu();say(text)}};
const manualLink=new PeerLink(callbacks),roomLink=new RoomLink(callbacks);
let link=manualLink,roomCode='',hostAccumulator=0;
const prediction=new LocalPrediction(),remoteInputs=new RemoteInputs(),smoothWorld=new SmoothWorld();
function say(text){if($('status').textContent!==text)$('status').textContent=text}
function mine(){return role==='guest'?1:0}
function active(){return !!state&&!state.paused&&!state.over&&!hold&&!document.hidden}
function clear(){
 keys.clear();mouse.fire=false;
 for(const name of ['move','aim']){const s=sticks[name],el=$(name);if(s.id!==null)try{el.releasePointerCapture(s.id)}catch{}s.id=null;s.x=0;s.z=name==='aim'?-1:0;s.fire=false;el.firstElementChild.style.transform='translate(-50%,-50%)'}
}
function input(){if(!active())return empty();return normalizeInput({x:sticks.move.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),z:sticks.move.z+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0),ax:sticks.aim.fire?sticks.aim.x:mouse.ax,az:sticks.aim.fire?sticks.aim.z:mouse.az,fire:sticks.aim.fire||mouse.fire||keys.has(' ')})}
function safe(){return !document.hidden&&(mode==='solo'||(link.connected&&!link.interrupted&&remoteVisible===true&&(role==='host'?clock()-remoteAt<1000:lastStateAt>0&&clock()-lastStateAt<1000)))}
function snap(reliable=false){if(mode==='coop'&&role==='host'&&state)link.send({t:'state',g,e,q:++q,s:state,r:ready,v:votes,visible:!document.hidden,why,ack:ack.slice(),moveAck:remoteInputs.done,version:3},reliable)}
function pause(text,force=false){
 if(!state||role==='guest')return;
 const changed=!state.paused||force||(text!==why&&ready.some(Boolean)),changedText=text!==why;
 if(changed){e++;ready=[false,false];clear();remote=empty();remoteAt=0;remoteInputs.reset();hostAccumulator=0}
 state.paused=true;why=text;if(changed||changedText)snap(true);hud();
}
function resume(){if(!state||role==='guest'||state.over||!state.paused||!safe()||!ready[0]||(mode==='coop'&&(!ready[1]||votes.some(Boolean))))return;clear();state.paused=false;why='';lastFrame=clock();snap(true);hud()}
function reset(){g++;e=0;q=0;state=createGame(mode);state.paused=true;ready=[false,false];votes=[false,false];remoteAt=0;remoteQ=0;remote=empty();remoteInputs.reset();hostAccumulator=0;why='New round. Tap Ready to start.';clear();snap(true);hud()}
function action(type,value){if(mode!=='coop'||role!=='guest'||!state||!link.connected)return;if([...pending.values()].some(p=>p.m.type===type&&p.m.value===value))return;const m={t:'action',g,e,a:++seq,type,value};pending.set(m.a,{m,start:clock(),sent:clock()});link.send(m,true);hud()}
function stop(text){clear();if(!state)return;if(role==='host')pause(text,ready.some(Boolean));else{hold=true;why=text;action('pause');hud()}}
function sendInput(reliable=false){if(mode==='coop'&&role==='guest'&&state&&link.connected)link.send({t:'input',g,e,q:++iq,v:!document.hidden,i:input(),frames:prediction.packet()},reliable)}
function valid(s){return s&&s.mode==='coop'&&Array.isArray(s.players)&&s.players.length===2&&Array.isArray(s.enemies)&&s.enemies.length<=LIMITS.enemies&&Array.isArray(s.bullets)&&s.bullets.length<=LIMITS.bullets&&typeof s.paused==='boolean'&&typeof s.over==='boolean'&&Number.isFinite(s.wave)&&Number.isFinite(s.score)&&[...s.players,...s.enemies,...s.bullets].every(x=>x&&Number.isFinite(x.x)&&Number.isFinite(x.z))}
function receive(m){
 if(mode!=='coop'||!m||typeof m!=='object')return;
 if((m.t==='hello'||m.t==='state')&&m.version!==3){menu();say('Phones have different game versions. Reload both game pages.');return}
 if(role==='host'){
  if(m.t==='hello'&&typeof m.v==='boolean'){if(remoteVisible===null){remoteVisible=m.v;remoteAt=clock()}snap(true);return}
  if(m.t==='input'){if(m.g!==g||m.e!==e||!Number.isSafeInteger(m.q)||m.q<=remoteQ||typeof m.v!=='boolean'||!remoteInputs.add(m.frames))return;remoteQ=m.q;remoteAt=clock();remote=normalizeInput(m.i);if(!m.v&&remoteVisible!==false){remoteVisible=false;pause('Friend left the game. Return, then both tap Ready.')}resume();return}
  if(m.t!=='action'||!Number.isSafeInteger(m.a)||m.a<1)return;
  if(ack.includes(m.a)){snap(true);return}
  if(m.g!==g||(m.type!=='visible'&&m.e!==e)||m.a<=seen){snap(true);return}
  if(!['ready','pause','restart','visible'].includes(m.type)||(m.type==='visible'&&typeof m.value!=='boolean'))return;
  seen=m.a;ack.push(m.a);if(ack.length>32)ack.shift();
  if(m.type==='visible'){const changed=remoteVisible!==m.value;remoteVisible=m.value;if(changed&&!m.value)pause('Friend left the game. Both tap Ready after returning.',ready.some(Boolean))}
  if(m.type==='pause')pause('Friend paused. Both tap Ready.',true);
  if(m.type==='ready'&&safe()&&!state.over&&!votes.some(Boolean)){ready[1]=true;resume()}
  if(m.type==='restart'){votes[1]=true;if(votes[0])reset();else pause('Friend requested a restart. Tap Restart to agree.',ready.some(Boolean))}
  snap(true);hud();return;
 }
 if(m.t!=='state'||!Number.isSafeInteger(m.g)||m.g<1||!Number.isSafeInteger(m.e)||m.e<0||!Number.isSafeInteger(m.q)||!valid(m.s)||!Array.isArray(m.r)||m.r.length!==2||!Array.isArray(m.v)||m.v.length!==2||typeof m.visible!=='boolean')return;
 if(m.g<g||(m.g===g&&(m.e<e||(m.e===e&&m.q<=lastQ))))return;
 const changed=m.g!==g||m.e!==e;if(changed){clear();pending.clear()}
 prediction.reconcile(m.s,m.moveAck,changed);smoothWorld.push(m.s,clock(),changed);
 g=m.g;e=m.e;lastQ=m.q;lastStateAt=clock();state=m.s;ready=m.r.map(Boolean);votes=m.v.map(Boolean);remoteVisible=m.visible;why=typeof m.why==='string'?m.why.slice(0,180):'Paused';
 if(Array.isArray(m.ack))for(const a of m.ack)pending.delete(a);
 if(state.paused)hold=false;
 if(changed){action('visible',!document.hidden);sendInput(true)}
 if(hold&&!state.paused)action('pause');hud();
}
function opened(){
 mode='coop';role=link.role;g=role==='host'?1:0;e=q=iq=seq=seen=remoteQ=0;lastQ=-1;remoteAt=lastStateAt=0;remoteVisible=null;ready=[false,false];votes=[false,false];ack=[];pending.clear();hold=false;clear();remoteInputs.reset();prediction.reset();smoothWorld.reset();hostAccumulator=0;
 state=role==='host'?createGame('coop'):null;if(state)state.paused=true;why='Connected. Both players tap Ready.';lastFrame=clock();
 $('panel').hidden=true;$('hud').hidden=false;
 if(role==='host')snap(true);else link.send({t:'hello',version:3,v:!document.hidden},true);
 hud();say('Connected. Both tap Ready.');
}
function menu(){token++;link.close();mode='menu';state=null;pending.clear();hold=false;clear();remoteInputs.reset();prediction.reset();smoothWorld.reset();hostAccumulator=0;$('room-code').hidden=true;$('room-in').hidden=true;$('share-room').hidden=true;roomCode='';$('url').hidden=true;$('panel').hidden=false;$('choices').hidden=false;$('pair').hidden=true;$('hud').hidden=true;$('gate').hidden=true;$('controls').hidden=true}
function hud(){
 if(!state){$('gate').hidden=mode==='menu';$('controls').hidden=true;$('ready').disabled=true;$('restart').disabled=true;$('gate-title').textContent='Receiving the arena';$('why').textContent='Keep both game tabs open.';return}
 $('controls').hidden=false;$('controls').style.opacity=active()?'1':'.35';
 $('wave').textContent=state.wave;$('score').textContent=state.score;$('health').textContent=Math.ceil(state.players[mine()].hp);$('role').textContent=mode==='solo'?'SOLO':role.toUpperCase();
 $('gate').hidden=!state.paused&&!hold;$('gate-title').textContent=state.over?'Outpost overrun':hold?'Safety pause':'Ready to defend?';
 $('why').textContent=why+(mode==='coop'?' Cyan '+(ready[0]?'ready':'waiting')+' · Violet '+(ready[1]?'ready':'waiting')+'.':'');
 const waiting=[...pending.values()].some(p=>p.m.type==='ready'),restarting=[...pending.values()].some(p=>p.m.type==='restart');
 $('ready').disabled=state.over||!safe()||ready[mine()]||waiting||votes.some(Boolean)||restarting;$('ready').textContent=ready[mine()]||waiting?'Waiting for friend':'Ready';
 $('restart').disabled=mode==='coop'&&(votes[mine()]||restarting);$('restart').textContent=votes[mine()]||restarting?'Restart requested':votes[1-mine()]?'Confirm restart':'Restart';
 say(mode==='solo'?'Solo · move left / aim and fire right':role==='host'?'Host · you are cyan':'Guest · you are violet');
}
$('ready').onclick=()=>{if(!state||!safe()||state.over||votes.some(Boolean))return;if(role==='guest')action('ready');else{ready[0]=true;resume();snap(true);hud()}};
$('restart').onclick=()=>{if(!state)return;if(mode==='solo')reset();else if(role==='guest')action('restart');else{votes[0]=true;if(votes[1])reset();else pause('Restart requested. Waiting for friend.',ready.some(Boolean));snap(true);hud()}};
$('pause').onclick=()=>stop('Paused. Tap Ready to continue.');$('menu').onclick=()=>{menu();say('Round ended. Create a new room to play again.')};
$('solo').onclick=()=>{if(!loaded)return;menu();mode='solo';role='host';g=1;e=0;state=createGame('solo');ready=[true,false];votes=[false,false];$('panel').hidden=true;$('hud').hidden=false;lastFrame=clock();hud()};
async function manualPair(kind){
 if(!loaded)return;menu();link=manualLink;pairKind=kind;$('choices').hidden=true;$('pair').hidden=false;$('in').value='';$('out').value='';$('out').hidden=true;$('copy').hidden=true;$('connect').hidden=false;$('connect').disabled=false;
 $('pair-title').textContent=kind==='host'?'Invite your friend':'Join your friend';
 $('help').textContent=kind==='host'?'Send your invite to your friend. Paste their reply below, connect, then both tap Ready.':'Paste your friend’s invite, create a reply, and send it back. Keep this tab open.';
 $('in').placeholder=kind==='host'?'Paste reply code':'Paste invite code';$('connect').textContent=kind==='host'?'Connect phones':'Create reply';
 if(kind==='host'){const t=token;$('connect').disabled=true;try{const code=await link.hostOffer();if(t!==token)return;$('out').value=code;$('out').hidden=false;$('copy').hidden=false;$('connect').disabled=false}catch(err){if(t===token)say(err.message)}}
}
async function roomPair(kind){
 if(!loaded)return;menu();link=roomLink;pairKind='room-'+kind;
 $('choices').hidden=true;$('pair').hidden=false;$('in').hidden=true;$('out').hidden=true;$('copy').hidden=true;
 $('room-in').hidden=kind!=='join';$('room-code').hidden=kind!=='host';$('share-room').hidden=true;
 $('connect').hidden=kind==='host';$('connect').disabled=false;
 $('pair-title').textContent=kind==='host'?'Your room code':'Join your friend';
 $('help').textContent=kind==='host'?'Send these six digits, or share the room link. Your friend joins automatically; then both tap Ready.':'Enter the six digits shown on your friend’s phone.';
 $('connect').textContent='Join game';
 if(kind==='host'){
  const t=token;$('room-code').textContent='··· ···';say('Creating a room…');
  try{const code=await roomLink.hostRoom();if(t!==token||mode!=='menu')return;roomCode=code;$('room-code').textContent=code.slice(0,3)+' '+code.slice(3);$('share-room').hidden=false;say('Room ready. Waiting for your friend.')}
  catch(err){if(t===token){menu();say(err.message)}}
 }else{$('room-in').value='';$('room-in').focus();say('Use the same Wi-Fi. Internet is needed while joining.')}
}
$('host').onclick=()=>roomPair('host');$('join').onclick=()=>roomPair('join');
$('manual-host').onclick=()=>{$('in').hidden=false;manualPair('host')};$('manual-join').onclick=()=>{$('in').hidden=false;manualPair('join')};
$('back').onclick=()=>menu();
$('connect').onclick=async()=>{const t=token;$('connect').disabled=true;try{if(pairKind==='room-join'){await roomLink.joinRoom($('room-in').value);if(t===token&&mode==='menu')say('Connecting to your friend…')}else if(pairKind==='host')await link.finishHost($('in').value);else{const code=await link.guestAnswer($('in').value);if(t!==token)return;$('out').value=code;$('out').hidden=false;$('copy').hidden=false;$('connect').hidden=true;$('help').textContent='Send this reply to your friend. They paste it and connect. Keep both tabs open, then both tap Ready.'}}catch(err){if(t===token){say(err.message);$('connect').disabled=false}}};
async function copy(field){try{await navigator.clipboard.writeText(field.value);say('Copied. Send it to your friend.')}catch{field.hidden=false;field.focus();field.select();say('Text selected. Use Copy.')}}
$('copy').onclick=()=>copy($('out'));
async function shareUrl(url){if(navigator.share)try{await navigator.share({title:'Neon Outpost',url});return}catch(err){if(err.name==='AbortError')return}$('url').value=url;await copy($('url'))}
$('share').onclick=()=>{const url=new URL(location.href);url.hash='';return shareUrl(url.href)};
$('share-room').onclick=()=>{if(!roomCode)return;const url=new URL(location.href);url.hash='room='+roomCode;return shareUrl(url.href)};
$('room-in').onkeydown=ev=>{if(ev.key==='Enter')$('connect').click()};
$('room-in').oninput=()=>{$('room-in').value=$('room-in').value.replace(/\D/g,'').slice(0,6)};

for(const name of ['move','aim']){
 const el=$(name),s=sticks[name],knob=el.firstElementChild;
 const move=ev=>{if(s.id!==ev.pointerId||!active())return;const r=el.getBoundingClientRect(),radius=r.width*.32;let x=(ev.clientX-r.left-r.width/2)/radius,z=(ev.clientY-r.top-r.height/2)/radius,n=Math.hypot(x,z);if(n>1){x/=n;z/=n}s.x=x;s.z=z;s.fire=name==='aim'&&n>.15;knob.style.transform='translate(-50%,-50%) translate('+x*radius+'px,'+z*radius+'px)';ev.preventDefault()};
 el.onpointerdown=ev=>{if(!active()||s.id!==null)return;s.id=ev.pointerId;el.setPointerCapture(s.id);move(ev)};el.onpointermove=move;
 const end=ev=>{if(s.id!==ev.pointerId)return;s.id=null;s.x=0;s.z=name==='aim'?-1:0;s.fire=false;knob.style.transform='translate(-50%,-50%)'};
 el.onpointerup=end;el.onlostpointercapture=end;el.onpointercancel=()=>clear();
}
addEventListener('keydown',ev=>{if(/INPUT|TEXTAREA/.test(ev.target.tagName))return;const k=ev.key.toLowerCase();if(k==='escape'&&state&&!ev.repeat)stop('Paused. Tap Ready.');if(active()&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)){ev.preventDefault();keys.add(k)}});
addEventListener('keyup',ev=>keys.delete(ev.key.toLowerCase()));addEventListener('pointerup',()=>mouse.fire=false);addEventListener('pointercancel',()=>clear());
$('view').onpointermove=ev=>{if(!active()||ev.pointerType!=='mouse'||!ray)return;ray.setFromCamera({x:ev.clientX/innerWidth*2-1,y:1-ev.clientY/innerHeight*2},camera);const p=new T.Vector3();if(ray.ray.intersectPlane(plane,p)){mouse.ax=p.x-state.players[mine()].x;mouse.az=p.z-state.players[mine()].z}};
$('view').onpointerdown=ev=>{if(active()&&ev.pointerType==='mouse'){mouse.fire=true;$('view').onpointermove(ev)}};
addEventListener('blur',()=>stop('Game lost focus. Return, then both tap Ready.'));
document.addEventListener('visibilitychange',()=>{clear();if(!state)return;if(role==='guest'){if(document.hidden)stop('Return to the game, then both tap Ready.');action('visible',!document.hidden);sendInput(true)}else{if(document.hidden)pause('Return to the game, then both tap Ready.',ready.some(Boolean));snap(true)}hud()});
const pool={players:[],enemies:[],bullets:[]},preview=createGame('coop');let geometry,materials,shadowGeometry,shadowMaterial,ballGeometry,bulletMaterials;
function box(w,h,d,mat,x=0,y=0,z=0){const m=new T.Mesh(geometry,mat);m.scale.set(w,h,d);m.position.set(x,y,z);return m}
function texture(crate=false){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#52606a';ctx.fillRect(0,0,128,128);for(let i=0;i<700;i++){ctx.fillStyle=i%2?'#ffffff12':'#00000018';ctx.fillRect(i*53%128,i*31%128,2,2)}ctx.strokeStyle='#283540';ctx.lineWidth=4;ctx.strokeRect(2,2,124,124);if(crate){ctx.fillStyle='#f4ac43';ctx.fillRect(0,48,128,32);ctx.fillStyle='#263442';for(let i=-40;i<160;i+=28){ctx.beginPath();ctx.moveTo(i,48);ctx.lineTo(i+14,48);ctx.lineTo(i-4,80);ctx.lineTo(i-18,80);ctx.fill()}}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t}
function robot(color){const group=new T.Group(),body=new T.Group(),mat=materials[color],shadow=new T.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;group.add(shadow,body);body.add(box(.65,.44,.56,mat,0,.5),box(.43,.32,.42,mat,0,.9),box(.42,.08,.04,materials.dark,0,.93,-.23),box(.2,.2,.35,materials.dark,-.2,.16),box(.2,.2,.35,materials.dark,.2,.16),box(.14,.14,.57,materials.dark,.24,.54,-.5));const flash=box(.16,.16,.24,materials.flash,.24,.54,-.9);flash.visible=false;body.add(flash);group.userData.flash=flash;group.userData.body=body;scene.add(group);return group}
function render(){
 const s=mode==='coop'&&role==='guest'&&state?(smoothWorld.view(clock(),prediction.view())||state):(state||preview);
 for(const kind of ['players','enemies','bullets']){
  const list=s[kind],items=pool[kind];items.forEach(x=>x.visible=false);
  list.forEach((a,i)=>{let mesh=items[i];if(!mesh){mesh=kind==='bullets'?new T.Mesh(ballGeometry,bulletMaterials[0]):robot(kind==='enemies'?'orange':i?'violet':'cyan');if(kind==='bullets')scene.add(mesh);items[i]=mesh}
   mesh.visible=true;mesh.position.set(a.x,kind==='bullets'?.57:0,a.z);
   if(kind==='bullets'){mesh.material=bulletMaterials[a.owner||0];return}
   const p=s.players.find(p=>p.hp>0),ax=kind==='players'?a.ax:p?p.x-a.x:0,az=kind==='players'?a.az:p?p.z-a.z:-1;mesh.rotation.y=Math.atan2(-ax,-az);mesh.userData.flash.visible=kind==='players'&&i===mine()&&a.hp>0&&(role==='guest'?prediction.flash>0:a.cool>.07);mesh.userData.body.rotation.z=a.hp<=0?Math.PI/2:0;mesh.userData.body.visible=!(a.hurt>0&&Math.floor(a.hurt*24)%2);
  });
 }renderer.render(scene,camera);
}
function resize(){if(!renderer)return;const aspect=innerWidth/innerHeight,h=Math.max(10.5,13.5/aspect);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight,false);camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.updateProjectionMatrix()}
function frame(time){
 const gap=(time-lastFrame)/1000;lastFrame=time;
 if(state){
  if(gap>.3)stop('Game interrupted. Both tap Ready.');
  if(role==='host'){
   if(mode==='coop'){if(document.hidden)pause('Return to this game, then both tap Ready.');else if(link.interrupted)pause('Connection interrupted. Keep both tabs open.');else if(remoteVisible!==true)pause('Waiting for your friend to return.');else if(time-remoteAt>1000)pause('Friend input stopped. Keep both tabs open.')}
   resume();
   if(!state.paused){
    hostAccumulator+=Math.min(.15,Math.max(0,gap));
    while(hostAccumulator+1e-9>=TICK&&!state.paused){
     hostAccumulator-=TICK;
     if(mode==='coop')remoteInputs.consume(state,TICK);
     stepGame(state,[input(),mode==='coop'?{...remote,x:0,z:0}:remote],TICK);
     if(state.over)pause('Outpost overrun. Restart to try again.',true);
    }
   }
   if(time-stateAt>=50){stateAt=time;snap()}
  }else{
   if(!document.hidden&&(link.interrupted||time-lastStateAt>1000)&&!hold)stop('Arena updates stopped. Keep both tabs open.');
   if(!prediction.step(input(),gap,active()))stop('Movement updates stopped. Both tap Ready.');
   if(time-inputAt>=40){inputAt=time;sendInput()}
   for(const [a,p] of pending){if(p.m.g!==g||p.m.e!==e){pending.delete(a);continue}if(time-p.start>5000){pending.delete(a);stop('Control unconfirmed. Keep both tabs open.');break}if(time-p.sent>=250){p.sent=time;link.send(p.m,true)}}
  }
  if(time-hudAt>=100){hudAt=time;hud()}
 }
 try{render()}catch{menu();loaded=false;for(const id of ['solo','host','join','manual-host','manual-join'])$(id).disabled=true;say('3D rendering stopped. Reload this page.');return}requestAnimationFrame(frame);
}
async function boot(){try{
 T=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');renderer=new T.WebGLRenderer({canvas:$('view'),antialias:false,powerPreference:'low-power'});renderer.setClearColor('#0b1723');renderer.outputColorSpace=T.SRGBColorSpace;scene=new T.Scene();scene.add(new T.HemisphereLight(0xd6f3ff,0x26303c,2));const sun=new T.DirectionalLight(0xffebd0,2);sun.position.set(-6,16,5);scene.add(sun);camera=new T.OrthographicCamera(-15,15,11,-11,.1,100);camera.position.set(0,26,18);camera.lookAt(0,0,0);ray=new T.Raycaster();plane=new T.Plane(new T.Vector3(0,1,0),0);geometry=new T.BoxGeometry(1,1,1);
 materials=Object.fromEntries(Object.entries({cyan:0x53f2e0,violet:0xb28aff,orange:0xf5a345,dark:0x152531}).map(([k,color])=>[k,new T.MeshLambertMaterial({color})]));materials.flash=new T.MeshBasicMaterial({color:0xfff3bc});shadowGeometry=new T.CircleGeometry(.55,12);shadowMaterial=new T.MeshBasicMaterial({color:0x03090f,transparent:true,opacity:.3,depthWrite:false});ballGeometry=new T.SphereGeometry(.09,6,4);bulletMaterials=[new T.MeshBasicMaterial({color:0xa4ffed}),new T.MeshBasicMaterial({color:0xd8b5ff})];
 const ft=texture();ft.repeat.set(12,9);const floor=new T.Mesh(new T.PlaneGeometry(24,18),new T.MeshLambertMaterial({map:ft}));floor.rotation.x=-Math.PI/2;scene.add(floor);const concrete=new T.MeshLambertMaterial({map:texture()}),crate=new T.MeshLambertMaterial({map:texture(true)});
 for(const o of OBSTACLES)scene.add(box(o.w,o.h,o.d,o.type==='crate'?crate:concrete,o.x,o.h/2,o.z));
 for(const z of [-9.25,9.25])scene.add(box(24.8,.5,.5,concrete,0,.25,z));for(const x of [-12.25,12.25])scene.add(box(.5,.5,18,concrete,x,.25,0));
 resize();addEventListener('resize',resize);loaded=true;for(const id of ['solo','host','join','manual-host','manual-join'])$(id).disabled=false;say('Same Wi-Fi · host a room / join with six digits');requestAnimationFrame(frame);
 const roomMatch=location.hash.match(/^#room=(\d{6})$/);if(roomMatch){await roomPair('join');$('room-in').value=roomMatch[1];$('connect').click()}
 }catch{say('3D view unavailable. Check internet, use current Chrome or Safari, and reload.')}
}
for(const id of ['solo','host','join','manual-host','manual-join'])$(id).disabled=true;
boot();