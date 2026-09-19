/* Beginner Minesweeper only. */
window.initMiniGames = function () {
  const {Mines}=MiniGameRules;
  const mineRoot=document.querySelector('#mines-content');
  let mines, flagMode=false, mineSeconds=0, lastResult=null;
  const faceIcons=new Map();
  function faceIcon(state){
    const key=state==='lost'||state==='won'?state:'normal';if(faceIcons.has(key))return faceIcons.get(key);
    const pixels=Array.from({length:17},()=>Array(17).fill(''));
    for(let y=0;y<17;y++)for(let x=0;x<17;x++){const r=Math.hypot(x-8,y-8);if(r<=8.15)pixels[y][x]=r<=7?'#ffff00':'#000';}
    const dot=(x,y)=>pixels[y][x]='#000';
    if(key==='lost'){
      for(const x of [4,10])for(let i=0;i<3;i++){dot(x+i,4+i);dot(x+2-i,4+i);}
    }else if(key==='won'){
      for(let x=3;x<=13;x++)dot(x,5);
      for(const x of [4,10])for(let y=6;y<=7;y++)for(let i=0;i<3;i++)dot(x+i,y);
      dot(5,8);dot(11,8);
    }else for(const x of [4,11])for(let y=5;y<=6;y++){dot(x,y);dot(x+1,y);}
    for(const [x,y] of [[4,10],[5,11],[6,12],[7,12],[8,12],[9,12],[10,12],[11,11],[12,10]])dot(x,key==='lost'?22-y:y);
    let rects='';for(let y=0;y<17;y++)for(let x=0;x<17;x++)if(pixels[y][x])rects+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${pixels[y][x]}"/>`;
    const svg=`<svg viewBox="0 0 17 17" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;faceIcons.set(key,svg);return svg;
  }
  function mineRender(){if(mines.state!==lastResult){if(mines.state==='won')window.XPSounds?.play('chimes');lastResult=mines.state;}mineRoot.innerHTML=`<nav class="menu"><button data-m="new">새 게임</button><button data-m="flags" aria-pressed="${flagMode}">${flagMode?'⚑ 깃발 모드':'깃발 모드'}</button></nav><div class="mine-panel"><div class="mine-dashboard"><output class="led" aria-label="남은 지뢰">${String(10-mines.flags).padStart(3,'0')}</output><button class="mine-face" data-m="new" aria-label="새 게임">${faceIcon(mines.state)}</button><output class="led" id="mine-time" aria-label="시간">${String(mineSeconds).padStart(3,'0')}</output></div><div class="mine-board" role="group" aria-label="초급 지뢰찾기 9 곱하기 9">${mines.cells.map((c,i)=>`<button class="mine-cell ${c.open?'revealed':''} ${i===mines.hit?'mine-hit':''}" data-cell="${i}" data-n="${c.n}" aria-label="${Math.floor(i/9)+1}행 ${i%9+1}열 ${c.flag?'깃발':c.open?(c.mine?'지뢰':c.n+'개 인접 지뢰'):'닫힘'}">${c.flag?(mines.state==='lost'&&!c.mine?'×':'⚑'):c.mine&&(c.open||mines.state==='lost')?'✹':c.open&&c.n?c.n:''}</button>`).join('')}</div></div>`;}
  function resetMine(){mines=new Mines();flagMode=false;mineSeconds=0;mineRender();}
  mineRoot.addEventListener('click',e=>{const a=e.target.closest('[data-m]')?.dataset.m;if(a==='new')resetMine();else if(a==='flags'){flagMode=!flagMode;mineRender();}else{const c=e.target.closest('[data-cell]');if(c){flagMode?mines.flag(+c.dataset.cell):mines.reveal(+c.dataset.cell);mineRender();}}});
  mineRoot.addEventListener('contextmenu',e=>{const c=e.target.closest('[data-cell]');if(c){e.preventDefault();e.stopPropagation();mines.flag(+c.dataset.cell);mineRender();}});
  setInterval(()=>{if(!document.hidden&&!mineRoot.closest('.window').hidden&&mines.state==='playing'){mineSeconds=Math.min(999,mineSeconds+1);document.querySelector('#mine-time').textContent=String(mineSeconds).padStart(3,'0');}},1000);
  resetMine();return {reset:resetMine};
};
