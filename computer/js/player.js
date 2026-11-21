// Desktop playlist window. Playback state comes from the hosted YouTube API bridge.
const musicPlayer = (() => {
  const PUBLISHED_PLAYER='https://sn6irls.github.io/game/computer/playlist-player.html';
  let frameOrigin='',errorMessage='';

  let appRef = null;
  let el = null, frame = null;
  let dom = null;            // ⚡ LCD 요소들을 한 번만 찾아두고 재사용 (render 는 1초에 여러 번 불립니다)
  let place = 'os';        // 'room' = 3D 방 상단 / 'os' = 웹사이트(SNG:OS) 안
  let size = 'wide';         // 'mini' = 아주 작게 / 'wide' = 화면 크게
  let cur = null;            // { key, id, title }
  let playing = false;
  let heard = false;         // 유튜브가 상태를 보내주기 시작했는지
  let ready = false;         // 재생목록을 걸어둔 상태인지 (about:blank 면 false)
  let hello = null, ticker = null;
  const info = { time: 0, dur: 0, title: '', author: '', muted: false };

  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const clock = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const h = Math.floor(s / 3600);
    return (h ? h + ':' : '') + pad((s % 3600) / 60) + ':' + pad(s % 60);
  };

  // ── 이 세계(슈파/노마)의 재생목록 ──
  //  재생목록 ID 는 유튜브가 주는 영문·숫자·-_ 조합입니다.
  //  다른 글자가 섞이면(설정 오타 등) 목록이 없는 것으로 봅니다 — 이상한 주소를 iframe 에 넣지 않게.
  const LIST_ID = /^[A-Za-z0-9_-]{2,64}$/;
  function listFor(key) {
    const pl = (CONFIG.os && CONFIG.os.playlist) || {};
    const mine = pl[key] || {};
    const id = mine.id || pl.id || '';
    if (!id || !LIST_ID.test(id)) return null;
    return { key, id, title: mine.title || pl.title || '♫ SNG PLAYLIST' };
  }
  const hasList = (key) => !!listFor(key || (appRef && appRef.themeKey) || 'supa');

  // ── 유튜브에 말 걸기 (API 스크립트 없이 postMessage 만 씁니다) ──
  //   유튜브 문서가 실제로 들어와 있는지 확인 — 다른 출처면 location 을 읽다가 막힙니다(=준비됨).
  //   아직 빈 문서(우리 출처)일 때 보내면 콘솔에 경고가 남기 때문에 이렇게 확인합니다.
  function post(func,args=[]){
    if(!ready||!frame?.contentWindow)return;
    frame.contentWindow.postMessage({channel:'sng-computer-command',func,args},frameOrigin);
  }
  addEventListener('message',event=>{
    if(event.source!==frame?.contentWindow||event.origin!==frameOrigin||event.data?.channel!=='sng-computer-player'||!cur)return;
    const data=event.data;
    if(data.event==='onReady'){
      ready=true;heard=true;errorMessage='';post(info.muted?'mute':'unMute');for(const button of el.querySelectorAll('.wmp-pad button,.wmp-vol'))button.disabled=false;
    }else if(data.event==='onAutoplayBlocked')errorMessage='영상의 재생 버튼을 눌러주세요.';
    else if(data.event==='onError')errorMessage='음악을 불러오지 못했어요. 창을 닫고 다시 열어주세요.';
    const i=data.event==='infoDelivery'?data.info:null;
    if(i){
      heard=true;if(typeof i.playerState==='number')playing=i.playerState===1;
      if(typeof i.currentTime==='number')info.time=i.currentTime;if(typeof i.duration==='number')info.dur=i.duration;
      if(i.muted!==undefined)info.muted=!!i.muted;
      if(i.videoData){info.title=i.videoData.title||'';info.author=i.videoData.author||'';}
      if(playing)errorMessage='';
    }
    render();
  });

  // ══════════════════════════════════════════
  //  창 만들기 (딱 한 번, body 에 붙여서 계속 살아 있게)
  // ══════════════════════════════════════════
  function build() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'wmp';
    el.className = 'wmp hidden place-os size-wide';
    el.innerHTML = [
      '<div class="wmp-top">',
      '  <img class="wmp-app-icon" src="assets/player.svg" alt="">',
      '  <span class="wmp-name">Playlist - 미디어 플레이어</span>',
      '  <span class="wmp-tbtn">',
      '    <button class="wmp-size" title="크게 / 작게" aria-label="크게 작게">□</button>',
      '    <button class="wmp-x" title="음악 끄기 (기본 BGM 으로)" aria-label="음악 끄기">✕</button>',
      '  </span>',
      '</div>',
      '<div class="wmp-menu">SUPERNORMALGIRLS · PLAYLIST</div>',
      '<div class="wmp-body">',
      '  <div class="wmp-screen"><iframe class="wmp-frame" allowfullscreen',
      '    allow="autoplay; encrypted-media; picture-in-picture" title="SNG PLAYLIST"></iframe></div>',
      '  <div class="wmp-pad">',
      '    <button class="wmp-prev" title="이전 곡" aria-label="이전 곡">◀◀</button>',
      '    <button class="wmp-play" title="재생 / 일시정지" aria-label="재생 일시정지">▶</button>',
      '    <button class="wmp-next" title="다음 곡" aria-label="다음 곡">▶▶</button>',
      '  </div>',
      '  <div class="wmp-lcd">',
      '    <b class="wmp-state">▶ PLAYING</b>',
      '    <span class="wmp-time">00:00</span>',
      '    <small class="wmp-track">SNG PLAYLIST</small>',
      '  </div>',
      '  <p class="wmp-message" hidden>플레이리스트를 YouTube에서 열어주세요.</p>',
      '  <a class="wmp-external" target="_blank" rel="noopener noreferrer">YouTube에서 열기</a>',
      '  <div class="wmp-foot">',
      '    <div class="wmp-seek" title="눌러서 그 지점으로"><i></i></div>',
      '    <button class="wmp-vol" title="음소거" aria-label="음소거">🔊</button>',
      '  </div>',
      '</div>',
    ].join('\n');
    document.body.appendChild(el);
    frame = el.querySelector('.wmp-frame');
    // 유튜브 문서가 들어오면 인사를 한 번 더 시도합니다
    frame.referrerPolicy='strict-origin-when-cross-origin';

    const q = (s) => el.querySelector(s);
    dom = {
      play: q('.wmp-play'), state: q('.wmp-state'), time: q('.wmp-time'),
      track: q('.wmp-track'), vol: q('.wmp-vol'), seek: q('.wmp-seek i'),
    };
    q('.wmp-x').addEventListener('click', () => { AudioSys.sfx('close'); close(); });
    q('.wmp-size').addEventListener('click', () => {
      AudioSys.sfx('click');
      size = size === 'wide' ? 'mini' : 'wide';
      apply();
    });
    q('.wmp-play').addEventListener('click', () => {
      AudioSys.sfx('click');
      post(playing ? 'pauseVideo' : 'playVideo');
      // Playback state is updated by the actual YouTube player.
      // playing = !playing;            // 응답이 오기 전에도 버튼 표시가 바로 바뀌게
      render();
    });
    q('.wmp-prev').addEventListener('click', () => { AudioSys.sfx('click'); post('previousVideo'); });
    q('.wmp-next').addEventListener('click', () => { AudioSys.sfx('click'); post('nextVideo'); });
    q('.wmp-vol').addEventListener('click', () => {
      AudioSys.sfx('click');
      info.muted = !info.muted;
      post(info.muted ? 'mute' : 'unMute');
      render();
    });
    q('.wmp-seek').addEventListener('click', (e) => {
      if (!info.dur) return;
      const r = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      info.time = info.dur * ratio;
      post('seekTo', [info.time, true]);
      render();
    });

    // 제목줄을 잡고 옮길 수 있게 (방에서도, 웹사이트 안에서도)
    el.querySelector('.wmp-top').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = el.getBoundingClientRect();
      const off = { x: e.clientX - r.left, y: e.clientY - r.top };
      const move = (ev) => {
        el.classList.add('dragged');
        el.style.left = Math.max(2, Math.min(innerWidth - 60, ev.clientX - off.x)) + 'px';
        el.style.top = Math.max(2, Math.min(innerHeight - 40, ev.clientY - off.y)) + 'px';
      };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up);removeEventListener('pointercancel',up);removeEventListener('blur',up); };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);addEventListener('pointercancel',up);addEventListener('blur',up);
    });
  }

  function apply() {
    // hidden / dragged / playing 같은 다른 클래스는 건드리지 않습니다
    el.classList.remove('place-room', 'place-os', 'size-mini', 'size-wide');
    el.classList.add('place-' + place, 'size-' + size);
  }

  // ── LCD 갱신 ──
  function render() {
    if (!el || !dom) return;
    const track = info.title
      ? (info.author ? info.author + ' - ' + info.title : info.title)
      : (cur ? cur.title : 'SNG PLAYLIST');
    dom.play.textContent = playing ? '❙❙' : '▶';
    dom.state.textContent = !ready ? 'LOADING…' : playing ? '▶ PLAYING' : '❙❙ PAUSED';
    const message=el.querySelector('.wmp-message');message.hidden=!errorMessage;message.textContent=errorMessage;
    dom.time.textContent = clock(info.time);
    dom.track.textContent = track;
    dom.vol.textContent = info.muted ? '🔇' : '🔊';
    dom.seek.style.width = info.dur ? Math.min(100, info.time / info.dur * 100) + '%' : '0%';
    el.classList.toggle('playing', playing);   // 제목줄 이퀄라이저가 통통 튐
    el.title = track;
  }

  // ══════════════════════════════════════════
  //  켜기 / 끄기 / 세계 갈아타기
  // ══════════════════════════════════════════
  function load(key) {
    const list = listFor(key);
    if (!list) return false;
    cur = list;
    info.time = 0; info.dur = 0; info.title = ''; info.author = '';
    playing=false;heard=false;ready=false;errorMessage='';info.muted=AudioSys.isMuted();
    el.querySelector('.wmp-external').href='https://www.youtube.com/playlist?list='+encodeURIComponent(list.id);
    frame.hidden=false;
    for(const button of el.querySelectorAll('.wmp-pad button,.wmp-vol'))button.disabled=true;
    // A hosted bridge gives file:// previews the same working YouTube origin as the website.
    const url=new URL(location.protocol==='file:'?PUBLISHED_PLAYER:'playlist-player.html',location.href);
    frameOrigin=url.origin;url.searchParams.set('list',list.id);url.searchParams.set('volume',String(CONFIG.audio.playlistVolume));url.searchParams.set('muted',info.muted?'1':'0');
    AudioSys.suppressBGM(true);frame.src=url.href;
    render();
    return true;
  }

  function open(app, opt) {
    if (app) appRef = app;
    const key = (opt && opt.key) || appRef?.themeKey;
    if (!key) { Util.warn('player', '어느 세계의 재생목록인지 몰라서 열지 않았어요.'); return false; }
    build();
    if (!load(key)) return false;
    el.classList.remove('hidden');
    apply();
    return true;
  }

  function close() {
    if (!el) return;
    frame.src = 'about:blank';         // 소리까지 확실히 끕니다
    el.classList.add('hidden');
    el.classList.remove('playing');
    cur = null; playing = false; ready = false;
    clearInterval(hello); hello = null;
    clearInterval(ticker); ticker = null;
    AudioSys.suppressBGM(!!window.__COMPUTER_GAME_ACTIVE);       // 바로 기본 BGM 으로
    if (appRef) AudioSys.playBGM(appRef.themeKey);
  }

  const isOpen = () => !!(el && !el.classList.contains('hidden'));

  // 웹사이트(SNG:OS) 안으로 — 큰 창
  function enterOS(app) {
    if (app) appRef = app;
    build();
    place = 'os'; size = 'wide';
    el.classList.remove('dragged');
    el.style.left = el.style.top = '';
    apply();
  }
  // 3D 방으로 — 상단에 아주 작은 바 (음악은 계속 흐릅니다)
  // 세계가 바뀌면 그 세계의 재생목록으로 갈아탑니다
  function syncTheme() {
    if (!isOpen() || !appRef) return;
    if (cur && cur.key === appRef.themeKey) return;
    if (!load(appRef.themeKey)) close();
  }
  addEventListener('sng-theme-change', syncTheme);

  return {
    open, close, isOpen, enterOS, syncTheme, hasList,
    toggle(app) { if (isOpen()) { close(); return true; } return open(app); },
    setMuted(on) { if (!isOpen()) return; info.muted = !!on; post(on ? 'mute' : 'unMute'); render(); },
    title() { return cur ? cur.title : ''; },
  };
})();
