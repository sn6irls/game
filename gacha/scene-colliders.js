import * as THREE from './vendor/three/three.module.js';

function hull(points){
 const sorted=[...new Map(points.map(p=>[`${p.x.toFixed(5)},${p.z.toFixed(5)}`,p])).values()].sort((a,b)=>a.x-b.x||a.z-b.z);
 if(sorted.length<3)return sorted;
 const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),lower=[],upper=[];
 for(const p of sorted){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of [...sorted].reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 lower.pop();upper.pop();return lower.concat(upper);
}

// Built once from the actual transformed lower meshes, then simulated cheaply in 2D.
export function floorFootprint(root,{floorY,ceiling,kind,name}){
 root.updateWorldMatrix(true,true);const points=[],v=new THREE.Vector3();
 root.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);if(v.y<floorY-.09||v.y>floorY+ceiling)continue;points.push({x:v.x*10,z:v.z*10});}
 });
 const polygon=hull(points);if(polygon.length<3)throw Error(`Missing floor collider: ${name}`);
 return {name,kind,points:polygon,restitution:kind==='machine'?.76:.64};
}
