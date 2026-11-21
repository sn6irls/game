import {CameraSession} from '../shared/camera.js?v=20261121-camera';

const el=id=>document.getElementById(id);
const dialog=document.createElement('dialog');
dialog.id='liveCamera';
dialog.innerHTML='<button id="cameraClose" type="button">×</button><video id="cameraPreview" autoplay muted playsinline></video><p id="cameraMessage" role="status" aria-live="polite"></p><div class="cameraActions"><button id="cameraRetry" type="button" hidden></button><button id="shutter" type="button" disabled></button><button id="nativeCamera" type="button" hidden></button></div>';
document.querySelector('main').append(dialog);
const video=el('cameraPreview');
let request=0;
const text=()=>document.documentElement.lang==='en'?{
 loading:'Starting camera…',shot:'Take photo',retry:'Try again',native:'Camera / photo',close:'Close camera',denied:'Camera access is blocked. Check camera access in both browser and device settings, then try again.',missing:'No camera found on this device.',busy:'Camera is unavailable. Close other apps using it and try again.',secure:'Live camera needs a secure browser connection. You can choose a photo below.',failed:'Could not start the camera. Try again, or choose a photo below.',timeout:'The camera did not respond. Once permission is allowed, try again.',playback:'The camera connected, but its picture did not start. Try again.',interrupted:'Camera connection stopped. Tap Try again to reconnect.'
}:{loading:'카메라를 켜는 중…',shot:'촬영',retry:'다시 시도',native:'카메라 / 사진 선택',close:'카메라 닫기',denied:'카메라 접근이 차단되어 있어요. 브라우저와 기기 설정에서 카메라를 허용한 뒤 다시 시도해 주세요.',missing:'이 기기에서 카메라를 찾지 못했어요.',busy:'카메라를 사용할 수 없어요. 카메라를 사용하는 다른 앱을 닫고 다시 시도해 주세요.',secure:'실시간 카메라는 보안 연결된 브라우저에서 사용할 수 있어요. 아래에서 사진을 선택할 수 있어요.',failed:'카메라를 켜지 못했어요. 다시 시도하거나 아래에서 사진을 선택해 주세요.',timeout:'카메라 응답이 늦어지고 있어요. 권한을 허용했다면 다시 시도해 주세요.',playback:'카메라는 연결됐지만 영상이 시작되지 않았어요. 다시 시도해 주세요.',interrupted:'카메라 연결이 중단됐어요. 다시 시도를 누르면 연결할 수 있어요.'};
const camera=new CameraSession(()=>{stop();if(dialog.open)fail(text().interrupted);});
function stop(){request++;camera.stop();el('shutter').disabled=true;}
function fail(message){
 el('cameraMessage').hidden=false;el('cameraMessage').textContent=message;
 el('cameraRetry').hidden=false;el('nativeCamera').hidden=false;el('shutter').disabled=true;el('shutter').hidden=true;
}
async function start(){
 stop();const token=request,t=text();el('shutter').hidden=false;
 el('shutter').setAttribute('aria-label',t.shot);el('cameraClose').setAttribute('aria-label',t.close);
 el('cameraRetry').textContent=t.retry;el('nativeCamera').textContent=t.native;
 el('cameraMessage').hidden=false;el('cameraMessage').textContent=t.loading;el('cameraRetry').hidden=true;el('nativeCamera').hidden=true;
 try{
  await camera.open({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
  if(token!==request||!dialog.open)return;
  await camera.attach(video);
  if(token!==request||!dialog.open)return;
  if(document.hidden){stop();fail(text().interrupted);return;}
  el('cameraMessage').hidden=true;el('cameraMessage').textContent='';el('shutter').disabled=false;
 }catch(error){
  if(token!==request||!dialog.open)return;
  stop();
  const key={NotAllowedError:'denied',SecurityError:'denied',NotFoundError:'missing',NotReadableError:'busy',CameraSecurityError:'secure',CameraUnavailableError:'secure',CameraTimeoutError:'timeout',CameraPlaybackError:'playback'}[error.name]||'failed';
  fail(text()[key]);
 }
}
el('camera').onclick=()=>{el('picker').close();dialog.showModal();start();};
el('cameraClose').onclick=()=>{stop();dialog.close();};
dialog.addEventListener('cancel',stop);dialog.addEventListener('close',stop);
el('cameraRetry').onclick=start;
el('nativeCamera').onclick=()=>{stop();dialog.close();el('cameraInput').click();};
el('shutter').onclick=()=>{
 if(!camera.stream||!video.videoWidth||video.readyState<2)return;
 el('shutter').disabled=true;
 const token=request,photo=document.createElement('canvas');
 const failed=()=>{if(token===request&&dialog.open){el('shutter').disabled=false;el('cameraMessage').hidden=false;el('cameraMessage').textContent=text().failed;}};
 try{
  const scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
  photo.width=Math.round(video.videoWidth*scale);photo.height=Math.round(video.videoHeight*scale);
  photo.getContext('2d').drawImage(video,0,0,photo.width,photo.height);
  photo.toBlob(blob=>{
   if(token!==request||!dialog.open)return;
   if(!blob){failed();return;}
   stop();dialog.close();
   el('cameraInput').onchange({target:{files:[new File([blob],'lunch-camera.jpg',{type:'image/jpeg'})],value:''}});
  },'image/jpeg',.92);
 }catch{failed();}
};
function suspend(){stop();if(dialog.open)fail(text().interrupted);}
window.addEventListener('pagehide',suspend);
window.addEventListener('pageshow',event=>{if(event.persisted)suspend();});
// A permission prompt may temporarily hide the page; cancel only an established stream.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&camera.stream)suspend();});
