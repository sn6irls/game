// School Meal background track and synthesized desktop sound effects.
// Playback starts after the first click or key press.
const AudioSys = (() => {
  let ctx = null, master = null;
  const bgm=new Audio(CONFIG.audio.bgm);bgm.loop=true;bgm.preload='metadata';bgm.volume=CONFIG.audio.bgmVolume;
  let bgmRevision=0;
  let muted = false, started = false;
  let suppressed = false;   // Games and the playlist suppress desktop BGM.

  //  소리를 못 켜도(브라우저가 WebAudio 를 막았거나 오래된 브라우저) 앱은 그냥 조용히 돌아갑니다.
  function init() {
    started = true; // HTML music can play even when synthesized effects are unavailable.
    if(ctx){ctx.resume?.().catch(()=>{});return;}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      started = true;
    } catch (err) {
      ctx = master = null;
      console.warn('[sng:audio] 효과음을 켤 수 없어요. 배경음악은 계속 사용할 수 있습니다.', err);
    }
  }

  // 짧은 음 하나
  function tone(freq, dur, { type = 'square', gain = 0.1, attack = 0.005, dest = null, slide = 0 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ⚡ 노이즈 버퍼는 길이별로 한 번만 만들어 재사용합니다.
  //    전에는 햇·귀뚜라미가 울릴 때마다(약 0.15초에 한 번) 버퍼를 새로 만들고
  //    Math.random() 을 수천 번 돌렸습니다 — 소리는 그대로인데 GC 만 늘었습니다.
  const noiseCache = new Map();
  function noiseBuffer(dur) {
    const key = Math.round(dur * 1000);
    let buf = noiseCache.get(key);
    if (buf && buf.sampleRate === ctx.sampleRate) return buf;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noiseCache.set(key, buf);
    return buf;
  }

  // 노이즈 (햇/바람/치익)
  function noiseBurst(dur, freq, gain, dest) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const buf = noiseBuffer(dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest || master);
    src.start(t);
  }

  // Reuse School Meal's original track at a quieter desktop level.
  function playBGM(){
    if(!started||suppressed||muted||document.hidden||window.__COMPUTER_GAME_ACTIVE){stopBGM();return;}
    if(!bgm.paused)return;
    const revision=++bgmRevision;bgm.muted=false;bgm.volume=CONFIG.audio.bgmVolume;
    bgm.play().then(()=>{if(revision!==bgmRevision&&(suppressed||muted||document.hidden||window.__COMPUTER_GAME_ACTIVE))bgm.pause();}).catch(()=>{});
  }
  function stopBGM(){++bgmRevision;bgm.pause();}
  addEventListener('computer-game-change',()=>{if(window.__COMPUTER_GAME_ACTIVE)stopBGM();});

  // ── 효과음 ──
  const sfxMap = {
    click() { tone(700, 0.05, { gain: 0.07 }); tone(950, 0.05, { gain: 0.05, attack: 0.02 }); },
    open() { tone(520, 0.08, { type: 'triangle', gain: 0.09 }); setTimeout(() => tone(780, 0.1, { type: 'triangle', gain: 0.09 }), 70); },
    close() { tone(700, 0.08, { type: 'triangle', gain: 0.08 }); setTimeout(() => tone(440, 0.1, { type: 'triangle', gain: 0.08 }), 70); },
    switch() { noiseBurst(0.4, 1200, 0.12); tone(300, 0.4, { type: 'sine', gain: 0.08, slide: 700 }); },
    ding() { [1319, 1568, 2093].forEach((f, i) => setTimeout(() => tone(f, 0.5, { type: 'sine', gain: 0.1 }), i * 85)); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, i === 3 ? 0.7 : 0.18, { type: 'triangle', gain: 0.12 }), i * 130)); },
    start() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.15, { type: 'triangle', gain: 0.1 }), i * 60)); },
    yum() { tone(300, 0.07, { type: 'square', gain: 0.06, slide: 150 }); },
    sleep() { tone(400, 0.6, { type: 'sine', gain: 0.06, slide: -200 }); },
  };

  return {
    init,
    playBGM,
    stopBGM,
    // 🎵 유튜브 플레이리스트가 켜지면 true — 이 동안 playBGM 호출은 무시됩니다
    suppressBGM(on) {
      suppressed = !!on;
      if (suppressed) stopBGM();
      return suppressed;
    },
    isSuppressed: () => suppressed,
    // 효과음은 "있으면 좋은" 것 — 실패해도 클릭 동작 자체는 계속됩니다
    sfx(name) {
      if (!started) return;
      try { sfxMap[name]?.(); } catch (err) { console.warn('[sng:audio] sfx', name, err); }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      if(muted)stopBGM();else playBGM();
      return muted;
    },
    isStarted: () => started,
    isMuted: () => muted,
    snapshot:()=>({started,muted,suppressed,bgmPlaying:!bgm.paused,bgmVolume:bgm.volume,bgmSource:bgm.currentSrc||bgm.src}),
  };
})();
