import * as THREE from 'three';

// A small, bevelled five-point metal charm. Shared geometry keeps dense patterns light.
export function createImpactStars(scene){
 const shape=new THREE.Shape();
 for(let i=0;i<10;i++){const angle=Math.PI/2-i*Math.PI/5,r=i%2?.47:1,x=Math.cos(angle)*r,y=Math.sin(angle)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}
 shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.22,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.055,bevelThickness:.045,curveSegments:1});geometry.center();geometry.computeBoundingSphere();
 const front=new THREE.MeshStandardMaterial({color:0xc8cba3,roughness:.42,metalness:.25,emissive:0x272b17,emissiveIntensity:.25,flatShading:true,depthTest:false,depthWrite:false});
 const edge=new THREE.MeshStandardMaterial({color:0x77805b,roughness:.55,metalness:.4,emissive:0x171c10,emissiveIntensity:.2,flatShading:true,depthTest:false,depthWrite:false});
 const stars=[],pending=[];let serial=0;
 const right=new THREE.Vector3(),up=new THREE.Vector3(),toward=new THREE.Vector3(),view=new THREE.Vector3(),ndc=new THREE.Vector3();
 const diagnostics={spawned:0,exited:0,live:0,pending:0,lastExit:null};
 function emit(now){pending.push({born:now,id:serial++});diagnostics.pending=pending.length;}
 function update(now,camera,character){
  if(!camera||!character)return;
  camera.updateMatrixWorld(true);right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);toward.setFromMatrixColumn(camera.matrixWorld,2);
  for(const event of pending.splice(0)){
   const origin=character.impactPoint(new THREE.Vector3());origin.addScaledVector(toward,.07);
   const distance=-origin.clone().applyMatrix4(camera.matrixWorldInverse).z,height=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/camera.zoom;
   const angle=event.id*2.399963+.4,side=Math.cos(angle)>=0?1:-1,mesh=new THREE.Mesh(geometry,[front,edge]);
   mesh.name='Impact star '+event.id;mesh.userData.sceneRole='impactStar';mesh.renderOrder=60;mesh.frustumCulled=false;mesh.scale.setScalar(height*.032);mesh.position.copy(origin);mesh.quaternion.copy(camera.quaternion);scene.add(mesh);
   stars.push({...event,mesh,origin,height,rotation:camera.quaternion.clone(),spin:new THREE.Vector3(side*2.1,1.8+Math.sin(angle)*.8,side*(3.4+Math.abs(Math.sin(angle)))),velocity:right.clone().multiplyScalar(height*side*(.37+.17*Math.abs(Math.cos(angle)))).addScaledVector(up,height*(.40+.12*Math.abs(Math.sin(angle)))).addScaledVector(toward,height*.055)});
   diagnostics.spawned++;
  }
  for(let i=stars.length-1;i>=0;i--){const star=stars[i],age=Math.max(0,(now-star.born)/1000);
   star.mesh.position.copy(star.origin).addScaledVector(star.velocity,age);star.mesh.position.y-=star.height*1.05*age*age;
   star.mesh.quaternion.copy(star.rotation).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(star.spin.x*age,star.spin.y*age,star.spin.z*age)));
   view.copy(star.mesh.position).applyMatrix4(camera.matrixWorldInverse);ndc.copy(star.mesh.position).project(camera);
   const radius=geometry.boundingSphere.radius*star.mesh.scale.x,ry=radius*camera.projectionMatrix.elements[5]/Math.max(.001,-view.z),rx=ry/camera.aspect;
   const outside=ndc.x-rx>1||ndc.x+rx< -1||ndc.y-ry>1||ndc.y+ry< -1||view.z>=-camera.near;
   if(outside&&age>.025){scene.remove(star.mesh);stars.splice(i,1);diagnostics.exited++;diagnostics.lastExit={id:star.id,age,x:ndc.x,y:ndc.y,rx,ry};}
  }
  diagnostics.live=stars.length;diagnostics.pending=pending.length;
 }
 return {emit,update,diagnostics,dispose(){for(const star of stars)scene.remove(star.mesh);stars.length=0;pending.length=0;geometry.dispose();front.dispose();edge.dispose();}};
}
