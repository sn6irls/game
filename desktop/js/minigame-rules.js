/* Small, DOM-independent rules shared by the UI and regression checks. */
(function (host) {
  'use strict';
  const shuffle = (a, rng = Math.random) => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  class Mines {
    constructor(rng = Math.random) { this.rng = rng; this.cells = Array.from({length:81}, () => ({mine:false,open:false,flag:false,n:0})); this.state='ready'; }
    neighbors(i) { const a=[]; for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const r=Math.floor(i/9)+y,c=i%9+x;if((x||y)&&r>=0&&r<9&&c>=0&&c<9)a.push(r*9+c);}return a; }
    plant(first) { const safe=new Set([first,...this.neighbors(first)]); shuffle(this.cells.map((_,i)=>i).filter(i=>!safe.has(i)),this.rng).slice(0,10).forEach(i=>this.cells[i].mine=true);this.cells.forEach((c,i)=>c.n=this.neighbors(i).filter(j=>this.cells[j].mine).length);this.state='playing'; }
    flag(i){if(!['ready','playing'].includes(this.state)||this.cells[i].open)return;const c=this.cells[i];if(c.flag||this.flags<10)c.flag=!c.flag;}
    get flags(){return this.cells.filter(c=>c.flag).length;}
    reveal(i){if(!['ready','playing'].includes(this.state)||this.cells[i].flag)return;if(this.state==='ready')this.plant(i);const c=this.cells[i];if(c.open){if(c.n&&this.neighbors(i).filter(j=>this.cells[j].flag).length===c.n)this.neighbors(i).filter(j=>!this.cells[j].open&&!this.cells[j].flag).forEach(j=>this.reveal(j));return;}if(c.mine){c.open=true;this.hit=i;this.state='lost';return;}const q=[i];while(q.length){const j=q.pop(),n=this.cells[j];if(n.open||n.flag||n.mine)continue;n.open=true;if(!n.n)q.push(...this.neighbors(j));}if(this.cells.filter(n=>n.open).length===71){this.state='won';this.cells.filter(n=>n.mine).forEach(n=>n.flag=true);}}
  }
  const api={Mines};if(typeof module!=='undefined')module.exports=api;else host.MiniGameRules=api;
})(globalThis);
