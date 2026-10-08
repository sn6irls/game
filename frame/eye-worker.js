// CPU inference stays off the UI thread; camera pixels never leave this worker.
self.exports={};
importScripts('./vendor/mediapipe/vision_bundle.js');
let detector,faceDetector,files;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FaceLandmarker,FilesetResolver}=self.exports;
   files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
   detector=await FaceLandmarker.createFromOptions(files,{
    canvas:new OffscreenCanvas(1,1),
    baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/face_landmarker.task',self.location.href).href,delegate:'CPU'},
    runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.35,minFacePresenceConfidence:.35,minTrackingConfidence:.4
   });
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{
    const face=detector.detectForVideo(data.bitmap,data.time).faceLandmarks[0];
    // Stylized faces may fail the dense mesh even when a face and both eyes are clear.
    let fallbackEyes=null;
    if(!face){
     if(!faceDetector)faceDetector=await self.exports.FaceDetector.createFromOptions(files,{
      baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/face_detector.tflite',self.location.href).href,delegate:'CPU'},
      runningMode:'VIDEO',minDetectionConfidence:.5
     });
     const detections=faceDetector.detectForVideo(data.bitmap,data.time).detections;
     const best=detections.sort((a,b)=>b.categories[0].score-a.categories[0].score)[0];
     if(best?.keypoints?.length>=2){
      const [a,b]=best.keypoints,dx=b.x-a.x,dy=b.y-a.y;
      // The coarse detector only supplies centers: estimate eye width from their separation.
      fallbackEyes=[a,b].map(c=>[{x:c.x-dx*.24,y:c.y-dy*.24},{x:c.x+dx*.24,y:c.y+dy*.24}]);
     }
    }
    // A lower model threshold helps stylized faces; reject degenerate landmark geometry.
    let eyes=face?[[face[33],face[133]],[face[362],face[263]]]:fallbackEyes;
    if(eyes){
     const center=pair=>({x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2});
     const a=center(eyes[0]),b=center(eyes[1]);
     const aspect=data.bitmap.width/data.bitmap.height;
     const distance=Math.hypot((a.x-b.x)*aspect,a.y-b.y);
     if(distance<.025||distance>.65||eyes.flat().some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))eyes=null;
    }
    self.postMessage({type:'eyes',eyes});
   }finally{data.bitmap.close();}
  }
 }catch{self.postMessage({type:'error'});}
};
