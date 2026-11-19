import * as THREE from './vendor/three/three.module.js';
import {createImagePrize} from './image-prize.js';
import {TRASH_CROPS,cropTrash} from './trash-atlas.js';
import {NORMAL_CROPS,cropNormal} from './normal-atlas.js';
export {DIALOGUE} from './reward-reactions.js';

export const PRIZES=[
 {id:'receipt',rarity:'N',ko:'영수증',en:'Receipt'},
 {id:'capsule',rarity:'N',ko:'플라스틱 캡슐',en:'Plastic capsule'},
 {id:'tissue',rarity:'N',ko:'코 푼 휴지',en:'Used tissue'},
 {id:'banana',rarity:'N',ko:'바나나껍질',en:'Banana peel'},
 {id:'anchovy',rarity:'N',ko:'육수용 멸치',en:'Stock anchovies'},
 {id:'gimbap',rarity:'N',ko:'김밥꼬다리',en:'Gimbap end piece'},
 {id:'lenses',rarity:'N',ko:'마른렌즈',en:'Dried contact lenses'},
 {id:'curler',rarity:'N',ko:'구루뿌',en:'Hair roller'},
 {id:'kelp',rarity:'N',ko:'한 번 우린 다시마',en:'Already-steeped kelp'},
 {id:'hairball',rarity:'N',ko:'고양이 헤어볼',en:'Cat hairball'},
 {id:'beef',rarity:'R',ko:'파격세일 소고기',en:'Bargain beef'},
 {id:'gum',rarity:'R',ko:'장난감 껌',en:'Prank chewing gum'},
 {id:'book',rarity:'R',ko:'문방구 공포책',en:'Corner-shop horror book'},
 {id:'glue',rarity:'R',ko:'반짝이풀',en:'Glitter glue'},
 {id:'mini',rarity:'SR',ko:'슈퍼짱미니피규어',en:'Mini Super-chan figure'},
 {id:'angel',rarity:'SSR',ko:'천사의 주방장 · 소라',en:'Angel Chef · Sora'}
];

// Build only the prize that is drawn. Collection thumbnails and their offscreen
// renderer are also lazy, so none of this blocks the first playable frame.
export function createPrizeLibrary(receipt,ssr,trashAtlas,normalAtlas){
 let renderer;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.01,20);camera.position.set(0,.6,4.3);camera.lookAt(0,0,0);
 const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-3,5,5);scene.add(light,new THREE.HemisphereLight(0xffffff,0x81766a,1.8));
 function photograph(model){
  if(!renderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(384,384);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);}
  const clone=model.clone(true);clone.visible=true;clone.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(clone),size=box.getSize(new THREE.Vector3());clone.position.sub(box.getCenter(new THREE.Vector3()));
  const group=new THREE.Group();group.add(clone);group.scale.setScalar(2/Math.max(size.x,size.y,size.z));scene.add(group);renderer.render(scene,camera);
  const still=document.createElement('canvas');still.width=still.height=384;still.getContext('2d').drawImage(renderer.domElement,0,0);scene.remove(group);return still;
 }
 const models=new Map(),thumbs=new Map(),stills=new Map();
 function getStill(id){
  if(!stills.has(id))stills.set(id,TRASH_CROPS[id]?cropTrash(trashAtlas,id):NORMAL_CROPS[id]?cropNormal(normalAtlas,id):photograph(id==='receipt'?receipt:ssr));
  return stills.get(id);
 }
 function getThumb(id){if(!thumbs.has(id))thumbs.set(id,getStill(id).toDataURL('image/png'));return thumbs.get(id);}
 function getModel(id){
  if(id==='receipt')return receipt;if(id==='angel')return ssr;
  if(models.has(id))return models.get(id);
  const still=getStill(id);
  const model=createImagePrize(still);
  model.traverse(o=>{if(o.isMesh){const previous=o.material;
    // Keep the photographed color, with gentle real lighting on the curved surface.
    previous.color.setScalar(.5);previous.roughness=.78;previous.metalness=0;
    if(previous.map){previous.emissive.set(0xffffff);previous.emissiveMap=previous.map;previous.emissiveIntensity=.62;}
    previous.needsUpdate=true;
   o.castShadow=true;
  }});
  const sizes={tissue:.13,capsule:.09,banana:.16,anchovy:.125,gimbap:.10,lenses:.085,curler:.11,kelp:.13,hairball:.085,beef:.14,gum:.13,book:.13,glue:.14,mini:.12};
  model.scale.setScalar(sizes[id]??.13);model.visible=false;models.set(id,model);return model;
 }
 return {models,getModel,getThumb,photograph,dispose:()=>{renderer?.dispose();renderer?.forceContextLoss();}};
}
