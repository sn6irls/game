import * as THREE from 'three';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {createAuthoredCharacter} from './authored-character.js';

const smoothNoise=x=>{const i=Math.floor(x),f=x-i,u=f*f*f*(f*(f*6-15)+10);const hash=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return (a-Math.floor(a))*2-1;};return hash(i)*(1-u)+hash(i+1)*u;};
export async function loadAuthoredScene(scene){
 const config=window.MISS_NORMAL_SCENE_CONFIG||await fetch(new URL('assets/bus-scene-config.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('Scene configuration load failed');return r.json();});
 const loader=new GLTFLoader();
 const gltf=window.MISS_NORMAL_SCENE
  ?await loader.parseAsync(Uint8Array.from(atob(window.MISS_NORMAL_SCENE),c=>c.charCodeAt(0)).buffer,'')
  :await loader.loadAsync(new URL('assets/after-school-bus.glb',document.baseURI).href);
 const root=gltf.scene;scene.add(root);root.updateMatrixWorld(true);
 const byRole={};
 root.traverse(o=>{
  if(o.userData.sceneRole)byRole[o.userData.sceneRole]=o;
  if(!o.isMesh)return;o.frustumCulled=false;
  if(o.userData.sceneRole==='character'){
   const old=o.material,texture=old.map||old.emissiveMap;
   o.material=new THREE.MeshStandardMaterial({name:old.name,map:texture,color:0xffffff,roughness:.94,metalness:0,side:THREE.DoubleSide,emissive:0x050603,emissiveIntensity:.25});
   old.dispose();o.layers.enable(1);o.castShadow=true;o.receiveShadow=true;
  }
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)m.map.anisotropy=8;
 });
 const camera=byRole.authoredCamera||gltf.cameras[0];
 if(!camera||!byRole.backdrop||!byRole.characterRig)throw Error('블렌더 장면 데이터가 불완전해요.');
 camera.layers.enable(1);camera.aspect=config.aspect;camera.fov=config.fov;camera.updateProjectionMatrix();
 camera.position.x-=.152;camera.position.y+=.053;
 const cameraRest=camera.position.clone(),cameraQ=camera.quaternion.clone(),cameraTilt=new THREE.Quaternion(),cameraEuler=new THREE.Euler();
 const windowRest=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(.844,0,-.536).normalize(),new THREE.Vector3(3.88,2.05,.46)),windowPlane=windowRest.clone();
 const character=createAuthoredCharacter(byRole.characterRig,windowPlane);
 const cabin=byRole.cabin,rig=byRole.characterRig;
 const backdrop=byRole.backdrop,material=new THREE.MeshBasicMaterial({map:backdrop.material.map||backdrop.material.emissiveMap,side:THREE.DoubleSide});backdrop.material=material;
 material.map=material.map.clone();material.map.wrapS=THREE.RepeatWrapping;material.map.needsUpdate=true;
 const travel={value:0},blur={value:.0035},haze={value:0},flash={value:0},boltOrigin={value:new THREE.Vector2(.5,.1)},boltScale={value:new THREE.Vector2(.10,.5)},boltVariation={value:0};
 // Mountain silhouette measured from the authored panorama, sampled with the
 // same travel and seam blend as the image. Lightning stays in the sky behind it.
 const skyline=[0.59783,0.59921,0.60335,0.6075,0.61026,0.61302,0.61578,0.61578,0.61302,0.61164,0.6144,0.6144,0.61164,0.61026,0.61302,0.61578,0.61717,0.61717,0.61717,0.61717,0.6144,0.61302,0.61302,0.61302,0.61302,0.5854,0.60473,0.6075,0.6075,0.61026,0.61717,0.62822,0.61578,0.62822,0.62822,0.62545,0.62407,0.62269,0.61578,0.61578,0.61164,0.60888,0.60473,0.60059,0.59921,0.60059,0.60197,0.60197,0.59783,0.59369,0.59092,0.5854,0.58125,0.57573,0.57159,0.5702,0.56882,0.56882,0.57297,0.57711,0.57987,0.58264,0.5854,0.58816,0.58816,0.59092,0.59369,0.59507,0.59369,0.5923,0.5923,0.59369,0.59645,0.60335,0.60335,0.60335,0.6075,0.61026,0.61302,0.61578,0.6144,0.61302,0.61855,0.61302,0.61164,0.61026,0.5854,0.58264,0.59092,0.59092,0.58954,0.5923,0.61578,0.61578,0.61302,0.61164,0.6144,0.6144,0.6144,0.61164,0.6144,0.61302,0.60888,0.60473,0.60473,0.60612,0.60473,0.60473,0.6075,0.60612,0.60612,0.60888,0.60888,0.60888,0.60612,0.60335,0.59783,0.59369,0.59092,0.59092,0.59369,0.59507,0.59921,0.60335,0.60612,0.60473,0.60059,0.59921],skyPixels=new Uint8Array(skyline.length*4);
 skyline.forEach((height,i)=>{const n=Math.round(height*65535);skyPixels.set([n>>8,n&255,0,255],i*4);});
 const mountainHorizon=new THREE.DataTexture(skyPixels,skyline.length,1,THREE.RGBAFormat);
 mountainHorizon.wrapS=THREE.RepeatWrapping;mountainHorizon.minFilter=mountainHorizon.magFilter=THREE.LinearFilter;mountainHorizon.needsUpdate=true;
 backdrop.userData.skyline=skyline;
 material.onBeforeCompile=shader=>{
  shader.uniforms.mountainHorizon={value:mountainHorizon};shader.uniforms.highwayTravel=travel;shader.uniforms.highwayBlur=blur;shader.uniforms.highwayHaze=haze;shader.uniforms.windowFlash=flash;shader.uniforms.boltOrigin=boltOrigin;shader.uniforms.boltScale=boltScale;shader.uniforms.boltVariation=boltVariation;
  shader.fragmentShader='uniform sampler2D mountainHorizon;uniform float highwayTravel;uniform float highwayBlur;uniform float highwayHaze;uniform float windowFlash;uniform vec2 boltOrigin;uniform vec2 boltScale;uniform float boltVariation;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',THREE.ShaderChunk.map_pars_fragment+`
   float boltSegment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.0,1.0));}
   float boltHash(float x){return fract(sin(x*127.1+boltVariation*53.7)*43758.5453);}
   vec2 boltVertex(float i){float y=i/18.0;return vec2(sin(y*5.7+boltVariation)*.12*y+(boltHash(i)-.5)*.13*smoothstep(0.0,.15,y),y);}
   float lightningDistance(vec2 p){
    float d=10.0;vec2 a=boltVertex(0.0);
    for(int i=1;i<=18;i++){vec2 b=boltVertex(float(i));d=min(d,boltSegment(p,a,b));a=b;}
    for(int j=0;j<2;j++){
     float start=6.0+float(j)*6.0,side=j==0?-1.0:1.0;vec2 root=boltVertex(start);a=root;
     for(int k=1;k<=4;k++){float f=float(k)/4.0;vec2 b=root+vec2(side*(f*.24+(boltHash(float(k)+start)-.5)*.055),f*.19);d=min(d,boltSegment(p,a,b)+.005);a=b;}
    }
    return d;
   }
   float horizonAt(float u){return dot(texture2D(mountainHorizon,vec2(fract(u),.5)).rg,vec2(65280.0,255.0))/65535.0;}
   float skyVisibility(vec2 uv){
    float x=fract(uv.x),seam=smoothstep(0.0,.08,x)*(1.0-smoothstep(.92,1.0,x));
    float first=1.0-smoothstep(horizonAt(uv.x)-.002,horizonAt(uv.x)+.001,uv.y);
    float second=1.0-smoothstep(horizonAt(uv.x+.5)-.002,horizonAt(uv.x+.5)+.001,uv.y);
    return mix(second,first,seam);
   }
   vec4 highwayRead(vec2 uv){float x=fract(uv.x);float seam=smoothstep(0.0,.08,x)*(1.0-smoothstep(.92,1.0,x));return mix(texture2D(map,uv+vec2(.5,0.0)),texture2D(map,uv),seam);}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );',`
   vec2 uv=vMapUv+vec2(highwayTravel,0.0);float spread=highwayBlur*(.35+.65*(1.0-vMapUv.y))+.015*highwayHaze;
   vec4 sampledDiffuseColor=vec4(0.0);float totalWeight=0.0;
   for(int i=-10;i<=10;i++){float f=float(i);float weight=exp(-f*f/42.0);sampledDiffuseColor+=highwayRead(uv+vec2(spread*f*.20,highwayHaze*sin(f)*.008))*weight;totalWeight+=weight;}
   sampledDiffuseColor/=totalWeight;
   float mist=(.40+.60*smoothstep(.25,.92,vMapUv.y))*(.72+.28*sin(vMapUv.x*11.0+vMapUv.y*7.0));
   sampledDiffuseColor.rgb*=.8;
   vec2 boltUV=(vMapUv-boltOrigin)/boltScale;
   float boltD=lightningDistance(boltUV),aa=max(fwidth(boltD),.002);
   float boltCore=1.0-smoothstep(.002,.002+aa*.75,boltD),boltGlow=exp(-boltD*52.0)*.12;
   float cloud=exp(-length(boltUV-vec2(0.0,.24))*.7)*.18;
   sampledDiffuseColor.rgb+=windowFlash*skyVisibility(uv)*(vec3(.30,.36,.49)*cloud+vec3(.80,.88,1.0)*(boltCore*1.6+boltGlow));
  `));
 };
 material.customProgramCacheKey=()=> 'highway-distant-lightning-v4';
 const ambient=new THREE.HemisphereLight(0xf4f0df,0x404738,1.1);scene.add(ambient);
 const lights=config.lights.map(spec=>{const light=new THREE.DirectionalLight();light.color.setRGB(...spec.color);light.color.lerp(new THREE.Color(0xfff8e7),.55);light.intensity=spec.power/140*1.55;light.position.fromArray(spec.position);light.target.position.fromArray(spec.target);scene.add(light,light.target);return {light,base:light.intensity};});
 const kickLight=new THREE.SpotLight(0xf2f4ff,0,5,.62,.48,2);kickLight.name='Directional kick flash';kickLight.target.position.set(3.35,1.95,.1);kickLight.castShadow=true;kickLight.shadow.mapSize.set(1024,1024);kickLight.shadow.bias=-.0003;kickLight.shadow.normalBias=.006;scene.add(kickLight,kickLight.target);
 const kickDirections=[[3.35,3.15,.65],[3.30,.95,.65],[2.30,2.12,.6],[4.35,2.18,.75],[3.4,2.6,-.9],[3.3,1.65,1.5]];
 const stop=byRole.stopButton,stopMat=stop.material;stopMat.emissive.setRGB(1,.05,.004);stopMat.emissiveIntensity=0;
 const stopMask=await new THREE.TextureLoader().loadAsync(window.MISS_NORMAL_STOP_MASK?'data:image/png;base64,'+window.MISS_NORMAL_STOP_MASK:new URL('assets/stop-mask.png',document.baseURI).href);stopMask.flipY=false;stopMask.channel=stopMat.map.channel;stopMat.emissiveMap=stopMask;stopMat.needsUpdate=true;
 stopMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep(.08,.36,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));');shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight *= mix(.04,1.0,smoothstep(.035,.16,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))));\n#include <opaque_fragment>');};
 const stopLight=new THREE.PointLight(0xff1606,0,3,2);stopLight.name='STOP red face spill';stopLight.layers.set(1);stop.getWorldPosition(stopLight.position);stopLight.position.x-=.12;stopLight.position.z+=.10;scene.add(stopLight);
 const windowLight=new THREE.PointLight(0xeaf5ff,0,5,2);windowLight.name='Outside lightning spill';windowLight.position.set(4.05,2.35,.2);scene.add(windowLight);
 const passingLight=new THREE.SpotLight(0xffefdb,0,5,.65,.8,2);passingLight.name='Passing roadside lamp';passingLight.target.position.set(3.35,2.0,.12);scene.add(passingLight,passingLight.target);
 const ray=new THREE.Raycaster(),probe=new THREE.Vector2(.35,.1);
 // Front and rear axles drive one sprung cabin. The passenger's pelvis and camera
 // share that rigid transform; only their compliant joints lag behind it.
 const suspension={front:0,fv:0,rear:0,rv:0,roll:0,rollV:0},cameraLag={y:0,v:0},bodyLag={y:0,v:0};
 // The cabin jolts first; a camera held in two hands catches up and settles.
 // Independent damped joints preserve continuity even on consecutive impacts.
 const cameraMount={pitch:0,pv:0,roll:0,rv:0};
 const cabinBind=cabin.matrix.clone(),rigBind=rig.matrix.clone(),pivot=new THREE.Vector3(3.35,1.15,.10);
 const travelMatrix=new THREE.Matrix4(),pivotMatrix=new THREE.Matrix4().makeTranslation(pivot.x,pivot.y,pivot.z),unpivot=new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z),vehicleQ=new THREE.Quaternion(),vehicleEuler=new THREE.Euler();
 const poseMatrix=new THREE.Matrix4(),rigOffset=new THREE.Matrix4().makeTranslation(-.055,0,.020);
 let scroll=0,lastTime=null,kickSerial=-1,lastKickId=-1,lastLightningAt=-Infinity,lightningSerial=0;
 const lightningRay=new THREE.Raycaster(),boltProbe=new THREE.Vector2();
 const diagnostics={scroll:0,lamp:0,haze:0,road:0,kickDirection:0};
 return {root:cabin,camera,character,aspect:config.aspect,backdrop,diagnostics,
  update(t,now,response,motion,boomAge,amount=1,roadImpactAge=boomAge,kickId=-1){
   const dt=lastTime===null?0:Math.max(0,Math.min(.05,t-lastTime));lastTime=t;
   scroll=(scroll+dt/3.4*(1+response.window*.12))%1;travel.value=scroll;backdrop.userData.scrollOffset=scroll;
   haze.value=0;
   const lightningAge=response.windowAge??Infinity;
   flash.value=(lightningAge>=0&&lightningAge<.20?(lightningAge<.026?1:lightningAge<.056?1-(lightningAge-.026)/.030:.52*Math.exp(-Math.pow((lightningAge-.082)/.022,2))):0)*amount;
   blur.value=.006*amount;
   const ages=response.impactAges||[Number.isFinite(roadImpactAge)?roadImpactAge:boomAge];
   const steps=Math.max(1,Math.ceil(dt*180)),h=dt/steps;
   for(let i=0;i<steps;i++){
    const offset=(i+1)*h-dt,clock=t+offset;
    const asphalt=smoothNoise(clock*2.2)*.0026+smoothNoise(clock*8.1)*.0008;
    const roadIndex=Math.floor(clock/3.7),jointAt=roadIndex*3.7+1.4+smoothNoise(roadIndex*9.1)*.6;
    const jointHeight=.012+(smoothNoise(roadIndex*6.7)+1)*.004;
    const frontJoint=Math.exp(-(((clock-jointAt)/.045)**2))*jointHeight;
    const rearJoint=Math.exp(-(((clock-jointAt-.19)/.055)**2))*jointHeight*.82;
    let frontBump=0,rearBump=0,rollBump=0,contactPulse=0;
    for(const age of ages){const a=age+offset;frontBump+=Math.exp(-(((a+.080)/.035)**2))-.30*Math.exp(-(((a-.015)/.055)**2));rearBump+=Math.exp(-(((a-.095)/.040)**2))-.24*Math.exp(-(((a-.190)/.065)**2));rollBump+=Math.exp(-(((a+.020)/.065)**2));if(a>=0&&a<.065)contactPulse+=Math.exp(-(((a-.012)/.018)**2));}
    const contact=Math.min(1.4,contactPulse)*amount;
    const frontTarget=(asphalt+frontJoint+THREE.MathUtils.clamp(frontBump,-.5,1.5)*.070)*amount;
    const rearTarget=(smoothNoise((clock-.19)*2.2)*.0026+rearJoint+THREE.MathUtils.clamp(rearBump,-.4,1.5)*.056)*amount;
    const fa=(frontTarget-suspension.front)*169-suspension.fv*15.5;
    const ra=(rearTarget-suspension.rear)*144-suspension.rv*15;
    suspension.fv+=fa*h;suspension.front+=suspension.fv*h;
    suspension.rv+=ra*h;suspension.rear+=suspension.rv*h;
    const rollTarget=(smoothNoise(clock*.72+40)*.00045-Math.min(1.5,rollBump)*.0048)*amount;
    suspension.rollV+=((rollTarget-suspension.roll)*144-suspension.rollV*19)*h;suspension.roll+=suspension.rollV*h;
    const acceleration=fa*.40+ra*.60;
    cameraLag.v+=(-cameraLag.y*160-cameraLag.v*18-acceleration*.95-contact*13)*h;cameraLag.y+=cameraLag.v*h;
    cameraMount.pv+=(-cameraMount.pitch*400-cameraMount.pv*26+acceleration*.035+contact*3.6)*h;cameraMount.pitch+=cameraMount.pv*h;
    cameraMount.rv+=(-cameraMount.roll*320-cameraMount.rv*24-contact*.42)*h;cameraMount.roll+=cameraMount.rv*h;
    bodyLag.v+=(-bodyLag.y*420-bodyLag.v*34-acceleration*.24)*h;bodyLag.y+=bodyLag.v*h;
   }
   const heave=suspension.front*.40+suspension.rear*.60,pitch=(suspension.front-suspension.rear)/3.8,roll=suspension.roll;
   vehicleQ.setFromEuler(vehicleEuler.set(pitch,0,roll));
   travelMatrix.makeTranslation(0,heave,0).multiply(pivotMatrix).multiply(new THREE.Matrix4().makeRotationFromQuaternion(vehicleQ)).multiply(unpivot);
   poseMatrix.copy(travelMatrix).multiply(cabinBind).decompose(cabin.position,cabin.quaternion,cabin.scale);
   poseMatrix.copy(travelMatrix).multiply(rigOffset).multiply(rigBind).decompose(rig.position,rig.quaternion,rig.scale);
   cabin.updateMatrixWorld(true);rig.updateMatrixWorld(true);
   windowPlane.copy(windowRest).applyMatrix4(travelMatrix);
   response.ride={heave:bodyLag.y,compression:THREE.MathUtils.clamp(-bodyLag.y*2,-.012,.012),pitch,roll};
   character.update(t,motion,amount,response,boomAge>=0&&boomAge<.065?boomAge:Math.min(boomAge,roadImpactAge));
   camera.position.copy(cameraRest).applyMatrix4(travelMatrix);
   camera.position.y+=.035*Math.tanh(cameraLag.y/.035)+smoothNoise(t*.67+5)*.00065*amount;
   camera.position.x+=smoothNoise(t*.53+70)*.00055*amount;
   cameraTilt.setFromEuler(cameraEuler.set(smoothNoise(t*.6+13)*.00032*amount-pitch*.3+cameraMount.pitch,-smoothNoise(t*.47+29)*.00028*amount,smoothNoise(t*.41+31)*.00045*amount-roll*.35+cameraMount.roll));
   camera.quaternion.copy(vehicleQ).multiply(cameraQ).multiply(cameraTilt);camera.updateMatrixWorld(true);
   if(kickId!==lastKickId&&kickId>=0){kickSerial++;lastKickId=kickId;}
   const kick=Math.min(1,response.kick),dark=1-kick*.94;
   ambient.intensity=1.1*dark+haze.value*.12;
   for(const {light,base}of lights)light.intensity=base*dark;
   kickLight.position.fromArray(kickDirections[Math.max(0,kickSerial)%kickDirections.length]);kickLight.intensity=13*kick;kickLight.color.set(kickSerial%2?'#fff3da':'#eaf0ff');
   const stopAge=response.stopAge??Infinity;const glow=stopAge>=0&&stopAge<.09?Math.pow(1-stopAge/.09,.5):0;
   stopMat.emissiveIntensity=.12+1.9*glow;stopLight.intensity=4.2*glow;stop.getWorldPosition(stopLight.position);stopLight.position.add(new THREE.Vector3(-.12,0,.10).applyQuaternion(vehicleQ));
   windowLight.intensity=2.9*flash.value;
   const lightningAt=now-lightningAge;
   if(lightningAge>=0&&lightningAge<.2&&Math.abs(lightningAt-lastLightningAt)>.025){
    lastLightningAt=lightningAt;boltVariation.value=lightningSerial++;
    const x=[.43,.50,.36][lightningSerial%3];
    const uvAt=(x,y)=>{lightningRay.setFromCamera(boltProbe.set(x,y),camera);return lightningRay.intersectObject(backdrop,false)[0]?.uv.clone();};
    const top=uvAt(x,.98),bottom=uvAt(x,-.45),right=uvAt(x+.42,.98);
    if(top&&bottom&&right){boltOrigin.value.copy(top);boltScale.value.set(right.x-top.x,bottom.y-top.y);}
   }
   // Use the same UV position/scroll as the visible lamp texture for the light sweep.
   ray.setFromCamera(probe,camera);const intersection=ray.intersectObject(backdrop,false)[0];const u=(intersection?.uv.x??.5)+scroll,x=((u%1)+1)%1;
   const seam=THREE.MathUtils.smoothstep(x,0,.08)*(1-THREE.MathUtils.smoothstep(x,.92,1));
   let lamp=0,nearest=0;for(const [offset,weight]of [[0,seam],[.5,1-seam]])for(const pos of [.23,.704]){const d=((u+offset-pos+.5)%1+1)%1-.5;const strength=Math.exp(-Math.pow(d/.04,2))*weight;if(strength>lamp){lamp=strength;nearest=d;}}
   passingLight.position.set(4.15,2.65,.2+nearest*30);passingLight.intensity=3.8*lamp;
   Object.assign(diagnostics,{scroll,lamp,haze:haze.value,flash:flash.value,boltOrigin:boltOrigin.value.toArray(),boltScale:boltScale.value.toArray(),road:heave,roll,pitch,cameraLag:cameraLag.y,cameraPitch:cameraMount.pitch,cameraRoll:cameraMount.roll,bodyLag:bodyLag.y,stopGlow:glow,kickDirection:Math.max(0,kickSerial)%6});
  },
  dispose(){stopMask.dispose();material.map.dispose();mountainHorizon.dispose();character.dispose();}
 };
}
