import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),strip=s=>s.replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
import {rtcConfiguration as RTC_CONFIG} from '../network-v20.js';
const ROOM_SOURCE=strip(read('room-v20.js'));

function environment(){
 let now=1000,nextTimer=1,nextPeer=1,nextOffer=1,nonce=1;const timers=new Map(),jobs=[],peers=new Map(),offers=new Map();let blocked=false,latency=0;
 const setTimeout=(fn,delay=0)=>{const id=nextTimer++;timers.set(id,{at:now+Math.max(0,delay),fn});return id;},clearTimeout=id=>timers.delete(id),Date={now:()=>now},crypto={getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=nonce++;return a;}};
 const queue=fn=>jobs.push(fn);
 class Events{constructor(){this.events=new Map();}on(name,fn){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn);return this;}emit(name,...args){for(const fn of this.events.get(name)||[])fn(...args);}}
 class Connection extends Events{
  constructor(metadata){super();this.metadata=metadata;this.open=false;this.closed=false;this.other=null;}
  send(m){if(this.closed||!this.open)throw Error('closed pairing connection');const copy=JSON.parse(JSON.stringify(m));queue(()=>{if(!this.other.closed)this.other.emit('data',copy);});}
  close(){if(this.closed)return;this.closed=true;this.open=false;const other=this.other;queue(()=>this.emit('close'));if(other&&!other.closed){other.closed=true;other.open=false;queue(()=>other.emit('close'));}}
 }
 class Peer extends Events{
  constructor(id,options){super();this.options=options||id;this.id=typeof id==='string'?id:'guest-'+nextPeer++;this.open=false;this.disconnected=false;this.destroyed=false;
   queue(()=>{if(this.destroyed)return;if(peers.has(this.id)){this.emit('error',{type:'unavailable-id'});return;}peers.set(this.id,this);this.open=true;this.emit('open',this.id);});}
  connect(id,options){
   const a=new Connection(options.metadata),b=new Connection(options.metadata);a.other=b;b.other=a;
   queue(()=>{const target=peers.get(id);if(blocked||!target||target.destroyed||target.disconnected){this.emit('error',{type:'peer-unavailable'});a.emit('error',{});return;}target.emit('connection',b);queue(()=>{if(a.closed||b.closed)return;a.open=b.open=true;a.emit('open');b.emit('open');});});return a;
  }
  reconnect(){if(this.destroyed)return;this.disconnected=false;queue(()=>{if(!this.destroyed){peers.set(this.id,this);this.open=true;this.emit('open',this.id);}});}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.open=false;if(peers.get(this.id)===this)peers.delete(this.id);queue(()=>this.emit('close'));}
 }
 class Direct{
  constructor(callbacks){this.callbacks=callbacks;this.connected=false;this.interrupted=false;this.partner=null;this.closed=false;}
  async hostOffer(){if(latency)await new Promise(resolve=>setTimeout(resolve,latency));this.key='offer-'+nextOffer++;offers.set(this.key,this);return this.key;}
  async guestAnswer(code){const host=offers.get(code);if(!host||host.closed)throw Error('offer gone');this.partner=host;host.partner=this;return code;}
  async finishHost(code){if(code!==this.key||!this.partner)throw Error('bad answer');const guest=this.partner;queue(()=>{if(this.closed||guest.closed)return;this.connected=guest.connected=true;this.callbacks.onOpen();guest.callbacks.onOpen();});}
  send(m){if(!this.connected||this.closed||!this.partner?.connected)return false;const partner=this.partner,copy=JSON.parse(JSON.stringify(m));queue(()=>{if(!partner.closed)partner.callbacks.onMessage(copy);});return true;}
  close(){if(this.closed)return;this.closed=true;const was=this.connected;this.connected=false;if(was&&this.partner&&!this.partner.closed){const partner=this.partner;partner.connected=false;queue(()=>{if(!partner.closed)partner.callbacks.onClose('drop');});}}
  break(){const partner=this.partner;this.connected=false;if(partner)partner.connected=false;this.callbacks.onClose('drop');partner?.callbacks.onClose('drop');}
 }
 async function flush(){for(let n=0;n<60;n++){await Promise.resolve();while(jobs.length){const job=jobs.shift();job();}await Promise.resolve();}}
 async function advance(ms){const end=now+ms;let steps=0;while(true){await flush();let entry=null;for(const [id,t] of timers)if(t.at<=end&&(!entry||t.at<entry[1].at))entry=[id,t];if(!entry)break;if(steps++>10000)throw Error('timer loop');now=entry[1].at;timers.delete(entry[0]);entry[1].fn();}now=end;await flush();}
 const makeRoom=new Function('PeerLink','loadRoomLibrary','setTimeout','clearTimeout','Date','crypto','rtcConfiguration',ROOM_SOURCE+';return RoomLink;');
 const RoomLink=makeRoom(Direct,async()=>Peer,setTimeout,clearTimeout,Date,crypto,RTC_CONFIG);
 return {RoomLink,Peer,Direct,flush,advance,peers,timers,setBlocked:v=>blocked=v,setLatency:v=>latency=v,get now(){return now}};
}

test('four-player matching shares ICE settings and restores the original authenticated seat',async()=>{
 const env=environment(),host=new env.RoomLink();let p=host.hostRoom();await env.flush();const code=await p,guests=[];
 for(let id=1;id<=3;id++){const guest=new env.RoomLink();p=guest.joinRoom(code);await env.flush();await p;await env.flush();guests.push(guest);}
 assert.deepEqual(guests.map(g=>g.localId),[1,2,3]);assert.ok([...env.peers.values()].every(p=>JSON.stringify(p.options.config)===JSON.stringify(RTC_CONFIG())));
 host.lock();host.session.links.get(2).direct.break();await env.flush();await env.advance(10);assert.ok(host.isConnected(2));assert.equal(guests[1].localId,2);
 const outsider=new env.RoomLink();p=outsider.joinRoom(code);await env.flush();await p;await env.flush();await env.advance(300);assert.equal(outsider.connected,false);
 host.close();await env.flush();assert.ok(guests.every(g=>!g.session));
});
