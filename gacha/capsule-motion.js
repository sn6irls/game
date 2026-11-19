const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const HATCH_CONTACTS=[1.39,1.65];
export const HATCH_DURATION=1.83;
// A sprung opening, then a gravity-like close against a physical stop. Both
// rebounds stay outside the cabinet and diminish instead of passing through it.
export function hatchOpening(seconds,reduced=false){
 const t=Math.max(0,seconds),open=1.15;
 if(t>=HATCH_DURATION)return 0;
 if(reduced){const ease=x=>{const u=clamp(x,0,1);return u*u*(3-2*u);};return open*ease(t/.32)*(1-ease((t-1.05)/.34));}
 if(t<1.05){const frequency=16.5,damping=.59,decay=frequency*damping,w=frequency*Math.sqrt(1-damping*damping);return open*(1-Math.exp(-decay*t)*(Math.cos(w*t)+decay/w*Math.sin(w*t)));}
 if(t<1.39){const u=(t-1.05)/.34;return open*(1-u*u);}
 if(t<1.65)return .17*Math.sin(Math.PI*(t-1.39)/.26);
 return .045*Math.sin(Math.PI*(t-1.65)/.18);
}

export class CapsuleDrop {
 constructor(){this.radius=.029;this.gravity=4.6;this.stepSize=1/180;this.time=0;this.impacts=[];this.bounces=0;this.accumulator=0;}
 launch(start,destination,profile={}){
  this.firstBounce=profile.bounce??.30;this.secondBounce=profile.secondBounce??.25;this.impactFriction=profile.impactFriction??.32;this.rollFriction=profile.rollFriction??10;
  Object.assign(this,{x:start.x,y:start.y,z:start.z,floor:destination.y,vx:0,vy:profile.lift??-.12,vz:0,time:0,accumulator:0,bounces:0,rx:.2,rz:1.2});this.impacts=[];
  const impact=Math.sqrt(this.vy*this.vy+2*this.gravity*(start.y-this.floor)),flight=(this.vy+impact)/this.gravity;
  // Aim the entire flight, smaller hops, and frictional roll at a chosen floor spot.
  // There is no position snap or artificial horizontal stop at an impact.
  let speed=impact*this.firstBounce,horizontal=this.impactFriction,travel=flight;
  for(let i=0;i<8;i++){travel+=horizontal*2*speed/this.gravity;if(speed<.24)break;speed*=this.secondBounce;horizontal*=.72;}
  travel+=horizontal/this.rollFriction;
  this.vx=(destination.x-start.x)/travel;this.vz=(destination.z-start.z)/travel;
 }
 update(dt){this.accumulator+=Math.min(.06,dt);while(this.accumulator>=this.stepSize){this.step(this.stepSize);this.accumulator-=this.stepSize;}}
 step(h){
  this.time+=h;const oldX=this.x,oldZ=this.z,grounded=this.y<=this.floor+1e-7&&this.vy===0;
  if(grounded){const friction=Math.exp(-this.rollFriction*h);this.vx*=friction;this.vz*=friction;}
  this.x+=this.vx*h;this.z+=this.vz*h;
  if(!grounded){this.y+=this.vy*h-.5*this.gravity*h*h;this.vy-=this.gravity*h;}
  if(this.y<this.floor){this.y=this.floor;
   if(this.vy<-.24){const speed=-this.vy;this.bounces++;this.vy=speed*(this.bounces===1?this.firstBounce:this.secondBounce);const friction=this.bounces===1?this.impactFriction:.72;this.vx*=friction;this.vz*=friction;this.impacts.push({time:this.time,x:this.x,y:this.y,z:this.z,speed,vx:this.vx,vz:this.vz});}
   else this.vy=0;
  }
  this.collide?.(this);
  this.rx+=(this.z-oldZ)/this.radius;this.rz-=(this.x-oldX)/this.radius;
 }
 get settled(){return this.bounces>=2&&this.y===this.floor&&this.vy===0&&Math.hypot(this.vx,this.vz)<.022;}
}

export class SmoothRotation {
 constructor(limit=1){this.limit=limit;this.reset();}
 reset(pitch=0,yaw=0){this.pitch=pitch;this.yaw=yaw;this.vx=this.vy=0;this.held=false;this.idle=1;}
 begin(rotation){this.reset(rotation.x,rotation.y);this.held=true;}
 move(dx,dy,seconds){
  const x=dy*.007,y=dx*.010,dt=clamp(seconds,1/120,1/20);
  this.pitch=clamp(this.pitch+x,-this.limit,this.limit);this.yaw+=y;
  this.vx=this.vx*.65+clamp(x/dt,-2.4,2.4)*.35;this.vy=this.vy*.65+clamp(y/dt,-3.2,3.2)*.35;this.idle=0;
 }
 release(){this.held=false;if(this.idle>.08)this.vx=this.vy=0;}
 step(dt,rotation){
  this.idle+=dt;
  if(!this.held){const decay=Math.exp(-7.5*dt),travel=(1-decay)/7.5;this.pitch=clamp(this.pitch+this.vx*travel,-this.limit,this.limit);this.yaw+=this.vy*travel;this.vx*=decay;this.vy*=decay;}
  const follow=1-Math.exp(-17*dt);rotation.x+=(this.pitch-rotation.x)*follow;rotation.y+=(this.yaw-rotation.y)*follow;
 }
}

// A lightly damped spring with zero initial speed and a small, soft overshoot.
export function rewardPop(seconds){const t=Math.max(0,seconds),frequency=10.5,damping=.76,decay=frequency*damping,oscillation=frequency*Math.sqrt(1-damping*damping);return 1-Math.exp(-decay*t)*(Math.cos(oscillation*t)+decay/oscillation*Math.sin(oscillation*t));}
