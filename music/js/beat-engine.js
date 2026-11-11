/* Five independent performance lanes: scene, glint, groove, tick, drop. */
(function(scope){
const DROP_LEAD=.38,ROWS=5;
function reaction(events,time){const out={kick:0,glint:0,groove:0,tick:0,boom:0,window:0,side:0};const names=['kick','groove','window','glint','boom'];for(const e of events){const age=time-e.at;if(age<0||age>1.4||e.row<0||e.row>=ROWS)continue;const value=Math.exp(-age*[6,10,2.5,7,6][e.row]);out[names[e.row]]+=value;if(e.row===2||e.row===3||e.row===4)out.side+=(e.id%2?1:-1)*value*[0,0,.027,.14,.13][e.row];}for(const k of names)out[k]=Math.min(1.5,out[k]);out.side=Math.max(-.24,Math.min(.24,out.side));return out;}
const SCENES=[
 {name:'FRONT',position:[0,2.8,4],key:80,rim:.3,ambient:.035,fill:.15,back:.015},
 {name:'RIM',position:[-2,4,-2],key:0,rim:12,ambient:.006,fill:.025,back:.16},
 {name:'TOP',position:[0,5.3,.6],key:125,rim:.4,ambient:.018,fill:.10,back:.015},
 {name:'BLACKOUT',position:[0,4,-3],key:0,rim:.12,ambient:.002,fill:.022,back:.025},
 {name:'SIDE',position:[-3,2.4,1.6],key:90,rim:.3,ambient:.009,fill:.025,back:.035},
 {name:'UNDER',position:[.2,.1,2.5],key:45,rim:.8,ambient:.006,fill:.04,back:.01}
];
// A quick beat accent with a continuous, longer recovery. The head reaches
// the window at audio time zero; the short approach follows the road jolt.
function snap(age,impact=false){
 const points=impact?
  [[-.14,0],[-.085,.18],[-.035,.65],[-.010,.94],[0,1],[.012,1],[.065,.82],[.145,.48],[.255,.12],[.335,-.025],[.44,0]]:
  [[0,0],[.055,1],[.125,.74],[.235,.10],[.30,-.035],[.39,0]];
 if(age<points[0][0]||age>=points.at(-1)[0])return 0;
 const slope=i=>{if(i<=0||i>=points.length-1)return 0;const h0=points[i][0]-points[i-1][0],h1=points[i+1][0]-points[i][0],a=(points[i][1]-points[i-1][1])/h0,b=(points[i+1][1]-points[i][1])/h1;if(a*b<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/a+w1/b);};
 for(let i=1;i<points.length;i++){const [a,x]=points[i-1],[b,y]=points[i];if(age<b){const h=b-a,u=(age-a)/h,u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*x+(u3-2*u2+u)*h*slope(i-1)+(-2*u3+3*u2)*y+(u3-u2)*h*slope(i);}}
 return 0;
}
function motion(events,time){
 const out={pitch:0,yaw:0,roll:0,headY:0,lean:0,heave:0,depth:0,hair:0};
 let peak=0,recoil=0,weight=0;
 for(const e of events){if(e.row!==1)continue;const age=time-e.at,k=snap(age),side=e.direction||(e.id%2?1:-1);
  peak=Math.max(peak,k);recoil=Math.min(recoil,k);weight+=Math.abs(k);out.yaw+=side*k*.022;out.roll+=side*k*.035;
 }
 out.pitch=(peak>0?peak:recoil)*.24;
 if(weight>1){out.yaw/=weight;out.roll/=weight;}
 out.pitch=Math.max(-.08,Math.min(.36,out.pitch));out.roll=Math.max(-.065,Math.min(.065,out.roll));out.yaw=Math.max(-.042,Math.min(.042,out.yaw));return out;
}
function lighting(mode,age){const base=SCENES[((mode%SCENES.length)+SCENES.length)%SCENES.length];const envelope=.56+.44*Math.exp(-Math.max(age,0)*5);const ring=Math.floor(mode/6),angle=Math.atan2(base.position[0],base.position[2])+ring*Math.PI+Math.min(Math.max(age,0),.6)*.65*(mode%2?1:-1),radius=Math.hypot(base.position[0],base.position[2]);const position=[Math.sin(angle)*radius,base.position[1],Math.cos(angle)*radius];return {...base,position,rimPosition:[-Math.sin(angle)*3,3.6,-Math.cos(angle)*3],tint:mode%3===0?'#e0e6ff':mode%3===1?'#fff0e1':'#ffffff',key:base.key*envelope};}
function initial(){return Array.from({length:ROWS},()=>Array(16).fill(false));}
function generate(random=Math.random){const rows=Array.from({length:ROWS},()=>Array(16).fill(false));const kickSets=[[0,6,10],[0,7,8,14],[0,3,10],[0,6,8,11]];for(const s of kickSets[Math.floor(random()*kickSets.length)])rows[0][s]=true;for(let s=0;s<16;s++){rows[1][s]=random()<(s%2?.32:.13);rows[2][s]=(s===4||s===12)||random()<.09;rows[3][s]=random()<(s%4===0?.34:.16);}if(!rows[1].some(Boolean))rows[1][7]=true;if(!rows[3].some(Boolean))rows[3][0]=true;rows[4][[7,11,14,15][Math.floor(random()*4)]]=true;return rows;}
function dropPose(age){if(age < -DROP_LEAD || age>.65)return {visible:false};if(age<0){const p=(age+DROP_LEAD)/DROP_LEAD;return {visible:true,y:2.78+.9*(1-p*p),x:0,rotation:(1-p)*-.35,scale:1};}const p=age/.65;return {visible:true,y:2.78+1.25*Math.sin(p*Math.PI)-1.65*p*p,x:p*1.35,rotation:p*4,scale:Math.max(0,1-Math.max(0,p-.7)/.3)};}
function lineCells(a,b){const n=Math.max(Math.abs(b.r-a.r),Math.abs(b.s-a.s)),out=[];for(let i=0;i<=n;i++){const t=n?i/n:0,r=Math.round(a.r+(b.r-a.r)*t),s=Math.round(a.s+(b.s-a.s)*t);if(r>=0&&r<ROWS&&s>=0&&s<16)out.push({r,s});}return out;}
const api={DROP_LEAD,ROWS,SCENES,reaction,snap,motion,lighting,initial,generate,dropPose,lineCells};if(typeof module!=='undefined')module.exports=api;else scope.MissNormalBeat=api;
})(globalThis);
