const computerApp={
 themeKey:'supa',state:{mode:'ui'},characters:{},
 isLite:()=>!!window.__SNG_LITE,
 setLite(value){window.__SNG_LITE=!!value;document.body.classList.toggle('lite',!!value);dispatchEvent(new Event('computer-motion-change'));},
};
for(const [key,theme] of Object.entries(CONFIG.themes))computerApp.characters[key]={cfg:theme.character,equip:{tops:0}};
browserUI.open(computerApp);
document.documentElement.dataset.computerReady='true';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
computerApp.setLite(reduced.matches);
reduced.addEventListener?.('change',e=>computerApp.setLite(e.matches));
function unlockSound(){AudioSys.init();AudioSys.playBGM(computerApp.themeKey);}
addEventListener('pointerdown',unlockSound,{once:true});
addEventListener('keydown',unlockSound,{once:true});
addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 document.getElementById('start-menu').classList.add('hidden');document.getElementById('task-start').setAttribute('aria-expanded','false');document.getElementById('task-start').classList.remove('active');
 if(diaryUI.isOpen()){diaryUI.close();return;}
 const wins=[...document.querySelectorAll('.os-window')].filter(el=>el.style.display!=='none');
 wins.sort((a,b)=>Number(b.style.zIndex)-Number(a.style.zIndex));wins[0]?.querySelector('.osw-x')?.click();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)AudioSys.stopBGM();else AudioSys.playBGM(computerApp.themeKey);});
window.addEventListener('pagehide',()=>AudioSys.stopBGM());
