// Reuse the original desktop game's artwork, without loading Instagram embeds.
(()=>{
 const ad=document.getElementById('instagram-ad'),img=ad.querySelector('img');
 let timer=0,variant=0,dismissed=false;
 function schedule(delay){clearTimeout(timer);timer=0;if(document.hidden||window.__COMPUTER_GAME_ACTIVE)return;timer=setTimeout(show,delay);}
 function show(){timer=0;if(document.hidden||window.__COMPUTER_GAME_ACTIVE)return;img.src=`assets/adimage-${variant%3+1}.webp`;ad.hidden=false;ad.classList.remove('ad-enter');void ad.offsetWidth;ad.classList.add('ad-enter');dismissed=false;}
 document.getElementById('ad-close').addEventListener('click',()=>{ad.hidden=true;dismissed=true;variant++;schedule(90000);});
 function sync(){clearTimeout(timer);timer=0;if(document.hidden||window.__COMPUTER_GAME_ACTIVE){ad.hidden=true;return;}schedule(dismissed?90000:6000);}
 addEventListener('computer-game-change',sync);document.addEventListener('visibilitychange',sync);
 addEventListener('pagehide',()=>clearTimeout(timer));addEventListener('pageshow',e=>{if(e.persisted)sync();});schedule(6000);
})();
