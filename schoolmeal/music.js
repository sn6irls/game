(()=>{
 'use strict';
 const audio=new Audio('assets/sound/bgm.MP3');audio.loop=true;audio.preload='auto';audio.volume=.16;
 let started=false,blocked=false,muted=false,revision=0;
 try{muted=localStorage.getItem('meal-bgm-muted-release')==='1';}catch{}
 const button=document.getElementById('bgmToggle');
 function label(){const en=document.documentElement.lang==='en';let image=button.querySelector('img');if(!image){image=document.createElement('img');image.alt='';button.replaceChildren(image);}const src='assets/font/'+(muted?'sound off.png':'sound on.png');if(image.getAttribute('src')!==src)image.src=src;button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',en?(muted?'Turn background music on':'Mute background music'):(muted?'배경음악 켜기':'배경음악 끄기'));}
 function sync(){const token=++revision;label();if(!started||blocked||muted||document.hidden){audio.pause();return;}audio.play().then(()=>{if(token!==revision&&(!started||blocked||muted||document.hidden))audio.pause();}).catch(()=>{});}
 button.onclick=()=>{muted=!muted;try{localStorage.setItem('meal-bgm-muted-release',muted?'1':'0');}catch{}sync();};
 new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.MealMusic=Object.freeze({start(){started=true;sync();},setMood(mood){blocked=mood===6;sync();},snapshot:()=>({started,blocked,muted,playing:!audio.paused,audible:!audio.paused&&!audio.muted,volume:audio.volume})});
 document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',()=>audio.pause());window.addEventListener('pageshow',sync);label();
})();
