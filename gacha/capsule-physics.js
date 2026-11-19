const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const R=.245,STEP=1/60,CELL=R*2+.03;

// Circle/convex-footprint contact in the floor plane. Points are counterclockwise.
export function polygonContact(x,z,points,radius=R){
 let inside=true,best=null,distance2=Infinity;
 for(let i=0;i<points.length;i++){
  const a=points[i],c=points[(i+1)%points.length],ex=c.x-a.x,ez=c.z-a.z,len2=ex*ex+ez*ez;
  if(len2<1e-12)continue;
  if(ex*(z-a.z)-ez*(x-a.x)<-1e-8)inside=false;
  const t=clamp(((x-a.x)*ex+(z-a.z)*ez)/len2,0,1),qx=a.x+ex*t,qz=a.z+ez*t,d2=(x-qx)**2+(z-qz)**2;
  if(d2<distance2){distance2=d2;best={x:qx,z:qz,nx:ez/Math.sqrt(len2),nz:-ex/Math.sqrt(len2)};}
 }
 if(!best||(!inside&&distance2>=radius*radius))return null;
 if(!inside&&distance2>1e-12){const d=Math.sqrt(distance2);best.nx=(x-best.x)/d;best.nz=(z-best.z)/d;}
 return best;
}

// Small fixed-step sphere simulation. Sleeping bodies cost no integration work;
// a spatial grid limits collision checks to adjacent cells.
export class CapsulePhysics {
 constructor(capacity=320){this.capacity=capacity;this.bodies=[];this.total=0;this.accumulator=0;this.grabbed=null;this.bounds={left:-5,right:5,back:.2,front:6.4};this.viewPlanes=[];this.obstacles=[];this.solidObstacles=[];this.solidHits={character:0,machine:0};this.collisionCount=0;this.lastChecks=0;}
 add(position={x:1,y:R,z:3},velocity={x:0,y:0,z:0}){
  const id=this.total++%this.capacity;
  this.bodies[id]={id,x:position.x,y:Math.max(R,position.y),z:position.z,vx:velocity.x||0,vy:velocity.y||0,vz:velocity.z||0,rx:id*.7,rz:id*1.3,asleep:false,rest:0,dirty:true};
  this.contain(this.bodies[id]);
  return id;
 }
 wake(b){b.asleep=false;b.rest=0;}
 setViewPlanes(planes){this.viewPlanes=planes;for(const b of this.bodies)this.contain(b);}
 setObstacles(obstacles){this.obstacles=obstacles;for(const b of this.bodies)this.contain(b);}
 setSolidObstacles(obstacles){this.solidObstacles=obstacles;for(const b of this.bodies)this.contain(b);}
 isSolidFree(x,z,radius=R){return this.solidObstacles.every(o=>!polygonContact(x,z,o.points,radius));}
 outsideSolids(b){
  let changed=false;
  const fits=(x,z)=>x>=this.bounds.left+R&&x<=this.bounds.right-R&&z>=this.bounds.back+R&&z<=this.bounds.front-R&&this.viewPlanes.every(p=>p.x*x+p.y*b.y+p.z*z+p.d>=.27-1e-5);
  for(const obstacle of this.solidObstacles){
   const contact=polygonContact(b.x,b.z,obstacle.points);if(!contact)continue;
   let {nx,nz}=contact,x=contact.x+nx*(R+.001),z=contact.z+nz*(R+.001);
   if(!fits(x,z)){
    let nearest=Infinity;
    for(let i=0;i<obstacle.points.length;i++){
     const a=obstacle.points[i],c=obstacle.points[(i+1)%obstacle.points.length],ex=c.x-a.x,ez=c.z-a.z,len=Math.hypot(ex,ez);if(len<1e-8)continue;
     const cx=ez/len,cz=-ex/len;
     for(let j=0;j<=12;j++){
      const px=a.x+ex*j/12+cx*(R+.002),pz=a.z+ez*j/12+cz*(R+.002),d2=(px-b.x)**2+(pz-b.z)**2;
      if(fits(px,pz)&&this.isSolidFree(px,pz)&&d2<nearest){nearest=d2;x=px;z=pz;nx=cx;nz=cz;}
     }
    }
   }
   b.x=x;b.z=z;const speed=b.vx*nx+b.vz*nz;
   if(speed<0){const restitution=obstacle.restitution??.7;b.vx-=(1+restitution)*speed*nx;b.vz-=(1+restitution)*speed*nz;if(speed<-.05){this.solidHits[obstacle.kind]=(this.solidHits[obstacle.kind]||0)+1;this.wake(b);}}
   changed=true;
  }
  return changed;
 }
 outsideCharacter(b){
  let changed=false;
  const fits=(x,z)=>x>=this.bounds.left+R&&x<=this.bounds.right-R&&z>=this.bounds.back+R&&z<=this.bounds.front-R&&this.viewPlanes.every(p=>p.x*x+p.y*b.y+p.z*z+p.d>=.27-1e-6);
  for(const o of this.obstacles){
   const rx=o.rx+.28,rz=o.rz+.28,dx=(b.x-o.x)/rx,dz=(b.z-o.z)/rz,len=Math.hypot(dx,dz);
   if(len>=1)continue;
   let x=o.x+(len>1e-8?dx/len:1)*rx,z=o.z+(len>1e-8?dz/len:0)*rz;
   // A character can overlap a screen edge. Pick a reachable side instead of
   // trapping shells between that edge and the character's footprint.
   if(!fits(x,z)){let best=Infinity;for(let i=0;i<64;i++){const a=i*Math.PI/32,cx=o.x+Math.cos(a)*(rx+.002),cz=o.z+Math.sin(a)*(rz+.002),distance=(cx-b.x)**2+(cz-b.z)**2;if(fits(cx,cz)&&distance<best){best=distance;x=cx;z=cz;}}}
   b.x=x;b.z=z;
   const nx=(x-o.x)/(rx*rx),nz=(z-o.z)/(rz*rz),n2=nx*nx+nz*nz,speed=b.vx*nx+b.vz*nz;
   if(speed<0&&n2>1e-8){b.vx-=1.45*speed*nx/n2;b.vz-=1.45*speed*nz/n2;}
   changed=true;
  }
  return changed;
 }
 contain(b){
  const bounds=this.bounds,oldX=b.x,oldZ=b.z;
  if(b.x<bounds.left+R){b.x=bounds.left+R;if(b.vx<0)b.vx*=-.55;}
  if(b.x>bounds.right-R){b.x=bounds.right-R;if(b.vx>0)b.vx*=-.55;}
  if(b.z<bounds.back+R){b.z=bounds.back+R;if(b.vz<0)b.vz*=-.55;}
  if(b.z>bounds.front-R){b.z=bounds.front-R;if(b.vz>0)b.vz*=-.55;}
  // Camera-side walls follow the viewport, including the capsule rim's radius.
  // Correct in the floor plane so a side collision cannot launch a shell upward.
  for(let pass=0;pass<8;pass++){let changed=false;
   for(const p of this.viewPlanes){const distance=p.x*b.x+p.y*b.y+p.z*b.z+p.d,overlap=.27-distance,n2=p.x*p.x+p.z*p.z;
    if(overlap<=1e-7||n2<1e-8)continue;
    b.x+=p.x*(overlap+1e-6)/n2;b.z+=p.z*(overlap+1e-6)/n2;
    const speed=b.vx*p.x+b.vz*p.z;if(speed<0){b.vx-=1.55*speed*p.x/n2;b.vz-=1.55*speed*p.z/n2;}
    changed=true;
   }
   if(this.outsideCharacter(b))changed=true;
   if(this.outsideSolids(b))changed=true;
   if(!changed)break;
  }
  if(b.x!==oldX||b.z!==oldZ){b.dirty=true;if(b.asleep&&Math.hypot(b.x-oldX,b.z-oldZ)>1e-6)this.wake(b);}
 }
 impulse(id,x,z){const b=this.bodies[id];if(!b)return;this.wake(b);b.vx=clamp(b.vx+x,-7,7);b.vz=clamp(b.vz+z,-7,7);}
 grab(id,x,z){if(!this.bodies[id])return;this.grabbed={id,x,z};this.wake(this.bodies[id]);}
 moveGrab(x,z){if(this.grabbed){this.grabbed.x=clamp(x,this.bounds.left+R,this.bounds.right-R);this.grabbed.z=clamp(z,this.bounds.back+R,this.bounds.front-R);this.wake(this.bodies[this.grabbed.id]);}}
 release(){this.grabbed=null;}
 sweep(from,to,seconds){
  if(!from)return;const dx=to.x-from.x,dz=to.z-from.z,length2=dx*dx+dz*dz;
  if(length2<.00002||length2>16)return;
  const speed=Math.min(5,Math.sqrt(length2)/Math.max(seconds,1/120)),inv=1/Math.sqrt(length2);
  for(const b of this.bodies){const t=clamp(((b.x-from.x)*dx+(b.z-from.z)*dz)/length2,0,1),distance=Math.hypot(b.x-from.x-dx*t,b.z-from.z-dz*t);
   if(distance<R+.12&&b.y<.9){this.impulse(b.id,dx*inv*speed*.75,dz*inv*speed*.75);}
  }
 }
 update(dt){
  if(!this.grabbed&&!this.bodies.some(b=>!b.asleep)){this.accumulator=0;return;}
  this.accumulator+=Math.min(dt,.05);
  while(this.accumulator>=STEP){this.step(STEP);this.accumulator-=STEP;}
 }
 step(h){
  for(const b of this.bodies){
   if(b.asleep)continue;
   if(this.grabbed?.id===b.id){b.vx+=((this.grabbed.x-b.x)*36-b.vx*6)*h;b.vz+=((this.grabbed.z-b.z)*36-b.vz*6)*h;}
   b.supported=b.y<=R+.005;b.vx=clamp(b.vx,-7,7);b.vz=clamp(b.vz,-7,7);b.vy-=9.8*h;
   b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
   if(b.y<R){b.y=R;b.vy=Math.abs(b.vy)>.7?-b.vy*.28:0;}
   this.contain(b);
   const friction=Math.exp(-(b.y<R+.02?1.35:.15)*h);b.vx*=friction;b.vz*=friction;
   b.rx+=b.vz*h/R;b.rz-=b.vx*h/R;b.dirty=true;
  }
  this.lastChecks=0;
  for(let pass=0;pass<4;pass++){
   const grid=new Map();for(const b of this.bodies){const key=Math.floor(b.x/CELL)+','+Math.floor(b.z/CELL);let cell=grid.get(key);if(!cell){cell=[];grid.set(key,cell);}cell.push(b);}
   for(const a of this.bodies){const gx=Math.floor(a.x/CELL),gz=Math.floor(a.z/CELL);
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
     const neighbors=grid.get((gx+x)+','+(gz+z));if(!neighbors)continue;
     for(const b of neighbors){if(b.id<=a.id||(a.asleep&&b.asleep))continue;this.lastChecks++;
      let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d2=dx*dx+dy*dy+dz*dz;if(d2>=4*R*R)continue;
      if(d2<1e-9){dx=.001*Math.cos(a.id+b.id);dz=.001*Math.sin(a.id+b.id);dy=0;d2=.000001;}
      const dist=Math.sqrt(d2),nx=dx/dist,ny=dy/dist,nz=dz/dist,overlap=2*R-dist;
      const speed=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny+(b.vz-a.vz)*nz;
      if(ny>.5)b.supported=true;else if(ny<-.5)a.supported=true;
      if(speed<-.35||overlap>.04){this.wake(a);this.wake(b);}
      const correction=Math.max(overlap-.001,0)*.49;
      // Even a gentle positional push must wake its neighbour; otherwise that
      // sleeping ball can be pushed into another sleeper without a new contact pass.
      if(correction>1e-5){if(a.asleep)this.wake(a);if(b.asleep)this.wake(b);}
      a.x-=nx*correction;a.y=Math.max(R,a.y-ny*correction);a.z-=nz*correction;
      b.x+=nx*correction;b.y=Math.max(R,b.y+ny*correction);b.z+=nz*correction;
      if(speed<0){const impulse=-(1+(Math.abs(speed)>.3?.55:0))*speed*.5;
       a.vx-=nx*impulse;a.vy-=ny*impulse;a.vz-=nz*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;b.vz+=nz*impulse;
       if(speed<-.15)this.collisionCount++;
      }
      a.dirty=b.dirty=true;
     }
    }
   }
   // Resolve walls together with ball contacts, so a resized viewport cannot
   // keep squeezing resting balls back into each other at a scene boundary.
   for(const b of this.bodies)if(!b.asleep)this.contain(b);
  }
  for(const b of this.bodies){this.contain(b);if(b.asleep)continue;
   if(Math.hypot(b.vx,b.vz)<.055&&Math.abs(b.vy)<.24&&b.supported&&this.grabbed?.id!==b.id){b.rest+=h;if(b.rest>.7){b.asleep=true;b.vx=b.vy=b.vz=0;}}
   else b.rest=0;
  }
 }
 reset(){this.bodies.length=0;this.total=0;this.accumulator=0;this.grabbed=null;this.collisionCount=0;this.solidHits={character:0,machine:0};}
 snapshot(){return this.bodies.map(({id,x,y,z,vx,vy,vz,asleep})=>({id,x,y,z,vx,vy,vz,asleep}));}
}
