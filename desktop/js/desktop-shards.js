/* Each bounded shard owns a small crop of the wallpaper before the impact. */
window.DesktopShards = class {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.items = [];
    this.floor = document.createElement('canvas');
    this.floor.width = w;
    this.floor.height = h;
    this.dirty = true;
    this.front=document.createElement('canvas');this.front.id='glass-foreground';document.body.appendChild(this.front);this.fg=this.front.getContext('2d');
  }
  clear() {
    this.items = [];
    // step() leaves a viewport transform behind, so reset it before clearing or
    // only part of the layer is wiped and settled shards stay on screen.
    this.fg.setTransform(1,0,0,1,0,0);
    this.fg.clearRect(0,0,this.front.width,this.front.height);
    this.dirty = true;
  }
  break(source, p, r) {
    const count = Math.min(9, Math.max(0, 180-this.items.length));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2,
        b = ((i + 1) / count) * Math.PI * 2;
      const points = [
        { x: p.x, y: p.y },
        { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r },
        { x: p.x + Math.cos(b) * r, y: p.y + Math.sin(b) * r },
      ];
      const left = Math.max(0, Math.floor(Math.min(...points.map((v) => v.x)))),
        top = Math.max(0, Math.floor(Math.min(...points.map((v) => v.y))));
      const width = Math.min(this.w - left, Math.ceil(Math.max(...points.map((v) => v.x)) - left)),
        height = Math.min(this.h - top, Math.ceil(Math.max(...points.map((v) => v.y)) - top));
      if (width < 1 || height < 1) continue;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const g = c.getContext('2d');
      g.beginPath();
      points.forEach((v, k) =>
        k ? g.lineTo(v.x - left, v.y - top) : g.moveTo(v.x - left, v.y - top),
      );
      g.closePath();
      g.clip();
      g.drawImage(source, left, top, width, height, 0, 0, width, height);
      const alpha = g.getImageData(0, 0, width, height).data;
      if (!alpha.some((v, k) => k % 4 === 3 && v > 10)) continue;
      this.items.push({
        image: c,
        x: left + width / 2,
        y: top + height / 2,
        vx: Math.cos((a + b) / 2) * 150,
        vy: -100 - Math.random() * 120,
        angle: 0,
        spin: (Math.random() - 0.5) * 5,
        floorScale: i % 4 === 0 ? 0.38 + Math.random() * 0.18 : 0.10 + Math.random() * 0.12,
        floorInset: 2 + Math.random() * 15,
        settled: false,
        bounces: 0,
        foreground: i % 3 === 0,
      });
    }

  }
  draw(g, p) {
    g.save();
    g.translate(p.x, p.y);
    if (p.settled) {
      // Compress in screen coordinates so rotated shards still lie on the floor.
      g.shadowColor = '#17233570';
      g.shadowBlur = 3;
      g.shadowOffsetY = 2;
      g.scale(1, p.floorScale);
      g.rotate(p.angle);
    } else {
      g.rotate(p.angle);
      g.scale(1, Math.max(0.2, Math.abs(Math.cos(p.angle))));
    }
    g.drawImage(p.image, -p.image.width / 2, -p.image.height / 2);
    g.restore();
  }
  step(g, dt) {
    const rect=document.getElementById('desktop').getBoundingClientRect();
    if(this.front.width!==innerWidth||this.front.height!==innerHeight){this.front.width=innerWidth;this.front.height=innerHeight;}
    const front=this.fg;front.setTransform(1,0,0,1,0,0);front.clearRect(0,0,this.front.width,this.front.height);front.setTransform(rect.width/this.w,0,0,rect.height/this.h,rect.left,rect.top);
    for(const p of this.items){
      p.vy+=1000*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
      const floor=this.h-p.image.height*.12;
      if(p.bounces<2&&p.y>=floor){p.y=floor;p.vy=-Math.abs(p.vy)*(p.bounces===0?.35:.22);p.vx*=.65;p.bounces++;p.spin*=.7;}
      if(p.bounces>=2&&p.vy>0)p.vy+=350*dt;
      if(p.x<0||p.x>this.w){p.x=Math.max(0,Math.min(this.w,p.x));p.vx*=-.3;}
      this.draw(p.foreground?front:g,p);
    }
    this.items=this.items.filter(p=>p.y<this.h+180);
    return this.items.length>0;
  }
};
