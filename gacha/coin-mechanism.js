import * as THREE from './vendor/three/three.module.js';

const DIAMETER=.038;
export const COIN_INSERT_DURATION=1.12;

export function createCoinMechanism(scene,model){
 const coin=new THREE.Group();coin.name='insert-coin';coin.add(model);coin.scale.setScalar(DIAMETER);coin.visible=false;scene.add(coin);
 const up=new THREE.Vector3(0,1,0),outward=new THREE.Vector3(-.766,0,.643).normalize();
 const right=new THREE.Vector3(.643,0,.766).normalize();
 // Mount the short receiver on the front panel immediately above the handle,
 // rather than on the high ledge under the poster. Keep its mouth in front of
 // the measured scan so the visible coin never passes through solid geometry.
 const mouthNormal=up.clone();
 const slot=new THREE.Vector3(.32831046,.75633866,-.09078512).addScaledVector(outward,.012);
 const rest=new THREE.Vector3(.3259991,.7743548,-.1048983)
  .addScaledVector(new THREE.Vector3(-.5103381,.7086684,.4871798).normalize(),.17).addScaledVector(right,.28);
 rest.y+=.08;
 const seatedRotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,outward));
 const entryPlane=new THREE.Plane().setFromNormalAndCoplanarPoint(mouthNormal,slot),clipping=[entryPlane],materials=[];
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.clipShadows=true;materials.push(m);}}});

 // A narrow metal lip and dark throat replace only the scan's filled-in slit.
 // The lip occludes the entering edge; the clipping plane keeps the swallowed
 // portion from showing through the receiver/handle farther down the cabinet.
 const mouthRight=right.clone().addScaledVector(mouthNormal,-right.dot(mouthNormal)).normalize();
 const mouthFront=new THREE.Vector3().crossVectors(mouthRight,mouthNormal).normalize();
 const receiver=new THREE.Group();receiver.name='coin-slot-lip';receiver.position.copy(slot);
 receiver.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(mouthRight,mouthNormal,mouthFront));scene.add(receiver);
 const metal=new THREE.MeshStandardMaterial({color:0x9b998d,roughness:.42,metalness:.65});
 const innerWidth=.043,innerDepth=.006,outerWidth=.051,outerDepth=.014,lipHeight=.002;
 function rim(w,d,x,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,lipHeight,d),metal);m.position.set(x,lipHeight/2,z);receiver.add(m);}
 rim(outerWidth,(outerDepth-innerDepth)/2,0,(outerDepth+innerDepth)/4);
 rim(outerWidth,(outerDepth-innerDepth)/2,0,-(outerDepth+innerDepth)/4);
 rim((outerWidth-innerWidth)/2,innerDepth,(outerWidth+innerWidth)/4,0);
 rim((outerWidth-innerWidth)/2,innerDepth,-(outerWidth+innerWidth)/4,0);
 const throat=new THREE.Mesh(new THREE.PlaneGeometry(innerWidth,innerDepth),new THREE.MeshBasicMaterial({color:0x080807,side:THREE.DoubleSide,toneMapped:false}));
 throat.rotation.x=-Math.PI/2;throat.position.y=-.0003;receiver.add(throat);

 const start=new THREE.Vector3(),screen=new THREE.Vector3(),startRotation=new THREE.Quaternion();
 const clear=slot.clone().addScaledVector(outward,.085).addScaledVector(up,.045);
 const above=slot.clone().addScaledVector(up,DIAMETER/2+.007);
 const bottom=slot.clone().addScaledVector(up,-DIAMETER/2-.003);
 let clipped=false,entered=false;
 function setClipping(enabled){if(clipped===enabled)return;clipped=enabled;for(const m of materials){m.clippingPlanes=enabled?clipping:null;m.needsUpdate=true;}}
 function idle(camera,viewport){
  setClipping(false);coin.visible=true;coin.scale.setScalar(DIAMETER);coin.position.copy(rest);coin.quaternion.copy(camera.quaternion);
  if(viewport){screen.copy(rest).project(camera);const mx=108/viewport.width,my=140/viewport.height;
   screen.x=THREE.MathUtils.clamp(screen.x,-1+mx,1-mx);screen.y=THREE.MathUtils.clamp(screen.y,-1+my,1-my);coin.position.copy(screen.unproject(camera));
  }
  // Hold the waiting coin nearer the viewer so its stamped face stays legible.
  // Its physical diameter remains constant as perspective brings it to the slot.
  coin.position.sub(camera.position).multiplyScalar(DIAMETER/.10).add(camera.position);
 }
 function begin(){setClipping(false);entered=false;start.copy(coin.position);startRotation.copy(coin.quaternion);}
 function insert(seconds){
  const t=THREE.MathUtils.clamp(seconds,0,COIN_INSERT_DURATION);
  // Travel in front of the cabinet, align above the mouth, then slide straight
  // down. No shrinking, turning edge-on, or pushing through the machine face.
  if(t<.43){
   const move=THREE.MathUtils.smootherstep(t,0,.43);
   coin.position.copy(start).lerp(clear,move);
   coin.quaternion.copy(startRotation).slerp(seatedRotation,move);
  }else if(t<.68){
   coin.position.copy(clear).lerp(above,THREE.MathUtils.smootherstep(t,.43,.68));coin.quaternion.copy(seatedRotation);
  }else{
   setClipping(true);coin.position.copy(above).lerp(bottom,THREE.MathUtils.smoothstep(t,.68,COIN_INSERT_DURATION));coin.quaternion.copy(seatedRotation);
  }
  entered=clipped&&entryPlane.distanceToPoint(coin.position)<=DIAMETER/2;
  coin.scale.setScalar(DIAMETER);coin.visible=t<COIN_INSERT_DURATION;
  return t===COIN_INSERT_DURATION;
 }
 return {coin,slot,rest,idle,begin,insert,entryPlane,receiver,get entered(){return entered;}};
}
