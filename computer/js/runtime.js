let toastTimer;
function toast(text){const el=document.getElementById('toast');clearTimeout(toastTimer);el.textContent=text;el.classList.remove('hidden');toastTimer=setTimeout(()=>el.classList.add('hidden'),2800);}
function popIn(el){el.classList.remove('pop-in');void el.offsetWidth;el.classList.add('pop-in');}
function applyTheme(app,key){
 app.themeKey=key;document.body.classList.toggle('theme-supa',key==='supa');document.body.classList.toggle('theme-noma',key==='noma');
 musicPlayer.syncTheme();
}
window.toggleComputerFullscreen=async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('브라우저의 전체 화면 메뉴를 이용해주세요.');}catch{toast('브라우저의 전체 화면 메뉴를 이용해주세요.');}
};
