import * as THREE from './vendor/three/three.module.js';

// Animate a real camera retreat, then cache the scene and depth once. A small
// aperture-shaped sample pattern softens distant surfaces without a broad blur veil.
export function createFocusBackdrop(renderer,focusPoint){
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d'),image=new THREE.CanvasTexture(canvas);
 image.colorSpace=THREE.SRGBColorSpace;image.minFilter=image.magFilter=THREE.LinearFilter;image.generateMipmaps=false;
 const depthTarget=new THREE.WebGLRenderTarget(1,1);depthTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const softTarget=new THREE.WebGLRenderTarget(1,1);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const vertexShader='varying vec2 screenUv;void main(){screenUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const lens=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,vertexShader,
  uniforms:{image:{value:image},depthImage:{value:depthTarget.depthTexture},texel:{value:new THREE.Vector2()},nearClip:{value:.01},farClip:{value:40},focusDistance:{value:2.3},aperture:{value:2.6},soften:{value:0},darkness:{value:0}},
  fragmentShader:`uniform sampler2D image,depthImage;uniform vec2 texel;uniform float nearClip,farClip,focusDistance,aperture,soften,darkness;varying vec2 screenUv;
   void main(){float depth=texture2D(depthImage,screenUv).r;float distance=nearClip*farClip/(farClip-depth*(farClip-nearClip));
    float coc=clamp((distance-focusDistance)/max(.8,focusDistance*.65),0.,1.);vec2 radius=texel*aperture*mix(.12,1.,coc);
    vec4 sharp=texture2D(image,screenUv),soft=sharp;
    for(int i=0;i<12;i++){float angle=float(i)*2.39996323;float ring=sqrt((float(i)+.5)/12.);soft+=texture2D(image,screenUv+vec2(cos(angle),sin(angle))*radius*ring);}
    gl_FragColor=mix(sharp,soft/13.,soften);
    #include <colorspace_fragment>
    float vignette=smoothstep(.28,.76,length(screenUv-.5));gl_FragColor.rgb*=1.-darkness*(.88+.12*vignette);gl_FragColor.a=1.;
   }`
 });
 const composite=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,vertexShader,
  uniforms:{sharp:{value:image},soft:{value:softTarget.texture},amount:{value:0},darkness:{value:0}},
  fragmentShader:`uniform sampler2D sharp,soft;uniform float amount,darkness;varying vec2 screenUv;
   void main(){gl_FragColor=mix(texture2D(sharp,screenUv),texture2D(soft,screenUv),amount);
    #include <colorspace_fragment>
    float vignette=smoothstep(.28,.76,length(screenUv-.5));gl_FragColor.rgb*=1.-darkness*(.88+.12*vignette);gl_FragColor.a=1.;}`
 });
 const shade=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),lens);scene.add(quad);
 let ready=false,dirty=true,wasActive=false,fade=0,soften=0,captures=0,pixelScale=1;
 return {
  resize(w,h){pixelScale=Math.min(renderer.getPixelRatio(),1280/w);canvas.width=Math.round(w*pixelScale);canvas.height=Math.round(h*pixelScale);lens.uniforms.texel.value.set(1/canvas.width,1/canvas.height);depthTarget.setSize(Math.max(1,Math.round(w*.5)),Math.max(1,Math.round(h*.5)));softTarget.setSize(canvas.width,canvas.height);dirty=true;},
  warmup(){const previous=quad.material;const work=[lens,composite,shade].map(material=>{quad.material=material;return renderer.compileAsync(scene,camera);});quad.material=previous;return Promise.all(work);},
  render(base,baseCamera,overlay,overlayCamera,active,dt,moving,reduced=false){
   fade=THREE.MathUtils.damp(fade,active?1:0,8,dt);
   if(active&&!wasActive){ready=false;soften=0;}
   if(!active){ready=false;soften=0;}
   if(!active||moving||!ready||dirty)renderer.render(base,baseCamera);
   if(active&&!moving&&(!ready||dirty)){
    context.drawImage(renderer.domElement,0,0,canvas.width,canvas.height);image.needsUpdate=true;
    renderer.setRenderTarget(depthTarget);renderer.render(base,baseCamera);renderer.setRenderTarget(null);
    lens.uniforms.nearClip.value=baseCamera.near;lens.uniforms.farClip.value=baseCamera.far;lens.uniforms.focusDistance.value=baseCamera.position.distanceTo(focusPoint)*.78;
    lens.uniforms.soften.value=1;lens.uniforms.darkness.value=0;lens.uniforms.aperture.value=2.6*pixelScale;
    quad.material=lens;renderer.setRenderTarget(softTarget);renderer.render(scene,camera);renderer.setRenderTarget(null);
    ready=true;dirty=false;captures++;
   }
   if(active&&ready&&!moving){
    soften=THREE.MathUtils.damp(soften,reduced?.45:1,9,dt);composite.uniforms.amount.value=soften;composite.uniforms.darkness.value=.16*fade;
    quad.material=composite;renderer.render(scene,camera);
   }else if(fade>.002){quad.material=shade;shade.opacity=.16*fade;renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=true;}
   if(active){renderer.autoClear=false;renderer.clearDepth();renderer.render(overlay,overlayCamera);renderer.autoClear=true;}
   wasActive=active;
  },get captures(){return captures;},get soften(){return soften;},get darkness(){return fade*.16;}
 };
}
