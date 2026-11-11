import * as THREE from 'three';
import {loadSampleBank,playOneShot,scheduleLaneTails} from '../sample-bank.js';
import {loadAuthoredScene} from '../authored-scene.js';
import {createImpactStars} from '../impact-stars.js';
/* Miss Normal beatmaker with the supplied green Blender character. */
SNG.register('music',({root,onCleanup})=>{

const Engine=MissNormalBeat,STEPS=16,STORE='miss-normal-beats-v3';
const tracks=[{"name":"킥","en":"위아래 조명","mark":"<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M9 3h6v2h3v3h2v6h-2v3h-3v3H9v-3H6v-3H4V8h2V5h3zM9 22h6v2H9z\"/></svg>","color":"#cbdad3"},{"name":"스네어","en":"고개 끄덕임","mark":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 7q5 5 0 10M14 5q7 7 0 14\"/></svg>","color":"#9fbbc3"},{"name":"스네어 2","en":"창밖 번개","mark":"<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"m14 3-9 11h6l-2 7L20 9h-7z\"/></svg>","color":"#9c9fac"},{"name":"코드","en":"STOP 버튼 점등","mark":"<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><circle cx=\"12\" cy=\"12\" r=\"8\"/></svg>","color":"#8dac9f"},{"name":"별","en":"창문에 머리박기","mark":"<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9z\"/></svg>","color":"#cab493"}];
const icons={play:'<svg viewBox="0 0 24 24"><path d="m9 5 11 7-11 7z" fill="currentColor"/></svg>',pause:'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="4"/></svg>',random:'<svg viewBox="0 0 24 24"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-5m2-3c2-3 3-4 5-4h3m-4-4 4 4-4 4"/></svg>',undo:'<svg viewBox="0 0 24 24"><path d="m8 4-5 5 5 5M3 9h10a6 6 0 0 1 0 12h-3"/></svg>',clear:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7"/></svg>'};
root.innerHTML=`<div class="studio"><header class="mast"><div class="wordmark">평범양의 하교버스</div><span class="session-mark" aria-hidden="true">● <span class="stage-counter">01 / 16</span></span></header><section class="stage" aria-label="평범양 무대"><canvas aria-label="비트에 반응하는 평범양"></canvas></section><section class="deck" id="beat-editor" aria-label="리듬 편집기"><div class="grid-scroll"><div class="beat-grid" aria-label="누르고 드래그해서 비트 입력"><span></span>${Array.from({length:16},(_,s)=>`<span class="number">${s%4===0?String(s/4+1).padStart(2,'0'):'·'}</span>`).join('')}${tracks.map((t,r)=>`<button class="track-name" data-audition="${r}" style="--track:${t.color};--row:${r}" aria-label="${t.name} 소리 미리듣기" title="${t.en}"><i aria-hidden="true">${t.mark}</i></button>${Array.from({length:STEPS},(_,s)=>{return `<button class="step ${s%4===0?'group':''}" style="--track:${t.color};grid-row:${r+1};grid-column:${s+1} / span 1" data-r="${r}" data-s="${s}" aria-label="${t.name} ${s+1}번 비트" aria-pressed="false"><span></span></button>`;}).join('')}`).join('')}</div></div><div class="transport"><div class="transport-cluster" role="group" aria-label="재생 및 패턴"><button class="play" aria-label="재생" title="재생 / 정지 (Space)">${icons.play}</button><button id="generate" aria-label="랜덤 만들기" title="랜덤 만들기">${icons.random}</button><button id="clear" aria-label="전체 지우기" title="전체 지우기">${icons.clear}</button></div><button class="menu-button" aria-label="비트 편집기 펼치기" aria-expanded="false" aria-controls="beat-editor">MENU</button><button class="record-button" aria-label="녹화 시작" aria-pressed="false" title="녹화 시작"><svg class="record-symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><rect x="6" y="6" width="12" height="12" rx="1"/></svg><span>REC</span></button></div></section><span class="sr-only" id="status" role="status">준비</span><span class="sr-only" id="save-state"></span><span class="sr-only" id="light-state"></span></div>`;
const $=s=>root.querySelector(s),cells=[...root.querySelectorAll('.step')],numbers=[...root.querySelectorAll('.number')],grid=$('.beat-grid');
let pattern=Array.from({length:5},()=>Array(16).fill(false)),bpm=160,playing=false,starting=false,disposed=false;
let ac,master,room,noiseBuffer,timer,raf,next=0,step=0,serial=0,dropSerial=0,events=[],hits=[],previews=[],history=[],gesture=null,lastFlash=0;
let character=null,bus=null,authored=null;
let samples=null,sampleLoading=null,uiBus;const activeSampleVoices=new Set(),uiVoices=new Set();
async function ensureSamples(){if(samples)return samples;if(!sampleLoading)sampleLoading=loadSampleBank(ac).then(bank=>(samples=bank)).catch(error=>{sampleLoading=null;throw error;});return sampleLoading;}
async function playUiFeedback(name){
 try{
  if(disposed)return;if(!ac)initAudio();const resume=ac.resume();await Promise.all([resume,ensureSamples()]);if(disposed||ac.state!=='running')return;
  const voice=playOneShot(ac,uiBus,samples,name,ac.currentTime+.004,0,bpm,()=>uiVoices.delete(voice));uiVoices.add(voice);scheduleLaneTails(uiVoices);
 }catch(error){console.error('UI sound could not load',error);}
}
// Sequencer cells and instrument previews are the music surface; UI clicks use
// their own bus, so MENU remains audible when the sequencer is stopped.
function clickFeedback(e){const button=e.target.closest('button,a');if(!button||button.disabled||button.closest('.beat-grid')||button.matches('.play'))return;void playUiFeedback(button.matches('.menu-button')?'menu':'button');}
root.addEventListener('click',clickFeedback,true);
const playhead=document.createElement('div');playhead.className='beat-playhead';playhead.hidden=true;playhead.setAttribute('aria-hidden','true');grid.append(playhead);let transportStartedAt=Infinity;
const cellMap=new Map(cells.map(b=>[b.dataset.r+':'+b.dataset.s,b]));
$('.studio').insertAdjacentHTML('beforeend','<div class="vn-text" aria-hidden="true"></div>');
const lcd=document.createElement('div');lcd.className='mp3-screen';$('.studio').prepend(lcd);
for(const selector of ['.mast','.stage','.vn-text'])lcd.append($(selector));
$('.studio').append($('.deck'));$('.studio').append($('.transport'));

$('.mast').insertAdjacentHTML('beforeend','<span class="battery" aria-hidden="true"><i></i><i></i><i></i></span>');
$('.transport-cluster').append($('.menu-button'),$('.record-button'));


function titlePixels(text,korean=false){
 const c=document.createElement('canvas'),g=c.getContext('2d'),size=korean?13:10;
 g.font=size+'px '+(korean?'"Malgun Gothic",sans-serif':'monospace');
 c.width=Math.ceil(g.measureText(text).width)+2;c.height=size+5;
 g.font=size+'px '+(korean?'"Malgun Gothic",sans-serif':'monospace');g.fillStyle='#fff';g.textBaseline='top';g.fillText(text,1,1);
 const data=g.getImageData(0,0,c.width,c.height).data;let pixels='';
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>100)pixels+='<rect x="'+x+'" y="'+y+'" width="1" height="1"/>';
 return '<svg viewBox="0 0 '+c.width+' '+c.height+'" shape-rendering="crispEdges" aria-hidden="true">'+pixels+'</svg>';
}
lcd.insertAdjacentHTML('beforeend','<section class="song-menu" aria-label="곡 선택"><div class="song-select"><span class="song-title" aria-label="평범양의 하교버스">'+titlePixels('평범양의 하교버스',true)+'</span><span class="start-caption" aria-label="Press MENU to start">'+titlePixels('Press MENU to start')+'</span></div></section>');
let gameStarted=false,editorOpen=false;
function setEditor(open){
 editorOpen=open;$('.studio').classList.toggle('editor-open',open);$('.deck').inert=!open;
 $('.menu-button').setAttribute('aria-expanded',String(open));$('.menu-button').setAttribute('aria-label',open?'비트 편집기 접기':'비트 편집기 펼치기');
 if(!open)endStroke();
}
$('.studio').classList.add('choosing-song');$('.deck').inert=true;
for(const button of root.querySelectorAll('.play,#generate,#clear,.record-button'))button.disabled=true;
$('.menu-button').onclick=()=>{
 if(!gameStarted){gameStarted=true;$('.studio').classList.remove('choosing-song');$('.song-menu').hidden=true;
  for(const button of root.querySelectorAll('.play,#generate,#clear,.record-button'))button.disabled=false;
  if(!ac)initAudio();ac.resume();
 }
 setEditor(!editorOpen);
};
let dialogueNode=null,dialogueIndex=0,dialogueStartedAt=-Infinity,lyricCurrent='',lyricPrevious='';const utterances=['아','야'];let impactStars=null;
const lyricPixels={아:['00000001000','01110001000','10001001000','10001001000','10001001110','10001001000','01110001000','00000001000','00000001000'],야:['00000001000','01110001000','10001001110','10001001000','10001001000','10001001110','01110001000','00000001000','00000001000']};
function lyricSVG(letter){return '<svg viewBox="0 0 11 9" aria-hidden="true" shape-rendering="crispEdges">'+lyricPixels[letter].flatMap((row,y)=>[...row].flatMap((bit,x)=>bit==='1'?'<rect x="'+x+'" y="'+y+'" width="1" height="1"/>':[])).join('')+'</svg>';}
function impactDialogue(at){const panel=$('.vn-text');if(at-dialogueStartedAt>=3&&at-dialogueStartedAt<3.65)return;if(at-dialogueStartedAt>=3.65){panel.classList.remove('lyric-exit');lyricCurrent='';lyricPrevious='';dialogueIndex=0;dialogueStartedAt=at;}const cap=Math.max(4,Math.floor((panel.clientWidth-12)/22));let shifted=false;if(lyricCurrent.length>=cap){lyricPrevious=lyricCurrent;lyricCurrent='';shifted=true;}lyricCurrent+=utterances[dialogueIndex++%2];panel.innerHTML='<div class="lyric-row previous">'+[...lyricPrevious].map(lyricSVG).join('')+'</div><div class="lyric-row current">'+[...lyricCurrent].map(lyricSVG).join('')+'</div>';panel.classList.toggle('lyric-scroll',shifted);dialogueNode=panel.lastElementChild;panel.classList.add('visible');panel.dataset.impactAt=String(at);}
function updateDialogue(now){if(!dialogueNode||now-dialogueStartedAt<3)return;const panel=$('.vn-text');if(now-dialogueStartedAt<3.65){panel.classList.add('lyric-exit');return;}panel.classList.remove('visible','lyric-scroll','lyric-exit');panel.replaceChildren();dialogueNode=null;dialogueIndex=0;dialogueStartedAt=-Infinity;lyricCurrent='';lyricPrevious='';}
function showImpact(){impactDialogue(audibleTime());impactStars?.emit(performance.now());}
function updateImpact(){updateDialogue(audibleTime());impactStars?.update(performance.now(),camera,character);}


let renderer,scene,camera,model,keyLight,fill,rim,ambient,accent,eyes=[],propTemplates=[];
let kickCount=0,lastKick=null,nodSerial=0;
let recordAudio,recorder=null,recordCanvas=null,recordContext=null,recordStream=null,recordChunks=[],recordBusy=false;
function drawRecordFrame(){if(!recordContext)return;const c=recordContext,w=recordCanvas.width,h=recordCanvas.height,stage=$('.stage'),sx=w/stage.clientWidth,sy=h/stage.clientHeight;c.fillStyle='#080d08';c.fillRect(0,0,w,h);c.drawImage($('canvas'),0,0,w,h);
 if($('.vn-text').classList.contains('visible')){const exit=Math.max(0,Math.min(1,(audibleTime()-dialogueStartedAt-3)/.65));c.save();c.globalAlpha=1-exit;c.translate(0,-28*exit*sy);for(const [j,line] of [lyricPrevious,lyricCurrent].entries()){c.fillStyle=j?'#fffdf2':'#98aaa0';[...line].forEach((ch,i)=>lyricPixels[ch].forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='1')c.fillRect(((w/sx-line.length*22)/2+i*22+x*1.7)*sx,(10+j*25+y*1.7)*sy,1.7*sx,1.7*sy);})));}c.restore();} }
let lastCapture=0;
function recordFrame(){
 if(!recordContext)return;
 const now=performance.now();if(now-lastCapture<1000/30-1)return;lastCapture=now;
 drawRecordFrame();const track=recordStream?.getVideoTracks()[0];track?.requestFrame?.();
}
let recordFile=null,recordFileURL=null;
const recordDialog=document.createElement('dialog');recordDialog.className='record-result';
recordDialog.innerHTML='<button class="record-close" aria-label="닫기">×</button><p class="record-message" role="status">녹화 완료</p><video controls playsinline preload="metadata"></video><div class="record-actions"><button class="record-share">저장 / 공유</button><a class="record-download">파일 저장</a></div>';
document.body.append(recordDialog);recordDialog.addEventListener('click',clickFeedback,true);
recordDialog.querySelector('.record-close').onclick=()=>recordDialog.close();
recordDialog.addEventListener('close',()=>recordDialog.querySelector('video').pause());
recordDialog.querySelector('.record-share').onclick=async()=>{
 if(!recordFile)return;
 try{await navigator.share({files:[recordFile],title:'평범양의 하교버스'});}
 catch(error){if(error.name!=='AbortError')recordDialog.querySelector('.record-message').textContent='공유할 수 없어요. 파일 저장을 눌러주세요.';}
};
function finishRecording(){
 recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;recordContext=null;recordCanvas?.remove();recordCanvas=null;recorder=null;recordBusy=false;
 const b=$('.record-button');b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','녹화 시작');b.title='녹화 시작';$('.studio').classList.remove('is-recording');
}
function showRecording(blob,poster){
 if(recordFileURL)URL.revokeObjectURL(recordFileURL);
 const ext=blob.type.includes('mp4')?'mp4':'webm';
 recordFile=new File([blob],'평범양의 하교버스-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.'+ext,{type:blob.type.split(';')[0]});
 recordFileURL=URL.createObjectURL(recordFile);
 const link=recordDialog.querySelector('.record-download');link.href=recordFileURL;link.download=recordFile.name;
 const share=recordDialog.querySelector('.record-share');share.hidden=!(navigator.canShare&&navigator.canShare({files:[recordFile]}));
 const video=recordDialog.querySelector('video');video.src=recordFileURL;if(poster)video.poster=poster;
 recordDialog.querySelector('.record-message').textContent='녹화 완료 · 저장해주세요';
 if(!disposed)recordDialog.showModal();
}
function stopRecording(){if(recorder?.state==='recording'){recordBusy=true;recorder.stop();}}
$('.record-button').onclick=async()=>{
 if(recordBusy)return;if(recorder?.state==='recording'){stopRecording();return;}
 recordBusy=true;
 try{
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('이 브라우저에서는 녹화를 지원하지 않아요.');
  if(!ac)initAudio();await ac.resume();if(!playing)await toggle();
  if(!playing||!renderer)throw Error('재생 화면이 준비된 뒤 다시 눌러주세요.');
  recordChunks=[];recordCanvas=document.createElement('canvas');recordCanvas.width=720;
  recordCanvas.height=Math.round(720*$('.stage').clientHeight/$('.stage').clientWidth/2)*2;
  recordCanvas.setAttribute('aria-hidden','true');recordCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:20';$('.stage').append(recordCanvas);
  recordContext=recordCanvas.getContext('2d');lastCapture=0;recordFrame();
  const manual=typeof CanvasCaptureMediaStreamTrack!=='undefined'&&'requestFrame' in CanvasCaptureMediaStreamTrack.prototype;
  recordStream=recordCanvas.captureStream(manual?0:30);
  for(const track of recordAudio.stream.getAudioTracks())recordStream.addTrack(track.clone());
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'];
  const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
  recorder=new MediaRecorder(recordStream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:2600000,audioBitsPerSecond:128000});
  const current=recorder;let failure=false;
  current.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
  current.onerror=e=>{failure=true;recordDialog.querySelector('.record-message').textContent='녹화 중 오류가 발생했어요. 다시 시도해주세요.';$('#status').textContent=e.error?.message||'녹화 오류';};
  current.onstop=()=>{
   const type=current.mimeType||recordChunks[0]?.type||'video/webm',blob=new Blob(recordChunks,{type}),poster=recordCanvas?.toDataURL('image/jpeg',.82);finishRecording();if(playing)stop();
   if(blob.size>1024&&!failure)showRecording(blob,poster);
   else{recordDialog.querySelector('video').removeAttribute('src');recordDialog.querySelector('.record-message').textContent='녹화 파일을 만들지 못했어요. 다시 시도해주세요.';recordDialog.querySelector('.record-actions').hidden=true;if(!disposed)recordDialog.showModal();}
  };
  recordDialog.querySelector('.record-actions').hidden=false;
  current.start(250);const button=$('.record-button');button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','녹화 종료');button.title='녹화 종료';$('.studio').classList.add('is-recording');
 }catch(error){finishRecording();recordDialog.querySelector('.record-message').textContent=error.message;recordDialog.querySelector('.record-actions').hidden=true;recordDialog.querySelector('video').removeAttribute('src');recordDialog.showModal();}
 finally{if(recorder?.state==='recording')recordBusy=false;}
};


const harmonyVoices=new Set();
const harmony={enabled:false,at:()=>[],cursor:()=>{}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
pattern=Engine.initial();
// Each fresh launch starts with an empty grid.

function paint(){cells.forEach(b=>b.setAttribute('aria-pressed',String(pattern[+b.dataset.r][+b.dataset.s])));}
function save(){try{localStorage.setItem(STORE,JSON.stringify({pattern,bpm}));$('#save-state').textContent='AUTO SAVED';}catch{$('#save-state').textContent='이번 창에서만 저장';}}
function remember(){history.push(pattern.map(r=>r.slice()));if(history.length>40)history.shift();}
function cancelVoice(v){if(!v)return;v.cancelled=true;if(v.bus&&ac){v.bus.gain.cancelScheduledValues(ac.currentTime);v.bus.gain.setTargetAtTime(0,ac.currentTime,.006);}for(const n of v.sources){try{n.stop();}catch{}}}
function syncPending(){if(!ac)return;for(const e of events){if(e.at<=ac.currentTime+.008)continue;for(let r=0;r<5;r++){if(pattern[r][e.step]&&!e.voices[r]){e.voices[r]=sound(r,e.at,e.step);if(r===4){e.dropSeed=dropSerial++;e.dropKind=e.dropSeed%3;};}if(!pattern[r][e.step]&&e.voices[r]){cancelVoice(e.voices[r]);e.voices[r]=null;}}if(!e.voices[4])removeProp(e);}scheduleLaneTails(activeSampleVoices);}
function change(r,s,value){if(pattern[r][s]===value)return;pattern[r][s]=value;cellMap.get(r+':'+s)?.setAttribute('aria-pressed',String(value));}
let holdTimer=null;
function clearHold(){clearTimeout(holdTimer);holdTimer=null;}
function pointCell(x,y){
 const box=grid.getBoundingClientRect();if(x<box.left||x>box.right||y<box.top||y>box.bottom)return null;
 const direct=document.elementFromPoint(x,y)?.closest('.step');if(direct&&grid.contains(direct))return {r:+direct.dataset.r,s:+direct.dataset.s};
 let closest=null,best=Infinity;for(const b of cells){const z=b.getBoundingClientRect();if(x<z.left-3||x>z.right+3||y<z.top-4||y>z.bottom+4)continue;const d=Math.hypot(x-z.x-z.width/2,y-z.y-z.height/2);if(d<best){best=d;closest={r:+b.dataset.r,s:+b.dataset.s};}}return closest;
}
function indicate(cell){
 const s=cell.s;
 cells.forEach(b=>b.classList.toggle('editing',+b.dataset.r===cell.r&&+b.dataset.s===s));
}
function armHold(delay=360){clearHold();holdTimer=setTimeout(()=>{
 if(!gesture)return;const next=gesture.last.s+1;if(next>=16)return;
 gesture.last={r:gesture.last.r,s:next};change(gesture.last.r,next,gesture.value);indicate(gesture.last);syncPending();armHold(120);
 },delay);}
function endStroke(e){if(!gesture||(e&&e.pointerId!==gesture.id))return;clearHold();gesture=null;cells.forEach(b=>b.classList.remove('editing'));syncPending();save();paint();}
grid.addEventListener('contextmenu',e=>e.preventDefault());
grid.addEventListener('pointerdown',e=>{const cell=e.target.closest('.step');if(!cell||e.button!==0)return;e.preventDefault();const r=+cell.dataset.r,s=+cell.dataset.s;remember();gesture={id:e.pointerId,pointerType:e.pointerType,value:!pattern[r][s],last:{r,s},x:e.clientX,y:e.clientY};grid.setPointerCapture(e.pointerId);change(r,s,gesture.value);syncPending();paint();indicate({r,s});armHold();});
grid.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<3)return;gesture.x=e.clientX;gesture.y=e.clientY;const current=pointCell(e.clientX,e.clientY);if(!current){clearHold();return;}for(const cell of Engine.lineCells(gesture.last,current))change(cell.r,cell.s,gesture.value);gesture.last=current;indicate(current);syncPending();armHold();});
grid.addEventListener('pointerup',endStroke);grid.addEventListener('pointercancel',endStroke);grid.addEventListener('lostpointercapture',endStroke);
// Pointer gestures own mouse/touch clicks; detail=0 preserves keyboard activation.
cells.forEach(b=>b.addEventListener('click',e=>{if(e.detail!==0)return;remember();const r=+b.dataset.r,s=+b.dataset.s;change(r,s,!pattern[r][s]);syncPending();paint();save();}));
function undo(){if(!history.length)return;pattern=history.pop();syncPending();paint();save();}
$('#clear').onclick=()=>{remember();pattern.forEach(r=>r.fill(false));syncPending();paint();save();};
$('#generate').onclick=()=>{remember();const old=JSON.stringify(pattern);for(let i=0;i<4;i++){pattern=Engine.generate();if(JSON.stringify(pattern)!==old)break;}syncPending();paint();save();};
function initAudio(){ac=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});uiBus=ac.createGain();uiBus.gain.value=.45;uiBus.connect(ac.destination);master=ac.createGain();master.gain.value=.48;const comp=ac.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=5;master.connect(comp);comp.connect(ac.destination);recordAudio=ac.createMediaStreamDestination();comp.connect(recordAudio);room=ac.createConvolver();const ir=ac.createBuffer(2,ac.sampleRate*.8,ac.sampleRate);for(let c=0;c<2;c++){const data=ir.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3)*.30;}room.buffer=ir;const wet=ac.createGain();wet.gain.value=.18;room.connect(wet);wet.connect(master);noiseBuffer=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
function sound(row,at,column=0){
 if(!samples)throw Error('음원을 불러오는 중이에요.');
 const voice=playOneShot(ac,master,samples,row,at,column,bpm,()=>activeSampleVoices.delete(voice));
 activeSampleVoices.add(voice);scheduleLaneTails(activeSampleVoices);return voice;
}
function harmonySound(note,at,duration){
 const sources=[],bus=ac.createGain(),filter=ac.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(2400,at);filter.frequency.exponentialRampToValueAtTime(650,at+duration+.25);filter.Q.value=.55;
 bus.gain.setValueAtTime(0,at);bus.gain.linearRampToValueAtTime(.078*(note.gain??1),at+.014);bus.gain.exponentialRampToValueAtTime(.024*(note.gain??1),at+Math.max(.025,duration));bus.gain.exponentialRampToValueAtTime(.0001,at+duration+.30);filter.connect(bus);bus.connect(master);bus.connect(room);
 const hz=440*Math.pow(2,(note.pitch-69)/12);for(const detune of [-4,4]){const o=ac.createOscillator();o.type='triangle';o.frequency.value=hz;o.detune.value=detune;o.connect(filter);o.start(at);o.stop(at+duration+.32);sources.push(o);}
 const bell=ac.createOscillator(),bellGain=ac.createGain();bell.frequency.value=hz*2.002;bellGain.gain.setValueAtTime(.23,at);bellGain.gain.exponentialRampToValueAtTime(.0001,at+.24);bell.connect(bellGain);bellGain.connect(filter);bell.start(at);bell.stop(at+.26);sources.push(bell);
 const voice={sources,bus,end:at+duration+.32};harmonyVoices.add(voice);sources[0].onended=()=>{harmonyVoices.delete(voice);for(const o of sources)o.disconnect();filter.disconnect();bus.disconnect();bellGain.disconnect();};return voice;
}
function syncHarmony(){if(!ac)return;if(!harmony.enabled){for(const v of harmonyVoices)cancelVoice(v);for(const e of events)e.harmony=[];return;}for(const e of events){if(e.at<=ac.currentTime+.012)continue;(e.harmony||[]).forEach(cancelVoice);e.harmony=harmony.at(e.step).map(n=>harmonySound(n,e.at,n.length*60/bpm/4));}}
async function auditionHarmony(pitches){try{if(!ac)initAudio();await ac.resume();if(disposed)return;master.gain.setTargetAtTime(.48,ac.currentTime,.015);for(const pitch of pitches)harmonySound({pitch,gain:.72},ac.currentTime+.02,.32);}catch{}}
function audibleTime(){if(!ac)return 0;if(ac.getOutputTimestamp){const stamp=ac.getOutputTimestamp();if(stamp.contextTime>0)return Math.min(ac.currentTime,stamp.contextTime+Math.max(0,performance.now()-stamp.performanceTime)/1000);}return Math.max(0,ac.currentTime-(ac.baseLatency||0));}
function newEvent(at,column,row=null){const e={at,step:column,id:serial++,voices:Array(5).fill(null),fired:false,prop:null};for(let r=0;r<5;r++)if(row===null?pattern[r][column]:r===row)e.voices[r]=sound(r,at,column);if(e.voices[4])e.dropKind=dropSerial++%3;e.harmony=row===null?harmony.at(column).map(n=>harmonySound(n,at,n.length*60/bpm/4)):[];return e;}
function schedule(){if(!playing)return;while(next<ac.currentTime+Engine.DROP_LEAD+.08){events.push(newEvent(next,step));next+=60/bpm/4;step=(step+1)%STEPS;}}
function removeProp(e){if(e.prop){scene?.remove(e.prop);e.prop=null;}}
function stop(){stopRecording();transportStartedAt=Infinity;playhead.hidden=true;for(const v of activeSampleVoices)cancelVoice(v);activeSampleVoices.clear();dialogueNode=null;dialogueIndex=0;dialogueStartedAt=-Infinity;$('.vn-text').replaceChildren();$('.vn-text').classList.remove('visible','lyric-exit');playing=false;starting=false;clearInterval(timer);for(const e of [...events,...previews]){e.voices.forEach(cancelVoice);removeProp(e);}for(const v of harmonyVoices)cancelVoice(v);harmonyVoices.clear();harmony.cursor(-1);events=[];previews=[];hits=[];lastFlash=0;lastKick=null;kickCount=0;step=0;if(master)master.gain.setTargetAtTime(0,ac.currentTime,.015);cells.forEach(b=>b.classList.remove('now','sounding'));numbers.forEach(b=>b.classList.remove('active'));$('.play').innerHTML=icons.play;$('.play').setAttribute('aria-label','재생');$('#status').textContent='READY WHEN YOU ARE';$('.stage-counter').textContent='01 / 16';$('.stage').classList.remove('playing','bonk');$('.studio').classList.remove('is-playing');}
async function toggle(){if(playing){stop();return;}if(starting)return;starting=true;try{if(!ac)initAudio();await ac.resume();await ensureSamples();master.gain.setTargetAtTime(.48,ac.currentTime,.015);if(disposed||!starting)return;playing=true;starting=false;next=ac.currentTime+Engine.DROP_LEAD+.04;transportStartedAt=next;$('.play').innerHTML=icons.pause;$('.play').setAttribute('aria-label','정지');$('#status').textContent='ON THE BEAT';$('.stage').classList.add('playing');$('.studio').classList.add('is-playing');schedule();timer=setInterval(schedule,20);}catch(error){starting=false;$('#status').textContent='음원을 불러오지 못했어요. 다시 눌러주세요.';console.error(error);}}
async function audition(row){try{if(!ac)initAudio();await ac.resume();await ensureSamples();master.gain.setTargetAtTime(.48,ac.currentTime,.015);if(disposed)return;previews.push(newEvent(ac.currentTime+(row===4?Engine.DROP_LEAD+.03:.025),-1,row));}catch{$('#status').textContent='오디오를 시작할 수 없어요';}}
$('.play').onclick=toggle;root.querySelectorAll('[data-audition]').forEach(b=>b.onclick=()=>audition(+b.dataset.audition));
const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();undo();}else if(!$('.studio').hidden&&!$('.studio').classList.contains('choosing-song')&&e.code==='Space'&&!/INPUT|BUTTON|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();toggle();}};addEventListener('keydown',key);
const hidden=()=>{if(document.hidden){endStroke();stop();for(const v of uiVoices)cancelVoice(v);uiVoices.clear();if(ac)ac.suspend();}};document.addEventListener('visibilitychange',hidden);
paint();
try{
const T=THREE;renderer=new T.WebGLRenderer({canvas:$('canvas'),antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#060806');
scene=new T.Scene();camera=new T.PerspectiveCamera();impactStars=createImpactStars(scene);
$('.stage').dataset.character='loading';
loadAuthoredScene(scene).then(result=>{if(disposed){result.dispose();return;}authored=result;camera=result.camera;character=result.character;bus=result;$('.stage').style.aspectRatio=String(result.aspect);$('.stage').dataset.character='green-ready';$('.stage').dataset.scene='authored-blender';$('.stage').dataset.bones=Object.keys(character.bones).length;resizeStage();}).catch(error=>{if(disposed)return;$('.stage').dataset.character='error';const p=document.createElement('p');p.className='error';p.textContent='버스 장면을 불러오지 못했어요. 새로고침해 주세요.';$('.stage').append(p);console.error(error);});
}catch(error){const p=document.createElement('p');p.className='error';p.textContent='3D 화면을 불러오지 못했어요. WebGL 지원 브라우저로 열어주세요.';$('.stage').append(p);console.error(error);}
function updateEvent(e,now){const age=now-e.at;if(e.voices[4]&&!e.captionFired&&age>=0){e.captionFired=true;showImpact();}
 if(!e.fired&&age>=0){e.fired=true;if(e.voices[0]){lastKick={at:e.at,mode:[2,4,5,0,7,3,10,1][kickCount++%8]};}for(let r=0;r<5;r++)if(e.voices[r])hits.push({at:e.at,row:r,id:e.id,direction:r===1?(nodSerial++%2?1:-1):0});if(e.step>=0){harmony.cursor(e.step);numbers.forEach((b,i)=>b.classList.toggle('active',i===e.step));$('.stage-counter').textContent=String(e.step+1).padStart(2,'0')+' / 16';}if(e.voices[4]){lastFlash=e.at;$('.stage').dataset.lastImpact=e.at.toFixed(4);}}

}
let renderedWidth=0,renderedHeight=0;
function resizeStage(){
 if(!renderer)return;
 const lcd=$('.mp3-screen'),stage=$('.stage'),aspect=authored?.aspect||1.0576725025746654;
 const width=Math.floor(Math.min(lcd.clientWidth,lcd.clientHeight*aspect)),height=Math.floor(width/aspect);
 if(width<1||height<1)return;
 stage.style.width=width+'px';stage.style.height=height+'px';
 // MENU animates CSS dimensions only. Reallocating the WebGL drawing buffer
 // inside ResizeObserver used to clear it between rendered frames.
 const bufferWidth=Math.max(1,Math.ceil(lcd.clientWidth)),bufferHeight=Math.max(1,Math.ceil(bufferWidth/aspect));
 if(bufferWidth===renderedWidth&&bufferHeight===renderedHeight)return;
 renderedWidth=bufferWidth;renderedHeight=bufferHeight;renderer.setSize(bufferWidth,bufferHeight,false);
 if(authored){camera.aspect=aspect;camera.updateProjectionMatrix();}
 renderer.render(scene,camera);
}
const ro=new ResizeObserver(resizeStage);ro.observe($('.mp3-screen'));
function updatePlayhead(now){
 const active=playing&&now>=transportStartedAt;playhead.hidden=!active;
 if(!active){for(const b of cells)b.classList.remove('now','sounding');return;}
 const position=((now-transportStartedAt)/(60/bpm/4))%STEPS,column=Math.floor(position);
 const gap=parseFloat(getComputedStyle(grid).columnGap)||0;
 playhead.style.transform='translateX('+Math.max(0,position*(grid.clientWidth+gap)/STEPS-gap*.5)+'px)';
 grid.dataset.playhead=position.toFixed(5);grid.dataset.audioTime=now.toFixed(5);
 for(const b of cells)b.classList.toggle('now',column===+b.dataset.s);
}
function frame(ms){if(disposed)return;raf=requestAnimationFrame(frame);if($('.studio').hidden)return;const now=audibleTime();for(const e of [...events,...previews])updateEvent(e,now);events=events.filter(e=>now-e.at<1.5);previews=previews.filter(e=>now-e.at<1.5);hits=hits.filter(h=>now-h.at<1.4);updatePlayhead(now);const response=Engine.reaction(hits,now),energy=response.groove*.8+response.tick*.15+response.boom;response.impactAges=[...new Set([...hits.filter(h=>h.row===4).map(h=>h.at),...events.filter(e=>e.voices[4]).map(e=>e.at),...previews.filter(e=>e.voices[4]).map(e=>e.at)])].map(at=>now-at).filter(age=>age>-.2&&age<.9);

$('.stage').dataset.reaction=energy.toFixed(3);$('.stage').classList.toggle('bonk',lastFlash>0&&now-lastFlash>=0&&now-lastFlash<.16);$('.stage').dataset.drops=String([...events,...previews].filter(e=>e.prop).length);
if(renderer&&authored){const t=ms*.001,amount=reduced?.22:1,motion=Engine.motion(hits.filter(h=>h.row===1),now);const boomAge=now-Math.max(-Infinity,...hits.filter(h=>h.row===4).map(h=>h.at));response.stopAge=now-Math.max(-Infinity,...hits.filter(h=>h.row===3).map(h=>h.at));response.windowAge=now-Math.max(-Infinity,...hits.filter(h=>h.row===2).map(h=>h.at));const pending=[...events,...previews].find(e=>e.voices[4]&&e.at>now&&e.at-now<.20);const roadImpactAge=pending?now-pending.at:boomAge;const kickId=hits.filter(h=>h.row===0).at(-1)?.id??-1;authored.update(t,now,response,motion,boomAge,amount,roadImpactAge,kickId);$('.stage').dataset.scroll=authored.backdrop.userData.scrollOffset.toFixed(6);$('.stage').dataset.glint=response.glint.toFixed(3);updateImpact();renderer.render(scene,camera);recordFrame();}}
raf=requestAnimationFrame(frame);
onCleanup(()=>{impactStars?.dispose();root.removeEventListener('click',clickFeedback,true);recordDialog.removeEventListener('click',clickFeedback,true);for(const v of uiVoices)cancelVoice(v);uiVoices.clear();if(recordFileURL)URL.revokeObjectURL(recordFileURL);recordDialog.remove();clearHold();disposed=true;stop();cancelAnimationFrame(raf);ro.disconnect();removeEventListener('keydown',key);clearHold();document.removeEventListener('visibilitychange',hidden);if(ac)ac.close();const geometries=new Set(),materials=new Set();for(const group of [scene,...propTemplates])group?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());const textures=new Set();materials.forEach(m=>{for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();});textures.forEach(t=>t.dispose());authored?.dispose?.();renderer?.dispose();});
});
