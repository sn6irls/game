const TRACKS={coin:.7,crank:.55,drop:.7,open:.8,trash:.75,ordinary:.75,ssr:.75};
export function createGameAudio(){
 let context,bgm,crankSource,crankPending=false,crankTimer,crankUntil=0,started=false;
 const downloads=new Map(),buffers=new Map(),plays={},failed=new Set();
 function bytes(id){if(!downloads.has(id))downloads.set(id,fetch(`./music/${id}.mp3`).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}));return downloads.get(id);}
 function buffer(id){if(!buffers.has(id))buffers.set(id,bytes(id).then(b=>context.decodeAudioData(b.slice(0))));return buffers.get(id);}
 function source(id,data,loop=false){const node=context.createBufferSource(),gain=context.createGain();node.buffer=data;node.loop=loop;gain.gain.value=id==='bgm'?.18:TRACKS[id];node.connect(gain);gain.connect(context.destination);node.onended=()=>{node.disconnect();gain.disconnect();};node.start();plays[id]=(plays[id]||0)+1;return node;}
 function preload(){for(const id of Object.keys(TRACKS))bytes(id).catch(()=>failed.add(id));}
 function unlock(){
  try{context??=new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});if(started)return;started=true;preload();
   for(const id of Object.keys(TRACKS))buffer(id).catch(()=>failed.add(id));
   buffer('bgm').then(data=>{bgm=source('bgm',data,true);}).catch(()=>failed.add('bgm'));
  }catch{}
 }
 async function play(id){if(!context)return;const at=performance.now();try{const data=await buffer(id);if(document.hidden||performance.now()-at>1200)return;source(id,data);}catch{failed.add(id);}}
 function stopCrank(){crankUntil=0;clearTimeout(crankTimer);if(crankSource){crankSource.stop();crankSource=null;}}
 function checkCrank(){const remaining=crankUntil-performance.now();if(remaining>0)crankTimer=setTimeout(checkCrank,remaining+10);else stopCrank();}
 function crank(){
  if(!context)return;crankUntil=performance.now()+180;clearTimeout(crankTimer);crankTimer=setTimeout(checkCrank,190);
  if(crankSource||crankPending)return;crankPending=true;buffer('crank').then(data=>{if(performance.now()<crankUntil&&!document.hidden)crankSource=source('crank',data,true);}).catch(()=>failed.add('crank')).finally(()=>crankPending=false);
 }
 function tick(hz,duration=.04,delay=0){if(!context||document.hidden)return;const o=context.createOscillator(),g=context.createGain(),now=context.currentTime+delay;o.type='triangle';o.frequency.value=hz;g.gain.setValueAtTime(.035,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(context.destination);o.onended=()=>{o.disconnect();g.disconnect();};o.start(now);o.stop(now+duration);}
 document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});
 document.addEventListener('visibilitychange',()=>{if(!context)return;if(document.hidden){stopCrank();context.suspend().catch(()=>{});}else context.resume().catch(()=>{});});
 return {preload,play,crank,stopCrank,tick,stats:()=>({unlocked:started,state:context?.state||'locked',bgm:!!bgm,cranking:!!crankSource,plays:{...plays},failed:[...failed]})};
}
