import * as THREE from './vendor/three/three.module.js';
import {CapsulePhysics} from './capsule-physics.js';
import {CAPSULE_COLORS} from './capsule-look.js';

export function viewportPlanes(camera,width,height){
  camera.updateMatrixWorld();
  const inset=new THREE.Matrix4().makeScale(1/Math.max(.1,1-24/width),1/Math.max(.1,1-24/height),1);
  const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).premultiply(inset);
  return new THREE.Frustum().setFromProjectionMatrix(matrix).planes.map(p=>({x:p.normal.x,y:p.normal.y,z:p.normal.z,d:p.constant}));
}

// Cache the unfocused background once per opening; animate only a cheap crossfade.
export function createBackgroundCompositor(renderer,{radius=1.35}={}){
  const snapshot=document.createElement('canvas'),snapshotContext=snapshot.getContext('2d');
  const target=new THREE.CanvasTexture(snapshot);target.colorSpace=THREE.SRGBColorSpace;target.minFilter=target.magFilter=THREE.LinearFilter;target.generateMipmaps=false;
  const intermediate=new THREE.WebGLRenderTarget(1,1);
  const blurred=new THREE.WebGLRenderTarget(1,1);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const material=new THREE.ShaderMaterial({
    uniforms:{image:{value:target},direction:{value:new THREE.Vector2(1,0)}},
    depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D image; uniform vec2 direction; varying vec2 uv0;
    void main(){vec4 color=texture2D(image,uv0)*.227027;
      color+=(texture2D(image,uv0+direction*1.384615)+texture2D(image,uv0-direction*1.384615))*.316216;
      color+=(texture2D(image,uv0+direction*3.230769)+texture2D(image,uv0-direction*3.230769))*.070270;
      gl_FragColor=color;
    }`
  });
  const finalMaterial=new THREE.ShaderMaterial({
    uniforms:{sharp:{value:target},soft:{value:blurred.texture},amount:{value:0},live:{value:0}},
    depthTest:false,depthWrite:false,transparent:true,vertexShader:material.vertexShader,
    fragmentShader:`uniform sampler2D sharp;uniform sampler2D soft;uniform float amount;uniform float live;varying vec2 uv0;
    void main(){gl_FragColor=mix(texture2D(sharp,uv0),texture2D(soft,uv0),amount);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.a=mix(1.,amount,live);
    }`
  });
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(quad);
  let blur=0,width=1,height=1,wasFocused=false,dirty=true,captures=0;
  return {resize(w,h){const scale=Math.min(1/3,640/w);width=Math.max(1,Math.round(w*scale));height=Math.max(1,Math.round(h*scale));const sharpScale=Math.min(renderer.getPixelRatio(),1280/w);snapshot.width=Math.round(w*sharpScale);snapshot.height=Math.round(h*sharpScale);for(const rt of [intermediate,blurred])rt.setSize(width,height);dirty=true;},
    warmup(){quad.material=material;renderer.compile(scene,camera);quad.material=finalMaterial;renderer.compile(scene,camera);},
    render(base,baseCamera,overlay,overlayCamera,active,result,dt,strength=1){
      const focused=active&&!result;
      blur=THREE.MathUtils.lerp(blur,focused?7*strength:0,1-Math.exp(-dt*9));
      if(focused&&(!wasFocused||dirty)){
        // Copy the displayed frame once so translucent shadows retain
        // their exact color/contrast instead of changing under offscreen blending.
        renderer.setRenderTarget(null);renderer.render(base,baseCamera);snapshotContext.drawImage(renderer.domElement,0,0,snapshot.width,snapshot.height);target.needsUpdate=true;
        quad.material=material;material.uniforms.image.value=target;material.uniforms.direction.value.set(radius/width,0);
        renderer.setRenderTarget(intermediate);renderer.render(scene,camera);
        material.uniforms.image.value=intermediate.texture;material.uniforms.direction.value.set(0,radius/height);
        renderer.setRenderTarget(blurred);renderer.render(scene,camera);
        renderer.setRenderTarget(null);dirty=false;captures++;
      }
      wasFocused=focused;
      if(!focused)renderer.render(base,baseCamera);
      if(focused||blur>.03){quad.material=finalMaterial;finalMaterial.uniforms.amount.value=blur/7;finalMaterial.uniforms.live.value=focused?0:1;renderer.autoClear=focused;renderer.render(scene,camera);renderer.autoClear=true;}
      if(active){renderer.autoClear=false;renderer.clearDepth();renderer.render(overlay,overlayCamera);renderer.autoClear=true;}
    },get blur(){return blur;},get captures(){return captures;}
  };
}

// Three instanced draws; only moving or touched shells wake the physics simulation.
export function createCapsulePile(scene,look){
  const capacity=320,group=new THREE.Group(),dummy=new THREE.Object3D();scene.add(group);
  const geo=look.geometries(.245,true),colors=[];
  const parts=[new THREE.InstancedMesh(geo.top,look.clear,capacity),new THREE.InstancedMesh(geo.bottom,look.cup,capacity),new THREE.InstancedMesh(geo.seam,look.rim,capacity)];
  // Allocate the instance-color attribute before the first shader compilation.
  parts[1].setColorAt(0,new THREE.Color());
  for(const part of parts){part.count=0;part.frustumCulled=false;part.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(part);}
  const physics=new CapsulePhysics(capacity),sphere=new THREE.Sphere(new THREE.Vector3(),.245),hit=new THREE.Vector3();
  physics.bounds.front=4.15;
  function sync(){let changed=false;for(const b of physics.bodies){if(!b.dirty)continue;dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(b.rx,0,b.rz);dummy.scale.setScalar(1);dummy.updateMatrix();for(const part of parts)part.setMatrixAt(b.id,dummy.matrix);b.dirty=false;changed=true;}if(changed)for(const part of parts)part.instanceMatrix.needsUpdate=true;}
  return {add(position,velocity,colorIndex=0){const id=physics.add(position,velocity);colors[id]=colorIndex;parts[1].setColorAt(id,new THREE.Color(CAPSULE_COLORS[colorIndex]));parts[1].instanceColor.needsUpdate=true;for(const part of parts)part.count=physics.bodies.length;sync();},
    setViewport(camera,width,height){physics.setViewPlanes(viewportPlanes(camera,width,height));sync();},
    setObstacles(obstacles){physics.setObstacles(obstacles);sync();},
    update(dt){physics.update(dt);sync();},
    hitTest(ray){let id=null,nearest=Infinity;for(const b of physics.bodies){sphere.center.set(b.x,b.y,b.z);if(ray.intersectSphere(sphere,hit)){const distance=ray.origin.distanceToSquared(hit);if(distance<nearest){nearest=distance;id=b.id;}}}return id;},
    grab(id,point){physics.grab(id,point.x,point.z);},moveGrab(point){physics.moveGrab(point.x,point.z);},release(){physics.release();},
    sweep(from,to,dt){physics.sweep(from,to,dt);},
    reset(){colors.length=0;physics.reset();for(const part of parts)part.count=0;},
    get colors(){return [...colors];},get count(){return physics.bodies.length;},get drawCalls(){return physics.bodies.length?3:0;},
    snapshot(){return physics.snapshot();},get collisions(){return physics.collisionCount;},get activeCount(){return physics.bodies.filter(b=>!b.asleep).length;}
  };
}
