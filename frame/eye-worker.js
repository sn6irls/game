// CPU inference stays off the UI thread; camera pixels never leave this worker.
self.exports={};
importScripts('./vendor/mediapipe/vision_bundle.js');
let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FaceLandmarker,FilesetResolver}=self.exports;
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
   detector=await FaceLandmarker.createFromOptions(files,{
    canvas:new OffscreenCanvas(1,1),
    baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/face_landmarker.task',self.location.href).href,delegate:'CPU'},
    runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.6,minFacePresenceConfidence:.6,minTrackingConfidence:.6
   });
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{
    const face=detector.detectForVideo(data.bitmap,data.time).faceLandmarks[0];
    self.postMessage({type:'eyes',eyes:face?[[face[33],face[133]],[face[362],face[263]]]:null});
   }finally{data.bitmap.close();}
  }
 }catch{self.postMessage({type:'error'});}
};
