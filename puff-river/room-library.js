let library;
export function loadRoomLibrary(){
 if(globalThis.Peer)return Promise.resolve(globalThis.Peer);
 if(library)return library;
 library=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let timer;
  const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error)}else resolve(globalThis.Peer)};
  script.src=new URL('./vendor/peerjs.min.js',import.meta.url).href;script.async=true;
  script.onload=()=>finish(globalThis.Peer?null:new Error('Room matching could not load. Try again.'));
  script.onerror=()=>finish(new Error('Room matching is unavailable. Check internet.'));
  timer=setTimeout(()=>finish(new Error('Room matching timed out. Try again.')),15000);
  document.head.appendChild(script);
 }).catch(error=>{library=null;throw error});
 return library;
}
