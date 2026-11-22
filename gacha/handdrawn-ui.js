const $=s=>document.querySelector(s);
export const BUBBLES={
 thought:{file:'말풍선0.png',aspect:1063/1421,body:{x:12,y:16,width:76,height:40},bodyY:.36,width:.58},
 speaking:{file:'말풍선2.png',aspect:890/1504,body:{x:12,y:18,width:74,height:44},bodyY:.40,width:.61},
 emphasis:{file:'말풍선1.png',aspect:845/1523,body:{x:14,y:21,width:73,height:56},bodyY:.49,width:.61}
};
const sprite=(box,extra='')=>`<svg class="ink-art ${extra}" viewBox="${box}" aria-hidden="true"><image href="./asset/ui.png" x="0" y="0" width="2560" height="4240"/></svg>`;
export function installDrawnUI(){
 const filters=document.createElementNS('http://www.w3.org/2000/svg','svg');filters.setAttribute('width','0');filters.setAttribute('height','0');filters.setAttribute('aria-hidden','true');filters.style.position='absolute';
 filters.innerHTML='<defs>'+[3,11,17,23].map((seed,i)=>`<filter id="gacha-ink-${i}" x="-6%" y="-7%" width="112%" height="114%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".025 .045" numOctaves="1" seed="${seed}" result="inkNoise"/><feDisplacementMap in="SourceGraphic" in2="inkNoise" scale="1.3" xChannelSelector="R" yChannelSelector="G"/></filter>`).join('')+'</defs>';
 document.body.prepend(filters);
 $('.counter').innerHTML=`<div class="drawn-count">${sprite('112 152 520 270','count-label')}<span class="count-label-en ink-art" hidden>PULLS</span><span class="drawn-number ink-art"><b id="count">0</b><small class="count-unit">번</small></span></div><div class="spending ink-art"><strong id="spent">-0원</strong></div>`;
 $('#ssr-settings').innerHTML=sprite('2080 3000 270 260');
 $('#settings').innerHTML=sprite('2085 3380 280 320');
 $('#language').innerHTML=sprite('2085 3800 270 205','lang-en')+'<span class="lang-ko ink-art" hidden>한</span>';
 $('#speech').innerHTML='<img class="speech-art ink-art" src="./asset/말풍선0.png" alt=""><div class="speech-body"><span id="speech-text"></span></div>';
 for(const {file} of Object.values(BUBBLES)){const image=new Image();image.src='./asset/'+file;}
 document.body.classList.add('drawn-ui');
}
export function syncDrawnUI(lang,kind='thought'){
 for(const [id,ko,en] of [['ssr-settings','가챠 교체','Swap prize'],['settings','경품 리스트','Prizes'],['language','English','한국어']]){const button=$('#'+id);button.setAttribute('aria-label',lang==='ko'?ko:en);button.title=lang==='ko'?ko:en;}
 $('.lang-en').toggleAttribute('hidden',lang!=='ko');$('.lang-ko').hidden=lang==='ko';
 $('.count-label').toggleAttribute('hidden',lang!=='ko');$('.count-label-en').hidden=lang==='ko';$('.count-unit').textContent=lang==='ko'?'번':'';
 const bubble=$('#speech'),style=BUBBLES[kind];bubble.dataset.kind=kind;
 bubble.classList.toggle('excited',kind==='emphasis');
 for(const [key,value] of Object.entries(style.body))bubble.style.setProperty('--body-'+key,value+'%');
 const file=style.file;if(!$('.speech-art').src.endsWith(encodeURIComponent(file)))$('.speech-art').src='./asset/'+file;
}
// A fixed body area, excluding the tail, keeps every line count on the same center.
// Measure only when text/size/font changes, not while the camera follows the pointer.
let speechFitKey='';
document.fonts?.ready.then(()=>{speechFitKey='';});
export function fitSpeechText(bubble,width,height){
 const text=$('#speech-text'),body=bubble.querySelector('.speech-body');
 const key=[bubble.dataset.kind,width,height,innerWidth,text.textContent].join('|');
 if(key===speechFitKey)return;speechFitKey=key;
 bubble.style.removeProperty('--speech-fit-font');
 let size=parseFloat(getComputedStyle(text).fontSize);
 while(size>10&&(text.scrollHeight>body.clientHeight+1||text.scrollWidth>body.clientWidth+1)){
  size=Math.max(10,size-.5);bubble.style.setProperty('--speech-fit-font',size+'px');
 }
}
