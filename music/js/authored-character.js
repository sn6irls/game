import * as THREE from 'three';
// Bind-pose articulation; arm IK is solved analytically in a fixed elbow plane.
export function createAuthoredCharacter(root,windowPlane){
 root.updateMatrixWorld(true);
 const bones={},rest=new Map(),faces=[];
 root.traverse(o=>{if(o.isBone){bones[o.name]=o;rest.set(o.name,{q:o.quaternion.clone(),p:o.position.clone(),s:o.scale.clone(),world:o.getWorldQuaternion(new THREE.Quaternion())});}if(o.isMesh){o.frustumCulled=false;if(o.name==='Face')faces.push({mesh:o});}});
 const rootBindQ=root.getWorldQuaternion(new THREE.Quaternion()),frameQ=new THREE.Quaternion();
 const q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),v=new THREE.Vector3(),euler=new THREE.Euler();let expression=-1;
 function rotate(name,x=0,y=0,z=0){const bone=bones[name];if(!bone)return;root.updateMatrixWorld(true);bone.parent.getWorldQuaternion(parentQ).invert();q.setFromEuler(euler.set(x,y,z)).premultiply(frameQ).multiply(rest.get(name).world);bone.quaternion.copy(parentQ).multiply(q);}
 function move(name,x,y,z){const bone=bones[name];root.updateMatrixWorld(true);v.set(x,y,z).applyQuaternion(frameQ).applyQuaternion(bone.parent.getWorldQuaternion(parentQ).invert());bone.position.copy(rest.get(name).p).add(v);}
 const eyeClosed={value:0};
 const impactAxis=new THREE.Vector3(0,1,0).cross(windowPlane.normal).normalize();
 const nodResponse={pitch:0,roll:0,yaw:0};
 for(const f of faces){
  // Front-face atlas vertices are distinct from the side wrap. Never shift the side/neck UVs.
  const indices=f.mesh.geometry.index.array,geometry=f.mesh.geometry.toNonIndexed(),region=new Float32Array(indices.length);
  for(let i=0;i<indices.length;i+=3){const front=indices[i]<13&&indices[i+1]<13&&indices[i+2]<13?1:0;region.fill(front,i,i+3);}
  geometry.setAttribute('eyeRegion',new THREE.BufferAttribute(region,1));f.mesh.geometry=geometry;
  f.mesh.material.onBeforeCompile=shader=>{
   shader.uniforms.eyeClosed=eyeClosed;
   shader.vertexShader='attribute float eyeRegion;varying float vEyeRegion;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeRegion=eyeRegion;');
   shader.fragmentShader='uniform float eyeClosed;varying float vEyeRegion;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );',`
    vec2 px=vMapUv*vec2(1071.0,926.0);
    vec2 leftMask=smoothstep(vec2(319.0,101.0),vec2(323.0,105.0),px)*(1.0-smoothstep(vec2(379.0,179.0),vec2(383.0,183.0),px));
    vec2 rightMask=smoothstep(vec2(411.0,94.0),vec2(415.0,98.0),px)*(1.0-smoothstep(vec2(447.0,173.0),vec2(451.0,177.0),px));
    float eyeMask=max(leftMask.x*leftMask.y,rightMask.x*rightMask.y)*eyeClosed*vEyeRegion;
    vec4 sampledDiffuseColor=mix(texture2D(map,vMapUv),texture2D(map,vMapUv+vec2(150.0/1071.0,0.0)),eyeMask);
   `));
  };f.mesh.material.customProgramCacheKey=()=> 'face-eye-only-v2';
 }
 // Derive the nod axis from the authored face, not the camera's horizontal axis.
 const faceForward=new THREE.Vector3(),tri=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
 for(const {mesh}of faces){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=3){if(!mesh.geometry.attributes.eyeRegion.getX(i))continue;for(let k=0;k<3;k++){mesh.getVertexPosition(i+k,tri[k]);mesh.localToWorld(tri[k]);}faceForward.add(new THREE.Vector3().crossVectors(tri[1].sub(tri[0]),tri[2].sub(tri[0])));}}
 faceForward.y=0;faceForward.normalize();const nodAxis=new THREE.Vector3(0,1,0).cross(faceForward).normalize();
 function blink(closed){const state=closed?1:0;if(state===expression)return;eyeClosed.value=state;for(const f of faces)f.mesh.userData.expressionIndex=state;expression=state;}
 const anchor=new THREE.Object3D();anchor.name='Head impact anchor';bones.Head.add(anchor);root.updateMatrixWorld(true);const headBox=new THREE.Box3().setFromObject(root.getObjectByName('Face'));const hitPoint=headBox.getCenter(new THREE.Vector3());hitPoint.y=headBox.max.y-.035;hitPoint.addScaledVector(windowPlane.normal,.08);anchor.position.copy(bones.Head.worldToLocal(hitPoint));

 const headMeshes=[];root.traverse(o=>{if(o.isMesh&&['Face','Hair','Ear'].includes(o.name))headMeshes.push(o);});
 const arms={};
 for(const side of ['Chin','Support']){
  const upper=bones['UpperArm_'+side],fore=bones['Forearm_'+side],hand=bones['Hand_'+side];
  const a=upper.getWorldPosition(new THREE.Vector3()),b=fore.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3());
  const axis=c.clone().sub(a).normalize(),pole=b.clone().sub(a);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  arms[side]={upper,fore,hand,length1:a.distanceTo(b),length2:b.distanceTo(c),axis1:b.clone().sub(a).normalize(),axis2:c.clone().sub(b).normalize(),pole,wristLocal:bones.Chest.worldToLocal(c.clone()),headLocal:bones.Head.worldToLocal(c.clone())};
 }
 const handDiagnostics={clearance:0};
 const faceSource=root.getObjectByName('Face'),faceProxy=new THREE.Mesh(faceSource.geometry.clone(),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const handRay=new THREE.Raycaster(),handPoint=new THREE.Vector3(),handFront=new THREE.Vector3(),handClearance={Chin:new THREE.Vector3(),Support:new THREE.Vector3()};let lastPoseTime=null;
 function prepareFaceCollision(){faceSource.skeleton.update();for(let i=0;i<faceSource.geometry.attributes.position.count;i++){faceSource.getVertexPosition(i,handPoint);faceSource.localToWorld(handPoint);faceProxy.geometry.attributes.position.setXYZ(i,handPoint.x,handPoint.y,handPoint.z);}faceProxy.geometry.computeBoundingSphere();faceProxy.updateMatrixWorld(true);handFront.set(0,0,1).applyQuaternion(frameQ);}
 const surfaceTriangle=new THREE.Triangle(),surfacePoint=new THREE.Vector3(),nearestPoint=new THREE.Vector3(),correction=new THREE.Vector3();
 function handCorrection(side,out){
  const mesh=root.getObjectByName('Hand_'+side+'_1'),facePositions=faceProxy.geometry.attributes.position;mesh.skeleton.update();let deepest=0;out.set(0,0,0);
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   mesh.getVertexPosition(i,handPoint);mesh.localToWorld(handPoint);handRay.set(handPoint,handFront);
   const contacts=handRay.intersectObject(faceProxy,false).filter((r,k,list)=>!k||Math.abs(r.distance-list[k-1].distance)>1e-5);if(!(contacts.length%2))continue;
   // Move to the closest face surface, not all the way through to its front.
   let distance=Infinity;
   for(let j=0;j<facePositions.count;j+=3){surfaceTriangle.a.fromBufferAttribute(facePositions,j);surfaceTriangle.b.fromBufferAttribute(facePositions,j+1);surfaceTriangle.c.fromBufferAttribute(facePositions,j+2);surfaceTriangle.closestPointToPoint(handPoint,surfacePoint);const d=surfacePoint.distanceToSquared(handPoint);if(d<distance){distance=d;nearestPoint.copy(surfacePoint);}}
   const depth=Math.sqrt(distance);if(depth>deepest){deepest=depth;out.copy(nearestPoint).sub(handPoint).multiplyScalar((depth+.0025)/Math.max(depth,1e-8));}
  }
  return deepest;
 }


 function align(bone,restAxis,targetAxis){
  const delta=new THREE.Quaternion().setFromUnitVectors(restAxis.clone().applyQuaternion(frameQ),targetAxis.normalize());
  bone.parent.getWorldQuaternion(parentQ).invert();bone.quaternion.copy(parentQ).multiply(delta).multiply(frameQ).multiply(rest.get(bone.name).world);root.updateMatrixWorld(true);
 }
 function solveArm(side,target,shrug){
  const arm=arms[side],a=arm.upper.getWorldPosition(new THREE.Vector3()),dir=target.clone().sub(a);let distance=dir.length();dir.normalize();
  distance=THREE.MathUtils.clamp(distance,Math.abs(arm.length1-arm.length2)+.002,arm.length1+arm.length2-.002);
  const pole=arm.pole.clone().applyQuaternion(frameQ);pole.addScaledVector(dir,-pole.dot(dir)).normalize();
  const along=(arm.length1**2-arm.length2**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,arm.length1**2-along**2));
  const elbow=a.clone().addScaledVector(dir,along).addScaledVector(pole,height);
  align(arm.upper,arm.axis1,elbow.clone().sub(a));
  const currentElbow=arm.fore.getWorldPosition(new THREE.Vector3());
  align(arm.fore,arm.axis2,a.clone().addScaledVector(dir,distance).sub(currentElbow));
 }
 function rightEdge(){let right=-Infinity;for(const mesh of headMeshes){mesh.skeleton?.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);mesh.localToWorld(v);if(v.y>headBox.min.y)right=Math.max(right,windowPlane.distanceToPoint(v));}}return right;}
 const hair=root.getObjectByName('Hair'),hairBase=hair.geometry.attributes.position.array.slice(),hairRestSide=[];
 const collisionMeshes=[];for(const name of ['Body','Collar']){const source=root.getObjectByName(name),geometry=source.geometry.clone(),proxy=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));collisionMeshes.push({source,proxy});}
 const ray=new THREE.Raycaster(),backward=new THREE.Vector3(0,0,-1),blend=new THREE.Matrix4(),bm=new THREE.Matrix4(),skin=new THREE.Matrix4(),worldPoint=new THREE.Vector3();
 hair.skeleton.update();for(let i=0;i<hair.geometry.attributes.position.count;i++){hair.getVertexPosition(i,worldPoint);hair.localToWorld(worldPoint);hairRestSide[i]=worldPoint.z>=.03?1:-1;}
 function keepHairOutside(){const positions=hair.geometry.attributes.position;positions.array.set(hairBase);hair.skeleton.update();for(const {source,proxy}of collisionMeshes){source.skeleton.update();for(let i=0;i<source.geometry.attributes.position.count;i++){source.getVertexPosition(i,worldPoint);source.localToWorld(worldPoint);proxy.geometry.attributes.position.setXYZ(i,worldPoint.x,worldPoint.y,worldPoint.z);}proxy.geometry.computeBoundingSphere();proxy.updateMatrixWorld(true);}
 for(let i=0;i<positions.count;i++){hair.getVertexPosition(i,worldPoint);hair.localToWorld(worldPoint);if(worldPoint.y>headBox.min.y+.03||worldPoint.y<1.08)continue;ray.set(new THREE.Vector3(worldPoint.x,worldPoint.y,2),backward);const contacts=ray.intersectObjects(collisionMeshes.map(m=>m.proxy),false);if(!contacts.length)continue;const front=contacts[0].point.z,back=contacts[contacts.length-1].point.z;let target=worldPoint.z;if(hairRestSide[i]>0&&target<front+.018&&target>back-.04)target=front+.018;else if(hairRestSide[i]<0&&target>back-.018&&target<front+.04)target=back-.018;if(target===worldPoint.z)continue;worldPoint.z=target;blend.elements.fill(0);for(let j=0;j<4;j++){const index=hair.geometry.attributes.skinIndex.getComponent(i,j),weight=hair.geometry.attributes.skinWeight.getComponent(i,j);bm.fromArray(hair.skeleton.boneMatrices,index*16);for(let k=0;k<16;k++)blend.elements[k]+=bm.elements[k]*weight;}skin.copy(hair.matrixWorld).multiply(hair.bindMatrixInverse).multiply(blend).multiply(hair.bindMatrix).invert();worldPoint.applyMatrix4(skin);positions.setXYZ(i,worldPoint.x,worldPoint.y,worldPoint.z);}
 positions.needsUpdate=true;
 }

 function envelope(age,points){
  // Monotone Hermite interpolation keeps velocity through intermediate keys.
  // Only rest and glass contact stop the motion, rather than easing at every key.
  const slope=i=>{if(i<=0||i>=points.length-1)return 0;const h0=points[i][0]-points[i-1][0],h1=points[i+1][0]-points[i][0],a=(points[i][1]-points[i-1][1])/h0,b=(points[i+1][1]-points[i][1])/h1;if(a*b<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/a+w1/b);};
  for(let i=1;i<points.length;i++){const [a,x]=points[i-1],[b,y]=points[i];if(age>=a&&age<b){const h=b-a,u=(age-a)/h,u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*x+(u3-2*u2+u)*h*slope(i-1)+(-2*u3+3*u2)*y+(u3-u2)*h*slope(i);}}return 0;
 }
 return {root,bones,handDiagnostics,dispose(){faceProxy.geometry.dispose();faceProxy.material.dispose();for(const {proxy}of collisionMeshes){proxy.geometry.dispose();proxy.material.dispose();}},impactPoint(out){root.updateMatrixWorld(true);return anchor.getWorldPosition(out);},update(t,motion,amount,response,age=Infinity){
  frameQ.copy(root.getWorldQuaternion(new THREE.Quaternion())).multiply(rootBindQ.clone().invert());
  for(const [name,r]of rest){const b=bones[name];b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}
  const poseDt=lastPoseTime===null?0:Math.max(0,Math.min(.1,t-lastPoseTime));
  if(lastPoseTime===null||t<lastPoseTime||t-lastPoseTime>.5){handClearance.Chin.set(0,0,0);handClearance.Support.set(0,0,0);for(const key of ['pitch','roll','yaw'])nodResponse[key]=motion[key]||0;}
  lastPoseTime=t;
  for(const key of ['pitch','roll','yaw'])nodResponse[key]+=((motion[key]||0)-nodResponse[key])*(1-Math.exp(-poseDt/ .018));
  const breathing=Math.sin(t*1.12)+Math.sin(t*.37)*.08,breathLag=Math.sin(t*1.12-.18);
  const ages=response.impactAges||[age],pulse=points=>Math.max(0,...ages.map(a=>envelope(a,points)))*amount;
  // Glass contact coincides with the beat. The neck, shoulder and hand recover in sequence.
  const signed=(offset=0)=>MissNormalBeat.impactMotion(ages,offset)*amount;
  const hitSigned=signed(),hit=Math.max(0,hitSigned),neckHit=signed(.020)*.66;
  const shrug=pulse([[-.08,0],[-.018,.16],[.025,1],[.08,.72],[.16,.12],[.24,.02],[.30,.18],[.46,0]]);
  const flinch=pulse([[-.025,0],[.040,1],[.12,.60],[.23,.10],[.34,.09],[.48,0]]);
  const release=pulse([[-.14,0],[-.070,.45],[-.020,.93],[.055,1],[.17,.94],[.27,.55],[.41,.10],[.52,0]]);
  const ride=response.ride||{},bodyHeave=THREE.MathUtils.clamp(ride.heave||0,-.004,.004);
  const roadNeck=THREE.MathUtils.clamp(ride.compression||0,-.012,.012);
  const nod=nodResponse.pitch*.72*amount*(1-hit*.90),side=nodResponse.roll*.65*amount*(1-hit),turn=nodResponse.yaw*.65*amount*(1-hit);
  rotate('Pelvis');rotate('Spine',breathing*.0025+flinch*nodAxis.x*.010,0,flinch*nodAxis.z*.010-neckHit*.0015);
  rotate('Chest',breathLag*.005+nod*nodAxis.x*.08+roadNeck*.15+flinch*nodAxis.x*.035,flinch*.007,-neckHit*.005+nod*nodAxis.z*.08+side*.025+flinch*nodAxis.z*.035);
  move('Chest',0,breathing*.0012+bodyHeave-flinch*.003,breathing*.0007+flinch*.004);
  rotate('Neck',nod*nodAxis.x*.28+neckHit*impactAxis.x*.085+roadNeck*.25,turn*.20,nod*nodAxis.z*.28+neckHit*impactAxis.z*.085-side*.15);
  move('Neck',0,-Math.max(0,nod)*.018-hit*.0025,0);
  const headPitch=nod*nodAxis.x+hitSigned*impactAxis.x*.55+roadNeck,headYaw=turn+hitSigned*.008,headRoll=nod*nodAxis.z+hitSigned*impactAxis.z*.55-side;
  rotate('Head',headPitch,headYaw,headRoll);
  const rise=shrug*.026+Math.max(0,nod)*.018+breathLag*.0009;
  move('Clavicle_Chin',0,rise,flinch*.007);move('Clavicle_Support',0,rise*.82,flinch*.005);
  rotate('Clavicle_Chin',flinch*.025,0,-shrug*.042);rotate('Clavicle_Support',flinch*.019,0,shrug*.034);
  root.updateMatrixWorld(true);
  // Stop skull rotation at the glass. Never drag the whole body or teleport its neck.
  if(rightEdge()>-.003){let low=0,high=1;for(let i=0;i<10;i++){const mid=(low+high)*.5;rotate('Head',headPitch*mid,headYaw*mid,headRoll*mid);root.updateMatrixWorld(true);if(rightEdge()>-.003)high=mid;else low=mid;}rotate('Head',headPitch*low,headYaw*low,headRoll*low);}
  root.updateMatrixWorld(true);
  prepareFaceCollision();
  for(const sideName of ['Chin','Support']){
   const arm=arms[sideName],wrist=bones.Chest.localToWorld(arm.wristLocal.clone());
   if(sideName==='Chin'){
    const follow=bones.Head.localToWorld(arm.headLocal.clone()).sub(wrist);wrist.addScaledVector(follow,1-release);
    wrist.add(new THREE.Vector3(-.032*release,-.004*release,.068*release+Math.max(0,nod)*.008).applyQuaternion(frameQ));
   }else wrist.add(new THREE.Vector3(-.012,-.002,.020).multiplyScalar(release).applyQuaternion(frameQ));
   wrist.add(new THREE.Vector3(0,rise*.20,0).applyQuaternion(frameQ));
   handClearance[sideName].multiplyScalar(Math.exp(-poseDt*24));wrist.add(handClearance[sideName]);
   for(let pass=0;pass<4;pass++){
    solveArm(sideName,wrist,shrug);
    rotate('Hand_'+sideName,sideName==='Chin'?release*.12:nod*nodAxis.x*.25-release*.045,-release*.025,sideName==='Chin'?release*.025:(nod*nodAxis.z-side)*.15-release*.04);
    if(sideName==='Chin'&&release<1){
     const followQ=bones.Head.getWorldQuaternion(new THREE.Quaternion()).multiply(rest.get('Head').world.clone().invert()).multiply(rest.get('Hand_Chin').world);
     const worldQ=arm.hand.getWorldQuaternion(new THREE.Quaternion()).slerp(followQ,1-release);
     arm.hand.quaternion.copy(arm.hand.parent.getWorldQuaternion(parentQ).invert()).multiply(worldQ);
    }
    root.updateMatrixWorld(true);const penetration=handCorrection(sideName,correction);if(penetration<.0001||pass===3)break;
    handClearance[sideName].add(correction);wrist.add(correction);
   }
   handDiagnostics.clearance=Math.max(handClearance.Chin.length(),handClearance.Support.length());
  }
  // Roots stay with the skull; only the ends retain a little momentum.
  const lagHit=signed(.022);
  rotate('Hair_Tail',headPitch*.88+breathLag*.002,headYaw*.90,headRoll*.88);
  rotate('Hair_Tail_Tip',nod*.65-lagHit*.070,turn*.65,-lagHit*.28-side*.60);
  rotate('Hair_Front_L',headPitch*.98,headYaw*.98,headRoll*.98);
  rotate('Hair_Front_R',headPitch*.95,headYaw*.95,headRoll*.94);
  rotate('Hair_Front_R_Tip',nod*.80-lagHit*.075,turn*.80,-lagHit*.32-side*.82);
  root.updateMatrixWorld(true);keepHairOutside();
  handDiagnostics.windowGap=-rightEdge();handDiagnostics.impact=hit;handDiagnostics.headImpulse=hitSigned;handDiagnostics.release=release;handDiagnostics.shoulder=shrug;handDiagnostics.flinch=flinch;
  const phase=t%4.7;blink(ages.some(a=>a>=-.010&&a<.17)||(!ages.some(a=>a<.7&&a>-.2)&&phase>4.54&&phase<4.67));
 }};
}
