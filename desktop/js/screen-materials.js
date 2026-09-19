/* Bounded, pixel-stepped glitter on a layer below the jelly surface. */
window.ScreenMaterials = class {
  constructor(w, h, ink, glints) {
    this.glints = glints;
    this.w = w;
    this.h = h;
    this.ink = ink;
    this.glitter = [];
    this.cells = new Set();
    this.lastFrame = -1;
    this.sampleAt = 0;
    this.mask = document.createElement('canvas');
    this.mask.width = 320;
    this.mask.height = 200;
    this.mg = this.mask.getContext('2d', { willReadFrequently: true });
  }
  get active() {
    return this.glitter.some((p) => p.visible);
  }
  clear() {
    this.glitter = [];
    this.cells = new Set();
    this.lastFrame = -1;
    this.glints.clearRect(0, 0, this.w, this.h);
  }
  addGlitter(a, b, size) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = a.x + (b.x-a.x)*t, y = a.y + (b.y-a.y)*t;
      const key = Math.floor(x / 12) + ":" + Math.floor(y / 12);
      if (this.cells.has(key)) continue;
      this.cells.add(key);
      this.glitter.push({
        key,
        x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * size * 0.2,
        y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * size * 0.2,
        phase: Math.random() * 6.28,
        visible: true,
      });
    }
    while(this.glitter.length>600){const old=this.glitter.shift();this.cells.delete(old.key);}
    // One sparkle per spatial cell keeps every stroke alive without unbounded growth.
    this.sampleAt = 0;
  }
  step(g, dt, now) {
    const frame = Math.floor(now / 125);
    if (frame === this.lastFrame) return this.active;
    this.lastFrame = frame;
    let moving = false;
    if (this.glitter.length && now > this.sampleAt) {
      this.sampleAt = now + 300;
      this.mg.clearRect(0, 0, 320, 200);
      this.mg.drawImage(this.ink.canvas, 0, 0, 320, 200);
      const data = this.mg.getImageData(0, 0, 320, 200).data;
      for (const p of this.glitter) {
        const x = Math.max(0, Math.min(319, ((p.x / this.w) * 320) | 0)),
          y = Math.max(0, Math.min(199, ((p.y / this.h) * 200) | 0));
        p.visible = data[(y * 320 + x) * 4 + 3] > 5;
      }
    }
    const pixels = this.w / Math.max(320, this.ink.canvas.getBoundingClientRect().width);
    const sparkle = this.glints;
    sparkle.clearRect(0, 0, this.w, this.h);
    for (const p of this.glitter) {
      if (!p.visible) continue;
      moving = true;
      const phase = (frame + Math.floor(p.phase * 9)) % 8;
      const x = Math.round(p.x / pixels) * pixels,
        y = Math.round(p.y / pixels) * pixels;
      sparkle.fillStyle =
        phase === 2 ? '#fffde9' : phase === 1 || phase === 3 ? '#fff2b8a0' : '#fff5df35';
      sparkle.fillRect(x, y, pixels, pixels);
      if (phase === 2) {
        sparkle.fillRect(x - 2 * pixels, y, 5 * pixels, pixels);
        sparkle.fillRect(x, y - 2 * pixels, pixels, 5 * pixels);
      }
    }
    return moving;
  }
};
