// One owner per camera: cancelled/late grants must never keep a device active.
const failure=name=>new DOMException(name,name);
const stopTracks=stream=>stream?.getTracks().forEach(track=>track.stop());

function deadline(promise,signal,ms,name){
 return new Promise((resolve,reject)=>{
  let timer;
  const finish=(fn,value)=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);fn(value);};
  const cancel=()=>finish(reject,failure('AbortError'));
  if(signal.aborted){reject(failure('AbortError'));return;}
  signal.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>finish(reject,failure(name)),ms);
  Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));
 });
}

// Safari can expose a stream before its first usable video frame. Check both
// playback and dimensions; loadeddata alone is not a reliable readiness signal.
export function playVideo(video,signal,timeout=12000){
 video.muted=true;video.defaultMuted=true;video.playsInline=true;
 video.setAttribute('muted','');video.setAttribute('playsinline','');
 return new Promise((resolve,reject)=>{
  let timer,poll,done=false;
  const events=['loadedmetadata','loadeddata','canplay','playing','resize','timeupdate'];
  const finish=error=>{
   if(done)return;done=true;clearTimeout(timer);clearInterval(poll);
   events.forEach(type=>video.removeEventListener(type,check));
   video.removeEventListener('error',bad);signal.removeEventListener('abort',cancel);
   if(error)reject(error);else resolve();
  };
  const check=()=>{if(!video.paused&&video.videoWidth>0&&video.videoHeight>0&&video.readyState>=2)finish();};
  const bad=()=>finish(failure('CameraPlaybackError'));
  const cancel=()=>finish(failure('AbortError'));
  if(signal.aborted){cancel();return;}
  signal.addEventListener('abort',cancel,{once:true});
  events.forEach(type=>video.addEventListener(type,check));video.addEventListener('error',bad);
  timer=setTimeout(()=>finish(failure('CameraPlaybackError')),timeout);poll=setInterval(check,100);
  try{Promise.resolve(video.play()).then(check,bad);}catch{bad();}
  check();
 });
}

export class CameraSession{
 constructor(onInterrupted){this.onInterrupted=onInterrupted;this.stream=null;this.video=null;this.controller=null;this.unwatch=()=>{};}
 get signal(){return this.controller?.signal;}
 stop(){
  this.unwatch();this.unwatch=()=>{};
  this.controller?.abort();this.controller=null;
  stopTracks(this.stream);this.stream=null;
  if(this.video){this.video.pause();this.video.srcObject=null;this.video=null;}
 }
 async open(constraints){
  this.stop();
  const controller=this.controller=new AbortController(),signal=controller.signal;
  try{
   if(!isSecureContext)throw failure('CameraSecurityError');
   if(!navigator.mediaDevices?.getUserMedia)throw failure('CameraUnavailableError');
   const acquire=options=>{
    // Call directly in the start click, without awaiting device enumeration.
    const pending=navigator.mediaDevices.getUserMedia(options).then(stream=>{
     if(signal.aborted){stopTracks(stream);throw failure('AbortError');}return stream;
    });
    return deadline(pending,signal,20000,'CameraTimeoutError');
   };
   let stream;
   try{stream=await acquire(constraints);}catch(error){
    if(signal.aborted||!['OverconstrainedError','NotReadableError','AbortError'].includes(error.name))throw error;
    // Give a just-released camera time to close, then retry once with only a
    // facing preference. Never loop permission prompts or open a second camera.
    await deadline(new Promise(resolve=>setTimeout(resolve,400)),signal,1000,'CameraTimeoutError');
    stream=await acquire({audio:false,video:{facingMode:constraints.video?.facingMode||{ideal:'user'}}});
   }
   if(signal.aborted){stopTracks(stream);throw failure('AbortError');}
   this.stream=stream;
   const tracks=stream.getVideoTracks();
   if(!tracks.length||tracks.some(track=>track.readyState==='ended'))throw failure('NotReadableError');
   const ended=()=>this.interrupt();
   tracks.forEach(track=>track.addEventListener('ended',ended));
   this.unwatch=()=>tracks.forEach(track=>track.removeEventListener('ended',ended));
   return stream;
  }catch(error){if(this.controller===controller)this.stop();throw error;}
 }
 async attach(video){
  const signal=this.signal;if(!signal||signal.aborted)throw failure('AbortError');
  this.video=video;video.srcObject=this.stream;
  await playVideo(video,signal);
  if(signal.aborted)throw failure('AbortError');
  const unwatch=this.unwatch;
  let lastTime=video.currentTime,lastProgress=performance.now(),resuming=false;
  const timer=setInterval(()=>{
   if(signal.aborted)return;
   const now=performance.now(),tracks=this.stream.getVideoTracks();
   if(document.hidden){lastProgress=now;return;}
   if(tracks.some(track=>track.readyState==='ended')){this.interrupt();return;}
   if(!tracks.some(track=>track.muted)&&video.readyState>=2&&video.currentTime!==lastTime){lastTime=video.currentTime;lastProgress=now;}
   if(video.paused&&!resuming){
    resuming=true;
    try{Promise.resolve(video.play()).catch(()=>{if(!signal.aborted)this.interrupt();});}catch{this.interrupt();}
   }else if(!video.paused)resuming=false;
   if(now-lastProgress>8000)this.interrupt();
  },1000);
  this.unwatch=()=>{clearInterval(timer);unwatch();};
 }
 interrupt(){if(!this.controller)return;this.stop();this.onInterrupted?.();}
}
