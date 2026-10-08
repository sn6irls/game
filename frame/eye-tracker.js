// Invert exactly the camera crop and selfie mirror used by the frame shader.
export function projectEyes(eyes,aspect,mirror){
 const target=(720*.85)/(1280*.60),cx=Math.min(1,target/aspect),cy=Math.min(1,aspect/target);
 const point=p=>[.5+((mirror?1-p.x:p.x)-.5)*.85/cx,.5+(.5-p.y)*.60/cy];
 const centers=eyes.map(pair=>{
  const a=point(pair[0]),b=point(pair[1]);
  return {x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,width:Math.hypot(a[0]-b[0],(a[1]-b[1])*1280/720)};
 }).sort((a,b)=>a.x-b.x);
 const dx=centers[1].x-centers[0].x,dy=(centers[1].y-centers[0].y)*1280/720;
 const distance=Math.hypot(dx,dy),axis=[dx/Math.max(distance,.001),dy/Math.max(distance,.001)];
 return centers.map((eye,i)=>{
  // Move each eye out by 6% of eye spacing; cap size so large character eyes do not overlap.
  const radius=Math.min(.22,distance*.46,Math.max(.015,eye.width*.98));
  // The drawn pupils sit inward of each PNG center; compensate before adding the outward offset.
  const shift=(i===0?-1:1)*(distance*.06+radius*.16);
  return [eye.x+axis[0]*shift,eye.y+axis[1]*shift*720/1280,radius,radius*(350/320)*720/1280,...axis];
 });
}

export class EyeTracker{
 constructor(onState){this.onState=onState;this.enabled=false;this.points=null;this.last=0;}
 start(){
  this.stop();this.enabled=true;this.onState('loading');
  try{
   if(!globalThis.Worker||!globalThis.OffscreenCanvas||!globalThis.createImageBitmap)throw Error();
   const worker=this.worker=new Worker(new URL('./eye-worker.js?v=14',import.meta.url));
   this.timer=setTimeout(()=>this.fail(),30000);
   worker.onerror=()=>{if(this.worker===worker)this.fail();};
   worker.onmessage=({data})=>{
    if(this.worker!==worker)return;
    clearTimeout(this.timer);
    if(data.type==='ready'){this.loaded=true;this.onState('on');}
    else if(data.type==='eyes'){
     this.pending=false;this.points=data.eyes;this.received=performance.now();
     if(!data.eyes)this.smoothed=null;
    }else this.fail();
   };
   worker.postMessage({type:'init'});
  }catch{this.fail();}
 }
 fail(){this.stop();this.onState('error');}
 stop(){
  clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.enabled=false;this.loaded=false;this.pending=false;this.points=null;this.smoothed=null;this.last=0;this.onState('off');
 }
 update(video,time){
  if(!this.loaded||this.pending||video.readyState<2||time-this.last<80)return;
  this.last=time;this.pending=true;
  const worker=this.worker;
  // One small frame in flight: slow phones never accumulate a queue.
  const scale=Math.min(1,480/Math.max(video.videoWidth,video.videoHeight));
  createImageBitmap(video,{resizeWidth:Math.max(1,Math.round(video.videoWidth*scale)),resizeHeight:Math.max(1,Math.round(video.videoHeight*scale))}).then(bitmap=>{
   if(this.worker!==worker){bitmap.close();return;}
   this.timer=setTimeout(()=>this.fail(),5000);
   worker.postMessage({type:'frame',bitmap,time},[bitmap]);
  }).catch(()=>{if(this.worker===worker)this.fail();});
 }
 positions(aspect,mirror){
  if(!this.enabled||!this.points||performance.now()-this.received>300){this.smoothed=null;return null;}
  const next=projectEyes(this.points,aspect,mirror);
  this.smoothed=next.map((eye,i)=>eye.map((v,j)=>this.smoothed?v*.65+this.smoothed[i][j]*.35:v));
  return this.smoothed;
 }
}
