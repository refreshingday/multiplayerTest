// Public network defaults shipped with PeerJS 1.5.5:
// https://github.com/peers/peerjs/blob/v1.5.5/lib/util.ts
// These are public service credentials, not an account API key.
export const RELEASE=Object.freeze({version:'22',protocol:22,changed:'2026-10-18',label:'v22 · Updated 18 Oct 2026'});
export function rtcConfiguration(){
 return {iceTransportPolicy:'all',iceServers:[
  {urls:['stun:stun.l.google.com:19302']},
  {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478','turn:eu-0.turn.peerjs.com:3478?transport=tcp','turn:us-0.turn.peerjs.com:3478?transport=tcp'],username:'peerjs',credential:'peerjsp'}
 ]};
}
export function candidateSummary(pc){
 const sdp=pc?.localDescription?.sdp||'',counts={local:0,public:0,relay:0};
 for(const line of sdp.split(/\r?\n/)){if(!line.startsWith('a=candidate:'))continue;const type=line.match(/\btyp\s+(\w+)/)?.[1];if(type==='host')counts.local++;else if(type==='srflx'||type==='prflx')counts.public++;else if(type==='relay')counts.relay++;}
 return {...counts,ice:pc?.iceConnectionState||'new'};
}
const setupError=text=>Object.assign(new Error(text),{neon:true});
export function gatherIce(pc,{active=()=>true,cancelSet=new Set(),timeout=20000}={}){
 return new Promise((resolve,reject)=>{
  let done=false,deadline=null,quiet=null;
  const finish=error=>{if(done)return;done=true;clearTimeout(deadline);clearTimeout(quiet);pc.removeEventListener('icegatheringstatechange',change);pc.removeEventListener('icecandidate',change);cancelSet.delete(cancel);error?reject(error):resolve();};
  const cancel=()=>finish(setupError('Connection setup was cancelled.'));
  const change=()=>{
   if(!active()){cancel();return;}
   if(pc.iceGatheringState==='complete'){finish();return;}
   const c=candidateSummary(pc);clearTimeout(quiet);quiet=null;
   // Non-trickle invite/reply: wait for usable internet/relay routes, then a short quiet window.
   // Do not let an unreachable server block a usable route indefinitely.
   if(c.relay||c.public)quiet=setTimeout(()=>finish(),c.relay?750:4000);
  };
  cancelSet.add(cancel);pc.addEventListener('icegatheringstatechange',change);pc.addEventListener('icecandidate',change);
  deadline=setTimeout(()=>{const c=candidateSummary(pc);if(c.local+c.public+c.relay)finish();else finish(setupError('No network route was found. Check internet access and run Test connection.'));},timeout);
  change();
 });
}
export async function selectedRoute(pc){
 try{
  const stats=await pc.getStats();let pair=null;
  for(const r of stats.values())if(r.type==='transport'&&r.selectedCandidatePairId){pair=stats.get(r.selectedCandidatePairId);break;}
  if(!pair)for(const r of stats.values())if(r.type==='candidate-pair'&&r.state==='succeeded'&&(r.nominated||r.selected)){pair=r;break;}
  if(!pair)return 'unknown';
  const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);
  return local?.candidateType==='relay'||remote?.candidateType==='relay'?'relay':'direct';
 }catch{return 'unknown';}
}
export async function probeNetwork(){
 if(typeof RTCPeerConnection!=='function')throw new Error('This browser does not support phone-to-phone play. Try current Chrome or Safari.');
 const pc=new RTCPeerConnection(rtcConfiguration());
 try{pc.createDataChannel('network-check');await pc.setLocalDescription(await pc.createOffer());await gatherIce(pc);return{stage:'test',...candidateSummary(pc),route:'unknown'};}
 finally{pc.close();}
}
export function diagnosticText(report={}){
 if(report.stage==='testing')return 'Testing this phone’s internet and relay routes…';
 const route=report.stage==='connected'?(report.route==='relay'?'Connected through relay':report.route==='direct'?'Connected directly':'Connected'):report.stage==='matching'?(report.side==='host'?'Room ready · waiting for a friend’s connection':'Finding the host'):report.stage==='pairing'?'Phones found · opening game connection':report.stage==='gathering'?'Finding network routes':report.stage==='connecting'?'Connecting game channel':report.stage==='failed'?'Connection failed':report.stage==='test'?'Connection test complete':'Connection details appear here while joining.';
 const paths=Number.isFinite(report.local)?'Internet route: '+(report.public?'found':'not found')+' · Relay route: '+(report.relay?'found':'not found'):'';
 return route+(paths?'\n'+paths:'')+(report.error?'\n'+report.error:'');
}
export function diagnosticReport(report={}){
 return RELEASE.label+'\n'+diagnosticText(report)+'\nStage: '+(report.stage||'idle')+'\nRoute: '+(report.route||'unknown')+'\nICE: '+(report.ice||'unknown');
}
