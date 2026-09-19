/* Autonomous desktop companion. Host provides drawing and scheduling hooks. */
window.DesktopPet = class {
  constructor({ element, desktop, asset, wake, onDoodle, onMischief, getJellyTarget }) {
    this.el = element;
    this.desktop = desktop;
    this.wake = wake;
    this.onDoodle = onDoodle;
    this.onMischief = onMischief;
    this.getJellyTarget=getJellyTarget;this.jellyHitAt=0;this.jellySeekAt=0;
    this.prankAt = 0;
    this.prankIndex = 0;
    this.image = new Image();
    this.image.src = asset;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 128;
    this.canvas.className = 'pet-sprite';
    this.g = this.canvas.getContext('2d');
    this.speech = document.createElement('span');
    this.speech.className = 'pet-speech';
    this.speech.hidden = true;
    element.replaceChildren(this.canvas, this.speech);
    element.style.backgroundImage = 'none';
    this.s = {
      active: false,
      x: 230,
      y: 280,
      vx: 0,
      vy: 0,
      tx: 230,
      ty: 280,
      drag: null,
      face: 1,
      frame: 4,
      mode: 'rest',
      until: 0,
    };
    this.pointer = { x: 700, y: 500 };
    this.sequence = 0;
    this.lastDraw = 0;
    this.lastCopy = 0;
    this.timer = 0;
    element.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      element.setPointerCapture(e.pointerId);
      const rect=this.desktop.getBoundingClientRect();
      this.s.drag = {
        id: e.pointerId,
        x: e.clientX-rect.left-48,
        y: e.clientY-rect.top-12,
        ox: rect.left+48,
        oy: rect.top+12,
      };
      this.enter('held', 999);
      this.say(window.PET_DIALOGUE.held);
    });
    element.addEventListener('pointermove', (e) => {
      const d = this.s.drag;
      if (d && d.id === e.pointerId) {
        d.x = e.clientX - d.ox;
        d.y = e.clientY - d.oy;
        wake();
      }
    });
    const release = (e) => {
      const d = this.s.drag;
      if (!d || d.id !== e.pointerId) return;
      this.s.drag = null;
      if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
      this.s.tx = Math.max(0, Math.min(desktop.clientWidth - 96, d.x));
      this.s.ty = Math.max(0, Math.min(desktop.clientHeight - 96, d.y));
      this.s.vy = 30;
      this.s.vx = Math.max(-140, Math.min(140, this.s.vx));
      this.dropFloor = Math.min(desktop.clientHeight - 96, this.s.y + 150);
      this.enter('fall', 3);
      this.say(window.PET_DIALOGUE.dizzy);
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    this.image.onload = () => this.draw(performance.now());
  }
  say(text) {
    if(Array.isArray(text)){this.dialogueTurns ||= new Map();const turn=this.dialogueTurns.get(text)||0;this.dialogueTurns.set(text,turn+1);text=text[turn%text.length];}
    clearTimeout(this.speechTimer);
    this.speech.textContent = text;
    this.speech.hidden = false;
    this.speechTimer = setTimeout(() => (this.speech.hidden = true), 2400);
  }
  enter(mode, seconds) {
    clearTimeout(this.timer);
    this.s.mode = mode;
    this.s.until = performance.now() + seconds * 1000;
    this.timer = setTimeout(() => this.wake(), seconds * 1000 + 20);
    this.wake();
  }
  toggle() {
    this.s.active = !this.s.active;
    this.el.hidden = !this.s.active;
    if (this.s.active) {
      this.prankAt = performance.now() + 8000;
      this.s.x = Math.min(this.desktop.clientWidth - 110, 230);
      this.s.y = Math.min(this.desktop.clientHeight - 110, 350);
      this.s.tx = this.s.x;
      this.s.ty = this.s.y;
      this.enter('rest', 2);
      this.say(window.PET_DIALOGUE.hello);
    } else {
      clearTimeout(this.timer);
      clearTimeout(this.speechTimer);
      this.s.drag = null;
    }
    return this.s.active;
  }
  movePointer(x, y) {
    this.pointer = { x, y };
    if (!this.s.active || this.s.drag || ['fall', 'dizzy', 'prank'].includes(this.s.mode)) return;
    const distance = Math.hypot(x - this.s.x - 48, y - this.s.y - 48);
    if (distance < 64 && this.s.mode !== 'follow' && this.s.mode !== 'draw') {
      this.enter('follow', 12);
      this.say(window.PET_DIALOGUE.follow);
    }
    if (this.s.mode === 'follow') {
      if (distance > 350) {
        this.s.tx = this.s.x;
        this.s.ty = this.s.y;
        this.enter('coast', 3);
        this.say(window.PET_DIALOGUE.goodbye);
      } else {
        this.s.tx = Math.max(0, Math.min(this.desktop.clientWidth - 96, x + 18));
        this.s.ty = Math.max(0, Math.min(this.desktop.clientHeight - 96, y + 12));
        this.wake();
      }
    }
  }
  observeDrawing(points, color, size) {
    if (
      !this.s.active ||
      points.length < 3 ||
      performance.now() - this.lastCopy < 3500 ||
      this.s.drag ||
      ['fall', 'dizzy', 'prank'].includes(this.s.mode)
    )
      return;
    this.lastCopy = performance.now();
    this.copy = { points: points.map((p) => ({ ...p })), color, size };
    this.enter('draw', 2.5);
    this.say(window.PET_DIALOGUE.copy);
    this.copyAt = performance.now() + 500;
  }
  choose() {
    const mode = ['wander', 'dream', 'dance', 'doze', 'wander', 'dream'][this.sequence++ % 6];
    if (mode === 'wander') {
      this.s.tx = 30 + Math.random() * Math.max(1, this.desktop.clientWidth - 140);
      this.s.ty = 80 + Math.random() * Math.max(1, this.desktop.clientHeight - 190);
    }
    this.enter(mode, mode === 'sleep' ? 7 : mode === 'wander' ? 5 : 4);
    if (mode === 'sleep') this.say(window.PET_DIALOGUE.sleep);
    if (mode === 'dance') this.say(window.PET_DIALOGUE.dance);
    if (mode === 'dream') this.say(window.PET_DIALOGUE.dream);
  }
  step(dt, now) {
    const s = this.s;
    if (!s.active) return false;
    if (now > s.until && !s.drag) {
      if(s.mode==='doze'){this.enter('sleep',7);this.say(window.PET_DIALOGUE.sleep);}
      else if(s.mode === 'follow'){s.tx=s.x;s.ty=s.y;this.enter('coast',3);this.say(window.PET_DIALOGUE.goodbye);}
      else this.choose();
    }
    if(!s.drag&&s.mode==='wander'){
      if(now>this.jellySeekAt){const target=this.getJellyTarget?.(s.x,s.y);if(target){s.tx=target.x;s.ty=target.y;}this.jellySeekAt=now+900;}
      if(now>this.jellyHitAt&&this.onMischief?.('jelly',s.x,s.y,true)){
        this.onMischief('jelly',s.x,s.y,false);this.say(window.PET_DIALOGUE.jelly);this.jellyHitAt=now+1800;
      }
    }
    if (!s.drag && ['rest', 'wander'].includes(s.mode) && now > this.prankAt) {
      this.prankAt = now + 8000;
      const kind = ['doodle', 'jelly', 'erase'][this.prankIndex++ % 3];
      if (this.onMischief?.(kind, s.x, s.y, true)) {
        this.prank = kind;
        this.prankApplied = false;
        this.prankHit = now + 420;
        s.vx = s.vy = 0;
        this.enter('prank', 1.3);
        this.say(window.PET_DIALOGUE[kind]);
      }
    }
    if (s.mode === 'prank' && !this.prankApplied && now >= this.prankHit) {
      this.onMischief?.(this.prank, s.x, s.y, false);
      this.prankApplied = true;
    }
    if (s.mode === 'draw' && this.copy && now > this.copyAt) {
      if (this.onDoodle(this.copy, s.x, s.y)) {
        this.copy = null;
      }
    }
    const movingMode = s.mode === 'wander' || s.mode === 'follow' || s.drag;
    let moving = false;
    if (s.mode === 'fall') {
      s.vy += 750 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      moving = true;
      if (s.y >= this.dropFloor) {
        s.y = this.dropFloor;
        s.vx = s.vy = 0;
        this.enter('dizzy', 1.6);
      }
    } else if (s.mode === 'dizzy' || s.mode === 'prank') {
      s.vx = s.vy = 0;
      moving = true;
    } else if (movingMode) {
      const t = s.drag || { x: s.tx, y: s.ty },
        dx = t.x - s.x,
        dy = t.y - s.y,
        k = s.drag ? 65 : 16;
      s.vx += (dx * k - s.vx * 8) * dt;
      s.vy += (dy * k - s.vy * 8) * dt;
      const cap = s.drag ? 1000 : 140,
        v = Math.hypot(s.vx, s.vy);
      if (v > cap) {
        s.vx *= cap / v;
        s.vy *= cap / v;
      }
      s.x = Math.max(-10, Math.min(this.desktop.clientWidth - 80, s.x + s.vx * dt));
      s.y = Math.max(0, Math.min(this.desktop.clientHeight - 86, s.y + s.vy * dt));
      if (Math.abs(s.vx) > 7) s.face = s.vx > 0 ? 1 : -1;
      moving = Math.hypot(dx, dy) > 3 || Math.hypot(s.vx, s.vy) > 4;
    } else {
      // Retain momentum when attention changes; friction brings the pet to rest.
      const damping = Math.exp(-5 * dt);
      s.vx *= damping;
      s.vy *= damping;
      s.x = Math.max(-10, Math.min(this.desktop.clientWidth - 80, s.x + s.vx * dt));
      s.y = Math.max(0, Math.min(this.desktop.clientHeight - 86, s.y + s.vy * dt));
      moving = Math.hypot(s.vx, s.vy) > 1;
      if (!moving) {
        s.vx = s.vy = 0;
        
      }
    }
    s.frame = s.drag || s.mode === 'fall' ? 5
      : s.mode === 'dizzy' ? 11
      : s.mode === 'prank' ? (this.prank === 'jelly' ? 4 : 8)
      : s.mode === 'sleep' ? 9
      : (s.mode === 'dream'||s.mode === 'doze') ? 10
      : s.mode === 'coast' ? 3
      : s.mode === 'rest' ? 4
      : s.mode === 'dance' ? 6 + (Math.floor(now / 260) % 2)
      : s.mode === 'draw' ? 8
      : moving ? [0,1,2,1][Math.floor(now / 150) % 4] : 4;
    if (now - this.lastDraw > 65 || s.drag) {
      this.draw(now);
      this.lastDraw = now;
    }
    return moving || !!s.drag || s.mode === 'dance' || s.mode === 'draw';
  }
  draw(now) {
    const s = this.s,
      g = this.g,
      f = s.frame;
    this.el.classList.toggle('airborne',!!s.drag||s.mode==='fall');
    g.clearRect(0, 0, 128, 128);
    if (!this.image.complete) return;
    const col = f % 4,
      row = Math.floor(f / 4);
    g.save();
    // The supplied walking frames face left; mirror when moving right.
    if (s.face > 0) {
      g.translate(128, 0);
      g.scale(-1, 1);
    }
    g.drawImage(this.image, col * 128, row * 128, 128, 128, 0, 0, 128, 128);
    g.restore();
    const tilt =
      s.mode === 'fall'
        ? Math.sin(now / 90) * 18
        : s.mode === 'prank'
          ? Math.sin(now / 80) * 7
          : s.drag
            ? Math.max(-12, Math.min(12, s.vx * 0.015))
            : s.mode === 'dance'
              ? Math.sin(now / 140) * 5
              : 0;
    this.el.style.transform = `translate3d(${s.x}px,${s.y}px,0) rotate(${tilt}deg)`;
    this.speech.style.left = s.x + 190 > this.desktop.clientWidth ? 'auto' : '32px';
    this.speech.style.right = s.x + 190 > this.desktop.clientWidth ? '12px' : 'auto';
    this.speech.style.bottom='auto';
    this.speech.style.top=Math.max(4-s.y,-30)+'px';
    this.speech.classList.toggle('beside',s.y<36);
    if(s.y<36){this.speech.style.left=s.x+210>this.desktop.clientWidth?'auto':'86px';this.speech.style.right=s.x+210>this.desktop.clientWidth?'86px':'auto';}
  }
};
