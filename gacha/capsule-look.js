import * as THREE from './vendor/three/three.module.js';
import {mergeGeometries} from './vendor/three/addons/utils/BufferGeometryUtils.js';

export const CAPSULE_COLORS=['#298dbd','#65943b','#d9ae24','#bb567f'];
export const randomCapsuleColor=()=>Math.floor(Math.random()*CAPSULE_COLORS.length);

// One small, prefiltered studio reflection shared by every shell. No real-time
// cube cameras, transmission render passes, bloom or per-ball lights are needed.
export function createCapsuleLook(renderer,authored=null){
 if(authored)return createPhotoCapsuleLook(renderer,authored);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d'),wash=ctx.createLinearGradient(0,0,0,512);
 wash.addColorStop(0,'#748790');wash.addColorStop(.5,'#333e46');wash.addColorStop(1,'#141c28');
 ctx.fillStyle=wash;ctx.fillRect(0,0,1024,512);
 // Window panes and a long softbox make readable moving highlights on a sphere.
 ctx.fillStyle='#ffffff';ctx.fillRect(115,140,65,92);ctx.fillRect(186,140,38,92);
 ctx.fillStyle='#d6ecff';ctx.fillRect(590,110,22,210);
 ctx.fillStyle='#a7b9c9';ctx.fillRect(785,235,110,48);
 const source=new THREE.CanvasTexture(canvas);source.mapping=THREE.EquirectangularReflectionMapping;source.colorSpace=THREE.SRGBColorSpace;
 const generator=new THREE.PMREMGenerator(renderer),environment=generator.fromEquirectangular(source);
 source.dispose();generator.dispose();
 const common={envMap:environment.texture,envMapIntensity:1.7,metalness:0,clearcoat:1,clearcoatRoughness:.075};
 const clear=new THREE.MeshPhysicalMaterial({...common,color:'#edfaff',roughness:.07,transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false,forceSinglePass:true});
 // A camera-side softbox gives the plastic a crisp window reflection even on
 // small mobile displays. It uses the reflected ray, not a painted-on sticker.
 function polish(material,transparent=false){
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 shellRay = reflect(-normalize(vViewPosition), normalize(normal));
   vec2 windowUV = shellRay.xy / max(.15, shellRay.z);
   vec2 windowEdge = abs(windowUV - vec2(-.68,.48));
   float windowLight = (1.-smoothstep(.19,.215,windowEdge.x)) * (1.-smoothstep(.24,.265,windowEdge.y));
   windowLight *= smoothstep(.012,.025,abs(windowUV.x+.68)) * step(.15,shellRay.z);
   windowLight *= gl_FrontFacing ? 1. : 0.;
   outgoingLight += vec3(2.5) * windowLight;
   ${transparent?'diffuseColor.a = max(clamp(diffuseColor.a + .43 * pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 3.), 0., .8), windowLight*.88);':''}
   #include <opaque_fragment>`);};
  material.customProgramCacheKey=()=>`capsule-polish-v2-${transparent}`;
 }
 polish(clear,true);
 const cup=new THREE.MeshPhysicalMaterial({...common,color:'#ffffff',roughness:.16,side:THREE.DoubleSide});
 const cups=CAPSULE_COLORS.map(color=>{const m=cup.clone();m.color.set(color);polish(m);return m;});polish(cup);
 const rim=new THREE.MeshPhysicalMaterial({...common,color:'#edf7ed',roughness:.15,transparent:true,opacity:.66,depthWrite:false,forceSinglePass:true});
 const geometryCache=new Map();
 function geometries(radius,small=false){
  const key=`${radius}/${small}`;if(geometryCache.has(key))return geometryCache.get(key);
  const segments=small?24:64,rings=small?10:32;
  const top=new THREE.SphereGeometry(radius,segments,rings,0,Math.PI*2,0,Math.PI/2);
  const bottom=new THREE.SphereGeometry(radius*.987,segments,rings,0,Math.PI*2,Math.PI/2,Math.PI/2);
  // Three finely spaced molded lips, merged into a single draw.
  const lips=[-.036,0,.036].map((y,i)=>{const g=new THREE.TorusGeometry(radius*1.006,radius*(i===1?.018:.012),small?6:10,segments);g.rotateX(Math.PI/2);g.translate(0,y*radius,0);return g;});
  const seam=mergeGeometries(lips);
  const result={top,bottom,seam,lowerLip:lips[0],middleLip:lips[1],upperLip:lips[2]};geometryCache.set(key,result);return result;
 }
 function setColor(group,index){group.userData.colorIndex=index;group.userData.bottom.material=cups[index];}
 function capsule(radius=.25,index=randomCapsuleColor()){
  const group=new THREE.Group(),geo=geometries(radius,radius<.3);
  const top=new THREE.Mesh(geo.top,clear),bottom=new THREE.Mesh(geo.bottom,cups[index]),seam=new THREE.Mesh(geo.middleLip,rim);
  top.add(new THREE.Mesh(geo.upperLip,rim));bottom.add(new THREE.Mesh(geo.lowerLip,rim));
  bottom.castShadow=true;group.add(bottom,top,seam);
  group.userData={top,bottom,seam,colorIndex:index};return group;
 }
 return {capsule,setColor,geometries,clear,cup,rim};
}

// Use the user's two shell meshes and their original photo UVs. All capsules
// share geometry/texture/materials; no per-ball render targets or light passes.
function createPhotoCapsuleLook(renderer,{mesh,texture,floorMesh=mesh}){
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const materials=CAPSULE_COLORS.map(color=>{
  const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
  const tint=new THREE.Color(color);
  material.onBeforeCompile=shader=>{
   shader.uniforms.shellTint={value:tint};
   shader.fragmentShader='uniform vec3 shellTint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float shellLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    float shellChroma=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b)-min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b);
    float shellColorWeight=clamp(.3+shellChroma*3.8,.3,.94);
    vec3 shellColor=mix(vec3(shellLuma),shellTint*shellLuma*2.1,shellColorWeight);
    diffuseColor.rgb=mix(shellColor,vec3(shellLuma),smoothstep(.62,.92,shellLuma)*.85)*.89;
   `);
  };
  material.customProgramCacheKey=()=> 'authored-capsule-photo-v1';
  return material;
 });
 function geometrySet(source){const result={};for(const part of ['top','bottom']){const geometry=new THREE.BufferGeometry();for(const [key,values] of Object.entries(source[part])){if(key==='index')geometry.setIndex(values);else geometry.setAttribute(key,new THREE.Float32BufferAttribute(values,key==='uv'?2:3));}result[part]=geometry;}return result;}
 const base=geometrySet(mesh),low=geometrySet(floorMesh);
 const cache=new Map(),rim=new THREE.MeshBasicMaterial({color:0xd6d1c3,transparent:true,opacity:.24,depthWrite:false,toneMapped:false});
 function geometries(radius){if(cache.has(radius))return cache.get(radius);const source=radius<.3?low:base;const data={top:source.top.clone().scale(radius,radius,radius),bottom:source.bottom.clone().scale(radius,radius,radius)};data.seam=new THREE.TorusGeometry(radius*.993,radius*.006,4,radius<.3?24:80);data.seam.rotateX(Math.PI/2);cache.set(radius,data);return data;}
 function setColor(group,index){group.userData.colorIndex=index;group.userData.top.material=materials[index];group.userData.bottom.material=materials[index];}
 function capsule(radius=.25,index=randomCapsuleColor()){
  const group=new THREE.Group(),geo=geometries(radius),top=new THREE.Mesh(geo.top,materials[index]),bottom=new THREE.Mesh(geo.bottom,materials[index]),seam=new THREE.Mesh(geo.seam,rim);
  // Molded seam highlights are already baked into the photo; only the fine
  // physical lip needs a separate mesh to remain visible at glancing angles.
  for(const [half,sign] of [[top,1],[bottom,-1]]){half.castShadow=true;const lip=new THREE.Mesh(geo.seam,rim);lip.position.y=sign*radius*.012;half.add(lip);}
  group.add(top,bottom,seam);group.userData={top,bottom,seam,colorIndex:index};return group;
 }
 return {capsule,setColor,geometries,clear:materials[0],cup:materials[0],rim};
}
