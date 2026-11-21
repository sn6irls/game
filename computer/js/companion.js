(()=>{
 const field=document.getElementById('pet-field'),element=document.getElementById('desktop-bot');
 let animation=0,last=0;
 function wake(){if(!animation&&!document.hidden&&!window.__COMPUTER_GAME_ACTIVE)animation=requestAnimationFrame(tick);}
 function tick(now){animation=0;if(document.hidden||window.__COMPUTER_GAME_ACTIVE)return;const dt=Math.min(.035,last?(now-last)/1000:.016);last=now;pet.step(dt,now);if(pet.s.active)wake();}
 const pet=new DesktopPet({element,desktop:field,asset:'assets/bot-sprites.webp',wake,onDoodle:()=>false,onMischief:()=>false});
 const marks=[];
 pet.onMischief=(kind,x,y,preview)=>{
  if(kind==='jelly')return false;
  if(kind==='erase'){
   if(!marks.length)return false;if(!preview)marks.shift()?.remove();return true;
  }
  if(preview)return true;
  const mark=document.createElement('span');mark.className='pet-doodle';mark.textContent=['♡','☆','♪'][marks.length%3];
  Object.assign(mark.style,{left:Math.max(4,Math.min(field.clientWidth-52,x+30))+'px',top:Math.max(4,Math.min(field.clientHeight-52,y+48))+'px'});
  field.prepend(mark);marks.push(mark);if(marks.length>8)marks.shift().remove();return true;
 };
 window.toggleCompanion=()=>{
  const active=pet.toggle();document.querySelector('[data-id="bot"]')?.setAttribute('aria-pressed',String(active));
  if(!active){marks.splice(0).forEach(mark=>mark.remove());cancelAnimationFrame(animation);animation=0;}
  else wake();
  document.getElementById('start-menu').classList.add('hidden');return active;
 };
 addEventListener('pointermove',e=>{if(window.__COMPUTER_GAME_ACTIVE)return;const r=field.getBoundingClientRect();pet.movePointer(e.clientX-r.left,e.clientY-r.top);},{passive:true});
 element.addEventListener('keydown',e=>{if(e.key==='Escape'){window.toggleCompanion();e.stopPropagation();}if(e.key==='Enter'||e.key===' '){e.preventDefault();pet.say(window.PET_DIALOGUE.hello);pet.enter('dance',4);}});
 function release(){if(pet.s.drag){pet.s.drag=null;pet.s.vx=pet.s.vy=0;pet.enter('rest',2);}}
 element.addEventListener('lostpointercapture',release);addEventListener('blur',release);
 addEventListener('resize',()=>{pet.s.x=Math.max(0,Math.min(field.clientWidth-96,pet.s.x));pet.s.y=Math.max(0,Math.min(field.clientHeight-96,pet.s.y));pet.s.tx=pet.s.x;pet.s.ty=pet.s.y;wake();});
 addEventListener('computer-game-change',()=>{release();cancelAnimationFrame(animation);animation=0;last=0;if(!window.__COMPUTER_GAME_ACTIVE&&pet.s.active)wake();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){release();cancelAnimationFrame(animation);animation=0;last=0;}else if(pet.s.active)wake();});
})();
