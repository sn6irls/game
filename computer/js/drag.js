// One captured pointer and one paint per frame; no native drag image or cloned element.
const DesktopDrag=(()=>{
 let activeCancel=null;
 function attach(handle,{element=handle,enabled=()=>true,start=()=>{},move=()=>{},end=()=>{},ignoreControls=false}={}){
  let state=null,paint=0,suppressClick=false;
  const flush=()=>{cancelAnimationFrame(paint);paint=0;if(state?.moved)move(state.latest.clientX-state.x,state.latest.clientY-state.y);};
  function finish(event){
   if(!state||(event?.pointerId!==undefined&&event.pointerId!==state.id))return;
   if(event?.type==='pointerup')state.latest=event;
   flush();const previous=state;state=null;
   handle.removeEventListener('pointermove',onMove);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);handle.removeEventListener('lostpointercapture',finish);removeEventListener('blur',finish);
   if(handle.hasPointerCapture?.(previous.id))handle.releasePointerCapture(previous.id);
   element.classList.remove('dragging');document.body.classList.remove('desktop-dragging');activeCancel=null;
   if(previous.moved)suppressClick=true;end(previous.moved);
  }
  function onMove(event){
   if(!state||event.pointerId!==state.id)return;
   if(event.pointerType==='mouse'&&event.buttons===0){finish();return;}
   state.latest=event;
   if(!state.moved){if(Math.hypot(event.clientX-state.x,event.clientY-state.y)<5)return;state.moved=true;start();element.classList.add('dragging');document.body.classList.add('desktop-dragging');}
   event.preventDefault();if(!paint)paint=requestAnimationFrame(flush);
  }
  function down(event){
   if(event.button!==0||event.isPrimary===false||!enabled()||(ignoreControls&&event.target.closest('button,a,input,textarea,select')))return;
   activeCancel?.();suppressClick=false;state={id:event.pointerId,x:event.clientX,y:event.clientY,latest:event,moved:false};activeCancel=finish;
   handle.setPointerCapture(event.pointerId);handle.addEventListener('pointermove',onMove);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);addEventListener('blur',finish);
  }
  const nativeDrag=event=>event.preventDefault();
  const click=event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}};
  handle.addEventListener('pointerdown',down);handle.addEventListener('dragstart',nativeDrag);handle.addEventListener('click',click,true);
  return {cancel:()=>finish(),destroy(){finish();handle.removeEventListener('pointerdown',down);handle.removeEventListener('dragstart',nativeDrag);handle.removeEventListener('click',click,true);}};
 }
 function windowDrag(element,handle){
  let origin;
  function place(x,y){const taskbar=document.querySelector('.taskbar')?.offsetHeight||46;const maxX=Math.max(0,innerWidth-element.offsetWidth),maxY=Math.max(0,innerHeight-taskbar-element.offsetHeight);element.style.setProperty('--window-left',Math.max(0,Math.min(maxX,x))+'px');element.style.setProperty('--window-top',Math.max(0,Math.min(maxY,y))+'px');}
  function clamp(){if(element.classList.contains('window-dragged')&&!element.classList.contains('maximized')){const rect=element.getBoundingClientRect();place(rect.left,rect.top);}}
  const drag=attach(handle,{element,ignoreControls:true,enabled:()=>!element.classList.contains('maximized'),start(){origin=element.getBoundingClientRect();element.classList.add('window-dragged');place(origin.left,origin.top);},move(dx,dy){place(origin.left+dx,origin.top+dy);}});
  addEventListener('resize',clamp);
  return {cancel:drag.cancel,clamp,reset(){drag.cancel();element.classList.remove('window-dragged');element.style.removeProperty('--window-left');element.style.removeProperty('--window-top');},destroy(){drag.destroy();removeEventListener('resize',clamp);}};
 }
 addEventListener('pagehide',()=>activeCancel?.());document.addEventListener('visibilitychange',()=>{if(document.hidden)activeCancel?.();});
 return {attach,window:windowDrag};
})();
