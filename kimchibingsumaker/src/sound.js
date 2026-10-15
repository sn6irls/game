export const SOUND_FILES = {
  openLid: "openlid.MP3",
  closeLid: "Close lid.MP3",
  putKimchi: "putinkimchi.MP3",
  end: "end.MP3",
  bowlMove: "bowl1.MP3",
  bowlReturn: "bowl2.MP3",
  sauce1: "sauce1.MP3",
  sauce2: "sauce2.MP3",
  shaveKimchi: "shavekimchi.MP3",
};
const sampleVolumes = {
  openLid: 1,
  closeLid: 2.2,
  putKimchi: 2.4,
  end: 1,
  bowlMove: 2.2,
  bowlReturn: 1.2,
  sauce1: 1.8,
  sauce2: 3.4,
  shaveKimchi: 1.8,
};

export class Sound {
  constructor(getTime, isHidden) {
    this.getTime = getTime;
    this.isHidden = isHidden;
    this.ctx = null;
    this.samples = new Map();
    this.loading = new Map();
    this.voices = new Map();
    this.squeezePlayed = false;
    this.nextSauce = 0;
    this.nextBowl = 0;
    // Download early, but create/resume audio only after a user gesture.
    this.sampleData = new Map(Object.entries(SOUND_FILES).map(([name, file]) => [
      name,
      fetch(new URL(`../assets/sound/${file}`, import.meta.url))
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .catch((error) => {
          console.warn(`Sound unavailable: ${file}`, error);
          return null;
        }),
    ]));
  }
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(c.destination);
      this.buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < d.length; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.07) / 1.02;
        d[i] = brown * 3;
      }
      this.grinding = this.loop(1800, 1.1);
      this.pouring = this.loop(620, 1.4);
      this.ambient = this.loop(420, 1.8);
      this.ambient.gain.gain.value = 0.007;
      const osc = c.createOscillator(),
        gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = 69;
      gain.gain.value = 0.0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.wet = { osc, gain };
      for (const name of Object.keys(SOUND_FILES)) this.loadSample(name);
      this.loadSample("shaveKimchi").then((buffer) => {
        if (!buffer) return;
        // Soften the loop seam without changing the supplied MP3 file.
        const fade = Math.min(Math.round(buffer.sampleRate * 0.005), buffer.length >> 1);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = 0; i < fade; i++) {
            const gain = i / fade;
            data[i] *= gain;
            data[data.length - 1 - i] *= gain;
          }
        }
        const source = c.createBufferSource(), gain = c.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.master);
        source.start();
        this.shaving = { source, gain };
      });
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }
  loadSample(name) {
    if (!this.loading.has(name)) {
      this.loading.set(name, this.sampleData.get(name)
        .then((data) => data && this.ctx.decodeAudioData(data))
        .then((decoded) => {
          const buffer = decoded && this.trimSilence(decoded);
          if (buffer) this.samples.set(name, buffer);
          return buffer;
        })
        .catch((error) => {
          console.warn(`Sound decode failed: ${SOUND_FILES[name]}`, error);
          return null;
        }));
    }
    return this.loading.get(name);
  }
  trimSilence(buffer) {
    const channels = Array.from({ length: buffer.numberOfChannels },
      (_, channel) => buffer.getChannelData(channel));
    let peak = 0, first = buffer.length, last = -1;
    for (const data of channels)
      for (const value of data) peak = Math.max(peak, Math.abs(value));
    const threshold = Math.max(0.001, peak * 0.01);
    for (const data of channels) {
      for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > threshold) {
          first = Math.min(first, i);
          last = Math.max(last, i);
        }
      }
    }
    if (last < first) return buffer;
    // Preserve short tails while removing recording silence from touch feedback.
    const padding = Math.round(buffer.sampleRate * 0.012);
    first = Math.max(0, first - padding);
    last = Math.min(buffer.length, last + padding + 1);
    const trimmed = this.ctx.createBuffer(channels.length, last - first, buffer.sampleRate);
    channels.forEach((data, channel) =>
      trimmed.getChannelData(channel).set(data.subarray(first, last)));
    return trimmed;
  }
  bowl() {
    this.play(this.nextBowl === 0 ? "bowlMove" : "bowlReturn", "bowl");
    this.nextBowl = 1 - this.nextBowl;
  }
  play(name, group = name) {
    if (!this.ctx || this.isHidden()) return;
    this.stop(group);
    const c = this.ctx, requestedAt = c.currentTime;
    const voice = { source: null, gain: null };
    this.voices.set(group, voice);
    const start = (buffer) => {
      if (this.voices.get(group) !== voice) return;
      // Do not replay a late download after the matching action has ended.
      if (!buffer || this.isHidden() || c.currentTime - requestedAt > 0.35) {
        this.voices.delete(group);
        return;
      }
      const source = c.createBufferSource(), gain = c.createGain();
      source.buffer = buffer;
      gain.gain.value = sampleVolumes[name];
      source.connect(gain);
      gain.connect(this.master);
      Object.assign(voice, { source, gain });
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.voices.get(group) === voice) this.voices.delete(group);
      };
      source.start();
    };
    if (this.samples.has(name)) start(this.samples.get(name));
    else this.loadSample(name).then(start);
  }
  stop(group) {
    const voice = this.voices.get(group);
    if (!voice) return;
    this.voices.delete(group);
    if (voice.source) {
      const now = this.ctx.currentTime;
      voice.gain.gain.setTargetAtTime(0, now, 0.006);
      voice.source.stop(now + 0.03);
    }
  }
  squeeze() {
    if (this.squeezePlayed) return;
    this.squeezePlayed = true;
    this.play(this.nextSauce === 0 ? "sauce1" : "sauce2", "sauce");
    this.nextSauce = 1 - this.nextSauce;
  }
  endSqueeze() {
    this.squeezePlayed = false;
    // A quick tap still completes its one-shot; cancel only an unready sample.
    if (!this.voices.get("sauce")?.source) this.stop("sauce");
  }
  stopEffects() {
    for (const group of this.voices.keys()) this.stop(group);
  }
  loop(freq, q) {
    const c = this.ctx,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = this.buffer;
    s.loop = true;
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.value = 0;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
    return { source: s, filter: f, gain: g };
  }
  tap(type = "wood") {
    if (!this.ctx) return;
    const c = this.ctx,
      n = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type === "glass" ? "sine" : "triangle";
    o.frequency.setValueAtTime(
      type === "glass" ? 1050 : type === "drop" ? 160 : 290,
      n,
    );
    o.frequency.exponentialRampToValueAtTime(
      type === "glass" ? 800 : 65,
      n + 0.13,
    );
    g.gain.setValueAtTime(type === "glass" ? 0.07 : 0.12, n);
    g.gain.exponentialRampToValueAtTime(0.0001, n + 0.18);
    o.connect(g);
    g.connect(this.master);
    o.start(n);
    o.stop(n + 0.2);
    if (type !== "glass") {
      const s = c.createBufferSource(),
        f = c.createBiquadFilter(),
        gn = c.createGain();
      s.buffer = this.buffer;
      f.type = "lowpass";
      f.frequency.value = 1800;
      gn.gain.setValueAtTime(0.5, n);
      gn.gain.exponentialRampToValueAtTime(0.001, n + 0.075);
      s.connect(f);
      f.connect(gn);
      gn.connect(this.master);
      s.start();
      s.stop(n + 0.08);
    }
  }
  update(grind, pour) {
    if (!this.ctx) return;
    const c = this.ctx,
      n = c.currentTime;
    this.master.gain.setTargetAtTime(!this.isHidden() ? 0.5 : 0, n, 0.07);
    this.grinding.gain.gain.setTargetAtTime(
      grind * 0.35 * (0.65 + 0.35 * Math.sin(this.getTime() * 48) ** 2),
      n,
      0.035,
    );
    this.grinding.filter.frequency.setTargetAtTime(800 + grind * 1900, n, 0.05);
    this.shaving?.gain.gain.setTargetAtTime(
      grind * sampleVolumes.shaveKimchi, n, 0.04,
    );
    this.pouring.gain.gain.setTargetAtTime(pour * 0.21, n, 0.04);
    this.pouring.filter.frequency.setTargetAtTime(
      550 + Math.sin(this.getTime() * 14) * 95,
      n,
      0.06,
    );
    this.wet.gain.gain.setTargetAtTime(
      pour * 0.035 * (0.5 + 0.5 * Math.sin(this.getTime() * 17)),
      n,
      0.035,
    );
    this.ambient.gain.gain.setTargetAtTime(
      0.007 * (0.9 + 0.1 * Math.sin(this.getTime() * 0.6)),
      n,
      0.03,
    );
  }
}
