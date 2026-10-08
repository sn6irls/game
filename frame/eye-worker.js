// CPU inference stays off the UI thread; camera pixels never leave this worker.
self.exports={};
importScripts('./vendor/mediapipe/vision_bundle.js');
let detector,faceDetector,files;
let blink=[false,false],openScore=[null,null];
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FaceLandmarker,FilesetResolver}=self.exports;
   files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
   detector=await FaceLandmarker.createFromOptions(files,{
    canvas:new OffscreenCanvas(1,1),
    baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/face_landmarker.task',self.location.href).href,delegate:'CPU'},
    runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,minFaceDetectionConfidence:.35,minFacePresenceConfidence:.35,minTrackingConfidence:.4
   });
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{
    const result=detector.detectForVideo(data.bitmap,data.time);
    const face=result.faceLandmarks[0];
    let faceSpan=face?[face[234],face[454]]:null;
    const scores=result.faceBlendshapes[0]?.categories||[];
    // Match the corner-pair order below: subject right eye, then subject left eye.
    blink=['eyeBlinkRight','eyeBlinkLeft'].map((name,i)=>{
     const score=scores.find(s=>s.categoryName===name)?.score||0;
     if(!face){openScore[i]=null;return false;}
     // Learn each eye's open resting score so squinty eyes/glasses do not stay closed.
     openScore[i]=Math.min(openScore[i]??.35,score);
     const threshold=blink[i]?Math.max(.14,openScore[i]+.06):Math.max(.25,openScore[i]+.15);
     return score>threshold;
    });
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
      const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},half=best.boundingBox.width/data.bitmap.width/2;
      faceSpan=[{x:center.x-half,y:center.y},{x:center.x+half,y:center.y}];
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
    if(!eyes)blink=[false,false];
    self.postMessage({type:'eyes',eyes,faceSpan,blink});
   }finally{data.bitmap.close();}
  }
 }catch{self.postMessage({type:'error'});}
};
