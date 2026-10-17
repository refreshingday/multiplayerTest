import {webcrypto} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rtcConfiguration,candidateSummary,selectedRoute,diagnosticReport,diagnosticText,RELEASE} from '../network-v20.js';
import {PeerLink} from '../peer-v20.js';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
function iceLab(){
 let now=0,serial=0;const timers=new Map();
 const setTimeout=(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id},clearTimeout=id=>timers.delete(id);
 const advance=ms=>{const end=now+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
 const api=new Function('setTimeout','clearTimeout',strip(read('network-v20.js'))+';return {gatherIce,probeNetwork};')(setTimeout,clearTimeout);
 const listeners=new Map(),pc={iceGatheringState:'gathering',iceConnectionState:'new',localDescription:{sdp:''},addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
 return {...api,pc,advance,timers,listeners,emit:()=>listeners.get('icecandidate')?.()};
}
const candidate=type=>'a=candidate:1 1 udp 1 203.0.113.4 1234 typ '+type+'\r\n';
test('fresh STUN and TURN configuration is shared by matching and gameplay',()=>{
 const a=rtcConfiguration(),b=rtcConfiguration();assert.equal(a.iceTransportPolicy,'all');assert.ok(a.iceServers.some(s=>s.urls.some(u=>u.startsWith('stun:'))));assert.ok(a.iceServers.some(s=>s.urls.some(u=>u.startsWith('turn:')&&u.includes('transport=tcp'))));a.iceServers[0].urls.length=0;assert.ok(b.iceServers[0].urls.length);
 const previous=globalThis.RTCPeerConnection;let actual;
 globalThis.RTCPeerConnection=class{constructor(config){actual=config;}close(){}};
 try{const link=new PeerLink();const s=link._fresh('host');assert.deepEqual(actual,b);link.close();assert.ok(s.closed);}finally{globalThis.RTCPeerConnection=previous;}
 assert.match(read('room-v20.js'),/config:rtcConfiguration\(\)/);
});
test('candidate reports count routes without exposing addresses or credentials',()=>{
 const report={stage:'gathering',...candidateSummary({localDescription:{sdp:candidate('host')+candidate('srflx')+candidate('relay')},iceConnectionState:'checking'})};
 assert.deepEqual([report.local,report.public,report.relay],[1,1,1]);const text=diagnosticReport(report);assert.ok(!text.includes('203.0.113.4'));assert.ok(!text.includes('peerjsp'));assert.ok(text.includes(RELEASE.label));assert.match(diagnosticText({stage:'failed',route:'direct',error:'Try again'}),/^Connection failed/);
});
test('non-trickle gathering waits for relay candidates and cleans all timers',async()=>{
 const l=iceLab();l.pc.localDescription.sdp=candidate('host')+candidate('srflx');let done=false;const p=l.gatherIce(l.pc).then(()=>done=true);
 l.advance(3500);await Promise.resolve();assert.equal(done,false);
 l.pc.localDescription.sdp+=candidate('relay');l.emit();l.advance(749);await Promise.resolve();assert.equal(done,false);
 l.advance(1);await p;assert.equal(done,true);assert.equal(l.timers.size,0);assert.equal(l.listeners.size,0);
});
test('public-only routes can complete even if a TURN server never responds',async()=>{
 const l=iceLab();l.pc.localDescription.sdp=candidate('srflx');const p=l.gatherIce(l.pc);l.advance(4000);await p;assert.equal(l.timers.size,0);
});
test('complete gathering, local fallback, no candidates and cancellation settle safely',async()=>{
 {const l=iceLab();l.pc.iceGatheringState='complete';await l.gatherIce(l.pc);assert.equal(l.timers.size,0);}
 {const l=iceLab();l.pc.localDescription.sdp=candidate('host');const p=l.gatherIce(l.pc);l.advance(20000);await p;assert.equal(l.timers.size,0);}
 {const l=iceLab();const p=l.gatherIce(l.pc);const failure=assert.rejects(p,/No network route/);l.advance(20000);await failure;assert.equal(l.listeners.size,0);}
 {const l=iceLab(),cancelSet=new Set();const p=l.gatherIce(l.pc,{cancelSet});const failure=assert.rejects(p,/cancelled/);for(const cancel of [...cancelSet])cancel();await failure;assert.equal(cancelSet.size,0);assert.equal(l.timers.size,0);}
});
test('selected route checks both ends of the selected pair',async()=>{
 const stats=new Map([['t',{type:'transport',selectedCandidatePairId:'p'}],['p',{type:'candidate-pair',state:'succeeded',localCandidateId:'l',remoteCandidateId:'r'}],['l',{candidateType:'host'}],['r',{candidateType:'relay'}]]);
 assert.equal(await selectedRoute({getStats:async()=>stats}),'relay');stats.get('r').candidateType='srflx';assert.equal(await selectedRoute({getStats:async()=>stats}),'direct');assert.equal(await selectedRoute({getStats:async()=>{throw Error()}}),'unknown');
});
test('the connection probe closes its temporary peer and does not claim a selected route',async()=>{
 const previous=globalThis.RTCPeerConnection;let closed=false;
 globalThis.RTCPeerConnection=class{constructor(){this.iceGatheringState='complete';}createDataChannel(){}async createOffer(){return{type:'offer',sdp:candidate('relay')}}async setLocalDescription(v){this.localDescription=v;}addEventListener(){}removeEventListener(){}close(){closed=true;}};
 try{const l=iceLab(),report=await l.probeNetwork();assert.equal(report.relay,1);assert.equal(report.route,'unknown');assert.equal(closed,true);}finally{globalThis.RTCPeerConnection=previous;}
});
