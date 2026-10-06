const $=id=>document.getElementById(id);
const canvas=$('view'),camera=$('camera'),frame=$('frame'),status=$('status');
let stream, facing='user', mirror=true, ready=false, busy=false, recorder, recordingStream;
let resultBlob,resultURL,gifBlob,worker,pressTimer,pressed=false,recordStarted=0,lastDraw=0,gifFrames=0;
let hue=0,colorIndex=0, chunks=[], photoPending=false, recordFailed=false;
const colors=[['핑크',0,'#ef78af'],['하늘',130,'#83b6ff'],['초록',-160,'#70bd86'],['보라',65,'#ae8fe2'],['검정',0,'#55515c']];
const gifCanvas=document.createElement('canvas');gifCanvas.width=270;gifCanvas.height=480;
const gifContext=gifCanvas.getContext('2d',{willReadFrequently:true});
const gl=canvas.getContext('webgl',{alpha:false,preserveDrawingBuffer:true,antialias:false});
let program,cameraTexture,frameTexture;
function message(text){status.textContent=text;}
function iconLabel(id,text){$(id).setAttribute('aria-label',text);$(id).title=text;}
function fail(text){message(text);status.classList.add('error');$('welcome').hidden=false;$('start').disabled=false;iconLabel('start','카메라 다시 켜기');}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function setupGL(){
 if(!gl)throw Error('이 브라우저는 프레임 합성을 지원하지 않아요. Safari 또는 Chrome에서 열어주세요.');
 program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*0.5;gl_Position=vec4(p,0,1);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;
 varying vec2 uv;uniform sampler2D camera;uniform sampler2D frame;uniform vec2 crop;uniform float mirror;uniform float angle;uniform float monochrome;
 void main(){vec2 c=(uv-.5)*crop+.5;if(mirror>.5)c.x=1.-c.x;vec3 base=texture2D(camera,c).rgb;vec3 f=texture2D(frame,uv).rgb;
 // Recover a black-matted overlay: neutral shadows become light, not dark halos.
 float strength=max(f.r,max(f.g,f.b));
 float a=smoothstep(.015,.075,strength)*strength;
 vec2 lens=(uv-vec2(.802,.300))/vec2(.087,.049);
 float lensMask=1.-smoothstep(.93,1.03,length(lens));
 a=mix(a,1.,lensMask);
 float y=dot(f,vec3(.299,.587,.114)),i=dot(f,vec3(.596,-.274,-.322)),q=dot(f,vec3(.211,-.523,.312));
 float ii=i*cos(angle)-q*sin(angle),qq=i*sin(angle)+q*cos(angle);
 vec3 tinted=clamp(vec3(y+.956*ii+.621*qq,y-.272*ii-.647*qq,y-1.106*ii+1.703*qq),0.,1.);
 float saturation=strength-min(f.r,min(f.g,f.b));
 vec3 black=mix(f,vec3(.065+.12*y),smoothstep(.035,.25,saturation));
 tinted=mix(tinted,black,monochrome);
 tinted=mix(tinted,f,lensMask);
 // Un-premultiply black matte before compositing; preserve the lens's own shading.
 vec3 clean=mix(tinted/max(strength,.001),tinted,lensMask);
 gl_FragColor=vec4(mix(base,clamp(clean,0.,1.),a),1.);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('프레임 합성을 시작할 수 없어요.');gl.useProgram(program);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 function texture(unit,name){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,name),unit);return t;}
 cameraTexture=texture(0,'camera');frameTexture=texture(1,'frame');
}
function controls(){const blocked=!ready||busy||!!recorder||photoPending;$('shutter').disabled=blocked;$('flip').disabled=blocked;$('color').disabled=blocked;$('download').disabled=!resultBlob||busy||!!recorder||photoPending;}
function draw(){
 if(!ready||camera.readyState<2||frame.readyState<2)return;
 gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);
 for(const [unit,texture,video] of [[0,cameraTexture,camera],[1,frameTexture,frame]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,video);}
 const aspect=camera.videoWidth/camera.videoHeight,target=canvas.width/canvas.height;
 gl.uniform2f(gl.getUniformLocation(program,'crop'),Math.min(1,target/aspect),Math.min(1,aspect/target));gl.uniform1f(gl.getUniformLocation(program,'mirror'),mirror?1:0);gl.uniform1f(gl.getUniformLocation(program,'angle'),hue*Math.PI/180);gl.uniform1f(gl.getUniformLocation(program,'monochrome'),colorIndex===4?1:0);gl.drawArrays(gl.TRIANGLES,0,6);
}
function loop(time){
 requestAnimationFrame(loop);if(document.hidden||time-lastDraw<1000/24)return;lastDraw=time;
 draw();if(recorder?.state==='recording'){
  const elapsed=performance.now()-recordStarted;$('timer').textContent='● '+(elapsed/1000).toFixed(1)+'초';
  if(worker&&elapsed<7500&&gifFrames<75&&elapsed>=gifFrames*100){gifContext.drawImage(canvas,0,0,270,480);const pixels=gifContext.getImageData(0,0,270,480);worker.postMessage({type:'frame',buffer:pixels.data.buffer,width:270,height:480},[pixels.data.buffer]);gifFrames++;}
  if(elapsed>=60000)endRecording();
 }
}
async function openCamera(){
 if(busy)return;status.classList.remove('error');busy=true;ready=false;controls();$('start').disabled=true;message('카메라를 연결하고 있어요…');
 stream?.getTracks().forEach(t=>t.stop());stream=null;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('카메라를 사용할 수 없어요. Safari 또는 Chrome에서 HTTPS 링크를 열어주세요.');
  if(!program)setupGL();
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:720},height:{ideal:1280},frameRate:{ideal:24,max:30}}});
  mirror=(stream.getVideoTracks()[0].getSettings().facingMode||facing)==='user';camera.srcObject=stream;
  await Promise.all([camera.play(),frame.play()]);ready=true;$('welcome').hidden=true;message('짧게 누르면 사진, 꾹 누르면 녹화 ♡');
 }catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;const texts={NotAllowedError:'카메라 권한을 허용한 뒤 다시 눌러주세요. 앱 안에서는 Safari/Chrome으로 열어주세요.',NotFoundError:'사용할 카메라를 찾지 못했어요.',NotReadableError:'다른 앱에서 카메라를 사용 중인지 확인해주세요.'};fail(texts[e.name]||e.message);}
 finally{busy=false;controls();$('start').disabled=false;}
}
function clearResult(){if(resultURL)URL.revokeObjectURL(resultURL);resultURL=null;resultBlob=null;gifBlob=null;worker?.terminate();worker=null;}
function showResult(blob,isPhoto){
 if(!blob?.size){message('촬영 결과를 저장하지 못했어요. 다시 촬영해주세요.');return;}
 resultBlob=blob;resultURL=URL.createObjectURL(blob);$('photo').hidden=!isPhoto;$('clip').hidden=isPhoto;
 if(isPhoto)$('photo').src=resultURL;else{$('clip').src=resultURL;}
 iconLabel('save',isPhoto?'사진 저장':'영상 저장');$('gif').hidden=isPhoto;$('save-note').textContent=isPhoto?'저장 버튼에서 사진을 저장하거나 공유하세요.':'영상은 누른 길이만큼, GIF는 처음 7.5초까지 저장돼요. (소리 없음)';
 if(!$('result').open)$('result').showModal();controls();
}
function photo(){if(!ready||busy||photoPending)return;clearResult();photoPending=true;controls();draw();canvas.toBlob(blob=>{photoPending=false;showResult(blob,true);controls();message('사진을 촬영했어요 ♡');},'image/jpeg',.94);}
function beginRecording(){
 if(!ready||busy||recorder)return;
 if(!window.MediaRecorder||!canvas.captureStream){message('이 브라우저에서는 사진만 지원해요. Safari/Chrome을 업데이트해주세요.');return;}
 clearResult();chunks=[];gifFrames=0;recordFailed=false;
 $('gif').disabled=true;iconLabel('gif','GIF 만드는 중');$('gif').classList.add('loading');
 try{
  worker=new Worker('gif-worker.js',{type:'module'});
  worker.onmessage=({data})=>{if(data.type==='done'&&data.count){gifBlob=new Blob([data.bytes],{type:'image/gif'});$('gif').disabled=false;iconLabel('gif','움짤 GIF 저장');$('gif').classList.remove('loading');}else{iconLabel('gif','GIF 변환 실패');$('gif').classList.remove('loading');}worker?.terminate();worker=null;};
  worker.onerror=()=>{iconLabel('gif','GIF 변환 실패');$('gif').classList.remove('loading');worker?.terminate();worker=null;};worker.postMessage({type:'start'});
  recordingStream=canvas.captureStream(24);
  const mime=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  recorder=new MediaRecorder(recordingStream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:2500000});
  const current=recorder;
  current.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  current.onerror=()=>{recordFailed=true;message('녹화 중 오류가 발생했어요. 다시 촬영해주세요.');endRecording();};
  current.onstop=()=>{recordingStream?.getTracks().forEach(t=>t.stop());recorder=null;busy=false;worker?.postMessage({type:'finish'});if(!recordFailed)showResult(new Blob(chunks,{type:current.mimeType||'video/webm'}),false);controls();};
  draw();current.start(250);recordStarted=performance.now();$('timer').hidden=false;$('shutter').classList.add('recording');$('flip').disabled=true;$('color').disabled=true;$('download').disabled=true;message('손을 떼면 녹화가 끝나요.');
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
$('download').onclick=()=>{if(resultBlob)$('result').showModal();};
$('close').onclick=()=>$('result').close();$('result').addEventListener('close',()=>$('clip').pause());
async function save(blob){
 if(!blob)return;const ext=blob.type.startsWith('image/gif')?'gif':blob.type.startsWith('image/')?'jpg':blob.type.includes('mp4')?'mp4':'webm';
 const name='frame1-'+Date.now()+'.'+ext,file=new File([blob],name,{type:blob.type});
 try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'훈녀생정 프레임'});return;}}catch(e){if(e.name==='AbortError')return;}
 const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.textContent='저장 파일';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('save-note').textContent='다운로드 폴더를 확인해주세요. 미리보기가 열리면 공유 메뉴에서 저장할 수 있어요.';
}
$('save').onclick=()=>save(resultBlob);$('gif').onclick=()=>save(gifBlob);
frame.addEventListener('error',()=>{ready=false;endRecording();fail('프레임 영상을 불러오지 못했어요. 네트워크 확인 후 새로고침해주세요.');controls();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;endRecording();stream?.getTracks().forEach(t=>t.stop());fail('화면 연결이 중단됐어요. 페이지를 새로고침해주세요.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){endRecording();frame.pause();stream?.getTracks().forEach(t=>t.stop());ready=false;controls();$('welcome').hidden=false;iconLabel('start','카메라 다시 켜기');}});
window.addEventListener('pagehide',()=>{endRecording();stream?.getTracks().forEach(t=>t.stop());worker?.terminate();});
requestAnimationFrame(loop);
