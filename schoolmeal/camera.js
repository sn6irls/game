(()=>{
  const el=id=>document.getElementById(id);
  const dialog=document.createElement('dialog');
  dialog.id='liveCamera';
  dialog.innerHTML='<button id="cameraClose" type="button">×</button><video id="cameraPreview" autoplay muted playsinline></video><p id="cameraMessage" role="status" aria-live="polite"></p><div class="cameraActions"><button id="cameraRetry" type="button" hidden></button><button id="shutter" type="button" disabled></button><button id="nativeCamera" type="button" hidden></button></div>';
  document.querySelector('main').append(dialog);
  const video=el('cameraPreview');
  let stream=null,request=0;
  const text=()=>document.documentElement.lang==='en'?{
    loading:'Starting camera…',ready:'Point at your food and take a photo.',shot:'Take photo',retry:'Try again',native:'Open device camera',close:'Close camera',denied:'Camera permission is off. Allow camera access in your browser settings, then try again.',missing:'No camera found on this device.',busy:'Camera is unavailable. Close other apps using it and try again.',secure:'Live camera needs HTTPS or localhost. You can use the device camera below.',failed:'Could not start the camera. Please try again.'
  }:{loading:'카메라를 켜는 중…',ready:'음식을 비추고 촬영 버튼을 눌러 주세요.',shot:'촬영',retry:'다시 시도',native:'기본 카메라 열기',close:'카메라 닫기',denied:'카메라 권한이 꺼져 있어요. 브라우저 설정에서 카메라를 허용한 뒤 다시 시도해 주세요.',missing:'이 기기에서 카메라를 찾지 못했어요.',busy:'카메라를 사용할 수 없어요. 카메라를 사용하는 다른 앱을 닫고 다시 시도해 주세요.',secure:'실시간 카메라는 HTTPS 또는 localhost에서 사용할 수 있어요. 아래 버튼으로 기기의 기본 카메라를 열 수 있어요.',failed:'카메라를 켜지 못했어요. 다시 시도해 주세요.'};
  function stop(){request++;if(stream)stream.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;el('shutter').disabled=true;}
  function fail(message,native=false){el('cameraMessage').textContent=message;el('cameraRetry').hidden=native;el('nativeCamera').hidden=!native;el('shutter').disabled=true;}
  async function start(){
    stop();const token=request,t=text();
    el('shutter').textContent=t.shot;el('cameraRetry').textContent=t.retry;el('nativeCamera').textContent=t.native;el('cameraClose').setAttribute('aria-label',t.close);
    el('cameraMessage').textContent=t.loading;el('cameraRetry').hidden=true;el('nativeCamera').hidden=true;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){fail(t.secure,true);return;}
    try{
      const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}}});
      if(token!==request||!dialog.open){acquired.getTracks().forEach(track=>track.stop());return;}
      stream=acquired;video.srcObject=stream;await video.play();
      if(token!==request||!dialog.open)return;
      el('cameraMessage').textContent=t.ready;
      el('shutter').disabled=!(video.videoWidth&&video.readyState>=2);
    }catch(error){if(token!==request||!dialog.open)return;stop();fail(error.name==='NotAllowedError'?t.denied:error.name==='NotFoundError'?t.missing:error.name==='NotReadableError'?t.busy:t.failed);}
  }
  video.addEventListener('loadeddata',()=>{if(stream&&dialog.open)el('shutter').disabled=false;});
  el('camera').onclick=()=>{el('picker').close();dialog.showModal();start();};
  el('cameraClose').onclick=()=>{stop();dialog.close();};
  dialog.addEventListener('cancel',()=>stop());
  dialog.addEventListener('close',()=>stop());
  el('cameraRetry').onclick=start;
  el('nativeCamera').onclick=()=>{stop();dialog.close();el('cameraInput').click();};
  el('shutter').onclick=()=>{
    if(!stream||!video.videoWidth||video.readyState<2)return;
    el('shutter').disabled=true;
    const token=request,photo=document.createElement('canvas');
    const scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
    photo.width=Math.round(video.videoWidth*scale);photo.height=Math.round(video.videoHeight*scale);
    photo.getContext('2d').drawImage(video,0,0,photo.width,photo.height);
    photo.toBlob(blob=>{
      if(token!==request||!dialog.open)return;
      if(!blob){el('shutter').disabled=false;el('cameraMessage').textContent=text().failed;return;}
      stop();dialog.close();
      el('cameraInput').onchange({target:{files:[new File([blob],'lunch-camera.jpg',{type:'image/jpeg'})],value:''}});
    },'image/jpeg',.92);
  };
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){stop();dialog.close();}});
})();
