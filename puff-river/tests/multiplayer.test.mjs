import test from 'node:test';
import assert from 'node:assert/strict';
import {RiverSession,RemoteCaptain,TICK,PROTOCOL,validSnapshot} from '../multiplayer.js';
import {createCrew,stepVoyage,voyageCourse} from '../crew-core.js';
import {territory,stepCaptain,bankLimits} from '../core.js';
function network(count=4){
 let now=0;const queue=[],clients=[],links=[];
 for(let id=0;id<count;id++){
  const link={localId:id,connected:true,locked:false,seats:new Set(Array.from({length:count-1},(_,i)=>i+1)),requested:[],send(m,reliable=true,target=null){
   const targets=id===0?(target===null?[...this.seats]:[target]):[0];let sent=false;
   for(const to of targets)if(links[to]?.connected&&(id!==0||this.seats.has(to))){queue.push({to,from:id,m:structuredClone(m),reliable});sent=true;}return sent;
  },isConnected(id){return this.seats.has(id);},lock(){this.locked=true;},requestReconnect(id){this.requested.push(id);}};
  links.push(link);clients.push(new RiverSession({transport:link,now:()=>now}));
 }
 const flush=(reverse=false)=>{if(reverse)queue.reverse();let n=0;while(queue.length){assert.ok(n++<1000,'message loop');const packet=queue.shift();clients[packet.to].receive(packet.m,packet.from);}};
 clients[0].prepare('host');for(let id=1;id<count;id++){clients[id].prepare('guest');clients[0].joined(id);clients[id].opened();}flush();
 return {clients,links,queue,flush,get now(){return now;},ready(){for(const client of clients)client.action('ready');flush();},tick(inputs={},deliver=true){now+=TICK*1000;for(let id=1;id<count;id++)clients[id].update(TICK,inputs[id]||{});if(deliver)flush();clients[0].update(TICK,inputs[0]||{});if(deliver)flush();},advance(seconds,inputs={}){for(let i=0;i<seconds/TICK;i++)this.tick(inputs);},drop(id){links[id].connected=false;links[0].seats.delete(id);clients[0].reconnecting(id);clients[id].reconnecting(id);flush();},restore(id){links[id].connected=true;links[0].seats.add(id);clients[0].reconnected(id);clients[id].reconnected(id);flush();}};
}
test('one to four captains join equal territories and unanimous Ready starts one authoritative raft',()=>{
 for(const count of [1,2,3,4]){const net=network(count),host=net.clients[0];assert.equal(host.state.playerCount,count);for(const client of net.clients){assert.equal(client.state.phase,'lobby');assert.equal(client.state.players.length,count);assert.ok(validSnapshot(client.state));}for(const p of host.members)assert.equal(territory(count,p.seat).arc,2*Math.PI/count);net.ready();assert.equal(host.state.phase,'playing');assert.ok(net.links[0].locked);assert.ok(net.clients.every(c=>c.state.phase==='playing'));}
});
test('all guests predict their own captain immediately and reconcile acknowledged ticks',()=>{
 const net=network();net.ready();net.clients[0].course=[];
 for(let tick=0;tick<120;tick++){net.tick({1:{right:true},2:{left:true},3:{aimAngle:0}});}
 for(let id=1;id<4;id++){const guest=net.clients[id],p=hostPlayer(net,id),area=territory(4,p.seat);assert.ok(p.angle>=area.min&&p.angle<=area.max);assert.ok(guest.seq>100);assert.ok(guest.frames.length<12);const replay={...p};for(const frame of guest.frames)stepCaptain(replay,frame.input,TICK,4,p.seat);assert.ok(Math.abs(replay.angle-guest.predicted.angle)<1e-9);assert.ok(Math.abs(replay.fuel-guest.predicted.fuel)<1e-9);}
 const guest=net.clients[1],before=guest.predicted.angle;net.tick({1:{left:true}},false);assert.ok(guest.predicted.angle<before,'prediction responds before a host snapshot arrives');
});
function hostPlayer(net,id){return net.clients[0].state.players.find(p=>p.id===id);}
test('unreliable input redundancy tolerates loss and reordering without changing seats or double-ticking',()=>{
 const net=network();net.ready();net.clients[0].course=[];
 for(let tick=0;tick<240;tick++){
  net.tick({1:{right:tick<100},2:{left:true},3:{aimAngle:Math.PI}},false);
  if(tick%4===0){for(let i=net.queue.length-1;i>=0;i--)if(!net.queue[i].reliable&&net.queue[i].m.t==='input'&&tick%12===0)net.queue.splice(i,1);net.flush(true);}
 }
 net.flush();for(const [id,r] of net.clients[0].remotes){assert.ok(r.done<=net.clients[id].seq);assert.ok(r.frames.size<=120);assert.equal(hostPlayer(net,id).seat,id);assert.ok(Number.isFinite(hostPlayer(net,id).angle));}
 assert.equal(net.clients[0].state.phase,'playing');assert.ok(net.clients.every(c=>validSnapshot(c.state)));
});
test('only the host owns bank hits, hazard hits, pickups and shared fuel restoration',()=>{
 const s=createCrew([0,1,2,3]);s.run=1;s.phase='playing';s.players.forEach(p=>p.fuel=20);
 const bean={id:1,at:0,x:0,kind:'bean',radius:.65,hit:false};stepVoyage(s,{},[bean],TICK);assert.equal(s.beans,1);assert.ok(s.players.every(p=>p.fuel>50&&p.fuel<51));stepVoyage(s,{},[bean],TICK);assert.equal(s.beans,1);assert.deepEqual(s.hitIds,[1]);
 const rock={id:2,at:s.distance,x:0,kind:'rock',radius:1.25,hit:false};stepVoyage(s,{},[rock],TICK);assert.equal(s.lives,2);stepVoyage(s,{},[rock],TICK);assert.equal(s.lives,2);
 const net=network();net.ready();const before=net.clients[0].state.lives;net.clients[0].receive({t:'hit',v:PROTOCOL,lives:0},1);net.clients[0].receive({t:'state',v:PROTOCOL,s:{lives:0}},1);assert.equal(net.clients[0].state.lives,before);
 const host=net.clients[0];host.state.x=bankLimits(host.state.distance).right+.1;host.update(TICK,{});host.broadcast(true);net.flush();assert.equal(host.state.lives,2);assert.ok(net.clients.slice(1).every(g=>g.state.lives===2));
});
test('per-captain puff power drains independently and opposite puffs cancel steering',()=>{
 const s=createCrew([0,1,2,3]);s.phase='playing';for(const p of s.players)p.angle=territory(4,p.seat).center;
 stepVoyage(s,{1:{boost:true},3:{boost:true}},[],TICK);assert.ok(Math.abs(s.vx)<1e-9);assert.ok(s.players[1].fuel<100&&s.players[3].fuel<100);assert.equal(s.players[0].fuel,100);assert.equal(s.players[2].fuel,100);
});
test('pause freezes world and fuel, requires every visible captain, and rejects stale input epochs',()=>{
 const net=network();net.ready();net.advance(.4);net.clients[2].action('pause');net.flush();assert.ok(net.clients.every(c=>c.state.phase==='paused'));const host=net.clients[0],before=structuredClone(host.state);net.advance(.6,{1:{boost:true,right:true}});assert.equal(host.state.distance,before.distance);assert.deepEqual(host.state.players.map(p=>p.fuel),before.players.map(p=>p.fuel));
 const oldEpoch=host.epoch;net.ready();assert.equal(host.state.phase,'playing');host.receive({t:'input',v:1,epoch:oldEpoch,visible:true,frames:[{n:1,input:{boost:true}}]},1);assert.equal(host.remotes.get(1).frames.size,0);
 net.clients[1].visibility(false);net.flush();assert.equal(host.state.phase,'paused');net.ready();assert.equal(host.state.phase,'paused');net.clients[1].visibility(true);net.flush();net.clients[1].action('ready');net.flush();assert.equal(host.state.phase,'playing');
});
test('a disconnected captain resumes in the same seat with fuel and progress preserved',()=>{
 const net=network();net.ready();net.advance(.6,{2:{right:true,boost:true}});const host=net.clients[0],p=hostPlayer(net,2),saved={seat:p.seat,angle:p.angle,fuel:p.fuel,distance:host.state.distance,lives:host.state.lives};net.drop(2);assert.equal(host.state.phase,'paused');net.advance(.6);assert.equal(host.state.distance,saved.distance);assert.equal(p.fuel,saved.fuel);net.restore(2);
 assert.ok(net.clients.every(c=>c.state.phase==='playing'));const restored=hostPlayer(net,2);assert.equal(restored.seat,saved.seat);assert.equal(restored.angle,saved.angle);assert.equal(restored.fuel,saved.fuel);assert.equal(host.state.distance,saved.distance);assert.equal(host.state.lives,saved.lives);assert.equal(host.recovering.size,0);assert.equal(host.syncNeeds.size,0);
});
test('simultaneous dropouts wait for all returning captains and manual pause prevents automatic resume',()=>{
 const net=network();net.ready();net.drop(1);net.drop(3);net.restore(1);assert.equal(net.clients[0].state.phase,'paused');assert.ok(net.clients[0].recovering.has(3));net.restore(3);assert.equal(net.clients[0].state.phase,'playing');
 net.drop(2);net.clients[0].pause();net.restore(2);assert.equal(net.clients[0].state.phase,'paused');net.ready();assert.equal(net.clients[0].state.phase,'playing');
});
test('leaving releases a lobby seat and departure mid-voyage keeps the original territories',()=>{
 const net=network();net.clients[0].left(1);assert.equal(net.clients[0].state.playerCount,3);assert.deepEqual(net.clients[0].members.map(p=>p.seat),[0,1,2]);net.clients[0].joined(1);net.flush();assert.equal(net.clients[0].state.playerCount,4);net.ready();net.clients[0].left(2);assert.equal(net.clients[0].state.phase,'paused');assert.equal(net.clients[0].state.playerCount,4);assert.equal(hostPlayer(net,3).seat,3);assert.equal(hostPlayer(net,2).active,false);
});
test('only unanimous restart resets the river, collected objects and all fuel',()=>{
 const net=network();net.ready();const host=net.clients[0];host.state.phase='lost';host.state.lives=0;host.state.hitIds=[1,2];host.state.players[0].fuel=7;host.broadcast(true);net.flush();
 for(let id=0;id<3;id++)net.clients[id].action('restart');net.flush();assert.equal(host.state.phase,'lost');net.clients[3].action('restart');net.flush();assert.equal(host.state.phase,'lobby');assert.equal(host.state.run,2);assert.equal(host.state.lives,3);assert.equal(host.state.distance,0);assert.deepEqual(host.state.hitIds,[]);assert.ok(host.members.every(p=>p.fuel===100));assert.deepEqual(host.course,voyageCourse(host.state));
});
test('remote frame queues and snapshots are bounded and malformed input cannot escape an arc',()=>{
 const remote=new RemoteCaptain(),s=createCrew([0,1]),p=s.players[1];assert.equal(remote.add(Array(121).fill({n:1}),0),false);remote.add([{n:9999,input:{boost:true}},{n:1,input:{aimAngle:Infinity,left:true,boost:'true'}},{n:1,input:{aimAngle:Math.PI,boost:true}}],0);assert.equal(remote.frames.size,1);remote.consume(p,2,0);assert.equal(remote.done,1);assert.ok(p.fuel<100);remote.consume(p,2,300);assert.equal(p.boosting,false);
 s.run=1;assert.ok(validSnapshot(s));s.players[1].angle=100;assert.equal(validSnapshot(s),false);s.players[1].angle=Math.PI;s.hitIds=Array(101).fill(1);assert.equal(validSnapshot(s),false);
 const net=network();const bytes=new TextEncoder().encode(JSON.stringify({s:net.clients[0].state,frames:Array.from({length:120},(_,n)=>({n,input:{left:true,right:false,boost:true,aimAngle:Math.PI}}))})).length;assert.ok(bytes<16000);
});
test('stale snapshots and mismatched protocols cannot replace a guest world',()=>{
 const net=network();net.ready();const guest=net.clients[1],saved=structuredClone(guest.state),q=guest.lastQ;
 guest.receive({t:'state',v:999,epoch:guest.epoch,q:q+100,you:1,s:saved},0);guest.receive({t:'state',v:1,epoch:guest.epoch,q:q-1,you:1,s:{...saved,distance:300}},0);guest.receive({t:'state',v:1,epoch:guest.epoch,q:q+100,you:1,s:{...saved,distance:300}},2);assert.deepEqual(guest.state,saved);
});
test('puffs still consume fuel between input packets and heartbeats cannot keep a stale puff active',()=>{
 const p=createCrew([0,1]).players[1],remote=new RemoteCaptain();remote.add([{n:1,input:{boost:true}}],0);remote.consume(p,2,0);const first=p.fuel;
 for(let tick=1;tick<12;tick++){remote.add([],tick*TICK*1000);remote.consume(p,2,tick*TICK*1000);}assert.ok(p.fuel<first-4);
 remote.add([],300);remote.consume(p,2,300);assert.equal(p.boosting,false);
});
test('host hitches retain simulation time in bounded batches and long freezes pause the raft',()=>{
 const net=network();net.ready();const host=net.clients[0];host.course=[];const before=host.state.time;
 host.update(.6,{});assert.ok(Math.abs(host.state.time-before-.2)<1e-8);host.update(0,{});host.update(0,{});assert.ok(Math.abs(host.state.time-before-.6)<1e-8);
 host.update(2.1,{});assert.equal(host.state.phase,'paused');assert.ok(Math.abs(host.state.time-before-.6)<1e-8);
});
