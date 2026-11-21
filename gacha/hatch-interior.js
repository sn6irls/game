import * as THREE from './vendor/three/three.module.js';

// Cut only the baked-in door inside the cabinet scan, then place the cavity
// behind it. A second copy of the whole flap intersects the moving hinge.
export function createHatchInterior(scene,machine,hatch,right,outward){
 hatch.updateWorldMatrix(true,true);
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity,minW=Infinity,maxW=-Infinity;
 const point=new THREE.Vector3();
 hatch.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);const u=point.dot(right),w=point.dot(outward);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,point.y);maxV=Math.max(maxV,point.y);minW=Math.min(minW,w);maxW=Math.max(maxW,w);}
 });
 // Inset the opening from the printed flap's border, especially at the hinge.
 const bounds=new THREE.Vector4(minU+.006,minV+.007,maxU-.006,maxV-.014);
 const back=minW-.018,front=minW-.002,enabled={value:0};
 const depths=new THREE.Vector2(back-.001,maxW+.004);
 machine.traverse(o=>{if(!o.isMesh)return;
  const cut=material=>{const m=material.clone(),previous=m.onBeforeCompile;
   m.onBeforeCompile=shader=>{previous?.(shader);Object.assign(shader.uniforms,{hatchOpen:enabled,hatchBounds:{value:bounds},hatchDepths:{value:depths},hatchRight:{value:right},hatchOutward:{value:outward}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 hatchWorldPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nhatchWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 hatchWorldPosition;\nuniform float hatchOpen;\nuniform vec4 hatchBounds;\nuniform vec2 hatchDepths;\nuniform vec3 hatchRight;\nuniform vec3 hatchOutward;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(hatchOpen>0.5){vec3 p=vec3(dot(hatchWorldPosition,hatchRight),hatchWorldPosition.y,dot(hatchWorldPosition,hatchOutward));if(p.x>hatchBounds.x&&p.x<hatchBounds.z&&p.y>hatchBounds.y&&p.y<hatchBounds.w&&p.z>hatchDepths.x&&p.z<hatchDepths.y)discard;}');
   };m.customProgramCacheKey=()=> 'recessed-hatch-cut-v1';return m;};
  o.material=Array.isArray(o.material)?o.material.map(cut):cut(o.material);
 });
 const vertices=[],indices=[];
 function quad(corners){const first=vertices.length/3;for(const [u,v,w] of corners){point.copy(right).multiplyScalar(u).addScaledVector(outward,w);point.y=v;vertices.push(point.x,point.y,point.z);}indices.push(first,first+1,first+2,first,first+2,first+3);}
 const [l,b,r,t]=bounds.toArray();
 quad([[l,b,back],[r,b,back],[r,t,back],[l,t,back]]);
 quad([[l,b,front],[l,b,back],[l,t,back],[l,t,front]]);
 quad([[r,b,back],[r,b,front],[r,t,front],[r,t,back]]);
 quad([[l,b,back],[l,b,front],[r,b,front],[r,b,back]]);
 quad([[l,t,front],[l,t,back],[r,t,back],[r,t,front]]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x030303,side:THREE.DoubleSide,toneMapped:false}));mesh.name='recessed-hatch-interior';mesh.visible=false;scene.add(mesh);
 return {mesh,setOpen(open){enabled.value=open?1:0;mesh.visible=open;}};
}
