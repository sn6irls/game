import {FACE_IDS} from './face-atlas.js';
export const DIALOGUE={
 ko:{
  idle:['얼마 만에 뽑을 수 있을까...?'],
  N:['또 이거 나왔어...','또 이거야...','중복이자나...','또 중복...','필요 없어!!!','제발 그만 나와...','슬슬 나올때가 됐는데...','4천원밖에 안하니까...','저 피규어 가지고 싶은데...','피규어 가지고 싶어...','한번만 더 해볼까...','딱 마지막으로 한번만 더...','이번엔 나오겠지...'],
  R:['나쁘진 않은데... 그래도...','이걸 원한건 아닌데...','이것도 귀엽긴한데...','이거라도 뽑았네...'],
  SSR_fast:['{count}번만에?! 대박!!!!'],SSR_quick:['{count}번만에 뽑았어!!'],SSR_wait:['{count}번만에 나왔어...!'],SSR_final:['{count}번만에 드디어...'],
  pity:['안에 든 모든 가챠를\n다 뽑았어...','결국 천장이구나...','여기에 10만원 넘게\n쓰다니...'],
  expensive:['여기에 10만원 넘게\n쓰다니...']
 },
 en:{
  idle:['How long will it take...?'],
  N:['This again...','Not this again...','It’s a duplicate...','Another duplicate...','I don’t need this!!!','Please stop coming out...','Surely it’s about time...','It’s only ₩4,000...','I want that figure...','I want the figure...','Maybe one more try...','Just one last time...','This time, surely...'],
  R:['Not bad... but still...','This isn’t what I wanted...','This is kind of cute, too...','At least I got something...'],
  SSR_fast:['Only {count} pulls?! Amazing!!!!'],SSR_quick:['Got it in {count} pulls!!'],SSR_wait:['It took {count} pulls...!'],SSR_final:['Finally... after {count} pulls...'],
  pity:['I emptied the whole\ngacha machine...','So it took the guarantee...','I spent over ₩100,000\non this...'],
  expensive:['I spent over ₩100,000\non this...']
 }
};
export function reactionFor({rarity,count,spent,pity},random=Math.random){
 let kind,emotion;
 if(pity){kind='pity';emotion='exhausted';}
 else if(spent>100000){kind='expensive';emotion='exhausted';}
 else if(rarity==='SSR'){
  kind=count<=5?'SSR_fast':count<=10?'SSR_quick':count<=15?'SSR_wait':'SSR_final';emotion='joy';
 }else if(rarity==='N'){kind='N';emotion=['crying','sulking','teary'][Math.min(2,Math.floor(random()*3))];}
 else{kind='R';emotion='ambivalent';}
 const index=Math.min(DIALOGUE.ko[kind].length-1,Math.floor(random()*DIALOGUE.ko[kind].length));
 return {kind,index,emotion,face:FACE_IDS[emotion]};
}
export function dialogueText(lang,kind,index,count){return DIALOGUE[lang][kind][index].replaceAll('{count}',String(count));}
