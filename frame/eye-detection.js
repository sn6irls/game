// Shared local-only face detection, used by a worker or the Safari fallback.
(function(scope){
scope.createLensDetector=async function(vision,canvas,baseURL){
let detector,faceDetector,files,nextId=1,tracks=[];
function geometry(face){
 const points=face.eyes.flat(),aspect=face.aspect;
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))return null;
 const centers=face.eyes.map(p=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}));
 const gap=Math.hypot((centers[0].x-centers[1].x)*aspect,centers[0].y-centers[1].y);
 if(gap<.025||gap>.65)return null;
 return {x:(centers[0].x+centers[1].x)/2,y:(centers[0].y+centers[1].y)/2,gap};
}
function assignFaces(candidates,time){
 tracks=tracks.filter(t=>time-t.time<500);
 const matches=[];
 candidates.forEach((c,i)=>tracks.forEach((t,j)=>{
  const distance=Math.hypot((c.center.x-t.center.x)*c.aspect,c.center.y-t.center.y);
  if(distance<Math.max(.08,c.center.gap*1.4))matches.push({i,j,distance});
 }));
 matches.sort((a,b)=>a.distance-b.distance);
 const used=new Set(),assigned=new Map();
 for(const m of matches)if(!assigned.has(m.i)&&!used.has(m.j)){assigned.set(m.i,tracks[m.j]);used.add(m.j);}
 const current=candidates.map((c,i)=>{
  const state=assigned.get(i)||{id:nextId++,blink:[false,false],openScore:[null,null]};
  state.blink=['eyeBlinkRight','eyeBlinkLeft'].map((name,k)=>{
   if(!c.scores){state.openScore[k]=null;return false;}
   const score=c.scores.find(s=>s.categoryName===name)?.score||0;
   state.openScore[k]=Math.min(state.openScore[k]??.35,score);
   const threshold=state.blink[k]?Math.max(.14,state.openScore[k]+.06):Math.max(.25,state.openScore[k]+.15);
   return score>threshold;
  });
  state.center=c.center;state.time=time;
  return {state,face:{id:state.id,eyes:c.eyes,faceSpan:c.faceSpan,blink:state.blink}};
 });
 tracks=current.map(x=>x.state);
 return current.map(x=>x.face);
}
   const {FaceLandmarker,FilesetResolver}=vision;
   files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',baseURL).href);
   detector=await FaceLandmarker.createFromOptions(files,{
    canvas,
    baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/face_landmarker.task',baseURL).href,delegate:'CPU'},
    runningMode:'VIDEO',numFaces:2,outputFaceBlendshapes:true,minFaceDetectionConfidence:.35,minFacePresenceConfidence:.35,minTrackingConfidence:.4
   });

try{
     faceDetector=await vision.FaceDetector.createFromOptions(files,{
      baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/face_detector.tflite',baseURL).href,delegate:'CPU'},runningMode:'VIDEO',minDetectionConfidence:.5
     });

}catch(error){detector?.close();throw error;}
return {detect(image,time){
    const result=detector.detectForVideo(image,time),aspect=image.width/image.height;
    const candidates=[];
    for(const [index,face] of result.faceLandmarks.slice(0,2).entries()){
     const c={eyes:[[face[33],face[133]],[face[362],face[263]]],faceSpan:[face[234],face[454]],scores:result.faceBlendshapes[index]?.categories||[],aspect};
     c.center=geometry(c);if(c.center)candidates.push(c);
    }
    // Fill an empty slot with a stylized face without duplicating an existing mesh face.
    if(candidates.length<2){
     const detections=faceDetector.detectForVideo(image,time).detections.sort((a,b)=>b.categories[0].score-a.categories[0].score);
     for(const detection of detections){
      if(candidates.length===2)break;
      if(detection.keypoints?.length<2)continue;
      const [a,b]=detection.keypoints,dx=b.x-a.x,dy=b.y-a.y;
      const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},half=detection.boundingBox.width/image.width/2;
      const c={eyes:[a,b].map(v=>[{x:v.x-dx*.24,y:v.y-dy*.24},{x:v.x+dx*.24,y:v.y+dy*.24}]),faceSpan:[{x:center.x-half,y:center.y},{x:center.x+half,y:center.y}],aspect};
      c.center=geometry(c);
      if(c.center&&!candidates.some(other=>Math.hypot((other.center.x-center.x)*aspect,other.center.y-center.y)<Math.max(other.center.gap,c.center.gap)*1.2))candidates.push(c);
     }
    }
    const faces=assignFaces(candidates,time);
return faces;
},close(){detector?.close();faceDetector?.close();}};
};
})(globalThis);
