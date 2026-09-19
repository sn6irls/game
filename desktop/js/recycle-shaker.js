/* Small, sleeping rigid-body toy. Only unused XP icons are loaded here. */
window.initRecycleShaker=function(root,sources){
 const win=root.querySelector('#recycle-window'),body=root.querySelector('#recycle-body');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Drag the icons or shake this window');body.replaceChildren(canvas);
 const ctx=canvas.getContext('2d'),images=sources.map(src=>{const im=new Image();im.src=src;im.onload=()=>wake();return im;});
 let items=[],width=294,height=169,raf=0,last=0,quiet=0,drag=null,moving=false,previous=null,windowVX=0,windowVY=0,stepping=false,opened=false;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function reset(){items=Array.from({length:images.length},(_,i)=>({image:images[i],x:24+(i%7)*36,y:22+Math.floor(i/7)*33,r:16+(i%3),vx:0,vy:0,a:(i%5-2)*.22,spin:0}));quiet=0;wake();}
 function wake(){quiet=0;if(!raf&&!stepping&&!win.hidden)raf=requestAnimationFrame(frame);}
 function size(){const rect=body.getBoundingClientRect();if(!rect.width||!rect.height)return;const w=body.clientWidth,h=body.clientHeight;if(w===canvas.width&&h===canvas.height)return;width=w;height=h;canvas.width=w;canvas.height=h;for(const p of items){p.x=clamp(p.x,p.r,width-p.r);p.y=clamp(p.y,p.r,height-p.r);}wake();}
 function frame(time){raf=0;if(win.hidden){last=0;return;}stepping=true;size();const dt=Math.min(.032,(time-(last||time-16))/1000);last=time;
 const rect=win.getBoundingClientRect();
 if(previous){const vx=moving?(rect.x-previous.x)/Math.max(.008,dt):0,vy=moving?(rect.y-previous.y)/Math.max(.008,dt):0;
 const ix=clamp(vx-windowVX,-700,700),iy=clamp(vy-windowVY,-700,700);
 if(Math.abs(ix)+Math.abs(iy)>1){for(const p of items){p.vx=clamp(p.vx-ix*.8,-1000,1000);p.vy=clamp(p.vy-iy*.8,-1000,1000);}quiet=0;}
 windowVX=vx;windowVY=vy;}previous={x:rect.x,y:rect.y};
 const oldPositions=items.map(p=>({x:p.x,y:p.y}));

 for(let step=0;step<3;step++){const h=dt/3;for(const p of items){if(drag?.item===p)continue;p.vy+=980*h;p.vx*=Math.exp(-.7*h);p.spin*=Math.exp(-4*h);p.x+=p.vx*h;p.y+=p.vy*h;p.a+=p.spin*h;if(p.x<p.r||p.x>width-p.r){p.x=clamp(p.x,p.r,width-p.r);p.vx*=-.34;p.spin*=.55;}if(p.y<p.r||p.y>height-p.r){p.y=clamp(p.y,p.r,height-p.r);p.vy=Math.abs(p.vy)<35?0:-p.vy*.25;p.vx*=.80;p.spin*=.45;}}
 for(let i=0;i<items.length;i++)for(let k=i+1;k<items.length;k++){const a=items[i],b=items[k],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01,min=(a.r+b.r)*.88;if(d>=min)continue;const nx=dx/d,ny=dy/d,overlap=min-d,ma=drag?.item===a?0:1,mb=drag?.item===b?0:1,total=ma+mb||1;a.x-=nx*overlap*ma/total;a.y-=ny*overlap*ma/total;b.x+=nx*overlap*mb/total;b.y+=ny*overlap*mb/total;const speed=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(speed<0){const impulse=-speed*.68;a.vx-=impulse*nx*ma;a.vy-=impulse*ny*ma;b.vx+=impulse*nx*mb;b.vy+=impulse*ny*mb;const tangent=(b.vx-a.vx)*(-ny)+(b.vy-a.vy)*nx;const twist=clamp(tangent*.0015,-.12,.12);if(impulse>25){a.spin=clamp(a.spin+twist,-2.5,2.5);b.spin=clamp(b.spin-twist,-2.5,2.5);}a.spin*=.94;b.spin*=.94;}}
 }
 ctx.clearRect(0,0,width,height);for(const p of items){p.x=clamp(p.x,p.r,width-p.r);p.y=clamp(p.y,p.r,height-p.r);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);if(p.image.complete&&p.image.naturalWidth)ctx.drawImage(p.image,-p.r,-p.r,p.r*2,p.r*2);ctx.restore();}
 const motion=Math.max(...items.map((p,i)=>Math.hypot(p.x-oldPositions[i].x,p.y-oldPositions[i].y)));quiet=motion<.28&&!drag&&!moving?quiet+dt:0;stepping=false;if(quiet<1.2||drag||moving)raf=requestAnimationFrame(frame);else {last=0;for(const p of items){p.vx=p.vy=p.spin=0;}}
 }
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*width/r.width,y:(e.clientY-r.top)*height/r.height}};
 canvas.addEventListener('pointerdown',e=>{const pos=point(e),item=[...items].reverse().find(p=>Math.hypot(p.x-pos.x,p.y-pos.y)<p.r+5);if(!item)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);drag={item,id:e.pointerId,x:pos.x,y:pos.y,t:performance.now(),ox:item.x-pos.x,oy:item.y-pos.y};wake();});
 canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const p=point(e),now=performance.now(),dt=Math.max(.016,(now-drag.t)/1000);drag.item.vx=clamp((p.x-drag.x)/dt,-900,900);drag.item.vy=clamp((p.y-drag.y)/dt,-900,900);drag.item.x=clamp(p.x+drag.ox,drag.item.r,width-drag.item.r);drag.item.y=clamp(p.y+drag.oy,drag.item.r,height-drag.item.r);drag.item.spin=clamp(drag.item.vx*.004,-2.5,2.5);Object.assign(drag,{x:p.x,y:p.y,t:now});wake();});
 const end=()=>{drag=null;wake()};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
 win.querySelector('.titlebar').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;moving=true;previous=null,windowVX=0,windowVY=0;wake();});window.addEventListener('pointerup',()=>{moving=false;wake()});window.addEventListener('pointercancel',()=>{moving=false;wake()});
 new ResizeObserver(size).observe(body);new MutationObserver(()=>{if(win.hidden){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}else{open();}}).observe(win,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('devicemotion',e=>{if(win.hidden)return;const a=e.acceleration;if(!a||Math.hypot(a.x||0,a.y||0)<2)return;for(const p of items){p.vx+=clamp((a.x||0)*9,-120,120);p.vy-=clamp((a.y||0)*9,-120,120);}wake();});
 function open(){size();if(!opened){opened=true;for(const p of items){p.x=clamp(p.x+(Math.random()-.5)*14,p.r,width-p.r);p.y=clamp(p.y-(Math.random()*45),p.r,height-p.r);p.vy=80+Math.random()*90;p.vx=(Math.random()-.5)*35;}}last=0;wake();}
 reset();const api={reset,open,get state(){return {running:!!raf,items:items.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,spin:p.spin,a:p.a})),width,height}}};window.recycleShaker=api;return api;
};
