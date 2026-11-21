// Only one live game browsing context may exist at a time.
const browserUI = (() => {
  const winRoot=document.getElementById('os-windows'), tabs=document.getElementById('task-tabs');
  const menu=document.getElementById('start-menu'), start=document.getElementById('task-start');
  const windows=new Map(), spots=new Map(), T=key=>I18N.t(key), esc=Util.esc;
  const copy=(ko,en)=>I18N.get()==='en'?en:ko;
  const games=()=>CONFIG.os.games.map(g=>({...g,label:I18N.get()==='en'?g.en:g.name}));
  let app,z=20,activeGame=null,restoreFocus=null;

  function focusWindow(id){
    const win=windows.get(id);if(!win)return;
    win.el.style.zIndex=++z;
    for(const item of windows.values()){
      item.el.classList.toggle('inactive',item!==win);item.tab.classList.toggle('active',item===win);
    }
  }
  function setGaming(on){
    window.__COMPUTER_GAME_ACTIVE=on;document.body.classList.toggle('game-running',on);
    AudioSys.suppressBGM(on||musicPlayer.isOpen());
    if(!on&&!document.hidden)AudioSys.playBGM('supa');
    dispatchEvent(new Event('computer-game-change'));
  }
  function closeWindow(id,restore=true){
    const win=windows.get(id);if(!win)return;
    // Removing the browsing context releases its media, timers and rendering resources.
    if(win.frame){
      clearTimeout(win.loadTimer);win.frame.onload=win.frame.onerror=null;
      win.frame.src='about:blank';win.frame.remove();activeGame=null;
    }
    win.cancelDrag?.();win.el.remove();win.tab.remove();windows.delete(id);
    if(id==='game'&&restore){setGaming(false);if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});}
  }
  function openWindow({id,title,html,width=440,game=false}){
    if(windows.has(id)){focusWindow(id);return windows.get(id);}
    const el=document.createElement('section');el.className='os-window'+(game?' game-window':'');
    el.dataset.window=id;el.setAttribute('role','region');el.setAttribute('aria-label',title);
    el.style.width=Math.min(width,innerWidth-24)+'px';
    el.style.left=Math.max(12,Math.min(200,(innerWidth-width)/2))+'px';el.style.top=Math.max(12,Math.min(80,innerHeight/8))+'px';
    el.innerHTML=`<header class="osw-top"><img src="assets/xp-computer.webp" alt=""><span class="osw-title">${esc(title)}</span><div class="osw-controls">${game?'<button class="osw-max" aria-label="전체 화면" title="전체 화면" aria-pressed="false">□</button>':''}<button class="osw-x" aria-label="닫기" title="닫기">×</button></div></header><div class="osw-body">${html}</div>`;
    const tab=document.createElement('button');tab.className='task-tab';tab.textContent=title;tab.title=title;
    // Task buttons focus the game; they never hide a game that keeps running.
    tab.addEventListener('click',()=>focusWindow(id));el.addEventListener('pointerdown',()=>focusWindow(id));
    el.querySelector('.osw-x').addEventListener('click',()=>closeWindow(id));
    el.querySelector('.osw-max')?.addEventListener('click',event=>{
      const full=el.classList.toggle('maximized'),button=event.currentTarget;
      button.setAttribute('aria-pressed',String(full));button.setAttribute('aria-label',full?'작은 창으로':'전체 화면');button.title=full?'작은 창으로':'전체 화면';button.textContent=full?'❐':'□';
    });
    const win={el,tab};windows.set(id,win);winRoot.append(el);tabs.append(tab);
    if(!game)el.querySelector('.osw-top').addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button'))return;
      win.cancelDrag?.();const rect=el.getBoundingClientRect(),dx=event.clientX-rect.left,dy=event.clientY-rect.top;
      const move=e=>{el.style.left=Math.max(0,Math.min(innerWidth-el.offsetWidth,e.clientX-dx))+'px';el.style.top=Math.max(0,Math.min(innerHeight-100,e.clientY-dy))+'px';};
      win.cancelDrag=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',win.cancelDrag);removeEventListener('pointercancel',win.cancelDrag);removeEventListener('blur',win.cancelDrag);};
      addEventListener('pointermove',move);addEventListener('pointerup',win.cancelDrag);addEventListener('pointercancel',win.cancelDrag);addEventListener('blur',win.cancelDrag);
    });
    focusWindow(id);return win;
  }
  const gameButtons=()=>games().map(g=>`<button data-launch="${esc(g.id)}"><span aria-hidden="true">${g.icon}</span><span>${esc(g.label)}</span></button>`).join('');
  function wireGames(root){root.querySelectorAll('[data-launch]').forEach(b=>b.addEventListener('click',()=>openGame(b.dataset.launch)));}

  function openGame(id){
    const game=games().find(g=>g.id===id);if(!game)return;
    if(activeGame===id){focusWindow('game');return;}
    restoreFocus=document.querySelector(`[data-game="${id}"]`);
    // Synchronous teardown before creation also handles rapid repeated clicks.
    closeWindow('game',false);closeWindow('games');musicPlayer.close();
    if(diaryUI.isOpen())diaryUI.close();activeGame=id;setGaming(true);setMenu(false);
    const win=openWindow({id:'game',title:game.label,game:true,html:'<div class="game-stage"></div>'});
    if(id==='desktop'&&!matchMedia('(pointer:coarse)').matches&&innerWidth>=900)win.el.querySelector('.osw-max').click();
    const frame=document.createElement('iframe');
    frame.className='game-frame';frame.title=game.label;frame.dataset.game=id;
    frame.setAttribute('allow','camera; microphone; autoplay; fullscreen');frame.setAttribute('allowfullscreen','');frame.referrerPolicy='strict-origin-when-cross-origin';win.frame=frame;
    frame.src=game.url;win.el.querySelector('.game-stage').append(frame);
    win.el.querySelector('.osw-x').focus({preventScroll:true});
  }
  function openGames(){const win=openWindow({id:'games',title:copy('게임','Games'),html:`<div class="game-grid-os">${gameButtons()}</div>`});if(!win.wired){wireGames(win.el);win.wired=true;}}
  function openDiary(){diaryUI.open(app,{fromBrowser:true});}
  function openPlaylist(){
    // Music videos cannot keep playing behind a game either.
    closeWindow('game');if(musicPlayer.isOpen())musicPlayer.close();else{musicPlayer.enterOS(app);musicPlayer.open(app);}
  }
  function openSettings(){
    const win=openWindow({id:'settings',title:copy('설정','Settings'),width:400,html:`<div class="settings-panel"><div class="settings-intro"><img src="assets/xp-run.webp" alt=""><p>${copy('표시 언어를 선택하세요.','Choose a display language.')}</p></div><fieldset><legend>${copy('언어','Language')}</legend><div class="language-grid"><button class="language-option" data-lang="ko">한국어</button><button class="language-option" data-lang="en">English</button></div></fieldset></div>`});
    if(win.wired)return;win.wired=true;
    win.el.querySelectorAll('[data-lang]').forEach(button=>{
      button.classList.toggle('active',button.dataset.lang===I18N.get());
      button.setAttribute('aria-pressed',String(button.dataset.lang===I18N.get()));
      button.addEventListener('click',()=>I18N.set(button.dataset.lang));
    });
  }
  const actions={games:openGames,diary:openDiary,playlist:openPlaylist,settings:openSettings,bot:()=>window.toggleCompanion(),fullscreen:()=>window.toggleComputerFullscreen()};
  function renderIcons(){
    const root=document.getElementById('os-icons');root.replaceChildren();root.classList.add('os-free');
    const icons=[...games().map(g=>({id:'game-'+g.id,label:g.label,img:g.image,game:g.id,emoji:g.icon})),...CONFIG.os.icons.map(i=>({...i,label:i.id==='bot'?copy('슈퍼짱봇','Super Bot'):T({diary:'iconDiary',playlist:'iconPlaylist',settings:'iconSettings'}[i.id])}))];
    for(const icon of icons){
      const button=document.createElement('button');button.className='os-icon'+(icon.game?' game-icon':'');button.dataset.id=icon.id;button.setAttribute('aria-label',icon.label);if(icon.game)button.dataset.game=icon.game;
      button.innerHTML=`<span class="osi-img">${icon.img?`<img src="${esc(icon.img)}" alt="" draggable="false">`:esc(icon.emoji||'')}</span><span class="osi-label">${esc(icon.label)}</span>`;
      button.addEventListener('click',()=>{if(button.dataset.justDragged)return;AudioSys.sfx('click');if(icon.game)openGame(icon.game);else actions[icon.id]?.();});root.append(button);dragIcon(button);
    }
    layoutIcons();
  }
  function placeIcon(el,x,y){
    const bottom=innerHeight-document.querySelector('.taskbar').offsetHeight-8;
    el.style.left=Math.max(4,Math.min(innerWidth-el.offsetWidth-4,x))+'px';el.style.top=Math.max(4,Math.min(bottom-el.offsetHeight,y))+'px';
  }
  function layoutIcons(){
    const icons=[...document.querySelectorAll('.os-icon')];if(!icons.length)return;
    const cellW=icons[0].offsetWidth+12,cellH=icons[0].offsetHeight+12,bottom=innerHeight-document.querySelector('.taskbar').offsetHeight-8;
    const rows=Math.max(1,Math.min(6,Math.floor((bottom-30)/cellH)));
    let gameIndex=0,utilityIndex=0;
    for(const el of icons){
      const game=!!el.dataset.game,index=game?gameIndex++:utilityIndex++;
      const col=Math.floor(index/rows),row=index%rows;
      const x=game?16+col*cellW:innerWidth-16-el.offsetWidth-col*cellW;
      const y=(game?20:66)+row*cellH;
      const initial=el.dataset.id==='diary'?[(innerWidth-el.offsetWidth)/2,(bottom-el.offsetHeight)/2]:[x,y];
      placeIcon(el,...(spots.get(el.dataset.id)||initial));
    }
  }
  function dragIcon(el){el.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;const x=e.clientX,y=e.clientY,left=parseFloat(el.style.left),top=parseFloat(el.style.top);let moved=false;
    const move=ev=>{if(!moved&&Math.abs(ev.clientX-x)+Math.abs(ev.clientY-y)<6)return;moved=true;el.classList.add('dragging');placeIcon(el,left+ev.clientX-x,top+ev.clientY-y);};
    const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);removeEventListener('blur',up);el.classList.remove('dragging');if(moved){spots.set(el.dataset.id,[parseFloat(el.style.left),parseFloat(el.style.top)]);el.dataset.justDragged='1';setTimeout(()=>delete el.dataset.justDragged,0);}};
    addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up);addEventListener('blur',up);
  });}
  function setMenu(open){menu.classList.toggle('hidden',!open);start.classList.toggle('active',open);start.setAttribute('aria-expanded',String(open));}
  start.addEventListener('click',()=>setMenu(menu.classList.contains('hidden')));
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#start-menu,#task-start'))setMenu(false);});
  menu.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>{setMenu(false);actions[b.dataset.act]?.();}));
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>setMenu(false)));
  document.getElementById('os-exit').addEventListener('click',()=>window.toggleComputerFullscreen());
  document.getElementById('desktop-sound').addEventListener('click',e=>{const muted=AudioSys.toggleMute();musicPlayer.setMuted(muted);e.currentTarget.setAttribute('aria-pressed',String(muted));e.currentTarget.classList.toggle('muted',muted);});
  function refreshLanguage(){
    I18N.apply(document);renderIcons();
    if(windows.has('settings')){closeWindow('settings');openSettings();}if(windows.has('games')){closeWindow('games');openGames();}
  }
  let resizeFrame;addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{
    layoutIcons();for(const[id,win]of windows){if(id==='game')continue;win.el.style.left=Math.max(0,Math.min(parseFloat(win.el.style.left),innerWidth-win.el.offsetWidth))+'px';win.el.style.top=Math.max(0,Math.min(parseFloat(win.el.style.top),innerHeight-120))+'px';}
  });});
  function clock(){document.getElementById('task-clock').textContent=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});}clock();setInterval(clock,30000);
  addEventListener('computer-language-change',refreshLanguage);
  addEventListener('pagehide',()=>{closeWindow('game',false);musicPlayer.close();AudioSys.stopBGM();});
  addEventListener('pageshow',event=>{if(event.persisted)setGaming(false);});
  return {open(value){app=value;app.closeCurrent=()=>this.close();refreshLanguage();},openGame,isGaming:()=>activeGame!==null,openGuestbook:openDiary,close(){for(const id of [...windows.keys()])closeWindow(id);musicPlayer.close();setMenu(false);}};
})();
