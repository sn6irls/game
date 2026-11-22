// A small desktop playlist window backed by the YouTube IFrame API.
const musicPlayer=(()=>{
 const PUBLISHED_PLAYER='https://sn6irls.github.io/game/computer/playlist-player.html';
 const copy=(ko,en)=>I18N.get()==='en'?en:ko;
 let appRef=null,el=null,frame=null,frameOrigin='',cur=null,ready=false,playing=false,error='',muted=false,track='',windowDrag=null;
 function listFor(key){const config=CONFIG.os.playlist||{},list=config[key]||{},id=list.id||config.id||'';return /^[A-Za-z0-9_-]{2,64}$/.test(id)?{key,id,title:list.title||config.title||'Playlist'}:null;}
 const hasList=key=>!!listFor(key||appRef?.themeKey||'supa');
 const isOpen=()=>!!el&&!el.classList.contains('hidden');
 function post(func,args=[]){if(ready&&frame?.contentWindow)frame.contentWindow.postMessage({channel:'sng-computer-command',func,args},frameOrigin);}
 function render(){
  if(!el)return;
  el.querySelector('.wmp-name').textContent=copy('플레이리스트','Playlist');
  el.querySelector('.wmp-track').textContent=track||copy('플레이리스트 불러오는 중…','Loading playlist…');
  const play=el.querySelector('.wmp-play');play.textContent=playing?'❚❚':'▶';play.setAttribute('aria-label',playing?copy('일시정지','Pause'):copy('재생','Play'));play.title=play.getAttribute('aria-label');
  for(const button of el.querySelectorAll('.wmp-pad button'))button.disabled=!ready;
  const message=el.querySelector('.wmp-message');message.hidden=!error;message.textContent=error;
  el.querySelector('.wmp-external').textContent=copy('YouTube Music에서 열기 ↗','Open in YouTube Music ↗');
  el.classList.toggle('playing',playing);
 }
 addEventListener('message',event=>{
  if(event.source!==frame?.contentWindow||event.origin!==frameOrigin||event.data?.channel!=='sng-computer-player'||!cur)return;
  const data=event.data;
  if(data.event==='onReady'){ready=true;error='';post(muted?'mute':'unMute');}
  else if(data.event==='onAutoplayBlocked')error=copy('영상의 재생 버튼을 눌러주세요.','Press play in the video.');
  else if(data.event==='onError')error=copy('음악을 불러오지 못했어요. YouTube Music에서 열어주세요.','Could not load the music. Open it in YouTube Music.');
  if(data.event==='infoDelivery'&&data.info){const info=data.info;if(typeof info.playerState==='number')playing=info.playerState===1;if(info.videoData?.title)track=info.videoData.title;if(info.muted!==undefined)muted=!!info.muted;if(playing)error='';}
  render();
 });
 function build(){
  if(el)return;el=document.createElement('section');el.id='wmp';el.className='wmp simple hidden place-os size-wide';el.setAttribute('role','region');el.setAttribute('aria-label','Playlist');
  el.innerHTML='<header class="wmp-top"><img class="wmp-app-icon" src="assets/player.svg" alt=""><span class="wmp-name">플레이리스트</span><span class="wmp-tbtn"><button class="wmp-x" aria-label="닫기" title="닫기">×</button></span></header><div class="wmp-body"><div class="wmp-screen"><iframe class="wmp-frame" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Playlist"></iframe></div><p class="wmp-track"></p><div class="wmp-pad"><button class="wmp-prev" aria-label="이전 곡" title="이전 곡">◀◀</button><button class="wmp-play" aria-label="재생" title="재생">▶</button><button class="wmp-next" aria-label="다음 곡" title="다음 곡">▶▶</button></div><p class="wmp-message" role="status" hidden></p><a class="wmp-external" target="_blank" rel="noopener noreferrer">YouTube Music에서 열기 ↗</a></div>';
  document.body.append(el);frame=el.querySelector('.wmp-frame');frame.referrerPolicy='strict-origin-when-cross-origin';
  el.querySelector('.wmp-x').addEventListener('click',()=>{AudioSys.sfx('close');close();});
  for(const [selector,command]of [['.wmp-prev','previousVideo'],['.wmp-next','nextVideo']])el.querySelector(selector).addEventListener('click',()=>{AudioSys.sfx('click');post(command);});
  el.querySelector('.wmp-play').addEventListener('click',()=>{AudioSys.sfx('click');post(playing?'pauseVideo':'playVideo');});
  windowDrag=DesktopDrag.window(el,el.querySelector('.wmp-top'));
 }
 function load(key){
  const list=listFor(key);if(!list)return false;cur=list;ready=false;playing=false;error='';track='';muted=AudioSys.isMuted();
  el.querySelector('.wmp-external').href='https://music.youtube.com/playlist?list='+encodeURIComponent(list.id);
  const url=new URL(location.protocol==='file:'?PUBLISHED_PLAYER:'playlist-player.html',location.href);frameOrigin=url.origin;url.searchParams.set('list',list.id);url.searchParams.set('volume',String(CONFIG.audio.playlistVolume));url.searchParams.set('muted',muted?'1':'0');
  AudioSys.suppressBGM(true);frame.src=url.href;render();return true;
 }
 function open(app,opt){if(app)appRef=app;build();if(!load(opt?.key||appRef?.themeKey||'supa'))return false;el.classList.remove('hidden');return true;}
 function close(){if(!el)return;windowDrag?.cancel();frame.src='about:blank';el.classList.add('hidden');el.classList.remove('playing');cur=null;ready=false;playing=false;AudioSys.suppressBGM(!!window.__COMPUTER_GAME_ACTIVE);AudioSys.playBGM();}
 function enterOS(app){if(app)appRef=app;build();windowDrag?.cancel();windowDrag?.reset();el.style.left=el.style.top='';}
 function syncTheme(){if(isOpen()&&appRef&&cur?.key!==appRef.themeKey)load(appRef.themeKey);}
 addEventListener('sng-theme-change',syncTheme);addEventListener('computer-language-change',render);
 return {open,close,isOpen,enterOS,syncTheme,hasList,toggle(app){if(isOpen()){close();return true;}return open(app);},setMuted(on){if(!isOpen())return;muted=!!on;post(muted?'mute':'unMute');},title:()=>cur?.title||''};
})();
