/* Oriented-box contacts for the small photo-jelly pile. No external physics dependency. */
(()=>{
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const normalized=v=>{const l=Math.hypot(...v);return l>1e-8?v.map(n=>n/l):null};
 const axes=(a,b)=>[cross(a.e[0],a.e[1]),cross(a.e[1],a.e[2]),cross(a.e[2],a.e[0]),cross(b.e[0],b.e[1]),cross(b.e[1],b.e[2]),cross(b.e[2],b.e[0]),...a.e.flatMap(u=>b.e.map(v=>cross(u,v)))].map(normalized).filter(Boolean);
 const radius=(b,n)=>b.e.reduce((s,e)=>s+Math.abs(dot(e,n)),0);
 function contact(a,b,margin=0){let depth=Infinity,normal=null;const delta=sub(b.c,a.c);for(const n of axes(a,b)){const d=dot(delta,n),overlap=radius(a,n)+radius(b,n)+margin-Math.abs(d);if(overlap<=0)return null;if(overlap<depth){depth=overlap;normal=n.map(v=>d<0?-v:v)}}return {depth,normal};}
 function verticalSupport(a,b){let lo=-Infinity,hi=Infinity;const delta=sub(a.c,b.c);for(const n of axes(a,b)){const d=dot(delta,n),r=radius(a,n)+radius(b,n)+.008;if(Math.abs(n[1])<1e-7){if(Math.abs(d)>=r)return null;continue}const t1=(-r-d)/n[1],t2=(r-d)/n[1];lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return null}return Number.isFinite(hi)?hi:null;}
 function bounds(b){return [0,1,2].map(i=>{const r=b.e.reduce((s,e)=>s+Math.abs(e[i]),0);return [b.c[i]-r,b.c[i]+r]})}
 function box(o){o.updateMatrix();const data=o.userData.collider,m=o.matrix.elements;
  const point=v=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
  const c=point(data.center),e=data.edges.map(v=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]]);return {c,e};
 }
 function shift(o,x,y,z){o.position.x+=x;o.position.y+=y;o.position.z+=z;const b=o.userData.body;if(b){b.x=o.position.x;b.y=o.position.y;b.z=o.position.z;b.tx+=x;b.tz+=z;}}
 function contain(o){const v=bounds(box(o));const x=v[0][0]<-1.83?-1.83-v[0][0]:v[0][1]>1.83?1.83-v[0][1]:0;const z=v[2][0]<.30?.30-v[2][0]:v[2][1]>2.65?2.65-v[2][1]:0;const y=Math.max(0,(window.mealSurface?.(o.position.x,o.position.z)??1.65)-v[1][0]);shift(o,x,y,z);const b=o.userData.body;if(b){if(x)b.vx=0;if(z)b.vz=0;if(y&&b.vy<0)b.vy=0}}
 function solve(objects){for(const o of objects)contain(o);for(let pass=0;pass<10;pass++){let changed=false;for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
   const a=objects[i],b=objects[j],hit=contact(box(a),box(b),.004);if(!hit||hit.depth<.0001)continue;changed=true;const n=hit.normal,dist=hit.depth+.001;
   // Preserve the older support; resolve the newer piece along the separating contact normal.
   shift(b,n[0]*dist,n[1]*dist,n[2]*dist);const body=b.userData.body;
   if(body){const speed=body.vx*n[0]+body.vy*n[1]+body.vz*n[2];if(speed<0){body.vx-=speed*n[0];body.vy-=speed*n[1];body.vz-=speed*n[2];}}
   contain(b);
   // If a rim blocks separation, place it above the older piece instead of allowing interpenetration.
   const remaining=contact(box(a),box(b),.002);if(remaining){const up=verticalSupport(box(b),box(a));if(up!==null&&up>0)shift(b,0,up+.002,0)}
  }if(!changed)break;}
 }
 window.MealContacts={contact,verticalSupport,bounds,box,solve};
})();
