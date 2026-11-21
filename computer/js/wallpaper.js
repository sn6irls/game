(()=>{
 const art=window.EYE_ART,wall=document.getElementById('wallpaper'),image=document.getElementById('background-art'),layer=document.getElementById('eye-layer');
 const eyes=[];let frame=0,lastTime=0,pointer=null;
 function layout(){
  // Use exactly the same cover transform for the background and the eye patches.
  const r=wall.getBoundingClientRect(),scale=Math.max(r.width/art.width,r.height/art.height);
  const width=art.width*scale,height=art.height*scale;
  // Keep the character's eyes in view on portrait displays as well.
  const focus=r.width/r.height<1?.72:.5;
  const left=(r.width-width)*focus,top=(r.height-height)*.5;
  Object.assign(image.style,{width:width+'px',height:height+'px',left:left+'px',top:top+'px'});
  for(const eye of eyes){
   const [x,y,w,h]=eye.box;Object.assign(eye.canvas.style,{left:(left+x*width)+'px',top:(top+y*height)+'px',width:w*width+'px',height:h*height+'px'});
   eye.center={x:left+(x+w*.5)*width,y:top+(y+h*.5)*height};
  }
  dispatchEvent(new Event('computer-wallpaper-layout'));
  wake();
 }
 function wake(){if(!frame&&!document.hidden&&!window.__COMPUTER_GAME_ACTIVE)frame=requestAnimationFrame(draw);}
 function draw(now){
  frame=0;if(document.hidden||window.__COMPUTER_GAME_ACTIVE)return;
  if(now-lastTime<32){wake();return;}lastTime=now;
  let moving=false;
  for(const eye of eyes){
   const target=pointer&&!window.__SNG_LITE?{x:Math.max(-1,Math.min(1,(pointer.x-eye.center.x)/450)),y:Math.max(-1,Math.min(1,(pointer.y-eye.center.y)/350))}:{x:0,y:0};
   if(window.__SNG_LITE){eye.x=0;eye.y=0;}else{eye.x+=(target.x-eye.x)*.24;eye.y+=(target.y-eye.y)*.24;}
   if(Math.abs(target.x-eye.x)+Math.abs(target.y-eye.y)>.003)moving=true;
   if(Math.abs(eye.x-eye.drawX)+Math.abs(eye.y-eye.drawY)<.002)continue;
   eye.drawX=eye.x;eye.drawY=eye.y;
   const {data,width,height,output,weights}=eye;
   // Smoothly displace the iris and fade the displacement to zero at the edge.
   // The original eyelashes/skin remain fixed; no replacement eye art is added.
   const dx=eye.x*width*.072,dy=eye.y*height*.040;
   for(let p=0;p<weights.length;p++){
    const x=p%width,y=(p/width)|0,w=weights[p];
    const sx=Math.max(0,Math.min(width-1.001,x-dx*w)),sy=Math.max(0,Math.min(height-1.001,y-dy*w));
    const ix=sx|0,iy=sy|0,fx=sx-ix,fy=sy-iy,at=(iy*width+ix)*4,to=p*4;
    for(let c=0;c<3;c++)output.data[to+c]=(data[at+c]*(1-fx)+data[at+4+c]*fx)*(1-fy)+(data[at+width*4+c]*(1-fx)+data[at+(width+1)*4+c]*fx)*fy;
    output.data[to+3]=Math.min(1,w*4)*255;
   }
   eye.ctx.putImageData(output,0,0);
  }
  if(moving)wake();
 }
 for(const spec of art.eyes){
  const img=new Image();img.onload=()=>{
   const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.setAttribute('aria-hidden','true');
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
   const width=canvas.width,height=canvas.height,data=ctx.getImageData(0,0,width,height).data,weights=new Float32Array(width*height);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const radius=Math.hypot((x-width*.5)/(width*.49),(y-height*.49)/(height*.49));
    const t=Math.max(0,Math.min(1,(1-radius)/.7));weights[y*width+x]=t*t*(3-2*t);
   }
   eyes.push({box:spec.box,canvas,ctx,width,height,data,weights,output:ctx.createImageData(width,height),x:0,y:0,drawX:99,drawY:99});layer.append(canvas);layout();
   if(eyes.length===art.eyes.length)wall.dataset.eyes='ready';
  };img.src=spec.src;
 }
 addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};wake();},{passive:true});
 document.documentElement.addEventListener('pointerleave',()=>{pointer=null;wake();});
 addEventListener('blur',()=>{pointer=null;wake();});addEventListener('resize',layout);
 addEventListener('computer-motion-change',wake);
 addEventListener('computer-game-change',()=>{cancelAnimationFrame(frame);frame=0;pointer=null;if(!window.__COMPUTER_GAME_ACTIVE)wake();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
 layout();
})();
