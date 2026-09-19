/* Pointer and keyboard behavior for the XP Games submenu. */
(() => {
  window.bindStartFlyouts = function () {
    const root=document.querySelector('#start-menu');
    const timers=new Map();
    const cancel=b=>{clearTimeout(timers.get(b));timers.delete(b);};
    const toggle=(b,on)=>{if(on)root.querySelectorAll('[data-flyout]').forEach(other=>{if(other!==b){cancel(other);other.setAttribute('aria-expanded','false');document.getElementById(other.getAttribute('aria-controls')).hidden=true;}});cancel(b);b.setAttribute('aria-expanded',String(on));document.getElementById(b.getAttribute('aria-controls')).hidden=!on;};
    root.querySelectorAll('[data-flyout]').forEach(b=>{
      const menu=document.getElementById(b.getAttribute('aria-controls'));
      const leave=e=>{
        if(e.pointerType!=='mouse')return;
        if(b.contains(e.relatedTarget)||menu.contains(e.relatedTarget))return;
        cancel(b);timers.set(b,setTimeout(()=>toggle(b,false),180));
      };
      b.addEventListener('click',()=>toggle(b,true));
      b.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')toggle(b,true);});
      b.addEventListener('pointerleave',leave);
      menu.addEventListener('pointerenter',()=>cancel(b));
      menu.addEventListener('pointerleave',leave);
      b.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();toggle(b,true);menu.querySelector('button').focus();}});
    });
    window.addEventListener('blur',()=>root.querySelectorAll('[data-flyout]').forEach(b=>toggle(b,false)));
    root.querySelectorAll('.xp-flyout').forEach(menu=>menu.addEventListener('keydown',e=>{const buttons=[...menu.children].flatMap(el=>el.matches('button')?[el]:[...el.querySelectorAll(':scope > button')]);const i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();const b=root.querySelector('[aria-controls="'+menu.id+'"]');toggle(b,false);b.focus();}}));
    return ()=>root.querySelectorAll('[data-flyout]').forEach(b=>toggle(b,false));
  };
})();
