/* Cached faceted gems and a purikura outline brush. No animation loop. */
window.DecorPens = (() => {
  let jewel;
  function gemArt(){
    if(jewel)return jewel;
    jewel=document.createElement('canvas');jewel.width=jewel.height=96;
    const g=jewel.getContext('2d');g.translate(48,48);
    const poly=points=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();};
    g.save();g.beginPath();g.arc(0,0,44,0,Math.PI*2);g.clip();
    const base=g.createRadialGradient(-16,-19,3,4,8,56);base.addColorStop(0,'#deffff');base.addColorStop(.38,'#65e9f2');base.addColorStop(.75,'#1da5ce');base.addColorStop(1,'#175ab1');g.fillStyle=base;g.fillRect(-48,-48,96,96);
    const colors=['#dafcff','#86eff8','#37c4e6','#138dc3','#1164a5','#54cfed','#a5ffff','#28b3d9'];
    const inner=Array.from({length:8},(_,i)=>{const a=(i*45-112.5)*Math.PI/180;return [Math.cos(a)*27,Math.sin(a)*27];});
    for(let i=0;i<16;i++){
      const a=(i*22.5-123.75)*Math.PI/180,b=a+Math.PI/8;
      const v=inner[Math.floor(i/2)],w=inner[(Math.floor(i/2)+1)%8];
      poly([[Math.cos(a)*45,Math.sin(a)*45],[Math.cos(b)*45,Math.sin(b)*45],i%2?w:v,v]);g.fillStyle=colors[i%8];g.globalAlpha=.68+(i%3)*.1;g.fill();
    }
    g.globalAlpha=1;poly(inner);const table=g.createLinearGradient(-20,-25,20,28);table.addColorStop(0,'#b8fbff');table.addColorStop(.48,'#66dce9');table.addColorStop(1,'#27abd1');g.fillStyle=table;g.fill();g.strokeStyle='#d7ffff9c';g.lineWidth=.8;g.stroke();
    for(const [c,pts] of [['#ffffff',[[-28,-29],[-13,-35],[-10,-21],[-25,-14]]],['#efffff',[[18,-30],[30,-21],[22,-9],[12,-19]]],['#b9fcff',[[-25,11],[-10,17],[-15,31],[-29,24]]],['#ecffff',[[12,23],[25,17],[31,28],[17,36]]]]){poly(pts);g.fillStyle=c;g.fill();}
    g.restore();g.strokeStyle='#c5ffffb0';g.lineWidth=1;g.beginPath();g.arc(0,0,43.5,0,Math.PI*2);g.stroke();return jewel;
  }
  function paint(ctx,from,to,size,kind,stroke,touch) {
    if(kind==='photo'){
      const width=9+size*.7;
      if(!stroke.photoBase){const c=document.createElement('canvas');c.width=ctx.canvas.width;c.height=ctx.canvas.height;c.getContext('2d').drawImage(ctx.canvas,0,0);stroke.photoBase=c;stroke.photoPoints=[from];stroke.photoBounds={l:from.x,t:from.y,r:from.x,b:from.y};}
      const pts=stroke.photoPoints,b=stroke.photoBounds;
      if(Math.hypot(to.x-pts.at(-1).x,to.y-pts.at(-1).y)>.7)pts.push(to);
      b.l=Math.min(b.l,to.x);b.t=Math.min(b.t,to.y);b.r=Math.max(b.r,to.x);b.b=Math.max(b.b,to.y);
      const pad=width+12,l=Math.max(0,Math.floor(b.l-pad)),t=Math.max(0,Math.floor(b.t-pad)),r=Math.min(ctx.canvas.width,Math.ceil(b.r+pad)),bottom=Math.min(ctx.canvas.height,Math.ceil(b.b+pad));
      touch((from.x+to.x)/2,(from.y+to.y)/2,Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y))/2+pad);ctx.save();ctx.clearRect(l,t,r-l,bottom-t);ctx.drawImage(stroke.photoBase,l,t,r-l,bottom-t,l,t,r-l,bottom-t);
      ctx.lineJoin=ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);if(pts.length===1)ctx.lineTo(to.x+.01,to.y+.01);
      ctx.shadowColor='#f279bc';ctx.shadowBlur=5;ctx.strokeStyle='#ee88bd';ctx.lineWidth=width;ctx.stroke();ctx.shadowColor='#fff3fb';ctx.shadowBlur=3;ctx.strokeStyle='#fff2fa';ctx.lineWidth=width*.38;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#ffffffb0';ctx.lineWidth=width*.18;ctx.stroke();ctx.restore();
    }else{
      const diameter=12+size*.68,spacing=diameter*1.02,dist=Math.hypot((to.x-from.x)*ctx.canvas.clientWidth/ctx.canvas.width,(to.y-from.y)*ctx.canvas.clientHeight/ctx.canvas.height);
      const bounds=ctx.canvas.getBoundingClientRect(),sx=ctx.canvas.width/bounds.width,sy=ctx.canvas.height/bounds.height;
      const draw=(x,y)=>{const dw=diameter*sx,dh=diameter*sy;touch(x,y,Math.max(dw,dh));ctx.drawImage(gemArt(),x-dw/2,y-dh/2,dw,dh);};
      if(stroke.gemCarry===undefined){draw(from.x,from.y);stroke.gemCarry=0;}
      let next=spacing-stroke.gemCarry;
      while(next<=dist){draw(from.x+(to.x-from.x)*next/dist,from.y+(to.y-from.y)*next/dist);next+=spacing;}
      stroke.gemCarry=(stroke.gemCarry+dist)%spacing;
    }
  }
  return {paint,gemArt};
})();

