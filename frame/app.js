import {EyeTracker} from './eye-tracker.js?v=16';
import {browserLaunchURL,mayAutoLaunch} from './browser-launch.js?v=16';
import {detectSamsungPhone,cameraConstraints,cameraZoom} from './camera-settings.js?v=11';
const samsungPhone=detectSamsungPhone(navigator);
const $=id=>document.getElementById(id);
const inApp=/Instagram|FBAN|FBAV|KAKAOTALK|YouTube|GSA\/|Line\/|; wv\)/i.test(navigator.userAgent);
const canvas=$('view'),camera=$('camera'),frame=$('frame'),status=$('status');
let cameraAttempt=0;
let stream, facing='user', mirror=true, ready=false, busy=false, recorder, recordingStream;
let resultBlob,resultURL,gifBlob,saveAsset,gifAsset,worker,pressTimer,pressed=false,recordStarted=0,lastDraw=0,gifFrames=0;
let hue=0,colorIndex=0, chunks=[], photoPending=false, recordFailed=false;
const colors=[['핑크',0,'#ef78af'],['하늘',140,'#9edaff'],['초록',-160,'#70bd86'],['보라',65,'#ae8fe2'],['검정',0,'#55515c']];
const lensColors=colors.map(([, ,hex])=>hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255));
const gifCanvas=document.createElement('canvas');gifCanvas.width=270;gifCanvas.height=480;
const gifContext=gifCanvas.getContext('2d',{willReadFrequently:true});
const gl=canvas.getContext('webgl',{alpha:false,preserveDrawingBuffer:true,antialias:false});
let program,cameraTexture,frameTexture;
let eyeNoticeTimer,eyeSprites,eyeSpritesLoading;
const eyeTracker=new EyeTracker(state=>{
 const button=$('lens-toggle');button.setAttribute('aria-pressed',String(state==='on'||state==='loading'));
 button.classList.toggle('loading',state==='loading');button.setAttribute('aria-busy',String(state==='loading'));
 button.setAttribute('aria-label',state==='on'?'눈 렌즈 끄기':'눈 렌즈 켜기');
 clearTimeout(eyeNoticeTimer);$('eye-notice').hidden=true;
 if(state==='error'){$('eye-notice').textContent='렌즈를 다시 눌러주세요';$('eye-notice').hidden=false;eyeNoticeTimer=setTimeout(()=>$('eye-notice').hidden=true,3500);}
});
async function loadEyeSprites(){
 if(eyeSprites)return;
 if(eyeSpritesLoading)return eyeSpritesLoading;
 eyeSpritesLoading=(async()=>{
  const images=await Promise.all(['left-1','right-1','left-2','right-2','left-3','right-3'].map(async name=>{
   const image=new Image();image.src='eyes-'+name+'.png?v=15';
   await bounded(image.decode(),15000,'눈 이미지 로딩 실패');return image;
  }));
  const textures=images.map(image=>{
   const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,texture);
   for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);
   for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);
   gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
   gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);return texture;
  });
  eyeSprites=textures;
 })().finally(()=>{eyeSpritesLoading=null;});
 return eyeSpritesLoading;
}
$('lens-toggle').onclick=()=>{
 if(!ready||busy||recorder)return;
 if(eyeTracker.enabled){eyeTracker.stop();return;}
 eyeTracker.start();
 const activeWorker=eyeTracker.worker;
 loadEyeSprites().catch(()=>{if(eyeTracker.worker===activeWorker&&eyeTracker.enabled)eyeTracker.fail();});
};
function message(text){status.textContent=text;}
function iconLabel(id,text){$(id).setAttribute('aria-label',text);$(id).title=text;}
function fail(text){message(text);status.classList.add('error');$('welcome').hidden=false;$('start').disabled=false;$('start').textContent='start';}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function setupGL(){
 if(!gl)throw Error('이 브라우저는 프레임 합성을 지원하지 않아요. Safari 또는 Chrome에서 열어주세요.');
 program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*0.5;gl_Position=vec4(p,0,1);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;
 varying vec2 uv;uniform sampler2D camera;uniform sampler2D frame;uniform vec2 crop;uniform float mirror;uniform float angle;uniform float monochrome;uniform float sky;uniform vec3 lensColor;uniform vec4 eyeA;uniform vec4 eyeB;
 uniform sampler2D eyeLeft;uniform sampler2D eyeRight;uniform sampler2D eyeLeftClosed;uniform sampler2D eyeRightClosed;uniform vec2 eyeAxis;uniform vec2 eyeBlink;
 vec3 trackedLens(vec3 base,vec4 eye,float side){
  if(eye.z<=0.)return base;
  vec2 axis=normalize(eyeAxis),delta=(uv-eye.xy)*vec2(1.,1280./720.);
  vec2 q=vec2(dot(delta,axis),dot(delta,vec2(-axis.y,axis.x)))/vec2(eye.z,eye.w*1280./720.);
  if(max(abs(q.x),abs(q.y))>=1.)return base;
  vec2 tex=q*.5+.5;
  vec4 openEye=side<.5?texture2D(eyeLeft,tex):texture2D(eyeRight,tex);
  // Closed artwork sits at the bottom of its PNG; align its lid with the tracked eye center.
  vec2 closedTex=tex-vec2(0.,.25);
  vec4 closedEye=side<.5?texture2D(eyeLeftClosed,closedTex):texture2D(eyeRightClosed,closedTex);
  if(closedTex.y<0.||closedTex.y>1.)closedEye=vec4(0.);
  vec4 sampleEye=mix(openEye,closedEye,side<.5?eyeBlink.x:eyeBlink.y);
  vec3 pixel=sampleEye.rgb/max(sampleEye.a,.001);
  float luminance=dot(pixel,vec3(.299,.587,.114));
  // Tint only the blue iris; black lashes and white sparkles keep their original colors.
  float blue=smoothstep(.015,.08,pixel.b-pixel.r)*smoothstep(.01,.06,pixel.g-pixel.r);
  vec3 color=clamp(lensColor*luminance/max(dot(lensColor,vec3(.299,.587,.114)),.001),0.,1.);
  pixel=mix(pixel,color,blue*(1.-sky));
  return mix(base,pixel,sampleEye.a);
 }
 void main(){vec2 c=((uv-vec2(.5,.5))/vec2(.85,.60))*crop+.5;if(mirror>.5)c.x=1.-c.x;vec3 base=texture2D(camera,c).rgb;base=trackedLens(trackedLens(base,eyeA,0.),eyeB,1.);vec3 f=texture2D(frame,uv).rgb;
 // Recover a black-matted overlay: neutral shadows become light, not dark halos.
 float strength=max(f.r,max(f.g,f.b));
 float a=smoothstep(.015,.075,strength)*strength;
 vec2 lens=(uv-vec2(.799,.295))/vec2(.091,.0512);
 float lensMask=1.-smoothstep(.93,1.03,length(lens));
 // Only the iris is opaque. Never force the black matte outside its white rim opaque.
 float iris=1.-smoothstep(.96,1.,length((uv-vec2(.799,.295))/vec2(.076,.04275)));
 a=mix(a,1.,iris);
 float y=dot(f,vec3(.299,.587,.114)),i=dot(f,vec3(.596,-.274,-.322)),q=dot(f,vec3(.211,-.523,.312));
 float ii=i*cos(angle)-q*sin(angle),qq=i*sin(angle)+q*cos(angle);
 vec3 tinted=clamp(vec3(y+.956*ii+.621*qq,y-.272*ii-.647*qq,y-1.106*ii+1.703*qq),0.,1.);
 float saturation=strength-min(f.r,min(f.g,f.b));
 vec3 black=mix(f,vec3(.065+.12*y),smoothstep(.035,.25,saturation));
 tinted=mix(tinted,black,monochrome);
 tinted=mix(tinted,mix(tinted,vec3(.78,.94,1.),.28*smoothstep(.035,.25,saturation)),sky);
 // Recolor the iris while retaining neutral reflections and the original rim.
 vec3 lensTint=clamp(lensColor*(y/max(dot(lensColor,vec3(.299,.587,.114)),.001)),0.,1.);
 vec3 coloredLens=mix(f,lensTint,smoothstep(.015,.12,saturation)*iris*(1.-sky));
 tinted=mix(tinted,coloredLens,lensMask);
 // Un-premultiply black matte before compositing; preserve the lens's own shading.
 vec3 clean=mix(tinted/max(strength,.001),tinted,iris);
 gl_FragColor=vec4(mix(base,clamp(clean,0.,1.),a),1.);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('프레임 합성을 시작할 수 없어요.');gl.useProgram(program);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 function texture(unit,name){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,name),unit);return t;}
 cameraTexture=texture(0,'camera');frameTexture=texture(1,'frame');
 // Transparent placeholders make all sampler units complete before the first lens tap.
 for(const [unit,name] of [[2,'eyeLeft'],[3,'eyeRight'],[4,'eyeLeftClosed'],[5,'eyeRightClosed']]){texture(unit,name);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));}
}
function controls(){const blocked=!ready||busy||!!recorder||photoPending;$('shutter').disabled=blocked;$('flip').disabled=blocked;$('color').disabled=blocked;$('lens-toggle').disabled=blocked;}
function draw(){
 if(!ready||camera.readyState<2||frame.readyState<2)return;
 gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);
 for(const [unit,texture,video] of [[0,cameraTexture,camera],[1,frameTexture,frame]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,video);}
 const aspect=camera.videoWidth/camera.videoHeight,target=(canvas.width*.85)/(canvas.height*.60);
 const eyes=eyeSprites?eyeTracker.positions(aspect,mirror):null;
 gl.uniform4f(gl.getUniformLocation(program,'eyeA'),...(eyes?.[0].slice(0,4)||[0,0,0,0]));
 gl.uniform4f(gl.getUniformLocation(program,'eyeB'),...(eyes?.[1].slice(0,4)||[0,0,0,0]));
 gl.uniform2f(gl.getUniformLocation(program,'eyeAxis'),...(eyes?.[0].slice(4,6)||[1,0]));
 gl.uniform2f(gl.getUniformLocation(program,'eyeBlink'),eyes?.[0][6]||0,eyes?.[1][6]||0);
 if(eyeSprites){
  const offset=(Math.floor(performance.now()/320)%2)*2;
  for(const [unit,index] of [[2,offset],[3,offset+1],[4,4],[5,5]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,eyeSprites[index]);}
 }
 gl.uniform2f(gl.getUniformLocation(program,'crop'),Math.min(1,target/aspect),Math.min(1,aspect/target));gl.uniform1f(gl.getUniformLocation(program,'mirror'),mirror?1:0);gl.uniform1f(gl.getUniformLocation(program,'angle'),hue*Math.PI/180);gl.uniform1f(gl.getUniformLocation(program,'monochrome'),colorIndex===4?1:0);gl.uniform1f(gl.getUniformLocation(program,'sky'),colorIndex===1?1:0);gl.uniform3f(gl.getUniformLocation(program,'lensColor'),...lensColors[colorIndex]);gl.drawArrays(gl.TRIANGLES,0,6);
}
function loop(time){
 requestAnimationFrame(loop);if(document.hidden||time-lastDraw<1000/24)return;lastDraw=time;
 if(ready&&!$('result').open)eyeTracker.update(camera,time);
 draw();if(recorder?.state==='recording'){
  const elapsed=performance.now()-recordStarted;$('timer').textContent='● '+(elapsed/1000).toFixed(1)+'초';
  if(worker&&elapsed<7500&&gifFrames<75&&elapsed>=gifFrames*100){gifContext.drawImage(canvas,0,0,270,480);const pixels=gifContext.getImageData(0,0,270,480);worker.postMessage({type:'frame',buffer:pixels.data.buffer,width:270,height:480},[pixels.data.buffer]);gifFrames++;}
  if(elapsed>=60000)endRecording();
 }
}
function bounded(promise,ms,text){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(text)),ms);})]).finally(()=>clearTimeout(timer));}
function resetCamera(){eyeTracker.stop();cameraAttempt++;stream?.getTracks().forEach(t=>t.stop());stream=null;camera.srcObject=null;ready=false;busy=false;$('start').disabled=false;$('start').textContent='start';$('welcome').hidden=false;controls();}
async function openCamera(){
 if(inApp){launchBrowser();return;}
 if(busy)return;
 if(gl?.isContextLost()){location.reload();return;}
 eyeTracker.stop();
 const attempt=++cameraAttempt;
 status.classList.remove('error');busy=true;ready=false;controls();$('start').disabled=true;$('start').textContent='start';message('카메라 권한을 허용해주세요.');
 stream?.getTracks().forEach(t=>t.stop());stream=null;
 try{
  if(!window.isSecureContext)throw Error('보안 연결이 필요해요. HTTPS 촬영 주소로 열어주세요.');
  if(!navigator.mediaDevices?.getUserMedia)throw Error('카메라 권한 허용해주세요. chrome/safari에서 열어주세요.');
  if(!program){try{setupGL();}catch(e){program=null;throw e;}}
  if(frame.error)frame.load();
  // Start muted media within the original tap, before waiting for camera permission.
  const playback=bounded(frame.play(),12000,'프레임 영상 로딩이 늦어지고 있어요. 연결 확인 후 다시 눌러주세요.').then(()=>null,e=>Error(e.name==='NotAllowedError'?'영상 재생이 차단됐어요. 촬영하기를 다시 눌러주세요.':e.message));
  const samsung=await samsungPhone;
  if(attempt!==cameraAttempt)return;
  const request=navigator.mediaDevices.getUserMedia(cameraConstraints(facing,samsung)).then(value=>{if(attempt!==cameraAttempt){value.getTracks().forEach(t=>t.stop());throw Error('취소된 촬영');}return value;});
  const acquired=await bounded(request,20000,'카메라 응답을 기다리지 못했어요. 권한을 확인하고 다시 눌러주세요.');
  if(attempt!==cameraAttempt){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;const track=stream.getVideoTracks()[0];const zoom=track.getCapabilities?.().zoom;
  if(zoom){try{await bounded(track.applyConstraints({advanced:[{zoom:cameraZoom(zoom,samsung,track.getSettings().facingMode||facing)}]}),1500,'');}catch{}}
  if(attempt!==cameraAttempt)return;
  mirror=(track.getSettings().facingMode||facing)==='user';camera.srcObject=stream;
  await bounded(camera.play(),10000,'카메라 재생을 시작하지 못했어요. 다시 눌러주세요.');
  const playbackError=await playback;if(playbackError)throw playbackError;
  await bounded(new Promise((resolve,reject)=>{function check(){if(attempt!==cameraAttempt){reject(Error('취소된 촬영'));return;}if(camera.videoWidth>16&&camera.videoHeight>16&&camera.readyState>=2&&frame.readyState>=2){resolve();return;}setTimeout(check,100);}check();}),10000,'화면을 받지 못했어요. 다시 눌러주세요.');
  if(attempt!==cameraAttempt)return;
  if(document.hidden){resetCamera();return;}
  ready=true;$('welcome').hidden=true;$('start').textContent='start';status.classList.remove('error');message('');
 }catch(e){
  if(attempt!==cameraAttempt)return;
  cameraAttempt++;stream?.getTracks().forEach(t=>t.stop());stream=null;camera.srcObject=null;
  const texts={NotAllowedError:'카메라 권한이 차단되어 있어요. 주소창의 사이트 설정과 휴대폰·PC 설정에서 카메라를 허용한 후 다시 눌러주세요.',SecurityError:'이 화면에서 카메라 접근이 제한되어 있어요. 브라우저 안내를 확인해주세요.',NotFoundError:'연결된 카메라가 없어요. 카메라 연결 후 다시 눌러주세요.',NotReadableError:'카메라를 다른 앱이 사용 중이거나 기기 설정에서 차단했어요. 확인 후 다시 눌러주세요.',OverconstrainedError:'이 카메라 설정을 사용할 수 없어요. 다른 카메라로 다시 시도해주세요.'};
  fail(texts[e.name]||e.message);busy=false;controls();
 }finally{if(attempt===cameraAttempt){busy=false;controls();$('start').disabled=false;}}
}
function clearResult(){for(const asset of [saveAsset,gifAsset])if(asset){URL.revokeObjectURL(asset.url);}saveAsset=gifAsset=null;$('save-note').hidden=true;resultURL=null;resultBlob=null;gifBlob=null;worker?.terminate();worker=null;}
let captureTipTimer;
function startCaptureTips(){
 clearInterval(captureTipTimer);
 const tips=['렌즈를 눌러서\n변신해봐!','촬영 버튼 꾹 누르면\n녹화 가능!'];
 const label=document.querySelector('.capture-tip');let index=0;label.textContent=tips[0];
 captureTipTimer=setInterval(()=>{index=1-index;label.textContent=tips[index];},2800);
}
function showResult(blob,isPhoto){
 if(!blob?.size){message('촬영 결과를 저장하지 못했어요. 다시 촬영해주세요.');return;}
 resultBlob=blob;saveAsset=makeAsset(blob);bindSave($('save'),saveAsset);resultURL=saveAsset.url;$('photo').hidden=!isPhoto;$('clip').hidden=isPhoto;
 if(isPhoto)$('photo').src=resultURL;else{$('clip').src=resultURL;}
 iconLabel('save',isPhoto?'사진 저장':'영상 저장');$('gif').hidden=isPhoto;$('save-note').textContent='저장할 파일을 준비했어요.';
 if(!$('result').open)$('result').showModal();startCaptureTips();controls();
}
function photo(){if(!ready||busy||photoPending)return;clearResult();photoPending=true;controls();canvas.width=1080;canvas.height=1920;draw();canvas.toBlob(blob=>{photoPending=false;showResult(blob,true);controls();message('사진을 촬영했어요 ♡');},'image/jpeg',.97);canvas.width=720;canvas.height=1280;draw();}
function beginRecording(){
 if(!ready||busy||recorder)return;
 if(!window.MediaRecorder||!canvas.captureStream){message('이 브라우저에서는 사진만 지원해요. Safari/Chrome을 업데이트해주세요.');return;}
 clearResult();chunks=[];gifFrames=0;recordFailed=false;
 $('gif').setAttribute('aria-disabled','true');$('gif').removeAttribute('href');iconLabel('gif','GIF 만드는 중');$('gif').classList.add('loading');
 try{
  worker=new Worker('gif-worker.js',{type:'module'});
  worker.onmessage=({data})=>{if(data.type==='done'&&data.count){gifBlob=new Blob([data.bytes],{type:'image/gif'});gifAsset=makeAsset(gifBlob);bindSave($('gif'),gifAsset);iconLabel('gif','움짤 GIF 저장');$('gif').classList.remove('loading');}else{iconLabel('gif','GIF 변환 실패');$('gif').classList.remove('loading');}worker?.terminate();worker=null;};
  worker.onerror=()=>{iconLabel('gif','GIF 변환 실패');$('gif').classList.remove('loading');worker?.terminate();worker=null;};worker.postMessage({type:'start'});
  recordingStream=canvas.captureStream(24);
  const mime=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  recorder=new MediaRecorder(recordingStream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:4500000});
  const current=recorder;
  current.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  current.onerror=()=>{recordFailed=true;message('녹화 중 오류가 발생했어요. 다시 촬영해주세요.');endRecording();};
  current.onstop=()=>{recordingStream?.getTracks().forEach(t=>t.stop());recorder=null;busy=false;worker?.postMessage({type:'finish'});if(!recordFailed)showResult(new Blob(chunks,{type:current.mimeType||'video/webm'}),false);controls();};
  draw();current.start(250);recordStarted=performance.now();$('timer').hidden=false;$('shutter').classList.add('recording');$('flip').disabled=true;$('color').disabled=true;$('lens-toggle').disabled=true;message('손을 떼면 녹화가 끝나요.');
 }catch(e){worker?.terminate();worker=null;recordingStream?.getTracks().forEach(t=>t.stop());recorder=null;message('이 기기에서 녹화를 시작하지 못했어요. 사진 촬영은 사용할 수 있어요.');controls();}
}
function endRecording(){clearTimeout(pressTimer);pressed=false;if(recorder?.state==='recording'){busy=true;recorder.stop();message('촬영한 영상을 준비하고 있어요…');}$('timer').hidden=true;$('shutter').classList.remove('recording');controls();}
$('shutter').addEventListener('pointerdown',e=>{if(e.button!==0||!ready||busy||recorder||photoPending)return;e.preventDefault();pressed=true;$('shutter').setPointerCapture(e.pointerId);pressTimer=setTimeout(()=>{if(pressed)beginRecording();},250);});
$('shutter').addEventListener('pointerup',e=>{e.preventDefault();if(!pressed)return;clearTimeout(pressTimer);pressed=false;if(recorder)endRecording();else photo();});
for(const event of ['pointercancel','lostpointercapture'])$('shutter').addEventListener(event,()=>{if(pressed)endRecording();});
$('shutter').addEventListener('contextmenu',e=>e.preventDefault());
$('shutter').addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();pressed=true;pressTimer=setTimeout(()=>{if(pressed)beginRecording();},250);}});
$('shutter').addEventListener('keyup',e=>{if((e.key===' '||e.key==='Enter')&&pressed){e.preventDefault();clearTimeout(pressTimer);pressed=false;if(recorder)endRecording();else photo();}});
$('start').onclick=openCamera;
$('flip').onclick=async()=>{facing=facing==='user'?'environment':'user';await openCamera();};
$('color').onclick=()=>{colorIndex=(colorIndex+1)%colors.length;hue=colors[colorIndex][1];iconLabel('color','색 변경 · '+colors[colorIndex][0]);document.documentElement.style.setProperty('--accent',colors[colorIndex][2]);};
$('close').onclick=()=>$('result').close();$('result').addEventListener('close',()=>{$('clip').pause();clearInterval(captureTipTimer);});
// Remove only this feature's old download worker/cache, not other site workers.
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(registrations=>{
 for(const registration of registrations){const worker=registration.active||registration.waiting||registration.installing;if(worker&&new URL(worker.scriptURL).pathname===new URL('download-sw.js',location.href).pathname)registration.unregister();}
}).catch(()=>{});
if('caches' in window)caches.delete('frame-downloads-v1').catch(()=>{});
function makeAsset(blob){
 const type=blob.type.split(';')[0].trim()||'application/octet-stream';
 const ext=type==='image/gif'?'gif':type.startsWith('image/')?'jpg':type==='video/mp4'?'mp4':'webm';
 const file=new File([blob],'frame1-'+Date.now()+'.'+ext,{type});
 return {file,url:URL.createObjectURL(file)};
}
function bindSave(link,asset){link.href=asset.url;link.download=asset.file.name;link.setAttribute('aria-disabled','false');}
function launchBrowser(){
 const target=browserLaunchURL(navigator.userAgent,location.href);
 if(target){try{location.assign(target);}catch{}}
}
// Auto-launch once after the entry UI can render. The start button always retries
// synchronously from a real user tap, independently of the auto-launch throttle.
if(inApp){
 let previous=0;try{previous=Number(sessionStorage.getItem('frame-browser-auto')||0);}catch{}
 if(mayAutoLaunch(true,location.href,previous,Date.now())){
  try{sessionStorage.setItem('frame-browser-auto',String(Date.now()));}catch{}
  setTimeout(launchBrowser,100);
 }
}
function saveNotice(text){$('save-note').hidden=false;$('save-note').textContent=text;}
for(const id of ['save','gif'])$(id).addEventListener('click',event=>{
 if(inApp){event.preventDefault();saveNotice('촬영 전에 Chrome 또는 삼성 인터넷에서 이 페이지를 열어주세요.');return;}
 if($(id).getAttribute('aria-disabled')==='true'||!$(id).hasAttribute('href')){event.preventDefault();saveNotice('파일을 준비하고 있어요. 잠시 후 저장을 눌러주세요.');return;}
 // Keep the user's native link navigation: no synthetic click, share sheet or popup.
 saveNotice('다운로드 요청을 보냈어요. 휴대폰 다운로드 알림을 확인해주세요.');
});
frame.addEventListener('error',()=>{if(!ready)return;eyeTracker.stop();endRecording();stream?.getTracks().forEach(t=>t.stop());ready=false;fail('프레임 영상을 불러오지 못했어요. 연결 확인 후 다시 눌러주세요.');controls();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();eyeTracker.stop();ready=false;endRecording();stream?.getTracks().forEach(t=>t.stop());fail('화면 연결이 중단됐어요. 페이지를 새로고침해주세요.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready){eyeTracker.stop();endRecording();frame.pause();if(!recorder)resetCamera();else{stream?.getTracks().forEach(t=>t.stop());ready=false;$('welcome').hidden=false;}}});
window.addEventListener('pagehide',()=>{clearInterval(captureTipTimer);eyeTracker.stop();cameraAttempt++;endRecording();stream?.getTracks().forEach(t=>t.stop());worker?.terminate();});
requestAnimationFrame(loop);
