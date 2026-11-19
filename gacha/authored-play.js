import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {createCapsuleLook,randomCapsuleColor} from './capsule-look.js';
import {viewportPlanes} from './scene-effects.js';
import {createFocusBackdrop} from './focus-backdrop.js';
import {CapsuleDrop,SmoothRotation,rewardPop,hatchOpening,HATCH_DURATION,HATCH_CONTACTS} from './capsule-motion.js';
import {CapsulePhysics} from './capsule-physics.js';
import {angleDelta,DEFAULT_ODDS,rollWithPity,pickPrize} from './logic.js';
import {PITY_LIMIT} from './game-config.js';
import {PRIZES,createPrizeLibrary} from './prize-library.js';
import {reactionFor,dialogueText} from './reward-reactions.js';
import {applyFaceFrame} from './face-atlas.js';
import {captureGameFrame} from './capture-game.js';
import {installDrawnUI,syncDrawnUI,BUBBLES} from './handdrawn-ui.js';
import {floorFootprint} from './scene-colliders.js';
import {createContactShadows} from './contact-shadows.js';
import {installMachinePrice} from './machine-price.js';
import {createCoinMechanism,COIN_CONTACT_TIME} from './coin-mechanism.js';

installDrawnUI();

const $=s=>document.querySelector(s),clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
let startRequested=false,startWhenReady=null;
$('#start-game').onclick=()=>{startRequested=true;startWhenReady?.();};
const canvas=$('#world'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
renderer.localClippingEnabled=true;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const loader=new GLTFLoader(),scene=new THREE.Scene();scene.background=new THREE.Color('#726b5c');
let loaded,ssrLoaded,capsuleMesh,capsuleTexture,floorCapsuleMesh,coinLoaded,trashAtlas,normalAtlas,faceTexture;
try{
 [loaded,ssrLoaded,capsuleMesh,capsuleTexture,floorCapsuleMesh,coinLoaded,trashAtlas,normalAtlas,faceTexture]=await Promise.all([
  loader.loadAsync('./asset/authored-scene.glb'),loader.loadAsync('./asset/ssr-lowpoly.glb'),
  fetch('./asset/capsule-mesh.json').then(r=>r.json()),new THREE.TextureLoader().loadAsync('./asset/capsule-photo.png'),fetch('./asset/capsule-floor-mesh.json').then(r=>r.json()),loader.loadAsync('./asset/user-coin.glb'),new THREE.ImageLoader().loadAsync('./asset/쓰레기.png'),new THREE.ImageLoader().loadAsync('./asset/노말.png'),new THREE.TextureLoader().loadAsync('./asset/face.png')
 ]);
}catch(error){$('#start-error').hidden=false;$('#start-error').textContent='장면을 불러오지 못했어요. 새로고침해 주세요.';throw error;}
const authored=loaded.scene;scene.add(authored,ssrLoaded.scene);
function bakedColors(root){root.traverse(o=>{
 if(!o.isMesh)return;
 const convert=m=>{const map=m.emissiveMap||m.map;if(map)map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return new THREE.MeshBasicMaterial({name:m.name,map,color:map?0xffffff:m.color,side:THREE.DoubleSide,toneMapped:false,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest});};
 o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
});}
bakedColors(authored);bakedColors(ssrLoaded.scene);bakedColors(coinLoaded.scene);
const coinRig=createCoinMechanism(scene,coinLoaded.scene);
const find=(root,name)=>root.getObjectByName(name)||root.getObjectByName(name.replaceAll('.',''))||root.getObjectByName(name.replaceAll('.','_'));
const body=find(authored,'body'),head=find(authored,'head'),trash=find(authored,'trash'),ssr=find(ssrLoaded.scene,'ssr');
const machine=find(authored,'gacha'),knob=find(authored,'gacha.001'),hatch=find(authored,'gacha.002'),floor=find(authored,'back.002');
if(!body||!head||!trash||!ssr||!knob||!hatch)throw Error('Authored scene object missing');
const initial={ssr:ssr.matrix.clone(),trash:trash.matrix.clone()};
const floorY=new THREE.Box3().setFromObject(floor).min.y;
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-1.4,3,1.46);light.target.position.set(0,.4,0);
light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.normalBias=.002;light.shadow.bias=-.0001;light.shadow.radius=1.65;
Object.assign(light.shadow.camera,{left:-1.8,right:1.8,top:2,bottom:-1.5,near:.1,far:7});
scene.add(light,light.target,new THREE.HemisphereLight(0xffffff,0x8a806b,1.2));
for(const root of [head,body,trash,ssr])root.traverse(o=>{if(o.isMesh)o.castShadow=true;});
function shadowReceiver(root){root?.traverse(o=>{if(!o.isMesh)return;o.updateWorldMatrix(true,false);const receiver=new THREE.Mesh(o.geometry,new THREE.ShadowMaterial({color:0x171615,opacity:.52,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));receiver.matrix.copy(o.matrixWorld);receiver.matrixAutoUpdate=false;receiver.receiveShadow=true;scene.add(receiver);});}
for(const root of [find(authored,'back'),machine,find(authored,'back.001')])shadowReceiver(root);
// Extend the real floor into a room; the machines remain separate 3D meshes.
const floorMap=floor.material.map.clone();floorMap.wrapS=floorMap.wrapT=THREE.MirroredRepeatWrapping;floorMap.repeat.set(6,6);floorMap.needsUpdate=true;
floor.visible=false;
const roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshBasicMaterial({map:floorMap,toneMapped:false}));roomFloor.rotation.x=-Math.PI/2;roomFloor.position.y=floorY;scene.add(roomFloor);shadowReceiver(roomFloor);
const roomWall=new THREE.Mesh(new THREE.PlaneGeometry(14,5),new THREE.MeshStandardMaterial({color:0x77705c,roughness:1}));roomWall.position.set(0,2.4,-2.1);roomWall.receiveShadow=true;scene.add(roomWall);
installMachinePrice(machine,renderer);

// A real elevated perspective camera, orbiting a point between the girl and machine.
const camera=new THREE.PerspectiveCamera(34,1,.01,40),cameraTarget=new THREE.Vector3(.18,.58,-.15);
const homeOffset=new THREE.Vector3(-.84,1.12,2.46),homeOrbit=new THREE.Spherical().setFromVector3(homeOffset);
homeOrbit.theta+=.13;homeOrbit.phi+=.035;
const pointerTarget=new THREE.Vector2(),pointerSmooth=new THREE.Vector2(),manualOrbit=new THREE.Vector2();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let view={x:0,y:0,width:1,height:1},fit=1;
let cameraPull=0,pullFrom=0,pullTo=0,pullAge=1,startPull=1;
const headBox=new THREE.Box3().setFromObject(head),neck=new THREE.Group();
neck.position.set((headBox.min.x+headBox.max.x)/2,headBox.min.y+.025,(headBox.min.z+headBox.max.z)/2);scene.add(neck);neck.attach(head);
const headRest={pitch:-.055,yaw:.11};neck.rotation.set(headRest.pitch,headRest.yaw,0);
const knobPivot=new THREE.Group();new THREE.Box3().setFromObject(knob).getCenter(knobPivot.position);scene.add(knobPivot);knobPivot.attach(knob);
const knobAxis=new THREE.Vector3(-.766,0,.643).normalize(),hatchRight=new THREE.Vector3(.643,0,.766).normalize();
const hatchBox=new THREE.Box3().setFromObject(hatch),hatchCenter=hatchBox.getCenter(new THREE.Vector3());
// Cover the baked scan behind the opened door with a fitted, unlit black recess.
hatch.updateWorldMatrix(true,true);
const hatchInside=hatch.clone(true);hatch.matrixWorld.decompose(hatchInside.position,hatchInside.quaternion,hatchInside.scale);
hatchInside.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:0x030303,side:THREE.DoubleSide,toneMapped:false});o.castShadow=false;}});
scene.add(hatchInside);hatchInside.position.addScaledVector(knobAxis,.002);hatchInside.visible=false;
const hinge=new THREE.Group();hinge.position.copy(hatchCenter);hinge.position.y=hatchBox.max.y;scene.add(hinge);hinge.attach(hatch);
hatch.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;const lift=m=>{const copy=m.clone();copy.polygonOffset=true;copy.polygonOffsetFactor=-1;copy.polygonOffsetUnits=-1;
 copy.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.006);');};copy.customProgramCacheKey=()=> 'black-hatch-interior-v1';
 return copy;};o.material=Array.isArray(o.material)?o.material.map(lift):lift(o.material);}});
const hatchRest={position:hatch.position.clone(),quaternion:hatch.quaternion.clone(),scale:hatch.scale.clone()};
function closeHatch(){hinge.quaternion.identity();hatch.position.copy(hatchRest.position);hatch.quaternion.copy(hatchRest.quaternion);hatch.scale.copy(hatchRest.scale);hatch.visible=true;hatchInside.visible=false;hatch.updateWorldMatrix(true,true);}

let faceMaterial;head.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name==='Material.003')faceMaterial=m;});
if(!faceMaterial)throw Error('Face material missing');
faceTexture.colorSpace=THREE.SRGBColorSpace;faceTexture.flipY=false;
// No mip blending across neighboring expressions at the row boundary.
faceTexture.generateMipmaps=false;faceTexture.minFilter=faceTexture.magFilter=THREE.LinearFilter;
faceMaterial.map=faceTexture;faceTexture.needsUpdate=true;faceMaterial.needsUpdate=true;
let expression=1;
function setFace(n){expression=n;applyFaceFrame(faceTexture,n);}

const ssrBox=new THREE.Box3().setFromObject(ssr),ssrSize=ssrBox.getSize(new THREE.Vector3()),ssrCenter=ssrBox.getCenter(new THREE.Vector3());
const rewardPivot=new THREE.Group();rewardPivot.position.copy(ssrCenter);scene.add(rewardPivot);rewardPivot.attach(ssr);ssr.visible=false;
let customSSR=null,customThumb=null;
const commonPivot=new THREE.Group();new THREE.Box3().setFromObject(trash).getCenter(commonPivot.position);scene.add(commonPivot);commonPivot.attach(trash);trash.visible=false;
const handLift=.04,handBaseY=new THREE.Box3().setFromObject(trash).min.y+handLift;
rewardPivot.position.y+=handLift;commonPivot.position.y+=handLift;
const library=createPrizeLibrary(trash,ssr,trashAtlas,normalAtlas);for(const model of library.models.values()){commonPivot.add(model);model.visible=false;}
let currentPrize=null,misses=0,pity=false,capsuleColor=0,lineKind='idle',lineIndex=0,reactionEmotion='neutral';
const owned=new Map();
function currentModel(){return currentPrize?.id==='receipt'?trash:currentPrize?.rarity==='SSR'?(customSSR||ssr):library.models.get(currentPrize?.id);}
function currentPivot(){return currentPrize?.rarity==='SSR'?rewardPivot:commonPivot;}
function hideRewards(){trash.visible=ssr.visible=false;if(customSSR)customSSR.visible=false;for(const model of library.models.values())model.visible=false;}
function keepRewardAboveHands(){
 const model=currentModel();if(!model)return;const pivot=currentPivot(),base=pivot===rewardPivot?ssrCenter.y+handLift:commonBaseY;
 pivot.position.y=base;pivot.updateWorldMatrix(true,true);
 const bottom=new THREE.Box3().setFromObject(model).min.y;pivot.position.y+=Math.max(0,handBaseY-bottom);
}
const commonBaseY=commonPivot.position.y;
const look=createCapsuleLook(renderer,{mesh:capsuleMesh,texture:capsuleTexture,floorMesh:floorCapsuleMesh});
const compositor=createFocusBackdrop(renderer,cameraTarget),overlay=new THREE.Scene(),revealCamera=new THREE.PerspectiveCamera(38,1,.1,30);
const previewLight=new THREE.DirectionalLight(0xffffff,2);previewLight.position.set(-1.4,3,1.46);overlay.add(previewLight,new THREE.HemisphereLight(0xffffff,0x8a806b,1.2));
revealCamera.position.set(0,0,7);revealCamera.lookAt(0,0,0);
const exhibit=new THREE.Group();exhibit.position.set(0,0,0);overlay.add(exhibit);
const reveal=look.capsule(.91,0);reveal.rotation.z=Math.PI/2;exhibit.add(reveal);exhibit.visible=false;
const prizePreview=new THREE.Group();overlay.add(prizePreview);prizePreview.visible=false;
const capsuleMotion=new SmoothRotation(1.3),rewardMotion=new SmoothRotation(.8);
const rotationControls={capsule:capsuleMotion,reward:rewardMotion};
const liftStart=new THREE.Vector3();let liftStartScale=.1;
let capsuleScale=1;
function fitReveal(){
 const tanHalf=Math.tan(THREE.MathUtils.degToRad(revealCamera.fov/2)),distance=revealCamera.position.z;
 capsuleScale=distance*Math.sin(Math.atan(tanHalf*Math.min(1,revealCamera.aspect)*.9))/.91;
 exhibit.scale.setScalar(capsuleScale*(exhibit.userData.zoom??1));
 const size=prizePreview.userData.size;if(!size)return;
 const height=distance*tanHalf*2,width=height*revealCamera.aspect;
 prizePreview.userData.scale=.94*Math.min(width*.90/size.x,height*.78/size.y);
 if(prizePreview.visible)prizePreview.scale.setScalar(prizePreview.userData.scale);
}
function rebuildPreview(){prizePreview.clear();const clone=(currentModel()||customSSR||ssr).clone(true);clone.visible=true;clone.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(clone),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());clone.position.sub(center);prizePreview.add(clone);prizePreview.userData.size=size;fitReveal();}
rebuildPreview();
const flash=document.createElement('div');flash.id='reward-flash';flash.setAttribute('aria-hidden','true');document.body.append(flash);let flashStrength=0;
const rolling=look.capsule(.029,0);rolling.visible=false;scene.add(rolling);
const rollVelocity=new THREE.Vector3(),rollEnd=new THREE.Vector3();let bounceCount=0,ballLaunched=false;
const drop=new CapsuleDrop();
const landingPoint=new THREE.Vector3(.025,floorY+.029,.25),firstLanding=new THREE.Vector3();
const dropProfiles=[{name:'soft',lift:.26,bounce:.45,secondBounce:.32,impactFriction:.66,rollFriction:8},{name:'hop',lift:.38,bounce:.56,secondBounce:.34,impactFriction:.62,rollFriction:9},{name:'roll',lift:.30,bounce:.48,secondBounce:.30,impactFriction:.74,rollFriction:7}];
let dropStyle=0,lastDropStyle=-1,dropCorrection=0;
const physics=new CapsulePhysics(80),ballGroup=new THREE.Group(),balls=[];scene.add(ballGroup);
const contactShadows=createContactShadows(scene,floorY);
physics.bounds={left:-11,right:12,back:-9,front:11};
physics.setSolidObstacles([
 floorFootprint(body,{floorY,ceiling:.28,kind:'character',name:'girl'}),
 floorFootprint(machine,{floorY,ceiling:.15,kind:'machine',name:'right-machines'}),
 floorFootprint(find(authored,'back.001'),{floorY,ceiling:.15,kind:'machine',name:'left-machines'})
]);
const dropBody={x:0,y:0,z:0,vx:0,vy:0,vz:0,asleep:false};
drop.collide=b=>{
 if(b.y>floorY+.20)return;
 Object.assign(dropBody,{x:b.x*10,y:(b.y-floorY)*10,z:b.z*10,vx:b.vx*10,vy:b.vy*10,vz:b.vz*10});physics.contain(dropBody);
 dropCorrection=Math.max(dropCorrection,Math.hypot(dropBody.x/10-b.x,dropBody.z/10-b.z));
 b.x=dropBody.x/10;b.z=dropBody.z/10;b.vx=dropBody.vx/10;b.vz=dropBody.vz/10;
};
function addBall(position,velocity={x:0,y:0,z:0},color=0){
 const id=physics.add({x:position.x*10,y:Math.max(.245,(position.y-floorY)*10),z:position.z*10},velocity);
 if(!balls[id]){balls[id]=look.capsule(.0245,color);ballGroup.add(balls[id]);}
 look.setColor(balls[id],color);return id;
}
function syncBalls(dt){physics.update(dt);for(const b of physics.bodies){balls[b.id].position.set(b.x/10,b.y/10+floorY,b.z/10);balls[b.id].rotation.set(b.rx,0,b.rz);}}
function updateContactShadows(){
 contactShadows.begin();
 for(const [x,z,w,d,a] of [[0,-.02,.66,.64,.50],[-.16,.26,.23,.24,.68],[.21,.20,.25,.24,.68],[-.30,-.28,.20,.16,.55],[.29,-.28,.20,.16,.55]])contactShadows.add(x,z-.012,w*1.06,d*1.06,a*.94);
 for(const ball of balls){const height=Math.max(0,ball.position.y-floorY-.0245);contactShadows.add(ball.position.x+.006,ball.position.z-.004,.080+height*.12,.072+height*.12,.62/(1+height*9));}
 if(rolling.visible){const height=Math.max(0,rolling.position.y-floorY-.029);contactShadows.add(rolling.position.x+.006,rolling.position.z-.004,.09+height*.12,.08+height*.12,.65/(1+height*7));}
 contactShadows.end();
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-floorY),floorPoint=new THREE.Vector3();
let lastFloor=null,lastFloorTime=0,lastHover=null;
function projected(point,cam=camera){const p=point.clone().project(cam);return {x:(p.x+1)*view.width/2,y:(1-p.y)*view.height/2};}
function pointerRay(e,cam=camera){pointer.set(e.clientX/view.width*2-1,1-e.clientY/view.height*2);cam.updateMatrixWorld();raycaster.setFromCamera(pointer,cam);}
function updateCamera(dt=1,followPointer=true){
 if(followPointer)pointerSmooth.lerp(pointerTarget,1-Math.exp(-dt*6));
 const orbit=homeOrbit.clone();orbit.radius*=fit*(1+startPull*.11+(reduced.matches?0:cameraPull*.085));
 orbit.theta+=manualOrbit.x+(reduced.matches?0:pointerSmooth.x*.065);
 orbit.phi+=manualOrbit.y+(reduced.matches?0:pointerSmooth.y*.035);
 camera.position.setFromSpherical(orbit).add(cameraTarget);camera.lookAt(cameraTarget);camera.updateMatrixWorld();
 physics.setViewPlanes(viewportPlanes(camera,view.width,view.height).map(p=>({...p,d:(p.d+p.y*floorY)*10})));
}
function resize(){
 view={x:0,y:0,width:innerWidth,height:innerHeight};camera.aspect=revealCamera.aspect=innerWidth/innerHeight;
 fit=Math.max(1,Math.min(1.20,.62/camera.aspect));camera.updateProjectionMatrix();revealCamera.updateProjectionMatrix();
 fitReveal();
 Object.assign(canvas.style,{left:'0',top:'0',width:'100%',height:'100%'});renderer.setSize(innerWidth,innerHeight,false);compositor.resize(innerWidth,innerHeight);
 for(const side of ['left','right','top','bottom'])document.documentElement.style.setProperty('--stage-'+side,'0px');
 updateCamera();
}
resize();addEventListener('resize',resize);
scene.updateMatrixWorld(true);

let lang='ko',state='start',count=0,spent=0,coinCredit=false,age=0,elapsed=0,progress=0,knobAngle=0,drag=null;
let blinkAt=3,blinkEnd=0,guideAge=0,guideDismissed=false,photoBusy=false,speechDismissed=false;
const actions=document.createElement('div');actions.id='play-actions';actions.hidden=true;
const rewardInfo=document.createElement('div');rewardInfo.id='reward-info';rewardInfo.setAttribute('aria-live','polite');rewardInfo.innerHTML='<small id="reward-grade"></small><strong id="reward-name"></strong>';
const resultButtons=document.createElement('div');resultButtons.className='result-buttons';
const again=document.createElement('button');again.id='play-again';resultButtons.append(again,$('#save-photo'));actions.append(rewardInfo,resultButtons);document.body.append(actions);
const resultState=()=>state==='result'||state==='won';
const bubbleKind=()=>state==='won'?'emphasis':resultState()?'speaking':'thought';
const gradeName=rarity=>({ko:{N:'쓰레기',R:'평범',SR:'평범',SSR:'슈퍼레어'},en:{N:'TRASH',R:'ORDINARY',SR:'ORDINARY',SSR:'SUPER RARE'}}[lang][rarity]);
function syncUI(){
 document.documentElement.lang=lang;$('#speech-text').textContent=dialogueText(lang,lineKind,lineIndex,count);
 syncDrawnUI(lang,bubbleKind());
 $('#count').textContent=String(count);$('#spent').textContent=lang==='ko'?`${spent?'-':''}${spent.toLocaleString('ko-KR')}원`:`${spent?'-':''}₩${spent.toLocaleString('en-US')}`;
 $('.counter').setAttribute('aria-label',lang==='ko'?`${count}번 뽑기, 사용 금액 ${spent}원`:`${count} pulls, spent ${spent} won`);
 again.textContent=lang==='ko'?'한번 더!':'One more!';
 $('#ssr-title').textContent=lang==='ko'?'가챠 교체':'SWAP PRIZE';$('#ssr-choose').textContent=lang==='ko'?'파일선택':'CHOOSE FILE';$('#ssr-reset').textContent=lang==='ko'?'되돌리기':'RESTORE';
 $('#save-photo').textContent=lang==='ko'?'사진 저장':'Save photo';$('#save-photo').hidden=state!=='won';
 $('#drawer h2').textContent=lang==='ko'?'경품 리스트':'Prizes';
 $('#drawer .close').setAttribute('aria-label',lang==='ko'?'닫기':'Close');
 $('#coin-label').textContent=lang==='ko'?'동전 넣기':'INSERT COIN';
 $('#reward-grade').textContent=currentPrize?gradeName(currentPrize.rarity):'';$('#reward-name').textContent=currentPrize?.[lang]||'';
 actions.hidden=!resultState();again.setAttribute('aria-label',lang==='ko'?(state==='won'?'처음부터 다시':'다시 뽑기'):(state==='won'?'Start over':'Try again'));
}
function transition(next){state=next;age=0;guideAge=0;guideDismissed=false;if(state==='ready'&&!coinCredit)coinRig.idle(camera,view);else if(state!=='inserting')coinRig.coin.visible=false;const focus=['zooming','capsule','opening'].includes(state);document.body.classList.toggle('capsule-focus',focus);document.body.classList.toggle('previewing',state==='capsule');document.body.classList.toggle('speech-dismissed',speechDismissed);$('header').inert=focus||['start','inserting','dispensing','discarding','resetting'].includes(state);syncUI();}
setFace(1);transition('start');
let audio;
function tone(hz,duration=.08,delay=0){try{audio??=new AudioContext();audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime+delay;oscillator.type='triangle';oscillator.frequency.setValueAtTime(hz,now);gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+duration);}catch{}}
function insertCoin(){if(state!=='ready'||coinCredit)return;setFace(1);blinkEnd=0;blinkAt=elapsed+2.5;coinRig.begin();progress=0;transition('inserting');tone(1450,.045);navigator.vibrate?.(12);}
$('#coin-tap').onclick=insertCoin;
function draw(){
 if(state!=='ready'||!coinCredit)return;coinCredit=false;coinRig.coin.visible=false;count++;progress=0;bounceCount=0;dropCorrection=0;ballLaunched=false;rolling.visible=false;setFace(1);blinkEnd=0;
 const outcome=rollWithPity(DEFAULT_ODDS,misses,PITY_LIMIT);misses=outcome.misses;pity=outcome.pity;currentPrize=pickPrize(PRIZES,outcome.rarity);
 capsuleColor=randomCapsuleColor();hideRewards();commonPivot.rotation.set(0,0,0);rewardPivot.rotation.set(0,0,0);rebuildPreview();
 speechDismissed=true;look.setColor(rolling,capsuleColor);look.setColor(reveal,capsuleColor);hatchInside.visible=true;
 transition('dispensing');tone(350);navigator.vibrate?.(25);
}
function chooseLanding(){
 dropStyle=(lastDropStyle+1+Math.floor(Math.random()*2))%dropProfiles.length;lastDropStyle=dropStyle;
 const candidates=[];scene.updateMatrixWorld(true);const blockers=[head,body,machine,find(authored,'back.001')];
 for(const sy of [.70,.78,.86,.92])for(const sx of [.16,.30,.44,.58,.72,.84]){
  raycaster.setFromCamera(new THREE.Vector2((sx+(Math.random()-.5)*.05)*2-1,1-(sy+(Math.random()-.5)*.025)*2),camera);
  const point=raycaster.ray.intersectPlane(ground,new THREE.Vector3());if(!point||!physics.isSolidFree(point.x*10,point.z*10,.35))continue;
  const outward=point.clone().sub(hatchCenter);outward.y=0;if(outward.length()<.22||outward.dot(knobAxis)<.12)continue;
  if(point.distanceTo(new THREE.Vector3(hatchCenter.x,floorY,hatchCenter.z))>1.1)continue;
  const hit=raycaster.intersectObjects(blockers,true)[0];if(hit&&hit.distance<raycaster.ray.origin.distanceTo(point)-.02)continue;
  if(point.distanceTo(landingPoint)<.09)continue;point.y=floorY+.029;candidates.push(point);
 }
 // Reject routes that would cut through the low body/machine footprints before
 // landing. Small contact corrections remain active during the actual flight.
 const trial=new CapsuleDrop(),clear=[];
 for(const point of candidates){
  trial.launch(rolling.position,point,dropProfiles[dropStyle]);let safe=true;
  for(let i=0;i<170&&!trial.settled;i++){trial.update(1/60);if(trial.y<=floorY+.20&&!physics.isSolidFree(trial.x*10,trial.z*10,.30)){safe=false;break;}}
  if(safe)clear.push(point);
 }
 const pool=clear.length?clear:candidates;
 if(pool.length)landingPoint.copy(pool[Math.floor(Math.random()*pool.length)]);
 landingPoint.y=floorY+.029;
}
function launchBall(){
 ballLaunched=true;rolling.visible=true;rolling.position.copy(hatchCenter).addScaledVector(knobAxis,-.012);
 rolling.position.y=hatchBox.min.y+.032;
 chooseLanding();drop.launch(rolling.position,landingPoint,dropProfiles[dropStyle]);
}
function updateDispense(dt){
 const opening=hatchOpening(age,reduced.matches);
 hinge.quaternion.setFromAxisAngle(hatchRight,-opening);
 hatch.visible=true;hatchInside.visible=opening>.012;if(age>=HATCH_DURATION)closeHatch();
 for(let i=0;i<HATCH_CONTACTS.length;i++)if(age>=HATCH_CONTACTS[i]&&age-dt<HATCH_CONTACTS[i])tone(i===0?960:720,i===0?.035:.025);
 if(age>=.38&&!ballLaunched)launchBall();
 if(ballLaunched){
  const previousBounces=bounceCount;drop.update(dt);bounceCount=drop.bounces;
  rolling.position.set(drop.x,drop.y,drop.z);rollVelocity.set(drop.vx,drop.vy,drop.vz);rolling.rotation.set(drop.rx,0,drop.rz);
  if(bounceCount>previousBounces){if(previousBounces===0){tone(115,.11);tone(230,.035,.008);const hit=drop.impacts[0];firstLanding.set(hit.x,hit.y,hit.z);navigator.vibrate?.(30);}else tone(180+bounceCount*22,.045);}
 }
 if(ballLaunched&&age>=HATCH_DURATION&&(drop.settled||(age>=3.4&&bounceCount>=2))){closeHatch();rollEnd.copy(rolling.position);prepareCapsule();}
}
function prepareCapsule(){
 closeHatch();
 const screen=rollEnd.clone().project(camera),height=14*Math.tan(THREE.MathUtils.degToRad(revealCamera.fov/2));
 liftStart.set(screen.x*height*revealCamera.aspect/2,screen.y*height/2,0);
 const depth=-rollEnd.clone().applyMatrix4(camera.matrixWorldInverse).z;
 liftStartScale=.029/.91*7/depth*Math.tan(THREE.MathUtils.degToRad(revealCamera.fov/2))/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 rolling.visible=false;trash.visible=false;exhibit.visible=true;exhibit.position.copy(liftStart);exhibit.rotation.set(.04,-.08,-.05);exhibit.userData.zoom=liftStartScale/capsuleScale;exhibit.scale.setScalar(liftStartScale);
 capsuleMotion.reset(exhibit.rotation.x,exhibit.rotation.y);
 reveal.userData.top.position.y=0;reveal.userData.bottom.position.y=0;reveal.userData.seam.visible=true;
 reveal.userData.top.scale.setScalar(1);reveal.userData.bottom.scale.setScalar(1);
 transition('zooming');
}
function openCapsule(){if(state!=='capsule')return;exhibit.rotation.set(0,0,0);prizePreview.rotation.set(0,0,0);transition('opening');tone(450,.12);tone(800,.1,.08);}
function showResult(){
 closeHatch();
 exhibit.visible=false;prizePreview.visible=false;hideRewards();currentModel().visible=true;
 const rare=currentPrize.rarity==='SSR';owned.set(currentPrize.id,(owned.get(currentPrize.id)||0)+1);
 const reaction=reactionFor({rarity:currentPrize.rarity,count,spent,pity});lineKind=reaction.kind;lineIndex=reaction.index;reactionEmotion=reaction.emotion;
 setFace(reaction.face);currentPivot().rotation.set(0,0,0);rewardMotion.reset();
 keepRewardAboveHands();
 addBall(rollEnd,{x:0,y:0,z:0},capsuleColor);speechDismissed=false;transition(rare?'won':'result');
 if(rare){tone(523,.18);tone(659,.2,.12);tone(784,.28,.24);}else{tone(392,.12);tone(330,.13,.14);tone(220,.24,.28);}
}
let discarded=null;
function readyAgain(){hideRewards();currentPrize=null;lineKind='idle';lineIndex=0;reactionEmotion='neutral';progress=0;setFace(1);blinkEnd=0;blinkAt=elapsed+2.5;speechDismissed=false;transition('ready');}
function restartRun(){
 physics.reset();ballGroup.clear();balls.length=0;owned.clear();count=spent=misses=0;coinCredit=false;pity=false;knobAngle=0;knobPivot.quaternion.identity();readyAgain();
}
again.onclick=()=>{
 if(!resultState())return;drag=null;rewardMotion.release();
 if(state==='won'){speechDismissed=true;transition('resetting');tone(740,.13);return;}
 discarded=currentModel().clone(true);scene.add(discarded);currentModel().updateWorldMatrix(true,false);discarded.matrix.copy(currentModel().matrixWorld);discarded.matrix.decompose(discarded.position,discarded.quaternion,discarded.scale);discarded.userData.start=discarded.position.clone();
 const depth=-discarded.position.clone().applyMatrix4(camera.matrixWorldInverse).z,travel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect+.35;
 discarded.userData.throw=new THREE.Vector3(-1,0,0).applyQuaternion(camera.quaternion).multiplyScalar(travel);hideRewards();speechDismissed=true;transition('discarding');tone(220,.06);
};

function modal(){return !!document.querySelector('dialog[open]');}
function knobCenter(){return projected(knobPivot.getWorldPosition(new THREE.Vector3()));}
function floorHit(e){pointerRay(e);return raycaster.ray.intersectPlane(ground,floorPoint);}
function ballHit(){ballGroup.updateMatrixWorld(true);const hits=raycaster.intersectObjects(balls,true);if(!hits.length)return null;let object=hits[0].object;while(object.parent!==ballGroup)object=object.parent;return balls.indexOf(object);}
function sweepFloor(e){
 if(!['ready','result','won'].includes(state)||modal()||!floorHit(e)){lastFloor=null;return;}
 const blocking=raycaster.intersectObjects([body,head],true)[0];if(blocking&&blocking.distance<raycaster.ray.origin.distanceTo(floorPoint)){lastFloor=null;return;}
 const point={x:floorPoint.x*10,z:floorPoint.z*10};physics.sweep(lastFloor,point,(e.timeStamp-lastFloorTime)/1000);lastFloor=point;lastFloorTime=e.timeStamp;
}
function sweepVisibleBalls(e){
 if(!['ready','result','won'].includes(state)||modal()){lastHover=null;return;}
 const from=lastHover;lastHover={x:e.clientX,y:e.clientY};if(!from)return;
 const dx=e.clientX-from.x,dy=e.clientY-from.y,length2=dx*dx+dy*dy;if(length2<.1||length2>10000)return;
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);right.y=0;right.normalize();
 const front=camera.position.clone().sub(cameraTarget);front.y=0;front.normalize();
 const impulse=right.multiplyScalar(dx*.11).addScaledVector(front,dy*.11);
 for(const ball of balls){const p=projected(ball.position),t=clamp(((p.x-from.x)*dx+(p.y-from.y)*dy)/length2,0,1);
  if(Math.hypot(p.x-from.x-dx*t,p.y-from.y-dy*t)>18)continue;
  raycaster.setFromCamera(new THREE.Vector2(p.x/view.width*2-1,1-p.y/view.height*2),camera);
  const blocked=raycaster.intersectObjects([body,head,machine],true)[0];
  if(blocked&&blocked.distance<camera.position.distanceTo(ball.position)-.03)continue;
  physics.impulse(balls.indexOf(ball),impulse.x,impulse.z);
 }
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(modal())return;pointerRay(e);canvas.setPointerCapture(e.pointerId);lastFloor=null;
 const start={x:e.clientX,y:e.clientY,time:e.timeStamp,total:0};
 if(state==='start')return;
 if(e.button===1&&!['inserting','dispensing','zooming','capsule','opening'].includes(state)){e.preventDefault();drag={...start,type:'orbit'};return;}
 if(state==='ready'){
  const c=knobCenter(),coinPoint=projected(coinRig.coin.position);
  if(!coinCredit&&(Math.hypot(e.clientX-coinPoint.x,e.clientY-coinPoint.y)<24||raycaster.intersectObject(coinRig.coin,true).length)){drag={...start,type:'coin'};return;}
  if(Math.hypot(e.clientX-c.x,e.clientY-c.y)<Math.max(24,view.width*.035)||raycaster.intersectObject(knob,true).length){if(!coinCredit){guideAge=0;guideDismissed=false;tone(180,.04);return;}drag={...start,type:'knob',center:c,angle:Math.atan2(e.clientY-c.y,e.clientX-c.x)};guideDismissed=true;return;}
 }
 if(state==='capsule'){
  exhibit.updateMatrixWorld(true);pointerRay(e,revealCamera);
  if(raycaster.intersectObject(reveal,true).length){drag={...start,type:'capsule'};capsuleMotion.begin(exhibit.rotation);guideDismissed=true;}return;
 }
 if(resultState()){
  const pivot=currentPivot(),reward=currentModel();pivot.updateMatrixWorld(true);
  const center=projected(pivot.position);
  if(raycaster.intersectObject(reward,true).length||Math.hypot(e.clientX-center.x,e.clientY-center.y)<28){drag={...start,type:'reward'};rewardMotion.begin(pivot.rotation);guideDismissed=true;return;}
 }
 if(['ready','result','won'].includes(state)){
  const id=ballHit();if(id!==null&&raycaster.ray.intersectPlane(ground,floorPoint)){physics.grab(id,floorPoint.x*10,floorPoint.z*10);drag={...start,type:'ball'};return;}
 }
});
canvas.addEventListener('pointermove',e=>{
 if(modal()||state==='start')return;
 pointerTarget.set(clamp(e.clientX/view.width*2-1,-1,1),clamp(e.clientY/view.height*2-1,-1,1));
 if(!drag){sweepFloor(e);sweepVisibleBalls(e);return;}
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.total+=Math.abs(dx)+Math.abs(dy);
 if(drag.type==='knob'&&state==='ready'){
  const c=drag.center,angle=Math.atan2(e.clientY-c.y,e.clientX-c.x),delta=angleDelta(angle,drag.angle);drag.angle=angle;
  if(Math.abs(delta)<.9){if(Math.abs(delta)>.004){speechDismissed=true;document.body.classList.add('speech-dismissed');}progress+=delta;knobAngle-=delta;knobPivot.quaternion.setFromAxisAngle(knobAxis,knobAngle);if(Math.floor(Math.abs(progress)*5)!==Math.floor(Math.abs(progress-delta)*5))tone(200,.025);if(Math.abs(progress)>=6.1){drag=null;draw();return;}}
 }else if(rotationControls[drag.type]){rotationControls[drag.type].move(dx,dy,(e.timeStamp-drag.time)/1000);}
 else if(drag.type==='ball'&&floorHit(e))physics.moveGrab(floorPoint.x*10,floorPoint.z*10);
 else if(drag.type==='orbit'){manualOrbit.x=clamp(manualOrbit.x-dx*.0025,-.25,.25);manualOrbit.y=clamp(manualOrbit.y-dy*.002,-.14,.14);}
 drag.x=e.clientX;drag.y=e.clientY;drag.time=e.timeStamp;
});
canvas.addEventListener('pointerup',e=>{
 rotationControls[drag?.type]?.release();
 if(drag?.total<10){if(drag.type==='coin')insertCoin();else if(drag.type==='capsule')openCapsule();else if(drag.type==='reward')rewardMotion.yaw+=Math.PI/6;}
 drag=null;physics.release();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel',()=>{rotationControls[drag?.type]?.release();drag=null;physics.release();lastFloor=null;});
canvas.addEventListener('pointerleave',()=>{if(!drag)pointerTarget.set(0,0);lastFloor=null;lastHover=null;});
const guide=$('#gesture-guide');
function updateGuide(){
 guide.hidden=modal()||state!=='ready'||(coinCredit&&(guideDismissed||guideAge>1.05));
 if(guide.hidden)return;
 const crank=coinCredit;guide.className=crank?'crank-guide dot-guide':'coin-guide';
 guide.setAttribute('aria-hidden',String(crank));
 const c=crank?knobCenter():projected(coinRig.coin.position);
 guide.style.left=c.x+'px';guide.style.top=c.y+'px';guide.style.setProperty('--crank-angle','0rad');
}
function updateSpeech(){
 const p=projected(neck.position.clone().add(new THREE.Vector3(0,.37,0))),bubble=$('#speech');
 const artwork=BUBBLES[bubbleKind()],width=Math.min(390,view.width*artwork.width,view.height*.39),height=width*artwork.aspect;
 const thoughtWidth=Math.min(390,view.width*BUBBLES.thought.width,view.height*.39);
 let left=clamp(p.x+Math.min(view.width,600)*(bubbleKind()==='emphasis'?.112:.10)-thoughtWidth/2,12,view.width-width-12);
 const counterBox=$('.counter').getBoundingClientRect(),minimumTop=x=>x<counterBox.right&&x+width>counterBox.left?Math.max(40,counterBox.bottom+8):40;
 let top=clamp(p.y-width*(resultState()?.265:.29)-height*artwork.bodyY,minimumTop(left),view.height-height-100);
 // Reserve the resting coin and its label even after paying, so the bubble
 // stays steady and never covers the target on wide or short viewports.
 const coinPoint=projected(coinRig.rest);coinPoint.x=clamp(coinPoint.x,54,view.width-54);coinPoint.y=clamp(coinPoint.y,70,view.height-70);
 if(left+width>coinPoint.x-60&&left<coinPoint.x+60&&top<coinPoint.y+78&&top+height>coinPoint.y-38){left=Math.max(12,Math.min(left,coinPoint.x-width-70));top=Math.max(top,minimumTop(left));}
 bubble.style.width=width+'px';bubble.style.height=height+'px';
 bubble.style.setProperty('--bubble-font',Math.min(20,Math.max(12,width*.061))+'px');
 bubble.style.left=left+'px';
 // Align the body of all three drawings, not their differently sized tails.
 bubble.style.top=top+'px';
}
$('#language').onclick=()=>{lang=lang==='ko'?'en':'ko';syncUI();};
$('#settings').onclick=()=>{
 const list=$('#prize-list');list.replaceChildren();
 for(const prize of PRIZES){
  const found=owned.has(prize.id),card=document.createElement('div');card.className='prize-card '+(found?'unlocked':'locked');card.setAttribute('role','listitem');const img=new Image();img.src=prize.id==='angel'&&customThumb?customThumb:library.thumbs.get(prize.id);img.alt='';const label=document.createElement('div');label.className='prize-name';label.textContent=found?prize[lang]:'???';const rarity=document.createElement('b');rarity.textContent=gradeName(prize.rarity);card.append(img,label,rarity);list.append(card);
 }$('#drawer').showModal();
};
$('#drawer').addEventListener('click',e=>{if(e.target===$('#drawer'))$('#drawer').close();});
$('#save-photo').onclick=async()=>{
 if(photoBusy||state!=='won')return;photoBusy=true;
 try{renderer.render(scene,camera);const frame=await captureGameFrame(canvas,[$('#speech'),$('.counter'),rewardInfo]);const blob=await new Promise(resolve=>frame.toBlob(resolve,'image/png'));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`super-gacha-${count}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}finally{photoBusy=false;}
};
const swap=$('#ssr-drawer'),input=$('#ssr-file');let importing=false;
$('#ssr-settings').onclick=()=>{$('#ssr-notice').textContent='';swap.showModal();};
$('#ssr-choose').onclick=()=>input.click();
input.addEventListener('change',()=>{if(input.files[0])importPrize(input.files[0]);});
swap.addEventListener('click',e=>{if(e.target===swap)swap.close();});
for(const event of ['dragenter','dragover'])swap.addEventListener(event,e=>{e.preventDefault();swap.classList.add('dragging');});
swap.addEventListener('dragleave',e=>{if(!swap.contains(e.relatedTarget))swap.classList.remove('dragging');});
swap.addEventListener('drop',e=>{e.preventDefault();swap.classList.remove('dragging');const file=e.dataTransfer?.files[0];if(file)importPrize(file);});
function disposeObject(root){if(!root)return;const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();}
function removeCustom(){if(customSSR){rewardPivot.remove(customSSR);disposeObject(customSSR);customSSR=null;}customThumb=null;}
$('#ssr-reset').onclick=()=>{removeCustom();rewardPivot.rotation.set(0,0,0);ssr.visible=state==='won';rebuildPreview();swap.close();};
async function importPrize(file){
 if(importing)return;importing=true;$('#ssr-choose').disabled=true;$('#ssr-reset').disabled=true;
 let object,url;
 try{
  if(file.name.toLowerCase().endsWith('.glb')){object=(await loader.parseAsync(await file.arrayBuffer(),'')).scene;bakedColors(object);}
  else if(file.type.startsWith('image/')){url=URL.createObjectURL(file);const texture=await new THREE.TextureLoader().loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;object=new THREE.Mesh(new THREE.PlaneGeometry(texture.image.width/texture.image.height,1),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:true,alphaTest:.02,toneMapped:false}));}
  else throw Error('file type');
  object.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3());
  if(box.isEmpty()||!Number.isFinite(size.length())||size.length()===0)throw Error('empty model');
  const group=new THREE.Group();object.position.sub(box.getCenter(new THREE.Vector3()));group.add(object);group.scale.setScalar(Math.max(ssrSize.x,ssrSize.y,ssrSize.z)/Math.max(size.x,size.y,size.z));
  group.traverse(o=>{if(o.isMesh)o.castShadow=true;});removeCustom();customSSR=group;rewardPivot.add(group);group.visible=state==='won';ssr.visible=false;rewardPivot.rotation.set(0,0,0);customThumb=library.photograph(group).toDataURL('image/png');rebuildPreview();
  input.value='';swap.close();
 }catch(error){if(object)disposeObject(object);$('#ssr-notice').textContent=lang==='ko'?'이미지 또는 GLB 파일을 선택해 주세요.':'Choose an image or GLB file.';}
 finally{if(url)URL.revokeObjectURL(url);importing=false;$('#ssr-choose').disabled=false;$('#ssr-reset').disabled=false;}
}

let previous=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;elapsed+=dt;age+=dt;guideAge+=dt;
 const focus=['dispensing','zooming','capsule','opening'].includes(state);
 const nextPull=['zooming','capsule','opening'].includes(state)?1:0;
 if(nextPull!==pullTo){pullFrom=cameraPull;pullTo=nextPull;pullAge=0;}pullAge+=dt;
 cameraPull=lerp(pullFrom,pullTo,THREE.MathUtils.smootherstep(pullAge,0,.7));
 startPull=lerp(startPull,state==='start'?1:0,1-Math.exp(-dt*5));
 if(!modal()){
  updateCamera(dt,!focus);if(!focus||state==='dispensing'){const follow=1-Math.exp(-dt*18);
   neck.rotation.y=lerp(neck.rotation.y,headRest.yaw+pointerTarget.x*.24,follow);neck.rotation.x=lerp(neck.rotation.x,headRest.pitch+pointerTarget.y*.13,follow);
  }
 }
 if(state==='ready'||state==='start'){
  if(elapsed>blinkAt&&!blinkEnd){setFace(2);blinkEnd=elapsed+.13;}
  if(blinkEnd&&elapsed>blinkEnd){setFace(1);blinkEnd=0;blinkAt=elapsed+2.5+Math.random()*3;}
 }
 if(state==='ready'&&!coinCredit)coinRig.idle(camera,view);
 else if(state==='inserting'){
  if(age>=COIN_CONTACT_TIME&&age-dt<COIN_CONTACT_TIME){tone(830,.035);tone(1160,.045,.055);tone(1700,.10,.11);}
  if(coinRig.insert(age,camera)){coinCredit=true;spent+=4000;transition('ready');navigator.vibrate?.([12,20,16]);}
 }else coinRig.coin.visible=false;
 if(state==='dispensing')updateDispense(dt);
 if(state==='zooming'){const t=THREE.MathUtils.smootherstep(age,0,.85);exhibit.position.copy(liftStart).multiplyScalar(1-t);exhibit.scale.setScalar(lerp(liftStartScale,capsuleScale,t));exhibit.userData.zoom=exhibit.scale.x/capsuleScale;if(t===1){exhibit.position.set(0,0,0);transition('capsule');}}
 if(state==='opening'){
  const split=THREE.MathUtils.smootherstep(age,.04,.95);reveal.userData.top.position.y=split*3;reveal.userData.bottom.position.y=-split*3;reveal.userData.seam.visible=split<.015;
  reveal.userData.top.scale.setScalar(1-split*.08);reveal.userData.bottom.scale.setScalar(1-split*.08);
  const popAge=Math.max(0,age-.23);prizePreview.visible=popAge>0;prizePreview.position.set(0,-.12*(1-THREE.MathUtils.smootherstep(popAge,0,.8)),0);prizePreview.scale.setScalar(prizePreview.userData.scale*rewardPop(popAge));
  if(age>=1.05)showResult();
 }
 if(state==='capsule')capsuleMotion.step(dt,exhibit.rotation);
 if(resultState()){rewardMotion.step(dt,currentPivot().rotation);keepRewardAboveHands();}
 if(state==='discarding'){
  const t=clamp(age/.45,0,1);discarded.position.copy(discarded.userData.start).addScaledVector(discarded.userData.throw,t);discarded.position.y+=Math.sin(t*Math.PI)*.10-t*.12;discarded.rotation.z+=dt*12;
  if(t===1){scene.remove(discarded);discarded=null;readyAgain();}
 }
 if(state==='resetting'&&age>=.45)restartRun();
 flashStrength=state==='resetting'?Math.sin(clamp(age/.45,0,1)*Math.PI):state==='opening'?THREE.MathUtils.smoothstep(age,.13,.21)*(1-THREE.MathUtils.smoothstep(age,.21,.77)):0;
 flash.style.opacity=String(flashStrength*(reduced.matches?.35:1));flash.style.transform=`scale(${.8+clamp((age-.13)/.64,0,1)*.5})`;
 syncBalls(dt);updateContactShadows();updateGuide();updateSpeech();
 const focused=['zooming','capsule','opening'].includes(state);
 compositor.render(scene,camera,overlay,revealCamera,focused,dt,!reduced.matches&&cameraPull<.9999,reduced.matches);
}
compositor.warmup();document.body.classList.add('authored-game','spatial-game');$('#reveal-ui').hidden=true;
startWhenReady=()=>{if(state!=='start')return;document.body.classList.remove('waiting-start');$('#start-screen').hidden=true;canvas.tabIndex=0;canvas.focus({preventScroll:true});setFace(1);blinkEnd=0;blinkAt=elapsed+2.5;transition('ready');};
if(startRequested)startWhenReady();requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('qa'))window.gachaDiagnostics=()=>({
 reaction:{kind:lineKind,index:lineIndex,emotion:reactionEmotion,bubble:bubbleKind()},
 coinFacing:Math.abs(coinRig.coin.quaternion.dot(camera.quaternion)),coinScale:coinRig.coin.scale.x,
 state,age,expression,faceOffset:faceMaterial.map.offset.toArray(),faceRepeat:faceMaterial.map.repeat.toArray(),count,spent,coinCredit,coinVisible:coinRig.coin.visible,coinPoint:projected(coinRig.coin.position),coinPosition:coinRig.coin.position.toArray(),coinSlot:coinRig.slot.toArray(),ssrAsset:'ssr-lowpoly.glb',odds:DEFAULT_ODDS,misses,pity,prize:currentPrize,owned:Object.fromEntries(owned),cursorHidden:getComputedStyle(canvas).cursor==='none',
 receiptVisible:trash.visible,ssrVisible:(customSSR||ssr).visible,customSSR:!!customSSR,importing,pile:physics.bodies.length,pileBodies:physics.snapshot(),collisions:physics.collisionCount,solidHits:physics.solidHits,solidObstacles:physics.solidObstacles,viewPlanes:physics.viewPlanes,
 ballScreens:balls.map(b=>projected(b.position)),knob:knobCenter(),capsulePoint:projected(exhibit.position,revealCamera),rewardPoint:projected(currentPivot().position),
 camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,aspect:camera.aspect},headRotation:neck.rotation.toArray(),headRest,
 capsuleRotation:exhibit.rotation.toArray(),previewRotation:prizePreview.rotation.toArray(),rewardRotation:rewardPivot.rotation.toArray(),capsuleColor:reveal.userData.colorIndex,headTarget:pointerTarget.toArray(),cameraFollow:pointerSmooth.toArray(),
 hatchAngle:hinge.quaternion.angleTo(new THREE.Quaternion()),hatchVisible:hatch.visible,hatchInsideVisible:hatchInside.visible,hatchPosition:hatch.position.toArray(),hatchRestPosition:hatchRest.position.toArray(),hatchPoint:projected(hatchCenter),capsuleRolling:rolling.visible,rollingPosition:rolling.position.toArray(),rollingScreen:projected(rolling.position),bounceCount,prizePreview:prizePreview.visible,
 progress,guide:!guide.hidden,guideRotation:guide.style.getPropertyValue('--crank-angle'),authored:true,blurCaptures:compositor.captures,blurAmount:compositor.soften,backgroundDarkness:compositor.darkness,cameraPull,startPull,dropStyle:dropProfiles[dropStyle].name,dropCorrection,
 handBaseY,rewardBottom:currentModel()?new THREE.Box3().setFromObject(currentModel()).min.y:null,rewardY:currentPivot().position.y,discardedScreen:discarded?projected(discarded.position):null,
 rollVelocity:rollVelocity.toArray(),dropImpacts:drop.impacts,dropSettled:drop.settled,liftStart:liftStart.toArray(),previewPop:prizePreview.scale.x/prizePreview.userData.scale,
 landingPoint:landingPoint.toArray(),landingScreen:projected(landingPoint),firstLanding:firstLanding.toArray(),capsuleScale,previewScale:prizePreview.userData.scale,previewSize:prizePreview.userData.size.toArray(),flashStrength
});
