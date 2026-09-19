'use strict';
(() => {
  const A = window.PAINT_ASSETS;
  const W = 1280,
    H = 800;
  const root = document.querySelector('#computer');
  const { apps, toolNames, colors, icon } = buildDesktopUI(root, A, W, H);
  const recycleShaker = window.initRecycleShaker(root, A.junk);
  root.querySelector('.error-icon').innerHTML = icon('critical');
  const miniGames = window.initMiniGames();
  const resetFlyouts = window.bindStartFlyouts();
  const languageUI = window.initGameLanguage(root);
  const $ = (s) => root.querySelector(s),
    $$ = (s) => [...root.querySelectorAll(s)];
  const desktop = $('#desktop'),
    wall = $('#wall'),
    ink = $('#ink'),
    fx = $('#effects'),
    under = $('#underlay');
  const wc = wall.getContext('2d', { willReadFrequently: true }),
    ic = ink.getContext('2d', { willReadFrequently: true }),
    fc = fx.getContext('2d'),
    uc = under.getContext('2d');
  const cursor = $('#tool-cursor'),
    stickerLayer = $('#stickers-layer'),
    jellyCanvas = $('#jelly-surface'),
    jc = jellyCanvas.getContext('2d');
  let activeTool = 'chalk',
    color = colors[0],
    size = 10;
  let ready = false,
    muted = false,
    z = 30,
    stroke = null,
    selectedSticker = null,
    hammerFound = false,
    launches = 0;
  let exporting = false;
  let shimmerTimer = 0;
  let frame = 0,
    inTick = false,
    lastFrame = 0,
    lastBlow = 0,
    blowing = false,
    lastSound = 0,
    ac = null,
    noise = null;
  let particles = [],
    bubbles = [],
    jellies = [],
    stickerId = 0,
    toastTimer = 0;
  let history = [],
    future = [],
    historyBytes = 0,
    gallery = [],
    images = {},
    brushes = {},
    activeWindow = '';
  const revisions = { wall: 0, ink: 0 };
  let jellyId = 0,
    jellyDirty = false,
    wetMarks = [],
    lastWet = 0,
    eraserDirt = 0,
    eraserBursts = 0,
    eraserCooldown = 0,
    eraserLevel = -1;
  const eraserFrames = [];
  const gelRenderer = new SoftJellyRenderer();
  let lastChalkDust = 0;
  const MAX_HISTORY = 20 * 1024 * 1024,
    MAX_PARTICLES = 110,
    MAX_BUBBLES = 32,
    MAX_STICKERS = 100;
  // Initialize the audio device during the boot screen, not the first drawing gesture.
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      ac = window.XPSounds.context;
      noise = ac.createBuffer(1, ac.sampleRate * 0.06, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    }
  } catch {}
  const pxy = (e) => {
    const r = ink.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let pointer = { x: 0, y: 0 };
  const getWindow = (id) => $(`#${id}-window`);
  function notify(text) {
    if (!text.startsWith('사진이 저장')) window.XPSounds?.play('notify');
    clearTimeout(toastTimer);
    $('#toast').textContent = text;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => ($('#toast').hidden = true), 2300);
  }
  function sound(freq = 450, duration = 0.04, vol = 0.018, type = 'sine') {
    if (muted || performance.now() - lastSound < 45) return;
    lastSound = performance.now();
    try {
      if (!ac) ac = window.XPSounds.context;
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        Math.max(50, freq * 0.65),
        ac.currentTime + duration,
      );
      g.gain.setValueAtTime(Math.max(.025,Math.min(.055,vol)), ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
      o.connect(g);
      g.connect(window.XPSounds.output);
      o.start();
      o.stop(ac.currentTime + duration);
    } catch {}
  }
  function transparentEraserSound() {
    if (muted || performance.now() - lastSound < 120) return;
    lastSound = performance.now();
    try {
      if (!ac) ac = window.XPSounds.context;
      if (ac.state === 'suspended') ac.resume();
      if (!noise) {
        noise = ac.createBuffer(1, ac.sampleRate * 0.06, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
      }
      const s = ac.createBufferSource(),
        g = ac.createGain();
      s.buffer = noise;
      g.gain.value = 0.18;
      s.connect(g);
      g.connect(window.XPSounds.output);
      s.start();
      s.onended=()=>{s.disconnect();g.disconnect();};
    } catch {}
  }
  function chalkSound(){playToolSound('chalk');}
  // Cache short friction/impact sounds; normalize their energy before the shared compressor.
  const toolAudioCache=new Map(),toolAudioTimes=new Map();
  function playToolSound(kind){
    if(muted)return;
    const now=performance.now(),interval={chalk:100,glitter:240,tap:110,sticker:70,cut:90}[kind];
    if(now-(toolAudioTimes.get(kind)||-1000)<interval)return;
    toolAudioTimes.set(kind,now);
    if(!ac)ac=window.XPSounds.context;if(ac.state==='suspended')ac.resume();
    let buffer=toolAudioCache.get(kind);
    if(!buffer){
      const duration={chalk:.115,glitter:.36,tap:.095,sticker:.055,cut:.14}[kind],sr=ac.sampleRate;
      buffer=ac.createBuffer(1,Math.ceil(duration*sr),sr);const samples=buffer.getChannelData(0);let low=0,previous=0,sum=0,peak=0;
      for(let i=0;i<samples.length;i++){
        const t=i/sr,u=t/duration,n=Math.random()*2-1;low+=.10*(n-low);let v=0;
        if(kind==='chalk')v=(n-previous)*.30*Math.sin(Math.PI*u)*Math.exp(-u*1.5)+Math.sin(2*Math.PI*1100*t)*.13*Math.exp(-t*100);
        if(kind==='cut')v=(n-low)*.30*Math.sin(Math.PI*u)*( .8+.2*Math.sin(2*Math.PI*45*t));
        if(kind==='tap')v=low*2.4*Math.min(1,t/.003)*Math.exp(-t*48);
        if(kind==='sticker')v=((n-low)*.16*Math.exp(-t*230)+(Math.sin(2*Math.PI*980*t)*.30+Math.sin(2*Math.PI*1730*t)*.10)*Math.exp(-t*110))*Math.min(1,t/.0015);
        if(kind==='glitter')for(let k=0;k<4;k++){const z=t-k*.045;if(z>=0)v+=Math.sin(2*Math.PI*[1568,2093,2637,3136][k]*z)*Math.min(1,z/.012)*Math.exp(-z*18)*.13;}
        previous=n;samples[i]=v;sum+=v*v;peak=Math.max(peak,Math.abs(v));
      }
      const gain=Math.min((kind==='sticker'?.019:kind==='glitter'?.022:.03)/Math.sqrt(sum/samples.length),.22/Math.max(.001,peak));
      for(let i=0;i<samples.length;i++)samples[i]*=gain;toolAudioCache.set(kind,buffer);
    }
    const source=ac.createBufferSource();source.buffer=buffer;source.connect(window.XPSounds.output);source.start();source.onended=()=>source.disconnect();
  }
  function toggleSound() {
    muted = !muted;
    $('#sound').classList.toggle('muted', muted);
    window.XPSounds?.setMuted(muted);
    $('#sound').setAttribute('aria-pressed', String(muted));
    $('#sound').title = muted ? '소리 켜기' : '소리 끄기';
    $('#sound').setAttribute('aria-label', $('#sound').title);
    if (ac) muted ? ac.suspend() : ac.resume();
    markSessionChanged();
  }
  function focusWindow(el) {
    if (!el || el.hidden) return;
    if(el.dataset.app!=='ad'&&!el.classList.contains('maximized')){
      el.style.left=clamp(el.offsetLeft,0,Math.max(0,desktop.clientWidth-el.offsetWidth))+'px';
      el.style.top=clamp(el.offsetTop,0,Math.max(0,desktop.clientHeight-el.offsetHeight))+'px';
    }
    z++;
    if (z > 400) {
      z = 40;
      $$('.window').forEach((w, i) => (w.style.zIndex = 30 + i));
    }
    $$('.window').forEach((w) => w.classList.toggle('inactive', w !== el));
    el.style.zIndex = z;
    activeWindow = el.dataset.app;
    $$('.task').forEach((b) => b.classList.toggle('active', b.dataset.task === activeWindow));
  }
  function positionWindow(el, id) {
    const dw = desktop.clientWidth,
      dh = desktop.clientHeight;
    const small = dw < 650;
    let x, y;
    if (id === 'tools') {
      x = small ? dw - 258 : dw * 0.35;
      y = small ? 44 : dh * 0.2;
      el.style.width = small ? '250px' : '286px';
    } else if (id === 'mines') {
      el.style.width = Math.min(matchMedia('(pointer:coarse)').matches ? 246 : 156, dw - 16) + 'px';
      x = small ? 8 : 70;
      y = small ? 75 : 60;
    } else if (id === 'ad') {
      x = dw - (small ? 192 : 250);
      y = dh - (small ? 207 : 235);
      el.style.width = small ? '184px' : '238px';
    } else {
      x = small ? 8 : dw * 0.29 + Object.keys(apps).indexOf(id) * 9;
      y = small ? 75 : dh * 0.18;
    }
    if (small && !['tools', 'ad', 'error', 'mines'].includes(id)) el.style.width = 'calc(100% - 16px)';
    el.style.left = clamp(x, 0, Math.max(0, dw - el.offsetWidth)) + 'px';
    el.style.top = clamp(y, 0, Math.max(0, dh - Math.min(el.offsetHeight, dh))) + 'px';
    el.dataset.positioned = '1';
  }
  function open(id) {
    if (id === 'bot') {
      toggleBot();
      return;
    }
    if (id === 'capture') {
      photo();
      return;
    }
    if (id === 'secret') {
      launchGame();
      return;
    }
    const el = getWindow(id);
    if (!el) return;
    el.hidden = false;
    if (id === 'settings') languageUI.sync();
    if (id === 'recycle') recycleShaker.open();
    if (!el.dataset.positioned) positionWindow(el, id);
    focusWindow(el);
    if (!$(`[data-task="${id}"]`)) {
      const b = document.createElement('button');
      b.className = 'task';
      b.dataset.task = id;
      b.innerHTML =
        icon(apps[id]?.icon || 'network') +
        `<span>${apps[id]?.name || (id === 'ad' ? '전단지' : '소녀의 방.exe')}</span>`;
      b.addEventListener('click', () => {
        if (el.hidden) {
          el.hidden = false;
          focusWindow(el);
        } else if (activeWindow === id) minimize(id);
        else focusWindow(el);
      });
      $('#tasks').append(b);
    }
    focusWindow(el);
    hideStart();
    cursor.style.display = 'none';
  }
  function minimize(id) {
    const el = getWindow(id);
    el.hidden = true;
    $(`[data-task="${id}"]`)?.classList.remove('active');
    if (activeWindow === id) activeWindow = '';
  }
  function close(id) {
    minimize(id);
    $(`[data-task="${id}"]`)?.remove();
  }
  function hideStart() {
    resetFlyouts();
    $('#start-menu').hidden = true;
    $('#start').classList.remove('active');
  }
  function setTool(tool) {
    if (stroke) endStroke();
    $('.colors').hidden = tool !== 'chalk';
    activeTool = tool;
    root.dataset.tool = tool || '';
    $$('#tools-window [data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === tool);
      b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    });
    cursor.src =
      tool === 'eraser' ? eraserFrames[eraserLevel] || A.tools.eraser : A.tools[tool] || '';
    cursor.className = tool || '';
    ink.style.cursor = tool === 'jelly' ? 'grab' : !tool || tool === 'stickers' ? 'default' : 'none';
    cursor.style.display = 'none';
    if (tool === 'stickers') {
      renderPalette();
      open('stickers');

    }
    hideStart();
  }
  let errorSerial = 0;
  function stackError() {
    const original = getWindow('error');
    if (original.hidden) return;
    const copies = $$('.error-copy');
    if (copies.length >= 9) copies[0].remove();
    const copy = original.cloneNode(true);
    copy.id = 'error-copy-' + ++errorSerial;
    copy.dataset.app = copy.id;
    copy.classList.add('error-copy');
    copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    copy.querySelectorAll('[data-win]').forEach((n) => {
      if (n.dataset.win !== 'close') n.remove();
    });
    copy.querySelectorAll('button').forEach((n) =>
      n.addEventListener('click', () => {
        if (n.textContent === '다시 시도' || n.textContent === 'Retry') {
          if (hammerFound) {
            stackError();
            open('error');
          } else launchGame();
        } else copy.remove();
      }),
    );
    copy.style.left =
      clamp(original.offsetLeft - 22, 5, desktop.clientWidth - copy.offsetWidth) + 'px';
    copy.style.top = clamp(original.offsetTop - 24, 5, desktop.clientHeight - 170) + 'px';
    desktop.append(copy);
    copy.style.zIndex = ++z;
    original.style.left =
      clamp(original.offsetLeft + 12, 5, Math.max(5, desktop.clientWidth - original.offsetWidth)) +
      'px';
    original.style.top =
      clamp(original.offsetTop + 15, 5, Math.max(5, desktop.clientHeight - original.offsetHeight)) +
      'px';
  }
  function launchGame() {
    if (hammerFound) {window.XPSounds?.play('chord');return;}
    stackError();
    launches++;
    const el = $('.desktop-icon[data-open="secret"]');
    shakeScreen({
      x: (el.offsetLeft / desktop.clientWidth) * W + 32,
      y: (el.offsetTop / desktop.clientHeight) * H + 32,
    });
    el.classList.remove('burst');
    void el.offsetWidth;
    el.classList.add('burst');

    if (launches < 6) {
      $('#error-message').textContent = [
        '응용 프로그램을 제대로 초기화하지 못했습니다(0xc0000142).\n응용 프로그램을 종료하려면 확인을 클릭하십시오.',
        '소녀의 방.exe에 문제가 발생하여 프로그램을 종료해야 합니다.\n불편을 끼쳐드려서 죄송합니다.',
        '지정된 장치, 경로 또는 파일에 액세스할 수 없습니다.\n이 항목에 액세스할 수 있는 권한이 없는 것 같습니다.',
        '0x00401000에 있는 명령이 0x00000000의 메모리를 참조했습니다. 메모리는 read될 수 없습니다.\n프로그램을 마치려면 확인을 클릭하십시오.',
        '으아아 나컴퓨터가이상해',
      ][launches - 1];
      open('error');
      window.XPSounds?.play('critical');
    } else {
      hammerFound = true;
      unlockHammer();
      setTool('hammer');
      $$('.error-copy').forEach((el) => el.remove());
      close('error');
      open('prize');
      lastSound = 0;
      window.XPSounds?.play('tada');
    }
    markSessionChanged();
  }
  function unlockHammer() {
    $('#tools-window [data-tool="hammer"]').classList.remove('locked');
    const el = $('.desktop-icon[data-open="secret"]');
    el.innerHTML = '<img class="xp-icon" src="' + A.gameAfter + '" alt=""><span>' + apps.secret.name + '</span>';
    el.disabled = false;
  }

  function fitWindowZoom(el){
    const w=parseFloat(el.style.getPropertyValue('--zoom-width')),h=parseFloat(el.style.getPropertyValue('--zoom-height'));
    const scale=Math.min(2,(desktop.clientWidth-4)/w,(desktop.clientHeight-4)/h);
    el.style.setProperty('--window-scale',scale);
    el.style.setProperty('--zoom-left',clamp(parseFloat(el.style.left)||0,0,Math.max(0,desktop.clientWidth-w*scale))+'px');
    el.style.setProperty('--zoom-top',clamp(parseFloat(el.style.top)||0,0,Math.max(0,desktop.clientHeight-h*scale))+'px');
  }
  function toggleWindowZoom(el){
    if(el.classList.contains('maximized')){el.classList.remove('maximized');return;}
    el.style.setProperty('--zoom-width',el.offsetWidth+'px');el.style.setProperty('--zoom-height',el.offsetHeight+'px');
    fitWindowZoom(el);el.classList.add('maximized');
  }
  function wireWindow(el) {
    const handle = el.querySelector('.titlebar');
    let drag = null;
    el.addEventListener('pointerdown', () => focusWindow(el));
    handle?.addEventListener('dblclick', (e) => {
      if (el.dataset.app !== 'ad' && el.dataset.app !== 'error' && !e.target.closest('button'))
        toggleWindowZoom(el);
    });
    handle?.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button') || el.classList.contains('maximized'))
        return;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: el.offsetLeft,
        top: el.offsetTop,
      };
      handle.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      e.preventDefault();
    });
    handle?.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      el.style.left =
        clamp(
          drag.left + e.clientX - drag.x,
          0,
          Math.max(0, desktop.clientWidth - el.offsetWidth),
        ) + 'px';
      el.style.top =
        clamp(drag.top + e.clientY - drag.y, 0, Math.max(0, desktop.clientHeight - 30)) + 'px';
    });
    const end = (e) => {
      if (!drag) return;
      if (handle.hasPointerCapture(drag.id)) handle.releasePointerCapture(drag.id);
      drag = null;
      el.classList.remove('dragging');
    };
    handle?.addEventListener('pointerup', end);
    handle?.addEventListener('pointercancel', end);
    el.querySelectorAll('[data-win]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.win === 'close') close(el.dataset.app);
        else if (b.dataset.win === 'min') minimize(el.dataset.app);
        else {
          toggleWindowZoom(el);
          focusWindow(el);
        }
      }),
    );
  }
  function wireIcon(el) {
    let drag = null,
      lastTap = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: el.offsetLeft,
        top: el.offsetTop,
        moved: false,
      };
      el.setPointerCapture(e.pointerId);
      $$('.desktop-icon').forEach((i) => i.classList.toggle('selected', i === el));
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (!drag.moved) return;
      el.style.left = clamp(drag.left + dx, 0, desktop.clientWidth - el.offsetWidth) + 'px';
      el.style.top = clamp(drag.top + dy, 0, desktop.clientHeight - el.offsetHeight) + 'px';
      el.classList.add('dragging');
    });
    el.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const moved = drag.moved;
      el.classList.remove('dragging');
      if (el.hasPointerCapture(drag.id)) el.releasePointerCapture(drag.id);
      drag = null;
      if (!moved) {
        const now = performance.now();
        if (
          ['capture', 'bot'].includes(el.dataset.open) ||
          e.pointerType === 'touch' ||
          now - lastTap < 420
        ) {
          lastTap = 0;
          open(el.dataset.open);
        } else lastTap = now;
      } else markSessionChanged();
    });
    el.addEventListener('pointercancel', () => {
      drag = null;
      el.classList.remove('dragging');
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(el.dataset.open);
      }
    });
  }

  // History stores only the changed rectangle, with a strict retained byte budget.
  function beginPixels(layer) {
    return { kind: 'pixels', layer, tiles: new Map(), bounds: null };
  }
  function touch(x, y, r) {
    if (!stroke?.action) return;
    const a = stroke.action;
    if (a.kind !== 'pixels') return;
    const b = {
      x: Math.max(0, Math.floor(x - r)),
      y: Math.max(0, Math.floor(y - r)),
      r: Math.min(W, Math.ceil(x + r)),
      b: Math.min(H, Math.ceil(y + r)),
    };
    if (!a.bounds) a.bounds = b;
    else {
      a.bounds.x = Math.min(a.bounds.x, b.x);
      a.bounds.y = Math.min(a.bounds.y, b.y);
      a.bounds.r = Math.max(a.bounds.r, b.r);
      a.bounds.b = Math.max(a.bounds.b, b.b);
    }
    const c = a.layer === 'wall' ? wc : ic;
    for (let yy = Math.floor(b.y / 64) * 64; yy < b.b; yy += 64)
      for (let xx = Math.floor(b.x / 64) * 64; xx < b.r; xx += 64) {
        const key = yy * W + xx;
        if (!a.tiles.has(key))
          a.tiles.set(key, {
            x: xx,
            y: yy,
            pixels: c.getImageData(xx, yy, Math.min(64, W - xx), Math.min(64, H - yy)),
          });
      }
  }
  function finishPixels(a) {
    if (!a?.bounds) return;
    if(a.layer === 'wall'){revisions.wall++;return;}
    const b = a.bounds,
      w = b.r - b.x,
      h = b.b - b.y;
    if (w < 1 || h < 1) return;
    const after = (a.layer === 'wall' ? wc : ic).getImageData(b.x, b.y, w, h),
      before = new ImageData(new Uint8ClampedArray(after.data), w, h);
    for (const t of a.tiles.values()) {
      const left = Math.max(b.x, t.x),
        right = Math.min(b.r, t.x + t.pixels.width),
        top = Math.max(b.y, t.y),
        bottom = Math.min(b.b, t.y + t.pixels.height);
      for (let y = top; y < bottom; y++) {
        const src = ((y - t.y) * t.pixels.width + left - t.x) * 4;
        before.data.set(
          t.pixels.data.subarray(src, src + (right - left) * 4),
          ((y - b.y) * w + left - b.x) * 4,
        );
      }
    }
    pushHistory({
      kind: 'pixels',
      layer: a.layer,
      x: b.x,
      y: b.y,
      before,
      after,
      decorations: a.decorations
        ? { before: a.decorations, after: captureDecorations(!!a.decorations.soap) }
        : null,
      bytes:
        before.data.byteLength +
        after.data.byteLength +
        (a.decorations?.soap ? W * H * 8 : 0) +
        (a.decorations ? 8192 : 0),
    });
  }
  function pushHistory(a) {
    if (a.kind === 'pixels') revisions[a.layer]++;
    else if (a.kind === 'reset') {
      revisions.wall++;
      revisions.ink++;
    }
    history.push(a);
    historyBytes += a.bytes || 0;
    future = [];
    while (historyBytes > MAX_HISTORY || history.length > 35) {
      historyBytes -= history.shift().bytes || 0;
    }
    updateUndo();
    markSessionChanged();
  }
  function updateUndo() {
    // Undo/redo remain available through keyboard shortcuts.

  }
  function applyAction(a, redo) {
    if (a.peelsBefore) {
      peeledSlots = new Set(redo ? a.peelsAfter : a.peelsBefore);
      refreshPeels();
    }
    if (a.kind === 'peels') {
      peeledSlots = new Set(redo ? a.after : a.before);
      refreshPeels();
    }
    if (a.decorations) {
      const d = redo ? a.decorations.after : a.decorations.before;
      restoreStickers(d.stickers);
      peeledSlots = new Set(d.peels || []);
      refreshPeels();
      restoreJellies(d.jellies);
      if (d.soap) sc.putImageData(d.soap, 0, 0);
      bubbles = [];
      wetMarks = [];
    }
    if (a.kind === 'pixels') {
      (a.layer === 'wall' ? wc : ic).putImageData(redo ? a.after : a.before, a.x, a.y);
      revisions[a.layer]++;
    } else if (a.kind === 'jellies') restoreJellies(redo ? a.after : a.before);
    else if (a.kind === 'stickers') restoreStickers(redo ? a.after : a.before);
    else if (a.kind === 'reset') {
      peeledSlots = new Set((redo ? a.after : a.before).peels || []);
      refreshPeels();
      // Hammer damage persists until a restart, including through undo.
      ic.putImageData(redo ? a.after.ink : a.before.ink, 0, 0);
      restoreStickers(redo ? a.after.stickers : a.before.stickers);
      restoreJellies((redo ? a.after.jellies : a.before.jellies) || []);
      eraserDirt = (redo ? a.after.eraserDirt : a.before.eraserDirt) || 0;
      updateEraser();
      wetMarks = [];
      if ((redo ? a.after : a.before).soap) sc.putImageData((redo ? a.after : a.before).soap, 0, 0);
      else sc.clearRect(0, 0, W, H);
      soapCount = (redo ? a.after : a.before).soapCount || 0;
      fc.clearRect(0, 0, W, H);
      revisions.wall++;
      revisions.ink++;
    }
    markSessionChanged();
  }
  function undo() {
    endStroke();
    if (!history.length) return;
    const a = history.pop();
    historyBytes -= a.bytes || 0;
    applyAction(a, false);
    future.push(a);
    updateUndo();
  }
  function redo() {
    endStroke();
    if (!future.length) return;
    const a = future.pop();
    applyAction(a, true);
    history.push(a);
    historyBytes += a.bytes || 0;
    updateUndo();
  }
  const stickerSizes = A.stickers.map(s=>s.size||80);
  let peeledSlots = new Set();
  function refreshPeels() {
    $$('.sticker-pick').forEach((el) => {
      const used = peeledSlots.has(Number(el.dataset.index));
      el.classList.toggle('peeled', used);
      el.setAttribute(
        'aria-label',
        A.stickers[Number(el.dataset.index)].name + (used ? ' · 지우개로 자국 지우기' : ' 스티커'),
      );
    });
  }
  function captureStickers() {
    return [...stickerLayer.children].map((el) => ({
      id: el.dataset.id,
      index: Number(el.dataset.index),
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      size: parseFloat(el.style.getPropertyValue('--size')),
      turn: parseFloat(el.style.getPropertyValue('--turn')) || 0,
    }));
  }
  function restoreStickers(items) {
    stickerLayer.replaceChildren();
    selectedSticker = null;
    for (const item of items.slice(0, MAX_STICKERS)) makeSticker(item);
  }
  function makeSticker(item) {
    const def = A.stickers[item.index];
    if (!def) return;
    const el = document.createElement('button');
    el.className =
      'placed' + (def.cutout ? ' cutout' : item.index >= 2 && item.index <= 5 ? ' round' : '');
    el.dataset.id = item.id || String(++stickerId);
    el.dataset.index = item.index;
    el.title = '드래그 이동 · Delete 삭제';
    el.setAttribute('aria-label', def.name + ' 스티커');
    el.style.left = item.x + '%';
    el.style.top = item.y + '%';
    el.style.setProperty('--size', item.size + 'px');
    el.style.setProperty('--turn', (item.turn || 0) + 'deg');
    const im = new Image();
    im.src = def.src;
    im.alt = def.name;
    el.append(im);
    stickerLayer.append(el);
    wirePlaced(el);
    return el;
  }
  function addSticker(index, x, y) {
    if (stickerLayer.childElementCount >= MAX_STICKERS) {
      notify('스티커는 한 화면에 100장까지 붙일 수 있습니다.');
      return;
    }
    if (peeledSlots.has(index)) return;
    const before = captureStickers(),
      peelsBefore = [...peeledSlots];
    peeledSlots.add(index);
    refreshPeels();
    const r = desktop.getBoundingClientRect();
    makeSticker({
      index,
      x: clamp(x, 3, 97),
      y: clamp(y, 3, 97),
      size: stickerSizes[index],
      turn: 0,
    });
    pushHistory({
      kind: 'stickers',
      before,
      after: captureStickers(),
      peelsBefore,
      peelsAfter: [...peeledSlots],
      bytes: 4096,
    });
    playToolSound('sticker');
  }
  function wirePlaced(el) {
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      selectedSticker = el;
      $$('.placed').forEach((s) => s.classList.toggle('selected', s === el));
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        ox: parseFloat(el.style.left),
        oy: parseFloat(el.style.top),
        before: captureStickers(),
        moved: false,
      };
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      el.style.left = clamp(drag.ox + (dx / desktop.clientWidth) * 100, 2, 98) + '%';
      el.style.top = clamp(drag.oy + (dy / desktop.clientHeight) * 100, 2, 98) + '%';
    });
    el.addEventListener('pointerup', (e) => {
      if (!drag) return;
      if (!drag.moved) {
        el.style.setProperty(
          '--turn',
          (((parseFloat(el.style.getPropertyValue('--turn')) || 0) + 15) % 360) + 'deg',
        );
      }
      const before = drag.before;
      el.classList.remove('dragging');
      if (el.hasPointerCapture(drag.id)) el.releasePointerCapture(drag.id);
      drag = null;
      pushHistory({
        kind: 'stickers',
        before,
        after: captureStickers(),
        bytes: 4096,
      });
    });
    el.addEventListener('pointercancel', () => {
      el.classList.remove('dragging');
      if (drag) {
        const before = drag.before;
        drag = null;
        restoreStickers(before);
      }
    });
  }
  function renderPalette() {
    $('#sticker-status').textContent = A.stickers.length + '개 항목';
    $('#sticker-grid').innerHTML = A.stickers
      .map(
        (item, i) =>
          '<button class="sticker-pick ' +
          (item.cutout ? 'cutout' : '') +
          '" data-index="' +
          i +
          '" title="' +
          item.name +
          '" aria-label="' +
          item.name +
          '"><img src="' +
          item.src +
          '" alt=""></button>',
      )
      .join('');
    $$('.sticker-pick').forEach((el,i)=>{const [x,y,w,h]=A.stickers[i].layout;el.style.cssText=`left:${x}%;top:${y}%;width:${w}%;height:${h}%;`;wireSource(el);});
    refreshPeels();
  }
  function wireSource(el) {
    let drag = null;
    const wipe = () => {
      const index = Number(el.dataset.index);
      if (activeTool !== 'eraser' || !peeledSlots.has(index)) return;
      const before = [...peeledSlots];
      peeledSlots.delete(index);
      refreshPeels();
      pushHistory({ kind: 'peels', before, after: [...peeledSlots], bytes: 256 });
      materialSound('eraser');
    };
    el.addEventListener('pointermove', (e) => {
      if (activeTool === 'eraser' && e.buttons === 1) wipe();
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (activeTool === 'eraser' && peeledSlots.has(Number(el.dataset.index))) {
        wipe();
        return;
      }
      if (peeledSlots.has(Number(el.dataset.index))) return;
      const ghost = new Image();
      ghost.src = A.stickers[Number(el.dataset.index)].src;
      ghost.className = 'ghost';
      ghost.style.width = stickerSizes[Number(el.dataset.index)] + 'px';
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
      root.append(ghost);
      el.classList.add("peeling");
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, ghost };
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      drag.moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5;
      drag.ghost.style.left = e.clientX + 'px';
      drag.ghost.style.top = e.clientY + 'px';
    });
    el.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const r = desktop.getBoundingClientRect(),
        inside =
          e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
      drag.ghost.remove();
      el.classList.remove("peeling");
      if (el.hasPointerCapture(drag.id)) el.releasePointerCapture(drag.id);
      if (
        inside &&
        drag.moved &&
        !document.elementFromPoint(e.clientX, e.clientY)?.closest('.window,#icons,#taskbar')
      )
        addSticker(
          Number(el.dataset.index),
          ((e.clientX - r.left) / r.width) * 100,
          ((e.clientY - r.top) / r.height) * 100,
        );

      drag = null;
    });
    el.addEventListener('pointercancel', () => {
      drag?.ghost.remove();
      el.classList.remove("peeling");
      drag = null;
    });
  }

  function buildBrushes() {
    for (const c of colors) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 48;
      const g = cv.getContext('2d');
      let seed = 181;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      g.fillStyle = c;
      for (let i = 0; i < 850; i++) {
        const x = rand() * 48,
          y = rand() * 48,
          d = Math.hypot(x - 24, y - 24) / 24;
        if (d > 1) continue;
        g.globalAlpha = (1 - d) * (0.25 + rand() * 0.70);
        g.fillRect(x, y, 0.6 + rand() * 1.4, 0.6 + rand() * 1.6);
      }
      brushes[c] = cv;
    }
  }
  function line(from, to, step, cb) {
    const d = Math.hypot(to.x - from.x, to.y - from.y),
      n = Math.min(250, Math.max(1, Math.ceil(d / step)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      cb(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, i);
    }
  }
  function paintDecorPen(from, to, kind) {
    if(kind==='gem') sound(920+Math.random()*180,.075,.055,'sine');else materialSound('photo');
    DecorPens.paint(ic, from, to, size, kind, stroke, touch);
  }
  let checkerPattern;
  function paintExtra(from, to, kind) {
    materialSound(kind);
    ic.save();
    ic.globalAlpha = 1;
    ic.globalCompositeOperation = 'source-over';
    if (kind === 'checker') {
      if (!checkerPattern) {
        const tile = document.createElement('canvas'); tile.width = tile.height = 20;
        const ctx = tile.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 20, 20);
        ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, 10, 10); ctx.fillRect(10, 10, 10, 10);
        checkerPattern = ic.createPattern(tile, 'repeat');
      }
      const radius = Math.max(12, size * 1.3);
      ic.fillStyle = checkerPattern;
      line(from, to, Math.max(1, radius / 4), (x, y) => {
        touch(x, y, radius + 2); ic.beginPath(); ic.arc(x, y, radius, 0, Math.PI * 2); ic.fill();
      });
    } else {
      // Integer-grid Bresenham rasterization: opaque square pixels, no smooth path edges.
      const pixel = 3;
      let x = Math.floor(from.x / pixel), y = Math.floor(from.y / pixel);
      const endX = Math.floor(to.x / pixel), endY = Math.floor(to.y / pixel);
      const dx = Math.abs(endX-x), dy = -Math.abs(endY-y), sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
      let error = dx + dy;
      ic.fillStyle = '#050505'; ic.imageSmoothingEnabled = false;
      for (let guard = 0; guard < 2000; guard++) {
        touch(x * pixel, y * pixel, pixel + 2); ic.fillRect(x * pixel, y * pixel, pixel, pixel);
        if (x === endX && y === endY) break;
        const e = error * 2; if (e >= dy) { error += dy; x += sx; } if (e <= dx) { error += dx; y += sy; }
      }
    }
    ic.restore();
  }
  function paintChalk(from, to) {
    if (stroke?.kind === 'chalk') {
      stroke.copyPoints ??= [from];
      if (stroke.copyPoints.length < 160) stroke.copyPoints.push(to);
    }
    const r = size * 0.72;
    ic.save();
    ic.globalAlpha = 0.88;
    line(from, to, Math.max(1, size * 0.18), (x, y) => {
      touch(x, y, r + 3);
      ic.drawImage(brushes[color], x - r, y - r, r * 2, r * 2);
    });
    ic.restore();
    if (performance.now() - lastChalkDust > 65) {
      lastChalkDust = performance.now();
      for (let i = 0; i < 2; i++) {
        if (particles.length >= MAX_PARTICLES) particles.shift();
        particles.push({
          x: to.x + (Math.random() - 0.5) * size,
          y: to.y,
          vx: (Math.random() - 0.5) * 10,
          vy: 12 + Math.random() * 12,
          life: 0.5 + Math.random() * 0.4,
          size: 0.7 + Math.random(),
          color,
        });
      }
      kick();
    }
    chalkSound();
  }
  const MAX_JELLIES = 7,
    MAX_WET_MARKS = 80;
  const refractSource = document.createElement('canvas');
  refractSource.width = W;
  refractSource.height = H;
  const rg = refractSource.getContext('2d');
  let refractionKey = '',
    soapMarks = [],
    eraserBeat = null,
    totalPops = 0;
  function captureJellies() {
    return jellies.map((j) => ({
      id: j.id,
      modelIndex: j.modelIndex,
      upright: j.upright,
      ax: j.ax,
      ay: j.ay,
      size: j.size,
      angle: j.angle || 0,
      seed: j.seed,
      lobes: j.lobes,
      exponent: j.exponent,
    }));
  }
  function restoreJellies(items) {
    jellies = items.slice(-MAX_JELLIES).map((j) => ({
      ...j,
      x: j.ax,
      y: j.ay,
      vx: 0,
      vy: 0,
      phase: 'sleep',
      squash: 0,
      wobble: 0,
      height: 0,
    }));
    jellyDirty = true;
    renderJellies();
  }
  const jellyLiquidColors = ['#20aacf', '#ec4b9b', '#70bb20', '#ed5964', '#ec963b'];
  function wetMark(p, r = 4, j, vx = 0, vy = 0) {
    if (wetMarks.length >= MAX_WET_MARKS) wetMarks.shift();
    wetMarks.push({ x:p.x, y:p.y, r, color:jellyLiquidColors[j?.modelIndex ?? 0], vx, vy,
      born:performance.now(), duration:1800+Math.random()*900 });
    kick();
  }
  function wetSplash(j) {
    // A few small beads spread from the contact point, then cling to the glass.
    const sx=desktop.clientWidth/W, sy=desktop.clientHeight/H;
    for(let i=0;i<6;i++) {
      const a=Math.random()*Math.PI*2, d=j.size*(.25+Math.random()*.16);
      wetMark({x:j.ax+Math.cos(a)*d/sx,y:j.ay+Math.sin(a)*d*.65/sy},
        1.8+Math.random()*2.7,j,Math.cos(a)*(12+Math.random()*18),Math.sin(a)*12-8);
    }
  }
  function drawWetMarks(g, now) {
    const sx=desktop.clientWidth/W,sy=desktop.clientHeight/H;
    for(const m of wetMarks){
      const age=(now-m.born)/1000,left=1-age*1000/m.duration;
      if(left<=0)continue;
      const travel=(1-Math.exp(-age*8))/8;
      g.save();g.scale(1/sx,1/sy);g.translate(m.x*sx+m.vx*travel,m.y*sy+m.vy*travel+Math.min(3,age*1.3));
      g.globalAlpha=.48*Math.min(1,left*3);
      const gradient=g.createRadialGradient(-m.r*.3,-m.r*.35,0,0,0,m.r);
      gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.28,m.color);gradient.addColorStop(1,m.color+'55');
      g.fillStyle=gradient;g.beginPath();g.arc(0,0,m.r,0,Math.PI*2);g.fill();g.restore();
    }
  }
  function landJelly(j) {
    j.phase = 'roll';
    j.height = 0;
    j.squash = 1;
    j.wobble = 1;
    j.vx = (Math.random() > 0.5 ? 1 : -1) * (100 + Math.random() * 80);
    j.vy = 35 + Math.random() * 60;
    wetSplash(j);
    lastSound = 0;
    materialSound('splat');
  }
  function grabJelly(p) {
    ink.style.cursor = 'grabbing';
    cursor.style.display = 'none';
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H,
      before = captureJellies();
    let j = [...jellies]
      .reverse()
      .find(
        (j) =>
          Math.hypot((p.x - j.x) * sx, (p.y - j.y) * sy) < j.size * 0.62 ||
          Math.hypot((p.x - j.ax) * sx, (p.y - j.ay) * sy) < j.size * 0.62,
      );
    if (!j) {
      if (jellies.length >= MAX_JELLIES) jellies.shift();
      const s = Math.min(160 + size * 2, desktop.clientWidth * 0.46);
      j = {
        id: ++jellyId,
        modelIndex: [0,1,2,3,4,1][(jellyId-1)%6],
        upright: (jellyId-1)%6===5,
        ax: p.x,
        ay: p.y,
        x: p.x,
        y: p.y,
        size: s,
        vx: 0,
        vy: 0,
        height: Math.max(380, p.y * sy + s),
        fallSpeed: 0,
        fallDelay: .34,
        phase: 'fall',
        squash: 0,
        wobble: 0,
        angle: 0,
        seed: Math.random() * 6.28,
        lobes: 3 + Math.floor(Math.random() * 4),
        exponent: 0.72 + Math.random() * 0.55,
        pull: 0,
      };
      jellies.push(j);
    } else if (j.phase !== 'fall') {
      j.gripX = clamp((p.x - j.ax) * sx / (j.size * .5), -.85, .85);
      j.gripY = clamp((p.y - j.ay) * sy / (j.size * .5), -.85, .85);
      j.phase = 'held';
      j.vx = j.vy = 0;
      j.height = 0;
    }
    stroke.jelly = j;
    stroke.jellyLandingOnly = j.phase === 'fall';
    stroke.jellyBefore = before;
    stroke.grabPoint = { ...p };
    stroke.jellyMoved = false;
    stroke.dragTime = performance.now();
    stroke.dragVelocity = { x: 0, y: 0 };
    jellyDirty = true;
    kick();
  }
  function stretchJelly(p) {
    const j = stroke.jelly;
    if (!j || j.phase === 'fall' || stroke.jellyLandingOnly) return;
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H;
    if (
      !stroke.jellyMoved &&
      Math.hypot((p.x - stroke.grabPoint.x) * sx, (p.y - stroke.grabPoint.y) * sy) < 4
    )
      return;
    const now = performance.now(),
      dt = Math.max(0.016, (now - stroke.dragTime) / 1000);
    stroke.dragVelocity = {
      x: clamp(((p.x - stroke.last.x) * sx) / dt, -1100, 1100),
      y: clamp(((p.y - stroke.last.y) * sy) / dt, -1100, 1100),
    };
    stroke.dragTime = now;
    stroke.jellyMoved = true;
    j.phase = 'stretch';
    materialSound('stretch');
    j.height = 0;
    const dx = (p.x - stroke.grabPoint.x) * sx,
      dy = (p.y - stroke.grabPoint.y) * sy,
      l = Math.hypot(dx, dy),
      f = Math.min(1, (j.size * .42) / (l || 1));
    j.tx = j.ax + (dx * f) / sx;
    j.ty = j.ay + (dy * f) / sy;
    if (now - lastWet > 280) {
      const contact={x:j.ax+(j.tx-j.ax)*.6,y:j.ay+(j.ty-j.ay)*.6};
      wetMark(contact, 1.5 + Math.random() * 1.8, j);
      lastWet = now;
    }
    jellyDirty = true;
    kick();
  }
  function releaseJelly(done) {
    ink.style.cursor = activeTool === 'jelly' ? 'grab' : activeTool === 'stickers' ? 'default' : 'none';
    const j = done.jelly;
    if (!j) return;
    if (done.jellyMoved) {
      j.pull = Math.hypot(
        ((j.x - j.ax) * desktop.clientWidth) / W,
        ((j.y - j.ay) * desktop.clientHeight) / H,
      );
      j.pullAngle = Math.atan2(
        ((j.y - j.ay) * desktop.clientHeight) / H,
        ((j.x - j.ax) * desktop.clientWidth) / W,
      );
      j.x = j.ax;
      j.y = j.ay;
      j.pull *= 0.65;
      j.vx = done.dragVelocity.x * 0.65;
      j.vy = done.dragVelocity.y * 0.65;
      j.phase = 'roll';
      j.wobble = 1;
      j.squash = 0.6;
      wetSplash(j);
      materialSound('stretch');
    } else if (j.phase === 'held') {
      j.phase = 'roll';
      j.vx = 110;
      j.vy = 50;
      j.wobble = 0.5;
    }
    pushHistory({
      kind: 'jellies',
      before: done.jellyBefore,
      after: captureJellies(),
      bytes: Math.max(1024, jellies.length * 180),
    });
    jellyDirty = true;
    kick();
  }
  function nudgeJellies(from, to) {
    const dx = to.x - from.x,
      dy = to.y - from.y,
      len = Math.hypot(dx, dy),
      sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H;
    for (const j of jellies) {
      if (j.phase === 'stretch' || j.phase === 'held' || j.height > 10) continue;
      const t = clamp(((j.ax - from.x) * dx + (j.ay - from.y) * dy) / (len * len || 1), 0, 1);
      let nx = (j.ax - from.x - dx * t) * sx,
        ny = (j.ay - from.y - dy * t) * sy,
        d = Math.hypot(nx, ny),
        radius = j.size * 0.55 + size;
      if (d >= radius) continue;
      if (d < 1) {
        nx = len ? -dy / len : 1;
        ny = len ? dx / len : 0;
        d = 1;
      }
      const force = Math.min(18, (radius - d) * 0.35);
      j.ax = clamp(j.ax + ((nx / d) * force) / sx, 25, W - 25);
      j.ay = clamp(j.ay + ((ny / d) * force) / sy, 25, H - 25);
      j.x = j.ax;
      j.y = j.ay;
      j.vx = (nx / d) * 110;
      j.vy = (ny / d) * 110;
      j.phase = 'roll';
      j.wobble = 0.65;
      j.squash = 0.3;
      jellyDirty = true;
      kick();
    }
  }
  function stepJellies(dt) {
    let moving = false;
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H;
    for (const j of jellies) {
      if (j.phase === 'sleep' || j.phase === 'held') continue;
      moving = true;
      jellyDirty = true;
      j.pull = (j.pull || 0) * Math.exp(-3.5 * dt);
      j.wobble = Math.max(0, (j.wobble || 0) - dt * 0.32);
      j.squash = Math.max(0, j.squash - dt * 1.4);
      if (j.phase === 'fall') {
        if (j.fallDelay > 0) { j.fallDelay = Math.max(0,j.fallDelay-dt); continue; }
        j.fallSpeed += 2100 * dt;
        j.height -= j.fallSpeed * dt;
        if (j.height <= 0) landJelly(j);
      } else if (j.phase === 'stretch') {
        const f = 1 - Math.exp(-24 * dt);
        j.x += (j.tx - j.x) * f;
        j.y += (j.ty - j.y) * f;
      } else {
        j.ax += (j.vx * dt) / sx;
        j.ay += (j.vy * dt) / sy;
        j.angle += ((j.vx * dt) / j.size) * 0.55;
        j.vx *= Math.exp(-1.7 * dt);
        j.vy *= Math.exp(-1.7 * dt);
        const rx = (j.size * 0.45) / sx,
          ry = (j.size * 0.33) / sy;
        if (j.ax < rx || j.ax > W - rx) {
          j.ax = clamp(j.ax, rx, W - rx);
          j.vx *= -0.78;
          j.wobble = 0.9;
        }
        if (j.ay < ry || j.ay > H - ry) {
          j.ay = clamp(j.ay, ry, H - ry);
          j.vy *= -0.78;
          j.wobble = 0.9;
        }
        j.x = j.ax;
        j.y = j.ay;
        if (Math.hypot(j.vx, j.vy) < 4 && j.wobble === 0) {
          j.phase = 'sleep';
          j.vx = j.vy = 0;
        }
      }
    }
    // Pair contacts keep the soft bodies from rolling straight through each other.
    for (let a = 0; a < jellies.length; a++)
      for (let b = a + 1; b < jellies.length; b++) {
        const p = jellies[a],
          q = jellies[b];
        if (!['roll', 'sleep'].includes(p.phase) || !['roll', 'sleep'].includes(q.phase)) continue;
        const dx = (q.ax - p.ax) * sx,
          dy = (q.ay - p.ay) * sy,
          d = Math.hypot(dx, dy) || 1,
          min = (p.size + q.size) * 0.36;
        if (d >= min) continue;
        const nx = dx / d,
          ny = dy / d,
          over = (min - d) * 0.51;
        p.ax -= (nx * over) / sx;
        p.ay -= (ny * over) / sy;
        q.ax += (nx * over) / sx;
        q.ay += (ny * over) / sy;
        const rel = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
        if (rel < 0) {
          const force = -rel * 0.7;
          p.vx -= nx * force;
          p.vy -= ny * force;
          q.vx += nx * force;
          q.vy += ny * force;
          p.wobble = q.wobble = 0.6;
          p.phase = q.phase = 'roll';
        }
        p.x = p.ax;
        p.y = p.ay;
        q.x = q.ax;
        q.y = q.ay;
        jellyDirty = true;
      }
    return moving;
  }
  function refreshRefraction() {
    const key =
      revisions.wall +
      ':' +
      revisions.ink + ':' + soapCount +
      ':' +
      captureStickers()
        .map((s) => s.id + ',' + s.x + ',' + s.y + ',' + s.turn)
        .join(';');
    if (key === refractionKey && !stroke?.action) return;
    refractionKey = key;
    refractSource._version = (refractSource._version || 0) + 1;
    for (const j of jellies) if (j.phase === 'sleep') j.lensReady = false;
    rg.clearRect(0, 0, W, H);
    rg.drawImage(under, 0, 0);
    rg.drawImage(giant, 0, 0);
    rg.drawImage(wall, 0, 0);
    rg.drawImage(ink, 0, 0);
    rg.drawImage(soapCanvas, 0, 0);
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H;
    for (const el of stickerLayer.children) {
      const im = images['sticker' + el.dataset.index];
      rg.save();
      rg.translate((parseFloat(el.style.left) * W) / 100, (parseFloat(el.style.top) * H) / 100);
      rg.scale(1 / sx, 1 / sy);
      rg.rotate(((parseFloat(el.style.getPropertyValue('--turn')) || 0) * Math.PI) / 180);
      rg.drawImage(im, -el.offsetWidth / 2, -el.offsetHeight / 2, el.offsetWidth, el.offsetHeight);
      rg.restore();
    }
  }
  function blobPath(g, x, y, r, angle, wobble, now, j = {}) {
    g.beginPath();
    const pts = [],
      seed = j.seed || 1,
      lobes = j.lobes || 3,
      exp = j.exponent || 0.9;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2,
        rr =
          1 +
          Math.sin(a * lobes + seed) * 0.14 +
          Math.sin(a * 2 + seed * 2) * 0.065 +
          Math.sin(a * 3 + now * 0.008) * wobble * 0.11;
      const xx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), exp) * r * rr,
        yy = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), exp) * r * 0.82 * rr;
      pts.push({
        x: x + xx * Math.cos(angle) - yy * Math.sin(angle),
        y: y + xx * Math.sin(angle) + yy * Math.cos(angle),
      });
    }
    g.moveTo((pts[31].x + pts[0].x) / 2, (pts[31].y + pts[0].y) / 2);
    for (let i = 0; i < 32; i++) {
      const p = pts[i],
        n = pts[(i + 1) % 32];
      g.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
    }
    g.closePath();
  }
  function renderJellies() {
    if (!jellies.length) {
      if (jellyDirty) {
        jc.clearRect(0, 0, W, H);
        jellyDirty = false;
      }
      return;
    }
    if (gelRenderer.ready) {
      if (!jellyDirty) return;
      jellyDirty = false;
      refreshRefraction();
      const frame = gelRenderer.render(
        jellies,
        refractSource,
        Math.round(
          desktop.clientWidth * Math.min(1, 1280 / desktop.clientWidth, 900 / desktop.clientHeight),
        ),
        Math.round(
          desktop.clientHeight * Math.min(1, 1280 / desktop.clientWidth, 900 / desktop.clientHeight),
        ),
        performance.now(),
        desktop.clientWidth,
      );
      jc.clearRect(0, 0, W, H);
      jc.drawImage(frame, 0, 0, W, H);
      return;
    }
    if (!jellyDirty) return;
    jellyDirty = false;
    refreshRefraction();
    jc.clearRect(0, 0, W, H);
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H,
      now = performance.now();
    let lensUpdated = false;
    jc.save();
    jc.scale(1 / sx, 1 / sy);
    const candidate = jellies.reduce(
      (a, b) => (!a || (b.lensTime || 0) < (a.lensTime || 0) ? b : a),
      null,
    );
    for (const j of jellies) {
      const dx = (j.x - j.ax) * sx,
        dy = (j.y - j.ay) * sy,
        held = j.phase === 'stretch',
        d = held ? Math.hypot(dx, dy) : j.pull || 0,
        dir = held ? Math.atan2(dy, dx) : j.pullAngle || 0,
        x = j.x * sx - (held ? dx * 0.5 : 0),
        y = j.y * sy - (held ? dy * 0.5 : 0) - (j.height || 0),
        r = j.size * 0.5,
        stretch = 1 + d / (r * 2),
        cross = 1 / Math.pow(stretch, 0.53),
        squash = Math.sin(j.squash * Math.PI * 3) * j.squash * 0.25;
      if (d > 3) {
        jc.save();
        jc.translate(j.ax * sx, j.ay * sy);
        jc.rotate(dir);
        jc.beginPath();
        jc.moveTo(-r, 0);
        jc.bezierCurveTo(-r, -r, r * 0.2, -r, r * 0.55, -r * 0.55);
        jc.bezierCurveTo(r * 0.9, -r * 0.22, d - r * 0.2, -r * 0.15, d, -r * 0.25);
        jc.bezierCurveTo(d + r * 0.42, -r * 0.25, d + r * 0.42, r * 0.25, d, r * 0.25);
        jc.bezierCurveTo(d - r * 0.2, r * 0.15, r * 0.9, r * 0.22, r * 0.55, r * 0.55);
        jc.bezierCurveTo(r * 0.2, r, -r, r, -r, 0);
        jc.closePath();
        const fill = jc.createLinearGradient(0, -r, 0, r);
        fill.addColorStop(0, '#ffe6f3ca');
        fill.addColorStop(0.25, '#f973bba0');
        fill.addColorStop(0.65, '#b4006988');
        fill.addColorStop(1, '#ffd8efdd');
        jc.fillStyle = fill;
        jc.fill();
        jc.strokeStyle = '#ffedf7b0';
        jc.lineWidth = 1;
        jc.stroke();
        jc.restore();
        continue;
      }
      jc.save();
      const shadow = jc.createRadialGradient(
        j.ax * sx,
        j.ay * sy + r * 0.3,
        0,
        j.ax * sx,
        j.ay * sy + r * 0.3,
        r * 1.3,
      );
      shadow.addColorStop(0, j.phase === 'fall' ? '#27001630' : '#27001648');
      shadow.addColorStop(1, '#27001600');
      jc.fillStyle = shadow;
      jc.fillRect(j.ax * sx - r * 1.5, j.ay * sy - r, r * 3, r * 2.7);
      jc.translate(x, y);
      jc.rotate(d > 3 ? dir : (j.angle || 0) * 0.15);
      jc.scale(stretch * (1 + squash), cross * (1 - squash));
      blobPath(jc, 0, 0, r, 0, j.wobble || 0, now, j);
      jc.save();
      jc.clip();
      if (!j.lens) {
        j.lens = document.createElement('canvas');
        j.lens.width = j.lens.height = 144;
        j.lensTime = -Infinity;
      }
      if (!j.lensReady || (!lensUpdated && j === candidate && now - j.lensTime > 100)) {
        const g = j.lens.getContext('2d');
        g.clearRect(0, 0, 144, 144);
        const radius = r * 1.45;
        for (let row = 0; row < 144; row += 3) {
          const yy = ((row / 144) * 2 - 1) * radius,
            t = Math.min(1, Math.abs(yy) / r),
            zoom = 0.57 + 0.32 * t,
            srcX = clamp((x - radius * zoom) / sx, 0, W - 2),
            srcY = clamp((y + yy * (0.66 + 0.18 * t)) / sy, 0, H - 2),
            sw = Math.min((radius * 2 * zoom) / sx, W - srcX),
            sh = Math.min((((radius * 2) / 144) * 3 * (0.66 + 0.36 * t)) / sy, H - srcY);
          g.drawImage(refractSource, srcX, srcY, sw, sh, 0, row, 144, 3.15);
        }
        j.lensTime = now;
        j.lensReady = true;
        lensUpdated = true;
      }
      jc.drawImage(j.lens, -r * 1.45, -r * 1.45, r * 2.9, r * 2.9);
      const tint = jc.createRadialGradient(-r * 0.27, -r * 0.35, 0, 0, 0, r * 1.2);
      tint.addColorStop(0, '#ffb6d43d');
      tint.addColorStop(0.45, '#f855a176');
      tint.addColorStop(0.79, '#bc1f719a');
      tint.addColorStop(1, '#640037c4');
      jc.fillStyle = tint;
      jc.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
      const light = jc.createRadialGradient(
        -r * 0.35,
        -r * 0.42,
        0,
        -r * 0.35,
        -r * 0.42,
        r * 0.47,
      );
      light.addColorStop(0, '#fff9f5ed');
      light.addColorStop(0.23, '#fff6f1bd');
      light.addColorStop(0.6, '#ffedf344');
      light.addColorStop(1, '#fff4f000');
      jc.save();
      jc.scale(1, 0.47);
      jc.fillStyle = light;
      jc.fillRect(-r * 1.5, -r * 2.8, r * 3, r * 5);
      jc.restore();
      const rim = jc.createRadialGradient(r * 0.48, r * 0.43, 0, r * 0.48, r * 0.43, r * 0.34);
      rim.addColorStop(0, '#ffcce890');
      rim.addColorStop(1, '#ffcce800');
      jc.fillStyle = rim;
      jc.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
      jc.restore();
      jc.restore();
    }
    jc.restore();
  }

  function popBubble(b) {
    paintSoap(b);
    if (soapMarks.length >= 32) soapMarks.shift();
    soapMarks.push({ x: b.x, y: b.y, r: b.r, born: performance.now(), hue: b.hue });
    totalPops++;
    emitDust({ x: b.x, y: b.y }, 5, '#e3faff');
    lastSound = 0;
    sound(680, 0.025, 0.009);
  }
  function drawSoap(now) {
    soapMarks = soapMarks.filter((m) => now - m.born < 330);
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H;
    for (const m of soapMarks) {
      const t = (now - m.born) / 330;
      fc.save();
      fc.scale(1 / sx, 1 / sy);
      fc.globalAlpha = (1 - t) * 0.6;
      fc.strokeStyle = 'white';
      fc.lineWidth = 1;
      fc.beginPath();
      fc.arc(m.x * sx, m.y * sy, m.r * (1 + t * 0.7), 0, Math.PI * 2);
      fc.stroke();
      fc.restore();
    }
  }
  const giant = $('#giant-supa'),
    gg = giant.getContext('2d');
  let eyeTarget = { x: W * 0.6, y: H * 0.4 },
    eyeDrawPending = false,
    screenHits = 0,
    giantPainted = false,
    lastEyeDraw = 0;
  function drawGiant() {
    if (!images.giant) return;
    gg.clearRect(0,0,W,H);
    const cw=desktop.clientWidth,ch=desktop.clientHeight,k=Math.max(cw/images.giant.width,ch/images.giant.height),dw=images.giant.width*k,dh=images.giant.height*k;
    gg.save();gg.scale(W/cw,H/ch);
    if(images.eyes){const dx=(eyeTarget.x/W-.5)*36,dy=(eyeTarget.y/H-.5)*28;gg.drawImage(images.eyes,(cw-dw)/2+dx,(ch-dh)/2+dy,dw,dh);}
    gg.drawImage(images.giant,(cw-dw)/2,(ch-dh)/2,dw,dh);gg.restore();
    giantPainted=true;
    eyeDrawPending = false;
  }
  function shakeScreen(p) {
    screenHits++;
    root.getAnimations().forEach((a) => a.cancel());
    root.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: 'translate(-2px,2px)' },
        { transform: 'translate(2px,-1px)' },
        { transform: 'translate(0,0)' },
      ],
      { duration: 180 },
    );
    // Screen shake is independent of debris; clicks no longer spawn loose shards.
    kick();
  }
  const glitterCanvas = document.createElement('canvas');
  glitterCanvas.id = 'glitter-surface';
  glitterCanvas.width = W;
  glitterCanvas.height = H;
  ink.after(glitterCanvas);
  const desktopShards = new DesktopShards(W, H);
  const screenMaterials = new ScreenMaterials(W, H, ic, glitterCanvas.getContext('2d'));
  const pet = new DesktopPet({
    element: $('#desktop-bot'),
    desktop,
    asset: window.BOT_ASSET.src,
    getJellyTarget(x,y){
      const settled=jellies.filter(j=>j.phase!=='fall'&&j.phase!=='held'&&j.phase!=='stretch');
      if(!settled.length)return null;
      const j=settled.reduce((a,b)=>Math.hypot(a.ax*desktop.clientWidth/W-x,a.ay*desktop.clientHeight/H-y)<Math.hypot(b.ax*desktop.clientWidth/W-x,b.ay*desktop.clientHeight/H-y)?a:b);
      return {x:clamp(j.ax*desktop.clientWidth/W-48,0,desktop.clientWidth-96),y:clamp(j.ay*desktop.clientHeight/H-60,0,desktop.clientHeight-96)};
    },
    wake: kick,
    onMischief: petMischief,
    onDoodle: (copy, x, y) => petMischief('doodle',x,y),
  });
  const botState = pet.s;
  function toggleBot() {
    pet.toggle();
    if(botState.active) window.XPSounds?.play('chimes');
    $('.desktop-icon[data-open="bot"]').classList.toggle('selected', botState.active);
    hideStart();
  }
  let mischiefCount = 0;
  function petMischief(kind, x, y, preview = false) {
    if (stroke || !ready) return false;
    const p = {
      x: clamp(((x + 48) / desktop.clientWidth) * W, 30, W - 30),
      y: clamp(((y + 60) / desktop.clientHeight) * H, 30, H - 30),
    };
    if (kind === 'jelly' && !jellies.length) return false;
    if (kind === 'jelly' && jellies.length) {
      const j = jellies.reduce((a, b) =>
        Math.hypot(a.ax - p.x, a.ay - p.y) < Math.hypot(b.ax - p.x, b.ay - p.y) ? a : b,
      );
      if (
        Math.hypot(
          ((j.ax - p.x) * desktop.clientWidth) / W,
          ((j.ay - p.y) * desktop.clientHeight) / H,
        ) >
        85 + j.size * 0.35
      )
        return false;
      if(['fall','held','stretch'].includes(j.phase))return false;
      if (preview) return true;
      j.vx = (Math.random() < 0.5 ? -1 : 1) * 180;
      j.vy = -90;
      j.phase = 'roll';
      j.wobble = 1;
      jellyDirty = true;
    } else {
      if (kind === 'erase') {
        screenMaterials.mg.clearRect(0, 0, 320, 200);
        screenMaterials.mg.drawImage(ink, 0, 0, 320, 200);
        const data = screenMaterials.mg.getImageData(0, 0, 320, 200).data;
        let best = (42 * W) / desktop.clientWidth,
          target = null;
        for (let yy = 0; yy < 200; yy += 3)
          for (let xx = 0; xx < 320; xx += 3) {
            if (data[(yy * 320 + xx) * 4 + 3] < 30) continue;
            const distance = Math.hypot(xx * 4 - p.x, yy * 4 - p.y);
            if (distance < best) {
              best = distance;
              target = { x: xx * 4, y: yy * 4 };
            }
          }
        if (!target) return false;
        p.x = target.x;
        p.y = target.y;
      }
      if (preview) return true;
      const action = beginPixels('ink');
      stroke = { action };
      touch(p.x, p.y, 44);
      ic.save();
      if (kind === 'erase') {
        ic.globalCompositeOperation = 'destination-out';
        ic.lineWidth = 16;
        ic.lineCap = 'round';
        ic.beginPath();
        ic.moveTo(p.x - 26, p.y + 8);
        ic.lineTo(p.x + 26, p.y - 8);
        ic.stroke();
      } else {
        const sx=W/desktop.clientWidth,sy=H/desktop.clientHeight;
        ic.translate(p.x,p.y);ic.scale(sx,sy);ic.rotate((Math.random()-.5)*.30);
        const points=[],art=brushes[colors[mischiefCount%4]];
        const doodle=mischiefCount%5;
        const segment=(a,b)=>{const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y));for(let i=0;i<=n;i++)points.push({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n});};
        if(doodle===4){
          for(const [a,b] of [[[-23,-10],[-14,-3]],[[-14,-3],[-23,3]],[[23,-10],[14,-3]],[[14,-3],[23,3]],[[-9,6],[9,6]],[[-5,6],[-5,12]],[[5,6],[5,12]],[[0,7],[0,14]]])segment({x:a[0],y:a[1]},{x:b[0],y:b[1]});
          for(let i=0;i<=24;i++){const t=i/24*Math.PI;points.push({x:5*Math.cos(t),y:12+5*Math.sin(t)});}
        }else if(doodle===2){
          for(const [a,b] of [[[-24,-9],[-14,0]],[[-14,0],[-24,9]],[[24,-9],[14,0]],[[14,0],[24,9]],[[-6,-6],[6,-6]],[[6,-6],[6,6]],[[6,6],[-6,6]],[[-6,6],[-6,-6]]])segment({x:a[0],y:a[1]},{x:b[0],y:b[1]});
        }else if(doodle===3){
          segment({x:-9,y:15},{x:-9,y:-17});segment({x:-9,y:-17},{x:15,y:-23});segment({x:15,y:-23},{x:15,y:9});
          for(const [x,y] of [[-15,16],[9,10]])for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;points.push({x:x+7*Math.cos(a),y:y+4*Math.sin(a)});}
        }else if(doodle===1){
          for(let i=0;i<=90;i++){const t=i/90*Math.PI*2;points.push({x:1.45*16*Math.pow(Math.sin(t),3),y:-1.4*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))});}
        }else{
          const vertices=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5+(Math.random()-.5)*.08,r=(i%2?10:23)*( .90+Math.random()*.20);return {x:Math.cos(a)*r,y:Math.sin(a)*r};});
          for(let i=0;i<10;i++){const a=vertices[i],b=vertices[(i+1)%10],n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y));for(let k=0;k<n;k++)points.push({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n});}
          points.push(points[0]);
        }
        let wobbleX=0,wobbleY=0;
        for(const v of points){wobbleX=wobbleX*.7+(Math.random()-.5)*.5;wobbleY=wobbleY*.7+(Math.random()-.5)*.5;const d=4+Math.random()*1.7;ic.globalAlpha=.62+Math.random()*.28;ic.drawImage(art,v.x+wobbleX-d/2,v.y+wobbleY-d/2,d,d);}

      }
      ic.restore();
      stroke = null;
      finishPixels(action);
    }
    mischiefCount++;
    kick();
    return true;
  }
  function stepBot(dt, now) {
    return pet.step(dt, now);
  }
  function drawBot() {
    pet.draw(performance.now());
  }
  root.addEventListener('pointermove', (e) => {
    const r = desktop.getBoundingClientRect();
    pet.movePointer(e.clientX - r.left, e.clientY - r.top);
    eyeTarget = pxy(e);
    if (screenHits && !eyeDrawPending && performance.now() - lastEyeDraw > 40) {
      lastEyeDraw = performance.now();
      eyeDrawPending = true;
      requestAnimationFrame(drawGiant);
    }
  });
  const toolSoundTimes=new Map();
  function materialSound(kind){
    if(kind==='glitter'||kind==='tap'){playToolSound(kind);return;}
    if(kind==='checker'){transparentEraserSound();return;}
    if(muted||!ac)return;
    const profiles={glitter:[.25,125,78,680,1600,.045,.17,'sawtooth',150],photo:[.16,440,445,2400,2200,.028,.04,'sawtooth',130],ds:[.045,1700,1000,6500,4200,.016,.09,'triangle',75],checker:[.16,90,70,950,650,.001,.34,'sine',110],eraser:[.18,70,60,1700,1100,.001,.38,'sine',125],splat:[.42,340,100,800,250,.055,.075,'sine',180],tap:[.065,1350,270,3200,900,.045,.26,'triangle',90],stretch:[.30,260,105,900,600,.045,.03,'sine',220]};
    const v=profiles[kind],now=performance.now();if(!v||now-(toolSoundTimes.get(kind)||-1000)<v[8])return;toolSoundTimes.set(kind,now);
    if(ac.state==='suspended')ac.resume();
    // Soft back-and-forth friction, without a pitched tone or a sharp attack.
    if(kind==='eraser'||kind==='checker'){
      const t=ac.currentTime,duration=.22,source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
      source.buffer=noise;source.loop=true;source.playbackRate.value=.85+Math.random()*.3;
      filter.type='bandpass';filter.Q.value=.65;
      filter.frequency.setValueAtTime(850,t);filter.frequency.linearRampToValueAtTime(2200,t+.07);filter.frequency.linearRampToValueAtTime(1050,t+.12);filter.frequency.linearRampToValueAtTime(1850,t+.17);filter.frequency.linearRampToValueAtTime(700,t+duration);
      gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.27,t+.035);gain.gain.linearRampToValueAtTime(.07,t+.10);gain.gain.linearRampToValueAtTime(.22,t+.15);gain.gain.linearRampToValueAtTime(.0001,t+duration);
      source.connect(filter);filter.connect(gain);gain.connect(window.XPSounds.output);source.start(t,Math.random()*noise.duration);source.stop(t+duration);
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};return;
    }
    const [duration,f0,f1,c0,c1,toneLevel,noiseLevel,type]=v,t=ac.currentTime;
    const osc=ac.createOscillator(),tone=ac.createGain(),wet=ac.createBufferSource(),filter=ac.createBiquadFilter(),hiss=ac.createGain();
    osc.type=type;osc.frequency.setValueAtTime(f0,t);osc.frequency.exponentialRampToValueAtTime(f1,t+duration);wet.buffer=noise;wet.loop=true;filter.type=['photo','eraser','checker','tap'].includes(kind)?'bandpass':'lowpass';filter.Q.value=kind==='glitter'?5:1;filter.frequency.setValueAtTime(c0,t);filter.frequency.exponentialRampToValueAtTime(c1,t+duration);
    for(const [g,level] of [[tone,toneLevel],[hiss,noiseLevel]]){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(level,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);g.connect(window.XPSounds.output);}
    let wobble,depth;if(kind==='stretch'||kind==='splat'){wobble=ac.createOscillator();depth=ac.createGain();wobble.frequency.value=kind==='splat'?11:13;depth.gain.value=kind==='splat'?80:65;wobble.connect(depth);depth.connect(osc.frequency);wobble.start(t);wobble.stop(t+duration);}
    osc.connect(tone);wet.connect(filter);filter.connect(hiss);osc.start(t);wet.start(t);osc.stop(t+duration);wet.stop(t+duration);osc.onended=()=>{[osc,tone,wet,filter,hiss,wobble,depth].forEach(n=>n?.disconnect());};
  }
  function paintGlitter(from, to) {
    materialSound('glitter');
    const r = size * 0.8;
    touch(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) / 2 + r + 4,
    );
    MaterialBrushes.glitter(ic, from, to, size);
    screenMaterials.addGlitter(from, to, size);
    kick();
  }

  let lastCutSound = 0, knifeSounds = 0;
  function cutSound(distance) {if(distance>=1){knifeSounds++;playToolSound('cut');}}
  function finishCut(done) {
    const pts = done.cutPoints;
    if (!pts || pts.length < 5) return;
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H,
      first = pts[0],
      last = pts.at(-1);
    if (Math.hypot((first.x - last.x) * sx, (first.y - last.y) * sy) > 28) return;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        q = pts[(i + 1) % pts.length];
      area += p.x * q.y - q.x * p.y;
    }
    if (Math.abs(area) * sx * sy < 1500) return;
    const xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y),
      x = (Math.min(...xs) + Math.max(...xs)) / 2,
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const old = stroke;
    stroke = done;
    touch(
      x,
      y,
      Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 10,
    );
    stroke = old;
    ic.save();
    ic.beginPath();
    pts.forEach((p, i) => (i ? ic.lineTo(p.x, p.y) : ic.moveTo(p.x, p.y)));
    ic.closePath();
    ic.clip();
    ic.drawImage(under, 0, 0);
    ic.drawImage(giant, 0, 0);
    ic.restore();
    emitDust({ x, y }, 12, '#f5e9d5');
  }
  const soapCanvas = $('#soap-surface'),
    sc = soapCanvas.getContext('2d');
  let soapCount = 0;
  function paintSoap(b) {
    soapCount++;
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H,
      r = b.r * 1.2;
    sc.save();
    sc.scale(1 / sx, 1 / sy);
    sc.translate(b.x * sx, b.y * sy);
    const fill = sc.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
    fill.addColorStop(0, `hsla(${b.hue},95%,85%,.04)`);
    fill.addColorStop(0.7, `hsla(${b.hue},90%,75%,.08)`);
    fill.addColorStop(1, `hsla(${b.hue},95%,76%,.35)`);
    sc.fillStyle = fill;
    sc.beginPath();
    sc.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
    sc.fill();
    for (let i = 0; i < 6; i++) {
      sc.strokeStyle = `hsla(${b.hue + i * 55},95%,78%,.5)`;
      sc.lineWidth = 1.4;
      sc.beginPath();
      sc.ellipse(0, 0, r, r, 0, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3);
      sc.stroke();
    }
    sc.restore();
  }
  const bubbleArts = [];
  function buildBubbleArt() {
    for (let hue = 0; hue < 360; hue += 30) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const fc = cv.getContext('2d'),
        b = { r: 44, hue };
      fc.save();
      fc.translate(48, 48);
      const tint = 190 + 34 * Math.sin(hue * Math.PI / 180);
      const g = fc.createRadialGradient(-b.r*.30,-b.r*.38,b.r*.02,0,0,b.r);
      g.addColorStop(0, '#ffffffdf');
      g.addColorStop(.20, `hsla(${tint},95%,92%,.42)`);
      g.addColorStop(.48, `hsla(${b.hue},88%,88%,.10)`);
      g.addColorStop(.72, `hsla(${tint},88%,67%,.19)`);
      g.addColorStop(.86, `hsla(${b.hue+40},84%,85%,.56)`);
      g.addColorStop(.95, '#c9f7ffc0');
      g.addColorStop(1, '#fffffff0');
      fc.fillStyle=g;fc.beginPath();fc.arc(0,0,b.r,0,Math.PI*2);fc.fill();
      const sheen=fc.createLinearGradient(-b.r,-b.r,b.r,b.r);
      sheen.addColorStop(0,'#ffffffd9');sheen.addColorStop(.3,'#d1faff08');
      sheen.addColorStop(.7,'#a4ecff00');sheen.addColorStop(1,'#d8fbffba');
      fc.fillStyle=sheen;fc.beginPath();fc.arc(0,0,b.r*.98,0,Math.PI*2);fc.fill();
      fc.lineCap='round';
      for(const [radius,start,end,width,alpha] of [[.94,3.3,4.65,2.2,.94],[.84,3.5,4.35,1,.4],[.95,.55,1.85,3,.85],[.82,.8,1.4,1,.3]]){
        fc.strokeStyle=`rgba(235,253,255,${alpha})`;fc.lineWidth=width;
        fc.beginPath();fc.arc(0,0,b.r*radius,start,end);fc.stroke();
      }
      const halo=fc.createRadialGradient(b.r*.28,b.r*.4,0,b.r*.28,b.r*.4,b.r*.65);halo.addColorStop(0,'#f8f5ffc0');halo.addColorStop(.45,'#e0fbff38');halo.addColorStop(1,'#c0f9ff00');fc.fillStyle=halo;fc.beginPath();fc.arc(0,0,b.r*.98,0,Math.PI*2);fc.fill();
      fc.fillStyle='#ffffffe0';fc.beginPath();
      fc.ellipse(-b.r*.28,-b.r*.48,b.r*.28,b.r*.095,-.48,0,Math.PI*2);fc.fill();
      fc.restore();
      bubbleArts.push(cv);
    }
  }
  function drawBubble(b) {
    const sx = desktop.clientWidth / W,
      sy = desktop.clientHeight / H,
      r = (b.r * (0.7 + 0.5 * Math.min(1, b.age / b.life)) * 96) / 88;
    fc.save();
    fc.scale(1 / sx, 1 / sy);
    fc.globalAlpha = Math.min(1, b.age * 8);
    fc.drawImage(bubbleArts[Math.floor(b.hue / 30) % 12], b.x * sx - r, b.y * sy - r, r * 2, r * 2);
    fc.restore();
  }

  let adVariant = -1,
    adShows = 0;
  const instagramUrl = window.GAME_SETTINGS?.instagramUrl || '';
  function showAd() {
    adVariant = (adVariant + 1) % A.ads.length;
    adShows++;
    const el = $('#ad-window'), link = el.querySelector('.ad-body');
    link.href = instagramUrl;
    link.innerHTML = '<img src="' + A.ads[adVariant] + '" alt="Super Normal Girls">';
    open('ad');
    el.classList.remove('ad-enter');
    void el.offsetWidth;
    el.classList.add('ad-enter');
  }
  function buildEraserArt() {
    for (let level = 0; level <= 6; level++) {
      const c = document.createElement('canvas');
      c.width = c.height = 112;
      const g = c.getContext('2d');
      g.drawImage(images.eraser, 0, 0, 112, 112);
      g.globalCompositeOperation = 'source-atop';
      let seed = 93;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < level * 100; i++) {
        const x = 12 + rand() * 90,
          y = 22 + rand() * 62;
        g.fillStyle = ['#fffce2', '#f6bfd3', '#b9dbcf'][i % 3];
        g.globalAlpha = 0.15 + level * 0.04;
        g.fillRect(x, y, 1 + rand() * 4, 1 + rand() * 2);
      }
      eraserFrames.push(c.toDataURL('image/png'));
    }
  }
  function updateEraser() {
    const level = Math.min(6, Math.floor(eraserDirt * 7));
    if (level === eraserLevel) return;
    eraserLevel = level;
    $('#tools-window [data-tool="eraser"] img').src = eraserFrames[level];
    if (activeTool === 'eraser') cursor.src = eraserFrames[level];
  }
  const dustCloud = document.createElement('canvas');
  dustCloud.width = dustCloud.height = 64;
  {
    const g = dustCloud.getContext('2d'),
      r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, '#fff5ea');
    r.addColorStop(0.4, '#efe4d9bb');
    r.addColorStop(1, '#efe4d900');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  function shakeEraser(p) {
    eraserDirt = 0;
    eraserBursts++;
    eraserCooldown = performance.now() + 1800;
    updateEraser();
    eraserBeat = { x: p.x, y: p.y, born: performance.now(), count: 0 };
    cursor.classList.remove('dusting');
    void cursor.offsetWidth;
    cursor.classList.add('dusting');
    kick();
  }
  function drawEraserBeat(now) {
    if (!eraserBeat) return;
    const beat = eraserBeat,
      age = now - beat.born;
    if (age > 840 || activeTool !== 'eraser') {
      eraserBeat = null;
      cursor.classList.remove('dusting');
      return;
    }
    const count = age >= 500 ? 2 : age >= 140 ? 1 : 0;
    if (count > beat.count) {
      beat.count = count;
      const p = pointer;
      // Deposit actual chalk on the ink layer, so the next pass can erase it.
      const ownAction = !stroke;
      const action = ownAction ? beginPixels('ink') : stroke.action;
      if (ownAction) stroke = { action };
      touch(p.x, p.y, 80);
      ic.save();
      ic.translate(p.x, p.y);
      ic.rotate(-0.2);
      const smudge = ic.createRadialGradient(0, 0, 2, 0, 0, 38);
      smudge.addColorStop(0, '#f1e9dfbb');
      smudge.addColorStop(1, '#f1e9df00');
      ic.fillStyle = smudge;
      ic.scale(1.6, 0.7);
      ic.fillRect(-40, -40, 80, 80);
      ic.scale(1 / 1.6, 1 / 0.7);
      for (let i = 0; i < 520; i++) {
        const x = (Math.random() - 0.5) * 112,
          y = (Math.random() - 0.5) * 48;
        ic.globalAlpha = 0.26 + Math.random() * 0.4;
        ic.fillStyle = ['#ffedde', '#f5cedc', '#dcf0ea'][i % 3];
        ic.fillRect(x, y, 0.6 + Math.random() * 2, 0.6 + Math.random() * 1.4);
      }
      ic.restore();
      // This puff belongs to this pointer gesture. It becomes erasable on the next one.
      if (!ownAction) (stroke.eraserProtected ??= []).push({ x: p.x, y: p.y });
      if (ownAction) {
        stroke = null;
        finishPixels(action);
      }
      for (let i = 0; i < 48; i++) {
        if (particles.length >= MAX_PARTICLES) particles.shift();
        particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 240,
          vy: -40 - Math.random() * 110,
          life: 0.9 + Math.random() * 0.7,
          size: 1 + Math.random() * 4,
          cloud: i < 12,
          color: ['#f9eee1', '#ffc9df', '#dae7e0'][i % 3],
          dust: true,
        });
      }
      lastSound = 0;
      materialSound('tap');
    }
  }
  function captureDecorations(soap) {
    return {
      stickers: captureStickers(),
      peels: [...peeledSlots],
      jellies: captureJellies(),
      soap: soap ? sc.getImageData(0, 0, W, H) : null,
    };
  }
  function erase(from, to) {
    if (!stroke.action.decorations) stroke.action.decorations = captureDecorations(soapCount > 0);
    const distance = (x, y) => {
      const dx = to.x - from.x,
        dy = to.y - from.y;
      const t = clamp(((x - from.x) * dx + (y - from.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      return Math.hypot(x - from.x - dx * t, y - from.y - dy * t);
    };
    const radius = size * 2.2;
    for (const el of [...stickerLayer.children]) {
      if (
        distance((parseFloat(el.style.left) * W) / 100, (parseFloat(el.style.top) * H) / 100) <
        radius + ((el.offsetWidth * W) / desktop.clientWidth) * 0.35
      ) {
        peeledSlots.delete(Number(el.dataset.index));
        el.remove();
        refreshPeels();
      }
    }
    soapMarks = soapMarks.filter(
      (m) => distance(m.x, m.y) > radius + (m.r * W) / desktop.clientWidth,
    );
    bubbles = bubbles.filter((b) => distance(b.x, b.y) > radius + (b.r * W) / desktop.clientWidth);
    jellies = jellies.filter((j) => distance(j.ax, j.ay) > radius + j.size * 0.3);
    wetMarks = wetMarks.filter((m) => distance(m.x, m.y) > radius + 20);
    sc.save();
    sc.globalCompositeOperation = 'destination-out';
    sc.lineWidth = radius * 2;
    sc.lineCap = 'round';
    sc.beginPath();
    sc.moveTo(from.x, from.y);
    sc.lineTo(to.x + 0.01, to.y + 0.01);
    sc.stroke();
    sc.restore();
    jellyDirty = true;
    kick();
    const r = size * 2.2;
    const dx = to.x - from.x,
      dy = to.y - from.y,
      len = Math.hypot(dx, dy) || 1,
      lead = r * 0.82,
      sample = clamp(Math.round(r * 0.25), 5, 16),
      x = clamp(Math.round(to.x + (dx / len) * lead) - sample, 0, W - sample * 2),
      y = clamp(Math.round(to.y + (dy / len) * lead) - sample, 0, H - sample * 2),
      data = ic.getImageData(x, y, sample * 2, sample * 2).data;
    let coverage = 0,
      n = 0;
    for (let i = 3; i < data.length; i += 16) {
      coverage += data[i] / 255;
      n++;
    }
    coverage /= Math.max(1, n);
    touch(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) / 2 + r + 3,
    );
    ic.save();
    for (const puff of stroke.eraserProtected || []) {
      if (distance(puff.x, puff.y) > r + 90) continue;
      const region = new Path2D(); region.rect(0, 0, W, H);
      region.ellipse(puff.x, puff.y, 78, 46, -0.2, 0, Math.PI * 2);
      ic.clip(region, 'evenodd');
    }
    ic.globalCompositeOperation = 'destination-out';
    ic.lineWidth = r * 2;
    ic.lineCap = 'round';
    ic.beginPath();
    ic.moveTo(from.x, from.y);
    ic.lineTo(to.x + 0.01, to.y + 0.01);
    ic.stroke();
    ic.restore();
    const travel = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    eraserDirt = Math.min(1, eraserDirt + (travel / 800) * Math.min(1, coverage * 7));
    updateEraser();
    if (eraserDirt >= 1 && performance.now() > eraserCooldown) shakeEraser(to);
    else materialSound('eraser');
  }

  function scratch(from, to) {
    if (stroke) {
      stroke.cutPoints ??= [from];
      if (stroke.cutPoints.length < 600) stroke.cutPoints.push(to);
    }
    const r = Math.min(2.8, 1.1 + size * 0.06),
      dx = to.x - from.x,
      dy = to.y - from.y,
      d = Math.hypot(dx, dy) || 1,
      nx = -dy / d,
      ny = dx / d;
    touch(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      Math.max(Math.abs(dx), Math.abs(dy)) / 2 + r + 9,
    );
    ic.save();
    ic.globalCompositeOperation = 'source-over';
    ic.strokeStyle = ic.createPattern(giant, 'no-repeat') || '#182d39';
    ic.lineWidth = r;
    ic.lineCap = 'round';
    ic.beginPath();
    ic.moveTo(from.x, from.y);
    ic.lineTo(to.x + 0.1, to.y + 0.1);
    ic.stroke();
    ic.globalCompositeOperation = 'source-over';
    for (const side of [-1, 1]) {
      ic.lineWidth = side < 0 ? 0.65 : 0.45;
      ic.strokeStyle = side < 0 ? '#fff9e9dc' : '#372a4877';
      ic.beginPath();
      for (let i = 0; i <= Math.min(40, Math.ceil(d / 3)); i++) {
        const t = i / Math.max(1, Math.min(40, Math.ceil(d / 3))),
          jag = (Math.random() - 0.5) * 0.65,
          off = side * (r * 0.5 + jag),
          x = from.x + dx * t + nx * off,
          y = from.y + dy * t + ny * off;
        i ? ic.lineTo(x, y) : ic.moveTo(x, y);
      }
      ic.stroke();
    }
    if (d > 2) {
      ic.fillStyle = '#fff5dc';
      ic.beginPath();
      ic.moveTo(to.x + nx * r * 0.6, to.y + ny * r * 0.6);
      ic.lineTo(to.x - (dx / d) * 3 + nx * (r * 0.6 + 1), to.y - (dy / d) * 3 + ny * (r * 0.6 + 1));
      ic.lineTo(to.x - (dx / d) * 3 + nx * r * 0.6, to.y - (dy / d) * 3 + ny * r * 0.6);
      ic.fill();
    }
    ic.restore();
    if (Math.random() < 0.45) {
      emitDust(to, 2, '#f4edd9');
      if (particles.length) particles.at(-1).shard = true;
    }
    cutSound(d);
  }
  let crashPending = false, revealedRatio = 0;
  const damageSample = document.createElement('canvas');
  damageSample.width = 160; damageSample.height = 100;
  const damageContext = damageSample.getContext('2d', {willReadFrequently:true});
  function checkScreenDamage() {
    if (crashPending) return;
    damageContext.clearRect(0,0,160,100);
    damageContext.drawImage(wall,0,0,160,100);
    const pixels = damageContext.getImageData(0,0,160,100).data;
    let removed = 0;
    for(let i=3;i<pixels.length;i+=4) removed += 1-pixels[i]/255;
    revealedRatio = removed/16000;
    if(revealedRatio < .60) return;
    crashPending = true;
    queueMicrotask(() => {
      if(stroke) endStroke();
      ready = false;
      cursor.style.display='none';
      window.XPSounds?.play('shutdown');
      $('#blue-screen').hidden=false;
      setTimeout(()=>{
        $('#blue-screen').hidden=true;
        restartComputer(true, true);
      },500);
    });
  }
  function smash(pos) {
    shakeScreen(pos);
    const r = 44 + size;
    desktopShards.break(wall, pos, r);
    monitorSound();
    touch(pos.x, pos.y, r * 3.6 + 3);
    wc.save();
    // A punched-out centre with uneven glass teeth, not a regular spiderweb.
    const count=12+Math.floor(Math.random()*10),turn=Math.random()*Math.PI*2,edge=[];
    const gaps=Array.from({length:count},()=>.45+Math.random()*1.4),total=gaps.reduce((a,b)=>a+b,0);let angle=turn;
    for(let i=0;i<count;i++){
      const a=angle;angle+=gaps[i]/total*Math.PI*2;
      const radius=r*(Math.random()<.3?.60+Math.random()*.18:.82+Math.random()*.18);
      edge.push({x:pos.x+Math.cos(a)*radius,y:pos.y+Math.sin(a)*radius,a,radius});
    }
    const path=points=>{wc.beginPath();points.forEach((p,i)=>i?wc.lineTo(p.x,p.y):wc.moveTo(p.x,p.y));};
    const polar=(a,d)=>({x:pos.x+Math.cos(a)*d,y:pos.y+Math.sin(a)*d});
    wc.globalCompositeOperation='destination-out';
    path(edge);wc.closePath();wc.fill();
    wc.globalCompositeOperation='source-atop';
    wc.lineJoin='miter';wc.lineCap='butt';
    function fissure(points,width,opacity){
      path(points);wc.strokeStyle=`rgba(30,32,37,${opacity})`;wc.lineWidth=width;wc.stroke();
      wc.save();wc.translate(-.65,-.65);path(points);wc.strokeStyle=`rgba(249,252,255,${opacity*.88})`;wc.lineWidth=Math.max(.4,width*.35);wc.stroke();wc.restore();
    }
    for(let i=0;i<count;i++){
      const e=edge[i],a=e.a,reach=r*(Math.random()<.18?2.8+Math.random()*.65:1.25+Math.random()*1.15);
      const mid=polar(a+(Math.random()-.5)*.10,r*(1.2+Math.random()*.3));
      const knee=polar(a+(Math.random()-.5)*.15,reach*.72),tip=polar(a+(Math.random()-.5)*.10,reach);
      // Narrow detached splinters have dark side faces and bright bevels.
      if(Math.random()<.23){
        const side=Math.random()<.5?1:-1,spread=.05+Math.random()*.07;
        const inner=polar(a+side*spread,r*(.88+Math.random()*.18));
        const shoulder=polar(a+side*spread*.9,r*(1.1+Math.random()*.35));
        const outer=polar(a+side*.035,Math.min(reach*.8,r*(1.25+Math.random()*.35)));
        const face=[e,mid,outer,shoulder,inner];
        path(face);wc.closePath();
        const shade=wc.createLinearGradient(e.x,e.y,shoulder.x,shoulder.y);
        shade.addColorStop(0,'rgba(18,20,25,.88)');shade.addColorStop(.23,'rgba(85,89,100,.38)');shade.addColorStop(.52,'rgba(241,245,249,.30)');shade.addColorStop(.76,'rgba(50,53,62,.68)');shade.addColorStop(1,'rgba(22,25,29,.82)');
        wc.fillStyle=shade;wc.fill();fissure([...face,e],1.1,.78);
        fissure([inner,shoulder,outer],2,.83);
        for(let k=0;k<3;k++){
          const t=.18+k*.23,u={x:mid.x+(outer.x-mid.x)*t,y:mid.y+(outer.y-mid.y)*t};
          const v={x:inner.x+(shoulder.x-inner.x)*t,y:inner.y+(shoulder.y-inner.y)*t};
          fissure([u,{x:(u.x+v.x)/2+(Math.random()-.5)*4,y:(u.y+v.y)/2+(Math.random()-.5)*4},v],.6+Math.random(),.30+Math.random()*.40);
        }
      }
      fissure([e,mid,knee,tip],Math.random()<.25?1.4:.7,.42+Math.random()*.35);
      if(Math.random()<.3){const fork=polar(a+.20,reach*.88);fissure([mid,knee,fork],.65,.46);}
      // Small irregular chips stay near the break; the long outer cracks remain clean.
      for(let k=0;k<3;k++){
        const t=Math.random(),d=e.radius+t*r*.72,aa=a+(Math.random()-.5)*.10;
        const v=polar(aa,d),sz=.3+Math.random()*.7;
        path([v,{x:v.x+sz*1.8,y:v.y-sz},{x:v.x+sz,y:v.y+sz*2}]);wc.closePath();
        wc.fillStyle=k%3?'rgba(239,242,247,.28)':'rgba(37,40,48,.38)';wc.fill();
      }
    }
    path(edge);wc.closePath();wc.lineWidth=2.2;wc.strokeStyle='rgba(21,23,29,.8)';wc.stroke();
    wc.save();wc.translate(-.7,-.7);path(edge);wc.closePath();wc.lineWidth=.8;wc.strokeStyle='rgba(253,254,255,.94)';wc.stroke();wc.restore();
    wc.restore();
    touch(pos.x, pos.y, r * 3.6 + 3);

    cursor.classList.remove('hit');
    void cursor.offsetWidth;
    cursor.classList.add('hit');
    checkScreenDamage();
  }
  let shatterBuffer = null;
  function monitorSound() {
    if (muted) return;
    sound(82, 0.25, 0.16, 'triangle');
    try {
      if (!ac) return;
      if (!shatterBuffer) {
        shatterBuffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.45), ac.sampleRate);
        const d = shatterBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++)
          d[i] = (Math.random() * 2 - 1) * Math.exp((-i / d.length) * 7);
      }
      const source = ac.createBufferSource(),
        filter = ac.createBiquadFilter(),
        gain = ac.createGain();
      source.buffer = shatterBuffer;
      filter.type = 'highpass';
      filter.frequency.value = 1700;
      gain.gain.value = 0.06;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(window.XPSounds.output);
      source.start();
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      for (const freq of [1700, 2750, 4100]) {
        const o = ac.createOscillator(),
          g = ac.createGain();
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.022, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.38);
        o.connect(g);
        g.connect(window.XPSounds.output);
        o.start();
        o.stop(ac.currentTime + 0.4);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
        };
      }
    } catch {}
  }
  function emitDust(p, n, c = color) {
    for (let i = 0; i < n; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      particles.push({
        x: p.x,
        y: p.y,
        vx: (Math.random() - 0.5) * 100,
        vy: -Math.random() * 90 - 12,
        life: 0.3 + Math.random() * 0.5,
        total: 0.8,
        size: 1 + Math.random() * 3,
        color: c,
      });
    }
    kick();
  }
  function spawnBubble(p) {
    if (bubbles.length >= MAX_BUBBLES) return;
    const r = 17 + Math.random() * 23;
    const b = {
      hue: Math.floor(Math.random() * 360),
      x: p.x + (Math.random() - 0.5) * 13,
      y: p.y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 42,
      vy: -25 - Math.random() * 38,
      r,
      age: 0,
      life: 1.6 + Math.random() * 1.2,
      phase: Math.random() * 6,
    };
    bubbles.push(b);
    kick();
  }
  function kick() {
    if (!frame && !inTick && !document.hidden) {
      clearTimeout(shimmerTimer);
      lastFrame = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    frame = 0;
    inTick = true;
    const dt = Math.min(0.035, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    fc.clearRect(0, 0, W, H);
    const jellyMoving = stepJellies(dt);
    renderJellies();
    wetMarks = wetMarks.filter((m) => now - m.born < m.duration);
    drawWetMarks(fc, now);
    if (blowing && now - lastBlow > 100) {
      spawnBubble(pointer);
      lastBlow = now;
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt;
      b.x += (b.vx + Math.sin(b.age * 4 + b.phase) * 14) * dt;
      b.y += b.vy * dt;
      if (b.age > b.life || b.y < 12 || b.x < 8 || b.x > W - 8) {
        popBubble(b);
        bubbles.splice(i, 1);
        continue;
      }
      drawBubble(b);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 130 * dt;
      fc.globalAlpha = Math.min(1, p.life * 2);
      fc.fillStyle = p.color;
      if (p.cloud) {
        p.size += dt * 10;
        p.vy -= 145 * dt;
        fc.globalAlpha = Math.min(0.16, p.life * 0.13);
        fc.drawImage(dustCloud, p.x - p.size * 3, p.y - p.size * 2, p.size * 6, p.size * 4);
      } else if (p.dust) {
        fc.globalAlpha *= 0.55;
        fc.beginPath();
        fc.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fc.fill();
      } else if (p.shard) {
        fc.save();
        fc.translate(p.x, p.y);
        fc.rotate(p.life * 5);
        fc.beginPath();
        fc.moveTo(-p.size, 0);
        fc.lineTo(p.size, -p.size * 0.5);
        fc.lineTo(p.size * 0.2, p.size);
        fc.closePath();
        fc.fill();
        fc.restore();
      } else fc.fillRect(p.x, p.y, p.size, p.size);
    }
    fc.globalAlpha = 1;
    const shardMoving = desktopShards.step(fc, dt);
    const materialMoving = screenMaterials.step(fc, dt, now);
    drawSoap(now);
    drawEraserBeat(now);
    const botMoving = stepBot(dt, now);
    inTick = false;
    if (
      blowing ||
      particles.length ||
      bubbles.length ||
      jellyMoving ||
      wetMarks.length ||
      soapMarks.length ||
      eraserBeat ||
      botMoving ||
      shardMoving
    )
      frame = requestAnimationFrame(tick);
    else if (materialMoving) shimmerTimer = setTimeout(kick, 125);
  }
  function startStroke(e) {
    if (!ready || e.button !== 0 || stroke || !activeTool || activeTool === 'stickers') return;
    e.preventDefault();
    ink.focus({ preventScroll: true });
    selectedSticker = null;
    $$('.placed').forEach((el) => el.classList.remove('selected'));
    pointer = pxy(e);
    ink.setPointerCapture(e.pointerId);
    if (['chalk', 'checker', 'ds', 'glitter', 'photo', 'gem'].includes(activeTool))
      nudgeJellies(pointer, pointer);
    const layer = activeTool === 'hammer' ? 'wall' : 'ink';
    stroke = {
      id: e.pointerId,
      last: pointer,
      kind: activeTool,
      action: ['bubble', 'jelly'].includes(activeTool) ? null : beginPixels(layer),
      lastStamp: pointer,
    };
    if (activeTool === 'bubble') {
      blowing = true;
      spawnBubble(pointer);
      lastBlow = performance.now();
      sound(780, 0.04, 0.012);
      kick();
    } else if (activeTool === 'chalk') paintChalk(pointer, pointer);
    else if (activeTool === 'checker' || activeTool === 'ds') paintExtra(pointer, pointer, activeTool);
    else if (activeTool === 'eraser') erase(pointer, pointer);
    else if (activeTool === 'jelly') grabJelly(pointer);
    else if (activeTool === 'glitter') paintGlitter(pointer, pointer);
    else if (activeTool === 'knife') scratch(pointer, pointer);
    else if (activeTool === 'hammer') smash(pointer);
    else if (activeTool === 'photo' || activeTool === 'gem') paintDecorPen(pointer, pointer, activeTool);
  }
  function moveStroke(e) {
    if (stroke && stroke.id !== e.pointerId) return;
    pointer = pxy(e);
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    if (
      e.pointerType !== 'touch' &&
      activeTool &&
      activeTool !== 'stickers' &&
      activeTool !== 'jelly'
    ) {
      cursor.style.display = 'block';
      const cursorSource =
        activeTool === 'eraser' ? eraserFrames[eraserLevel] || A.tools.eraser : A.tools[activeTool];
      if (cursor.getAttribute('src') !== cursorSource) cursor.src = cursorSource;
    }
    if (!stroke || stroke.id !== e.pointerId) return;
    const p = pointer,
      from = stroke.last;
    if (['chalk', 'checker', 'ds', 'glitter', 'photo', 'gem'].includes(stroke.kind)) nudgeJellies(from, p);
    if (stroke.kind === 'chalk') paintChalk(from, p);
    else if (stroke.kind === 'checker' || stroke.kind === 'ds') paintExtra(from, p, stroke.kind);
    else if (stroke.kind === 'eraser') erase(from, p);
    else if (stroke.kind === 'glitter') paintGlitter(from, p);
    else if (stroke.kind === 'knife') scratch(from, p);
    else if (stroke.kind === 'jelly') stretchJelly(p);
    else if (stroke.kind === 'photo' || stroke.kind === 'gem') paintDecorPen(from, p, stroke.kind);
    stroke.last = p;
    e.preventDefault();
  }
  function endStroke(e) {
    if (!stroke) return;
    if (e && e.pointerId !== stroke.id) return;
    blowing = false;
    const done = stroke;
    stroke = null;
    if (ink.hasPointerCapture(done.id)) ink.releasePointerCapture(done.id);
    if (done.kind === 'chalk' && done.copyPoints) pet.observeDrawing(done.copyPoints, color, size);
    if (done.kind === 'jelly') releaseJelly(done);
    else {
      if (done.kind === 'knife') finishCut(done);
      finishPixels(done.action);
    }
  }
  function reset(restoreWall = false) {
    if(restoreWall) desktopShards.clear();
    endStroke();
    const before = {
      peels: [...peeledSlots],
      wall: wc.getImageData(0, 0, W, H),
      ink: ic.getImageData(0, 0, W, H),
      stickers: captureStickers(),
      jellies: captureJellies(),
      eraserDirt,
      soap: sc.getImageData(0, 0, W, H),
      soapCount,
    };
    if(restoreWall) drawWallpaper();
    ic.clearRect(0, 0, W, H);
    stickerLayer.replaceChildren();
    selectedSticker = null;
    particles = [];
    bubbles = [];
    jellies = [];
    wetMarks = [];
    soapMarks = [];
    sc.clearRect(0, 0, W, H);
    soapCount = 0;
    eraserBeat = null;
    eraserDirt = 0;
    updateEraser();
    jellyDirty = true;
    renderJellies();
    fc.clearRect(0, 0, W, H);
    peeledSlots.clear();
    refreshPeels();
    const after = {
      peels: [],
      wall: wc.getImageData(0, 0, W, H),
      ink: ic.getImageData(0, 0, W, H),
      stickers: [],
      jellies: [],
      eraserDirt: 0,
      soap: null,
      soapCount: 0,
    };
    pushHistory({ kind: 'reset', before, after, bytes: W * H * 4 * 5 });
  }
  function restartComputer(force = false, instant = false) {
    miniGames.reset();
    if (!force && (!ready || exporting)) return;
    if (stroke) endStroke();
    ready = false;
    crashPending = false;
    revealedRatio = 0;
    reset(true);
    $$('.error-copy').forEach((el) => el.remove());
    blowing = false;
    screenMaterials.clear();
    desktopShards.clear();
    cancelAnimationFrame(frame);
    clearTimeout(shimmerTimer);
    frame = 0;
    history = [];
    future = [];
    historyBytes = 0;
    updateUndo();
    if (botState.active) pet.toggle();
    Object.assign(botState, { vx: 0, vy: 0, mode: 'rest', drag: null });
    pet.copy = null;
    pet.sequence = 0;
    pet.lastCopy = 0;
    gallery.forEach((item) => {if(item.url)URL.revokeObjectURL(item.url);if(item.thumbUrl)URL.revokeObjectURL(item.thumbUrl);});
    gallery = [];
    renderGallery();
    $('#note').value = '안냐세욤 슈퍼짱의 컴퓨터에욬>_<///';
    $('#note').style.fontSize = '';
    hammerFound = false;
    launches = 0;
    screenHits = 0;
    eraserBursts = 0;
    soapCount = 0;
    totalPops = 0;
    knifeSounds = 0;
    stickerId = 0;
    mischiefCount = 0;
    pet.prankAt = 0;
    pet.prankIndex = 0;
    jellyId = 0;
    eraserCooldown = 0;
    $('#tools-window [data-tool="hammer"]').classList.add('locked');
    const secret = $('.desktop-icon[data-open="secret"]');
    secret.disabled = false;
    recycleShaker.reset();
    secret.innerHTML = icon('game') + '<span>' + apps.secret.name + '</span>';
    $$('.window').forEach((w) => {
      close(w.dataset.app);
      w.classList.remove('maximized');
      delete w.dataset.positioned;
      w.style.left = '';
      w.style.top = '';
    });
    $$('.desktop-icon').forEach((el) => {
      el.classList.remove('selected');
      el.style.left = '';
      el.style.top = '';
    });
    color = colors[0];
    size = 10;
    peeledSlots.clear();
    refreshPeels();

    $$('.color').forEach((el) => {
      el.classList.toggle('active', el.dataset.color === color);
      el.setAttribute('aria-pressed', el.dataset.color === color);
    });
    hideStart();
    root.classList.remove('screen-impact');
    cursor.style.display = 'none';
    $('#boot').hidden = instant;
    if(!instant) window.XPSounds?.play('startup');
    clearInterval(adTimer);
    adVariant = -1;
    adShows = 0;
    setTimeout(() => {
      ready = true;
      setTool('chalk');
      open('tools');
      showAd();
      adTimer = setInterval(showAd, 60000);
      focusWindow(getWindow('tools'));
      $('#boot').hidden = true;
    }, instant ? 0 : 1500);
  }
  function drawWallpaper() {
    const img = images.wallpaper,
      aspect = desktop.clientWidth / desktop.clientHeight;
    let sw = img.width,
      sh = img.height;
    if (sw / sh > aspect) sw = sh * aspect;
    else sh = sw / aspect;
    wc.clearRect(0, 0, W, H);
    wc.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
  }
  function drawUnderlay() {
    uc.fillStyle = '#050c15';
    uc.fillRect(0, 0, W, H);
  }
  async function photo() {
    if (exporting || !ready) return;
    exporting = true;
    $$('[data-action="photo"]').forEach((b) => (b.disabled = true));
    try {
      endStroke();
      renderJellies();
      const out = document.createElement('canvas'),
        scale = Math.min(1.5, 1600 / desktop.clientWidth, 1200 / desktop.clientHeight);
      out.width = Math.round(desktop.clientWidth * scale);
      out.height = Math.round(desktop.clientHeight * scale);
      const c = out.getContext('2d');
      c.drawImage(under, 0, 0, out.width, out.height);
      c.drawImage(giant, 0, 0, out.width, out.height);
      c.drawImage(wall, 0, 0, out.width, out.height);
      c.drawImage(ink, 0, 0, out.width, out.height);
      c.drawImage(glitterCanvas, 0, 0, out.width, out.height);
      c.drawImage(soapCanvas, 0, 0, out.width, out.height);
      for (const el of stickerLayer.children) {
        const d = A.stickers[Number(el.dataset.index)],
          im = images['sticker' + el.dataset.index],
          s = el.offsetWidth * scale,
          h = el.offsetHeight * scale;
        const x = (parseFloat(el.style.left) * out.width) / 100,
          y = (parseFloat(el.style.top) * out.height) / 100;
        c.save();
        c.translate(x, y);
        c.rotate(((parseFloat(el.style.getPropertyValue('--turn')) || 0) * Math.PI) / 180);
        if (d.cutout) c.drawImage(im, -s / 2, -h / 2, s, h);
        else {
          c.fillStyle = '#fff';
          c.beginPath();
          if (el.classList.contains('round')) c.ellipse(0, 0, s / 2, h / 2, 0, 0, Math.PI * 2);
          else c.roundRect(-s / 2, -h / 2, s, h, 4 * scale);
          c.fill();
          c.clip();
          const border = 3 * scale;
          c.drawImage(im, -s / 2 + border, -h / 2 + border, s - border * 2, h - border * 2);
        }
        c.restore();
      }
      if (botState.active) {
        const f = botState.frame;
        c.save();
        c.translate((botState.x + 48) * scale, (botState.y + 48) * scale);
        c.scale(botState.face, 1);
        c.scale(botState.face, 1);
        c.drawImage(pet.canvas, -48 * scale, -48 * scale, 96 * scale, 96 * scale);
        c.restore();
      }
      c.drawImage(fx, 0, 0, out.width, out.height);
      c.drawImage(jellyCanvas, 0, 0, out.width, out.height);
      const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', .94));
      if (!blob) {
        notify('그림을 저장하지 못했습니다.');
        return;
      }
      const name = 'image_' + (++photoSerial) + '.jpg';
      const thumbnail=document.createElement('canvas');thumbnail.width=240;thumbnail.height=Math.max(1,Math.round(out.height*240/out.width));thumbnail.getContext('2d').drawImage(out,0,0,thumbnail.width,thumbnail.height);
      const thumbBlob=await new Promise(resolve=>thumbnail.toBlob(resolve,'image/jpeg',.82));
      gallery.unshift({ blob, name, thumbBlob });
      if (gallery.length > 12) {
        const old = gallery.pop();
        if (old.url) URL.revokeObjectURL(old.url);
        if (old.thumbUrl) URL.revokeObjectURL(old.thumbUrl);
      }
      renderGallery();
      download(blob, name);
      notify('사진이 저장되었습니다.\n내 사진에서 다시 볼 수 있습니다.');
      // Saving does not interrupt play with a gallery window.
      window.XPSounds?.play('ballon');
      markSessionChanged();
    } catch (error) {
      console.error(error);
      notify('그림을 준비하지 못했습니다. 다시 촬영해 주세요.');
    } finally {
      exporting = false;
      $$('[data-action="photo"]').forEach((b) => (b.disabled = false));
    }
  }
  let photoSerial=0,viewedPhoto=null;
  $('#photo-download').addEventListener('click',()=>{if(viewedPhoto)download(viewedPhoto.blob,viewedPhoto.name);});
  function renderGallery() {
    $('#gallery').replaceChildren();
    if(!gallery.length){$('#gallery').innerHTML='<p class="empty">저장한 그림이 없습니다.</p>';return;}
    for(const item of gallery){
      item.url ||= URL.createObjectURL(item.blob);
      item.thumbUrl ||= URL.createObjectURL(item.thumbBlob||item.blob);
      const button=document.createElement('button'),im=new Image(),label=document.createElement('span');
      button.className='photo-file';im.src=item.thumbUrl;im.alt=item.name;im.loading='lazy';im.decoding='async';label.textContent=item.name;
      button.append(im,label);button.addEventListener('click',()=>{viewedPhoto=item;$('#photo-preview-image').src=item.url;$('#photo-preview-image').alt=item.name;open('photo-viewer');$('#photo-viewer-window .titlebar>span').textContent=item.name;});$('#gallery').append(button);
    }
  }
  function download(blob, name) {
    // Keep the resource alive while a mobile browser hands it to its download UI.
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function markSessionChanged() {
    jellyDirty = true;
    if (ready) {
      renderJellies();
      screenMaterials.sampleAt = 0;
      kick();
    }
  }
  let artworkViewport={w:desktop.clientWidth,h:desktop.clientHeight};
  function fit() {
    const nw=desktop.clientWidth,nh=desktop.clientHeight;
    if(nw!==artworkViewport.w||nh!==artworkViewport.h){
      for(const layer of [ink,soapCanvas,glitterCanvas]){const tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;const g=tmp.getContext('2d');g.drawImage(layer,0,0);const target=layer.getContext('2d');target.clearRect(0,0,W,H);target.drawImage(tmp,0,0,W*artworkViewport.w/nw,H*artworkViewport.h/nh);}
      if(images.wallpaper){const mask=document.createElement('canvas');mask.width=W;mask.height=H;mask.getContext('2d').drawImage(wall,0,0);drawWallpaper();wc.save();wc.globalCompositeOperation='destination-in';wc.drawImage(mask,0,0);wc.restore();}
      artworkViewport={w:nw,h:nh};
    }
    drawGiant();
    refractionKey = '';
    jellyDirty = true;
    renderJellies();
    for (const el of $$('.window')) {
      if(el.classList.contains('maximized')){fitWindowZoom(el);continue;}
      if (el.hidden || el.dataset.app === 'ad') continue;
      el.style.left =
        clamp(el.offsetLeft, 0, Math.max(0, desktop.clientWidth - el.offsetWidth)) + 'px';
      el.style.top = clamp(el.offsetTop, 0, Math.max(0, desktop.clientHeight - el.offsetHeight)) + 'px';
    }
    for (const el of $$('.desktop-icon')) {
      if (el.offsetLeft > desktop.clientWidth - el.offsetWidth)
        el.style.left = Math.max(0, desktop.clientWidth - el.offsetWidth) + 'px';
      if (el.offsetTop > desktop.clientHeight - el.offsetHeight)
        el.style.top = Math.max(0, desktop.clientHeight - el.offsetHeight) + 'px';
    }
  }
  function clock() {
    $('#clock').textContent = new Date().toLocaleTimeString(languageUI.language === 'ko' ? 'ko-KR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    });
  }
  let adTimer = 0;
  async function boot() {
    await gelRenderer.initialized;
    const bot = $('#desktop-bot');
    const botIcon = document.querySelector('.desktop-icon[data-open=bot]');
    botIcon.querySelector('.xp-icon,svg,.bot-menu-icon')?.remove();
    const botThumb = document.createElement('i');
    botThumb.className = 'bot-thumb';
    botThumb.style.backgroundImage = 'url(' + window.BOT_ASSET.src + ')';
    botIcon.prepend(botThumb);
    const started = performance.now();
    const sources = {
      giant: window.BOT_ASSET.giant,
      eyes: window.BOT_ASSET.eyes,
      bot: window.BOT_ASSET.src,
      wallpaper: A.wallpaper,
      ...A.tools,
      ...Object.fromEntries(A.stickers.map((s, i) => ['sticker' + i, s.src])),
    };
    await Promise.all(
      Object.entries(sources).map(async ([key, src]) => {
        const im = new Image();
        im.src = src;
        await im.decode();
        images[key] = im;
      }),
    );
    buildBrushes();
    buildBubbleArt();
    drawWallpaper();
    drawUnderlay();
    drawGiant();
    renderPalette();
    buildEraserArt();
    updateEraser();
    ready = true;
    setTool('chalk');
    open('tools');
    showAd();
    adTimer = setInterval(showAd, 60000);
    focusWindow(getWindow('tools'));
    clock();
    setInterval(clock, 1000);
    setTimeout(() => ($('#boot').hidden = true), Math.max(0, 900 - (performance.now() - started)));
  }
  getWindow('ad')
    .querySelectorAll('[data-win]')
    .forEach((b) => {
      if (b.dataset.win !== 'close') b.remove();
    });
  getWindow('error')
    .querySelectorAll('[data-win]')
    .forEach((b) => {
      if (b.dataset.win !== 'close') b.remove();
    });
  $$('.window').forEach(wireWindow);
  $$('.desktop-icon').forEach(wireIcon);
  $$('[data-open]:not(.desktop-icon)').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.open)),
  );
  $$('#tools-window [data-tool]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!b.classList.contains('locked')) setTool(b.dataset.tool);
      else window.XPSounds?.play('ding');
    }),
  );
  $$('[data-color]').forEach((b) =>
    b.addEventListener('click', () => {
      color = b.dataset.color;
      $$('[data-color]').forEach((el) => {
        el.classList.toggle('active', el === b);
        el.setAttribute('aria-pressed', String(el === b));
      });
      if (activeTool !== 'chalk') setTool('chalk');
    }),
  );

  $('#retry-game').addEventListener('click', launchGame);
  $('#error-ok').addEventListener('click', () => close('error'));

  $('#start').addEventListener('click', () => {
    window.XPSounds?.play('load');
    const hidden = !$('#start-menu').hidden;
    $('#start-menu').hidden = hidden;
    $('#start').classList.toggle('active', !hidden);
  });
  $('#sound').addEventListener('click', toggleSound);
  $('#note').addEventListener('input', () => {
    markSessionChanged();
  });
  $('#note-font').addEventListener('click', () => {
    $('#note').style.fontSize = $('#note').style.fontSize === '16px' ? '13px' : '16px';
  });
  $$('[data-action]').forEach((b) =>
    b.addEventListener('click', async () => {
      const a = b.dataset.action;
      if (a === 'new') {window.XPSounds?.play('ding');reset();}
      else if (a === 'photo') photo();
      else if (a === 'sound') toggleSound();
      else if (a === 'desktop')
        $$('.window').forEach((w) => {
          if (!w.hidden) minimize(w.dataset.app);
        });
      else if (a === 'shutdown') { hideStart(); restartComputer(true); }
      else if (a === 'reboot') {
        window.XPSounds?.play('shutdown');
        setTimeout(() => restartComputer(), 2400);
      }
    }),
  );
  ink.addEventListener('pointerdown', startStroke);
  ink.addEventListener('pointermove', moveStroke);
  ink.addEventListener('pointerup', endStroke);
  ink.addEventListener('pointercancel', endStroke);
  ink.addEventListener('lostpointercapture', endStroke);
  ink.addEventListener('pointerleave', () => {
    if (!stroke) cursor.style.display = 'none';
  });
  desktop.addEventListener('pointermove', (e) => {
    if (e.target !== ink) cursor.style.display = 'none';
  });
  desktop.addEventListener('contextmenu', (e) => {
    if (e.target === ink) {
      e.preventDefault();
      open('tools');
    }
  });
  root.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#start-menu') && !e.target.closest('#start')) hideStart();
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('textarea,input')) return;
    if (e.key === 'Escape') {
      endStroke();
      setTool(null);
      hideStart();
      return;
    }
    if (e.key === 'Delete' && selectedSticker) {
      const before = captureStickers();
      selectedSticker.remove();
      selectedSticker = null;
      pushHistory({
        kind: 'stickers',
        before,
        after: captureStickers(),
        bytes: 4096,
      });
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        photo();
      }
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 7)
      setTool(['chalk', 'eraser', 'bubble', 'jelly', 'photo', 'knife', 'gem'][n - 1]);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      endStroke();
      blowing = false;
      cancelAnimationFrame(frame);
      frame = 0;
      markSessionChanged();
    } else if (
      screenMaterials.active ||
      botState.active ||
      particles.length ||
      bubbles.length ||
      wetMarks.length ||
      soapMarks.length ||
      eraserBeat ||
      jellies.some((j) => j.phase !== 'sleep')
    )
      kick();
  });
  window.addEventListener('blur', () => {
    endStroke();
    blowing = false;
    cursor.style.display = 'none';
  });
  window.addEventListener('pagehide', () => {
    markSessionChanged();
  });
  window.addEventListener('resize', fit);
  // Small read-only diagnostics used for performance verification.
  Object.defineProperty(window, 'paintDiagnostics', {
    get: () =>
      Object.freeze({
        ready,
        activeTool,
        particles: particles.length,
        bubbles: bubbles.length,
        frameScheduled: !!frame,
        historyBytes,
        historyLength: history.length,
        stickers: stickerLayer.childElementCount,
        hammerFound,
        exporting,
        jellies: jellies.length,
        jellyBodies: jellies.map((j) => ({
          id: j.id,
          x: j.x,
          y: j.y,
          ax: j.ax,
          ay: j.ay,
          phase: j.phase,
          height: j.height,
          vx: j.vx,
          vy: j.vy,
          size: j.size,
          seed: j.seed,
          lobes: j.lobes,
          pull: j.pull,
          stretch: Math.hypot(j.x - j.ax, j.y - j.ay),
        })),
        wetMarks: wetMarks.length,
        eraserDirt,
        eraserBursts,
        soapMarks: soapMarks.length,
        totalPops,
        eraserBeat: eraserBeat?.count ?? null,
        peeledSlots: [...peeledSlots],
        mischiefCount,
        gelRenderer: gelRenderer.ready ? gelRenderer.backend : 'canvas',
        gelError: gelRenderer.error || null,
        jellyModels: gelRenderer.models?.map(m => ({name:m.name,triangles:m.count/3})) || [],
        screenHits,
        revealedRatio,
        crashPending,
        glass: desktopShards.items.map((p) => ({ x: p.x, y: p.y, settled: p.settled })),
        glitterPoints: screenMaterials.glitter.length,
        petMode: botState.mode,
        soapCount,
        knifeSounds,
        adVariant,
        adShows,
        bot: {
          active: botState.active,
          x: botState.x,
          y: botState.y,
          frame: botState.frame,
          dragging: !!botState.drag,
        },
      }),
  });
  boot().catch((error) => {
    console.error(error);
    $('#boot').hidden = true;
    notify('이미지를 불러오지 못했습니다. 새로고침해 주세요.');
  });
})();
