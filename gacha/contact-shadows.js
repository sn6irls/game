import * as THREE from './vendor/three/three.module.js';

// Soft floor contact shadows share one instanced draw. They supplement the
// directional shadow map at the knees, feet, and small capsule contact points.
export function createContactShadows(scene,floorY,capacity=96){
 const geometry=new THREE.PlaneGeometry(1,1),opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);
 geometry.setAttribute('shadowOpacity',opacity);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
  vertexShader:`attribute float shadowOpacity;varying vec2 shadowUv;varying float strength;
   void main(){shadowUv=uv;strength=shadowOpacity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 shadowUv;varying float strength;
   void main(){vec2 q=shadowUv*2.-1.;float a=exp(-3.5*dot(q,q))*(1.-smoothstep(.65,1.,length(q)))*strength;
   gl_FragColor=vec4(.025,.021,.018,a);
   #include <colorspace_fragment>
   }`
 });
 const mesh=new THREE.InstancedMesh(geometry,material,capacity),stamp=new THREE.Object3D();mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
 let count=0;
 return {begin(){count=0;},add(x,z,width,depth,strength){if(count===capacity)return;stamp.position.set(x,floorY+.0015,z);stamp.rotation.set(-Math.PI/2,0,0);stamp.scale.set(width,depth,1);stamp.updateMatrix();mesh.setMatrixAt(count,stamp.matrix);opacity.setX(count,strength);count++;},end(){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;opacity.needsUpdate=true;}};
}
