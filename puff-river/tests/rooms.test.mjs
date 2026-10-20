import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {RoomLink} from '../room.js';
import {PeerLink} from '../peer.js';
class Events{constructor(){this.handlers=new Map();}on(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);}emit(name,...args){for(const fn of this.handlers.get(name)||[])fn(...args);}}
const brokers=new Map(),offers=new Map();let next=1;
class FakePeer extends Events{
 constructor(id){super();this.id=typeof id==='string'?id:'guest-'+next++;this.destroyed=false;this.disconnected=false;brokers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id));}
 connect(id,options){const local=new Events(),remote=new Events();Object.assign(local,{open:false,metadata:options.metadata});Object.assign(remote,{open:false,metadata:options.metadata});let closed=false;
  local.send=m=>queueMicrotask(()=>remote.emit('data',structuredClone(m)));remote.send=m=>queueMicrotask(()=>local.emit('data',structuredClone(m)));
  local.close=remote.close=()=>{if(closed)return;closed=true;local.open=remote.open=false;queueMicrotask(()=>{local.emit('close');remote.emit('close');});};
  queueMicrotask(()=>{const host=brokers.get(id);if(!host){this.emit('error',{type:'peer-unavailable'});return;}host.emit('connection',remote);queueMicrotask(()=>{if(closed)return;local.open=remote.open=true;local.emit('open');remote.emit('open');});});return local;
 }
 destroy(){this.destroyed=true;brokers.delete(this.id);this.emit('close');}
 reconnect(){this.disconnected=false;queueMicrotask(()=>this.emit('open',this.id));}
}
globalThis.Peer=FakePeer;
const original=Object.fromEntries(['hostOffer','guestAnswer','finishHost','send','close'].map(k=>[k,PeerLink.prototype[k]]));
PeerLink.prototype.hostOffer=async function(){const code='offer-'+next++;offers.set(code,this);return code;};
PeerLink.prototype.guestAnswer=async function(code){const host=offers.get(code);assert.ok(host);this.partner=host;host.partner=this;return code;};
PeerLink.prototype.finishHost=async function(){this.connected=this.partner.connected=true;this.callbacks.onOpen();this.partner.callbacks.onOpen();};
PeerLink.prototype.send=function(message){if(!this.connected||!this.partner?.connected)return false;queueMicrotask(()=>{if(this.partner?.connected)this.partner.callbacks.onMessage(structuredClone(message));});return true;};
PeerLink.prototype.close=function(){this.connected=false;};
after(()=>{for(const [key,value] of Object.entries(original))PeerLink.prototype[key]=value;delete globalThis.Peer;});
const settle=()=>new Promise(resolve=>setTimeout(resolve,12));
test('real RoomLink creates one host and three authenticated direct guest links, then rejects a fifth player',async()=>{
 const joined=[],received=[],closed=[];const host=new RoomLink({onPeerJoin:id=>joined.push(id),onMessage:(m,id)=>received.push({m,id})}),guests=[];
 try{const code=await host.hostRoom();assert.match(code,/^\d{6}$/);assert.ok(host.session.peerId.startsWith('puff-river-v3-'));
  for(let i=0;i<3;i++){const guest=new RoomLink({onClose:text=>closed.push(text)});guests.push(guest);await guest.joinRoom(code);await settle();}
  assert.deepEqual(joined,[1,2,3]);assert.deepEqual(guests.map(g=>g.localId),[1,2,3]);assert.ok(guests.every(g=>g.connected));
  for(let i=0;i<3;i++){const r=host.session.links.get(i+1);assert.match(r.token,/^[a-f0-9]{32}$/);assert.ok(r.connected);guests[i].send({t:'captain',id:99});}await settle();assert.deepEqual(received.map(r=>r.id),[1,2,3]);
  const fifth=new RoomLink({onClose:text=>closed.push(text)});guests.push(fifth);await fifth.joinRoom(code);await settle();assert.equal(fifth.connected,false);assert.ok(closed.some(t=>/full/i.test(t)));assert.equal(host.session.links.size,3);
 }finally{for(const g of guests)g.close();host.close();}
});
test('leaving frees a lobby seat while a locked run rejects strangers and preserves authenticated reconnect seats',async()=>{
 const returned=[],left=[];const host=new RoomLink({onReconnected:id=>returned.push(id),onPeerLeave:id=>left.push(id)}),guests=[];
 try{const code=await host.hostRoom();for(let i=0;i<2;i++){const g=new RoomLink();guests.push(g);await g.joinRoom(code);await settle();}
  guests[0].close();await settle();assert.deepEqual(left,[1]);const replacement=new RoomLink();guests.push(replacement);await replacement.joinRoom(code);await settle();assert.equal(replacement.localId,1);
  host.lock();assert.equal(host.locked,true);const returning=guests[1],record=host.session.links.get(2),token=record.token;record.direct.callbacks.onInterrupted();returning.session.links.get(0).direct.callbacks.onInterrupted();
  assert.equal(record.recovering,true);assert.equal(record.deadline-Date.now()>110000,true);
  const attacker=new FakePeer(),rejections=[];await settle();const bad=attacker.connect(host.session.peerId,{metadata:{game:'puff-river-room-v3',resume:{slot:2,token:'0'.repeat(32)}}});bad.on('data',m=>rejections.push(m));await settle();assert.ok(rejections.some(m=>m.type==='reject'));assert.equal(record.token,token);
  for(let i=0;i<12&&!returned.includes(2);i++)await settle();assert.ok(returned.includes(2));assert.equal(returning.localId,2);assert.equal(host.session.links.get(2).token,token);assert.ok(host.isConnected(2));
  const stranger=new RoomLink();guests.push(stranger);await stranger.joinRoom(code);await settle();assert.equal(stranger.connected,false);assert.equal(host.session.links.size,2);attacker.destroy();
 }finally{for(const g of guests)g.close();host.close();}
});
