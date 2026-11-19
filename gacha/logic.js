export const DEFAULT_ODDS={N:77.3,R:18,SR:3.7,SSR:1};
export function validateOdds(value){return ['N','R','SR','SSR'].every(k=>Number.isFinite(value[k])&&value[k]>=0)&&Math.abs(Object.values(value).reduce((a,b)=>a+b,0)-100)<.001;}
export function pickRarity(odds,random=Math.random){let roll=random()*100,total=0;for(const k of ['N','R','SR','SSR']){total+=odds[k];if(roll<total)return k;}return 'SSR';}
export function angleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function pickPrize(prizes,rarity,random=Math.random){const pool=prizes.filter(p=>p.rarity===rarity);return pool[Math.floor(random()*pool.length)];}


export function rollWithPity(odds,misses,limit,random=Math.random){const pity=misses>=limit-1;const rarity=pity?'SSR':pickRarity(odds,random);return {rarity,pity,misses:rarity==='SSR'?0:misses+1};}
