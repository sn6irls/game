// Intermittent closed-eye overlay. The background is never modified.
// Only two traced eye interiors are drawn; glasses pixels (including a safety margin) stay transparent.
(()=>{
 const art=window.BLINK_ART,layer=document.getElementById('eye-layer'),background=document.getElementById('background-art');
 const canvas=document.createElement('canvas');canvas.id='small-eye-blink';canvas.width=art.box[2];canvas.height=art.box[3];canvas.hidden=true;canvas.setAttribute('aria-hidden','true');layer.append(canvas);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 let ready=false,timer=0,opening=0;
 const allowed=()=>ready&&!document.hidden&&!window.__COMPUTER_GAME_ACTIVE&&!window.__SNG_LITE;
 function layout(){
  const w=parseFloat(background.style.width),h=parseFloat(background.style.height);if(!w||!h)return;
  const[x,y,cw,ch]=art.box;Object.assign(canvas.style,{left:(parseFloat(background.style.left)+x*w/2560)+'px',top:(parseFloat(background.style.top)+y*h/1723)+'px',width:cw*w/2560+'px',height:ch*h/1723+'px'});
 }
 function schedule(){clearTimeout(timer);if(allowed())timer=setTimeout(blink,3800+Math.random()*4000);}
 function blink(){if(!allowed())return;canvas.hidden=false;opening=setTimeout(()=>{canvas.hidden=true;schedule();},180);}
 function sync(){clearTimeout(timer);clearTimeout(opening);canvas.hidden=true;if(allowed())schedule();}
 const image=new Image();image.onload=()=>{
  const w=canvas.width,h=canvas.height;ctx.drawImage(image,0,0);const original=ctx.getImageData(0,0,w,h);ctx.clearRect(0,0,w,h);
  const eyes=[
   {points:[[400,1153],[408,1147],[416,1141],[422,1135],[429,1134],[433,1141],[435,1155],[435,1168],[429,1173],[416,1174],[408,1170],[400,1167]],line:[410,1153,430,1153],colors:['#cbb795','#fff1c7']},
   {points:[[469,1131],[475,1127],[483,1128],[490,1132],[494,1140],[495,1156],[491,1167],[484,1170],[477,1169],[472,1162],[469,1144]],line:[474,1150,491,1150],colors:['#fff7d2','#f7e8c4']},
  ];
  for(const eye of eyes){
   ctx.save();ctx.beginPath();eye.points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x-art.box[0],y-art.box[1]));ctx.closePath();ctx.clip();
   const xs=eye.points.map(p=>p[0]-art.box[0]);const gradient=ctx.createLinearGradient(Math.min(...xs),0,Math.max(...xs),0);gradient.addColorStop(0,eye.colors[0]);gradient.addColorStop(1,eye.colors[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
   const[a,b,c,d]=eye.line;ctx.strokeStyle='#343b2a';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a-art.box[0],b-art.box[1]);ctx.lineTo(c-art.box[0],d-art.box[1]);ctx.stroke();ctx.restore();
  }
  const closed=ctx.getImageData(0,0,w,h),protectedPixels=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4,r=original.data[i],g=original.data[i+1],b=original.data[i+2];
   // Glasses are red, with a pale antialias fringe. Protect nearby pixels as well.
   if(r>g+24&&r>b+18&&r>105){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const px=x+dx,py=y+dy;if(px>=0&&px<w&&py>=0&&py<h)protectedPixels[py*w+px]=1;}}
  }
  for(let i=0;i<protectedPixels.length;i++)if(protectedPixels[i])closed.data[i*4+3]=0;
  ctx.putImageData(closed,0,0);ready=true;canvas.dataset.ready='true';layout();schedule();
 };image.src=art.src;
 addEventListener('computer-wallpaper-layout',layout);addEventListener('resize',layout);
 addEventListener('computer-game-change',sync);addEventListener('computer-motion-change',sync);document.addEventListener('visibilitychange',sync);
 addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(opening);canvas.hidden=true;});addEventListener('pageshow',e=>{if(e.persisted)sync();});
})();
