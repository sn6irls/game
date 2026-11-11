const SAMPLE_FILES={'1':'1.kick.wav','2':'2.snare.wav','3':'3.snare2.wav','4':'4.chord.wav','5':'5.star.wav',button:'button.wav',menu:'menu.wav'};

export async function loadSampleBank(context){
 const entries=await Promise.all(Object.entries(SAMPLE_FILES).map(async ([name,file])=>{
  const embedded=globalThis.MISS_NORMAL_SAMPLES?.[name];
  let bytes;
  if(embedded){
   const binary=atob(embedded);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer;
  }else{
   const response=await fetch(new URL('assets/wav/'+file,document.baseURI));
   if(!response.ok)throw Error('Sample load failed: '+name);
   bytes=await response.arrayBuffer();
  }
  return [name,await context.decodeAudioData(bytes)];
 }));
 return Object.fromEntries(entries);
}

export function playOneShot(context,destination,bank,row,at,column,bpm,onended){
 const name=typeof row==='string'?row:String(row+1);
 const source=context.createBufferSource(),bus=context.createGain();
 source.buffer=bank[name];source.loop=false;source.playbackRate.value=1;
 const duration=source.buffer.duration;
 const level=typeof row==='string'?.55:[.93,.68,.68,.40,.72][row],release=Math.min(.008,duration/3);
 let envelope=[[at,level],[at+duration-release,level],[at+duration,0]];
 const valueAt=time=>{if(time<=envelope[0][0])return envelope[0][1];for(let i=1;i<envelope.length;i++){const [t1,v1]=envelope[i],[t0,v0]=envelope[i-1];if(time<=t1)return v0+(v1-v0)*Math.max(0,Math.min(1,(time-t0)/Math.max(1e-8,t1-t0)));}return 0;};
 const voice={sources:[source],bus,row,at,end:at+duration,naturalEnd:at+duration,sample:name,cancelled:false,
  setNext(nextAt=Infinity){
   const end=Math.max(at,Math.min(voice.naturalEnd,nextAt));
   if(voice.cancelled||Math.abs(end-voice.end)<1e-7||context.currentTime>=voice.end&&context.currentTime>at)return;
   const start=Math.max(at,context.currentTime),held=valueAt(start),fade=end<voice.naturalEnd?Math.min(.012,(end-at)*.25):release;
   bus.gain.cancelScheduledValues(start);bus.gain.setValueAtTime(held,start);envelope=[[start,held]];
   if(end<=start){bus.gain.linearRampToValueAtTime(0,start+.004);envelope.push([start+.004,0]);voice.end=start+.004;return;}
   const fadeAt=Math.max(start,end-fade);
   if(fadeAt>start){const restore=Math.min(fadeAt,start+.004);bus.gain.linearRampToValueAtTime(level,restore);envelope.push([restore,level]);bus.gain.setValueAtTime(level,fadeAt);envelope.push([fadeAt,level]);}
   bus.gain.linearRampToValueAtTime(0,end);envelope.push([end,0]);voice.end=end;
  }
 };
 for(const [i,[time,value]]of envelope.entries())i===2?bus.gain.linearRampToValueAtTime(value,time):bus.gain.setValueAtTime(value,time);
 source.connect(bus);bus.connect(destination);
 source.onended=()=>{source.disconnect();bus.disconnect();onended?.();};
 source.start(at,0,duration);
 source.stop(at+duration+.001);
 return voice;
}

// Choke only successive notes of the same lane. A lone note keeps its entire tail.
// Keep the source alive until its natural end so deleting a future note can restore
// an unplayed cut; rescheduling a gain envelope is reversible, source.stop is not.
export function scheduleLaneTails(voices){
 const lanes=new Map();
 for(const voice of voices){if(voice.cancelled)continue;if(!lanes.has(voice.row))lanes.set(voice.row,[]);lanes.get(voice.row).push(voice);}
 for(const lane of lanes.values()){lane.sort((a,b)=>a.at-b.at);for(let i=0;i<lane.length;i++)lane[i].setNext(lane[i+1]?.at??Infinity);}
}
