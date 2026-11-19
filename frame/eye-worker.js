// Camera frames never leave this page's worker.
self.exports={};
importScripts('./vendor/mediapipe/vision_bundle.js','./eye-detection.js?v=20261119');
let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   detector=await createLensDetector(self.exports,new OffscreenCanvas(1,1),self.location.href);
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{self.postMessage({type:'eyes',faces:detector.detect(data.bitmap,data.time)});}
   finally{data.bitmap.close();}
  }
 }catch(error){self.postMessage({type:'error',message:String(error.message||error)});}
};
