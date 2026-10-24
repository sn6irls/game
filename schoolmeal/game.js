(()=>{
/* Full 3D character, atlas expressions and separate tray/ladle GLBs. */
const $=id=>document.getElementById(id), T=THREE, canvas=$('scene');
let model3d=null;
let fullRequested=false,started=false,clearReaction=false;
const scattered=[];
// A 40-degree forward lean exposes more of the original photo to the camera.
const FOOD_TILT=Math.PI*40/180;
// Temporary five-serving reaction order for testing.
const expressionConfig=window.MealExpressions;
let reactionVisible=true,lang='ko',state='idle',count=0,mood=0,variant=0,food=null,fall=null,items=[],serial=0,time=0,last=0;
const w={ko:{feed:'급식주기',save:'저장하기',clear:'다시주기',camera:'camera',gallery:'picture',ready:'식판을 터치해서 급식을 주세요',busy:'말랑한 급식을 만드는 중…',error:'이미지를 열 수 없어요. JPG나 PNG로 다시 골라 주세요.',full:'더 못먹어요~',saved:'사진을 저장했어요!',saveError:'저장하지 못했어요. 다시 눌러 주세요.',say:[['배고파요 많이 주세요!'],['감사합니다!'],['더 주세요!','맛있겠다!'],[';;;'],['시러~~'],['웩...','먹을 수 없어...'],['...........','무리']]},en:{feed:'Give lunch',save:'Save image',clear:'Start over',camera:'camera',gallery:'picture',ready:'Tap the tray to serve your lunch',busy:'Making your jelly lunch…',error:'Cannot open image. Try a JPG or PNG.',full:'I can’t eat any more~',saved:'Image saved!',saveError:'Could not save. Please try again.',say:[["I’m hungry! Lots, please!"],['Thank you!'],['More, please!','Looks yummy!'],[';;;'],['Nooo~~'],['Eww...','I can’t eat this...'],['...........','No way']]}};
w.ko.say=expressionConfig.dialogue.ko;w.en.say=expressionConfig.dialogue.en;variant=Math.floor(Math.random()*2);

function artButton(id,name,label){const button=$(id),src='assets/font/'+name;let img=button.querySelector('img');if(!img){img=document.createElement('img');button.replaceChildren(img);}if(img.getAttribute('src')!==src)img.src=src;img.alt=label;button.setAttribute('aria-label',label);}
function ui(){artButton('feed',lang==='ko'?'급식주기.png':'give lunch.png',w[lang].feed);artButton('save',lang==='ko'?'저장하기.png':'save.png',w[lang].save);backgroundUI();$('pngHint').textContent=lang==='ko'?'투명 PNG는 원래 모양이 유지됩니다.':'Transparent PNGs keep their original shape.';$('startScreen').hidden=started;document.querySelector('.controls').hidden=!started||state==='intro';$('sideTools').hidden=!started||state==='intro';$('startGame').disabled=!model3d?.ready;artButton('camera','카메라.png',lang==='ko'?'카메라':'Camera');artButton('gallery','갤러리.png',lang==='ko'?'갤러리':'Picture');artButton('clear','다시시작.png',w[lang].clear);artButton('lang',lang==='ko'?'en.png':'한글.png',lang==='ko'?'English':'한국어');document.documentElement.lang=lang;$('save').hidden=!count||state==='ready'||state==='falling';$('feed').hidden=state==='ready'||state==='falling';$('feed').disabled=state==='loading'||state==='clearing'||!model3d?.ready;$('clear').classList.toggle('needs-clear',fullRequested&&count>=5);$('clear').disabled=state==='loading'||state==='clearing'||state==='falling'||(!count&&!food);$('status').textContent='';$('speech').hidden=!started||state==='intro'||!reactionVisible;$('speech').textContent=reactionVisible?(clearReaction?(lang==='ko'?'으아아아!':'Aaaah!'):fullRequested?w[lang].full:w[lang].say[mood][variant%w[lang].say[mood].length]):'';canvas.setAttribute('aria-label',w[lang].ready)}
const scene=new T.Scene();scene.background=new T.Color('#101720');scene.fog=new T.Fog('#101720',12,30);
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true})}catch(e){$('status').textContent='3D를 표시하려면 WebGL을 지원하는 브라우저가 필요해요.';throw e}renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const camera=new T.PerspectiveCamera(37,1,.1,50);camera.position.set(0,6.5,11.8);camera.lookAt(0,2.45,.2);scene.add(new T.HemisphereLight('#fffbe6','#7a938b',2.5));const key=new T.DirectionalLight('#fff8e7',4);key.position.set(0,10,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3.5,right:3.5,top:3.5,bottom:-3.5,near:.5,far:16});key.shadow.bias=-.00015;key.shadow.normalBias=.008;key.shadow.radius=2;scene.add(key);const rim=new T.DirectionalLight('#bcefff',2);rim.position.set(4,6,-4);scene.add(rim);
const mat=(c,rough=.45,metal=0)=>new T.MeshStandardMaterial({color:c,roughness:rough,metalness:metal});const skin=mat('#ffe0b0'),hair=mat('#65cce8',.24),hairLight=mat('#9ce9f6',.23),yellow=mat('#fff0a3'),dark=mat('#234550'),white=mat('#fffefa'),pink=mat('#ef9c9d'),metal=mat('#b5c0be',.25,.72),well=mat('#95a6a2',.33,.6);
function mesh(geo,m,parent=scene){const o=new T.Mesh(geo,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}function ball(parent,x,y,z,sx,sy,sz,m){const o=mesh(new T.SphereGeometry(1,32,24),m,parent);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o}function rod(parent,a,b,r,m,r2=r){const v=new T.Vector3(...a),u=new T.Vector3(...b),d=u.clone().sub(v);const o=mesh(new T.CylinderGeometry(r2,r,d.length(),20),m,parent);o.position.copy(v.add(u).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());ball(parent,...a,r,r,r,m);ball(parent,...b,r2,r2,r2,m);return o}

// A flat photographic backdrop: camera parallax without bending classroom lines.
const backgroundGeometry=new T.PlaneGeometry(1,1,40,48),backgroundVertices=backgroundGeometry.attributes.position,backgroundUV=backgroundGeometry.attributes.uv;
for(let i=0;i<backgroundVertices.count;i++){
 const u=backgroundUV.getX(i),v=backgroundUV.getY(i),side=Math.pow(Math.abs(u-.5)*2,2),foreground=1-T.MathUtils.smoothstep(v,.10,.65);
 backgroundVertices.setZ(i,0);
}
backgroundGeometry.computeVertexNormals();backgroundGeometry.computeBoundingSphere();
// A light, neutral dimming keeps the original classroom colors.
const backdrop=new T.Mesh(backgroundGeometry,new T.MeshBasicMaterial({color:new T.Color().setRGB(.82,.82,.82),toneMapped:false,fog:false}));
// Screen-space vignette affects the background material only, including saved images.
const backdropVignette={enabled:{value:0},resolution:{value:new T.Vector2(1,1)}};
backdrop.material.onBeforeCompile=shader=>{
 shader.uniforms.mealVignetteEnabled=backdropVignette.enabled;
 shader.uniforms.mealVignetteResolution=backdropVignette.resolution;
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float mealVignetteEnabled;\nuniform vec2 mealVignetteResolution;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
  vec2 edgePosition=(gl_FragCoord.xy/mealVignetteResolution-0.5)*2.0;
  float edgeShade=smoothstep(0.28,0.95,length(edgePosition))*mealVignetteEnabled;
  gl_FragColor.rgb*=mix(1.0,0.16,edgeShade);
 `);
};
backdrop.material.customProgramCacheKey=()=> 'desktop-background-vignette-v1';
backdrop.position.set(0,.8,-18);backdrop.visible=false;scene.add(backdrop);
let backdropAspect=1.5,backdropSourceAspect=1.5,defaultBackdrop=true;
function fitBackdrop(){
 const desktop=window.innerWidth>=900;
 backdropVignette.enabled.value=desktop?1:0;renderer.getDrawingBufferSize(backdropVignette.resolution.value);
 backdropAspect=defaultBackdrop&&!desktop?Math.min(backdropSourceAspect,Math.max(9/16,camera.aspect)):backdropSourceAspect;
 const map=backdrop.material.map;if(map){const visibleWidth=backdropAspect/backdropSourceAspect;map.repeat.set(visibleWidth,1);map.offset.set((1-visibleWidth)/2,0);map.updateMatrix();}
 for(let i=0;i<backgroundVertices.count;i++)backgroundVertices.setXYZ(i,backgroundUV.getX(i)-.5,backgroundUV.getY(i)-.5,0);
 backgroundVertices.needsUpdate=true;backgroundGeometry.computeVertexNormals();backgroundGeometry.computeBoundingSphere();
 // Cover the intro and playing views with one flat, proportional photograph.
 // Desktop pointer motion also needs room beyond the resting camera's viewport.
 const bounds=new T.Box3(),ref=new T.PerspectiveCamera(50,camera.aspect,.1,150);
 ref.filmGauge=36;ref.setFocalLength(150);
 const baseDistance=Math.max(7.3,3.45/camera.aspect)/(2*Math.tan(T.MathUtils.degToRad(ref.fov)/2));
 for(const progress of (desktop?[0,.25,.5,.75,1]:[0,1])){
  const focusY=T.MathUtils.lerp(1.95,2.35,progress),elevation=T.MathUtils.lerp(.24,.08,progress),d=baseDistance*T.MathUtils.lerp(1.28,1,progress);
  for(const yaw of (desktop?[-.045,0,.045]:[0]))for(const tilt of (desktop?[-.012,.012]:[0])){
   const a=yaw*progress,e=elevation+tilt*progress;
   ref.position.set(Math.sin(a)*d,focusY+Math.sin(e)*d,-1.2+Math.cos(a)*Math.cos(e)*d);ref.lookAt(0,focusY,-1.2);ref.updateMatrixWorld(true);
   for(const sx of [-1,1])for(const sy of [-1,1]){const ray=new T.Vector3(sx,sy,.5).unproject(ref).sub(ref.position);const t=(-18-ref.position.z)/ray.z;bounds.expandByPoint(ray.multiplyScalar(t).add(ref.position));}
  }
 }
 const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),height=Math.max(size.y,size.x/backdropAspect)*1.06;
 backdrop.position.set(center.x,center.y,-18);backdrop.scale.set(height*backdropAspect,height,1);
}
let backgroundToken=0,backgroundBusy=false,backgroundMessage='';
const backgroundText={ko:{button:'배경',title:'배경 바꾸기',choose:'배경 변경',reset:'기본 배경',close:'닫기',preview:'현재 배경',hint:'PNG·JPG 이미지를 선택하면 바로 적용돼요. 투명한 부분은 어두운 배경으로 보여요.',loading:'배경을 불러오는 중…',applied:'배경을 바꿨어요!',restored:'기본 배경으로 돌아왔어요.',error:'이미지를 열 수 없어요. PNG나 JPG를 다시 선택해 주세요.'},en:{button:'Background',title:'Change background',choose:'Change background',reset:'Default',close:'Close',preview:'Current background',hint:'Choose a PNG or JPG to apply it immediately. Transparent areas appear dark.',loading:'Loading background…',applied:'Background updated!',restored:'Default background restored.',error:'Could not open this image. Please choose a PNG or JPG.'}};
function backgroundUI(){const text=backgroundText[lang];artButton('background','bgc hange.png',text.button);$('backgroundTitle').textContent=text.title;$('backgroundChoose').textContent=text.choose;$('backgroundReset').textContent=text.reset;$('backgroundClose').setAttribute('aria-label',text.close);$('backgroundPreview').alt=text.preview;$('backgroundHint').textContent=text.hint;$('backgroundMessage').textContent=backgroundMessage==='error'?text.error:'';$('backgroundChoose').disabled=backgroundBusy;$('backgroundReset').disabled=backgroundBusy;}
async function changeBackground(source,isDefault=false,announce=true){
 const token=++backgroundToken;backgroundBusy=true;backgroundMessage='';backgroundUI();
 try{
  const image=new Image();image.src=source;await image.decode();if(token!==backgroundToken)return;
  const ratio=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight)),surface=document.createElement('canvas');
  surface.width=Math.max(1,Math.round(image.naturalWidth*ratio));surface.height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const ctx=surface.getContext('2d');ctx.fillStyle='#101720';ctx.fillRect(0,0,surface.width,surface.height);ctx.drawImage(image,0,0,surface.width,surface.height);
  const preview=document.createElement('canvas');preview.width=320;preview.height=Math.max(1,Math.round(320*surface.height/surface.width));
  // Bound preview memory for unusually tall images too.
  if(preview.height>512){preview.width=Math.max(1,Math.round(512*surface.width/surface.height));preview.height=512;}
  preview.getContext('2d').drawImage(surface,0,0,preview.width,preview.height);const previewURL=preview.toDataURL('image/jpeg',.8);
  const texture=new T.CanvasTexture(surface);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const previous=backdrop.material.map;backdropSourceAspect=image.naturalWidth/image.naturalHeight;defaultBackdrop=isDefault;backdrop.material.map=texture;backdrop.material.needsUpdate=true;fitBackdrop();backdrop.visible=true;previous?.dispose();
  $('backgroundPreview').src=previewURL;backgroundMessage=announce?(isDefault?'restored':'applied'):'';
 }catch{if(token===backgroundToken)backgroundMessage='error';}
 finally{if(token===backgroundToken){backgroundBusy=false;backgroundUI();}}
}
$('background').onclick=()=>{backgroundUI();$('backgroundPicker').showModal();};
$('backgroundClose').onclick=()=>$('backgroundPicker').close();
$('backgroundChoose').onclick=()=>$('backgroundInput').click();
$('backgroundReset').onclick=()=>changeBackground('assets/bg2.jpg',true);
$('backgroundPicker').onclick=e=>{if(e.target===$('backgroundPicker')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('backgroundInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;const url=URL.createObjectURL(file);try{await changeBackground(url);}finally{URL.revokeObjectURL(url);e.target.value='';}};
changeBackground('assets/bg2.jpg',true,false);
const ladle=new T.Group();scene.add(ladle);ladle.visible=false;
function facial(){
 // Dim only the photographic backdrop for contempt; also applies to saved images.
 const brightness=mood===9?.14:.82;backdrop.material.color.setRGB(brightness,brightness,brightness);
 scene.background.set(mood===9?'#05070a':'#101720');
 if(started)window.MealSFX?.expression(mood);window.MealMusic?.setMood(mood>=8?6:0);model3d?.react(mood);
}
model3d=window.createSchoolModel({scene,camera,renderer,ladle,onReady:()=>{facial();ui();document.documentElement.dataset.model='ready'},onError:()=>{$('status').textContent='모델을 불러오지 못했어요. 새로고침해 주세요.'}});
// Food is tilted toward the camera: its lowest contact lies toward the front of its footprint.
window.mealSurface=(x,z)=>model3d?.floorHeight(x,z+.39)??1.65;
const ray=new T.Raycaster(),ndc=new T.Vector2(),hitPlane=new T.Plane(new T.Vector3(0,1,0),-1.65),hit=new T.Vector3();let aim={x:-.7,z:1.85};
function pointer(e){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);model3d?.point(ndc.x,ndc.y);ray.setFromCamera(ndc,camera);if(ray.ray.intersectPlane(hitPlane,hit)){aim.x=T.MathUtils.clamp(hit.x,-1.4,1.4);aim.z=T.MathUtils.clamp(hit.z,1.75,1.95)}}canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',e=>{pointer(e);drop()});canvas.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();drop()}});
// A watertight alpha silhouette: front, back and exposed edge faces carry image UVs.
// Trace the alpha outline into smooth closed contours instead of extruding individual pixels.
function cutoutGeometry(mask,n,radius,aspect){
 const solid=(x,y)=>x>=0&&y>=0&&x<n&&y<n&&mask[(y*n+x)*4+3]>=128;
 const edges=new Map(),key=(x,y)=>x+','+y;
 function edge(ax,ay,bx,by){const k=key(ax,ay);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([bx,by])}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(solid(x,y)){if(!solid(x,y-1))edge(x,y,x+1,y);if(!solid(x+1,y))edge(x+1,y,x+1,y+1);if(!solid(x,y+1))edge(x+1,y+1,x,y+1);if(!solid(x-1,y))edge(x,y+1,x,y)}
 const area=p=>p.reduce((s,v,i)=>{const q=p[(i+1)%p.length];return s+v[0]*q[1]-q[0]*v[1]},0)/2;
 function simplify(p,epsilon){if(p.length<3)return p;const a=p[0],b=p[p.length-1],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let max=0,index=0;for(let i=1;i<p.length-1;i++){const q=p[i],t=den?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/den)):0,d=Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);if(d>max){max=d;index=i}}return max>epsilon?simplify(p.slice(0,index+1),epsilon).slice(0,-1).concat(simplify(p.slice(index),epsilon)):[a,b]}
 const loops=[];while(edges.size){const first=edges.keys().next().value,start=first.split(',').map(Number),loop=[start];let current=start;
  for(let guard=0;guard<n*n*8;guard++){const k=key(...current),nexts=edges.get(k);if(!nexts?.length)break;const next=nexts.pop();if(!nexts.length)edges.delete(k);current=next;if(key(...current)===first)break;loop.push(current)}
  if(loop.length<4||Math.abs(area(loop))<2)continue;let far=1;for(let i=2;i<loop.length;i++)if(Math.hypot(loop[i][0]-start[0],loop[i][1]-start[1])>Math.hypot(loop[far][0]-start[0],loop[far][1]-start[1]))far=i;
  let points=simplify(loop.slice(0,far+1),.55).slice(0,-1).concat(simplify(loop.slice(far).concat([start]),.55).slice(0,-1));
  for(let round=0;round<2;round++){const smooth=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];smooth.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}points=smooth}
  loops.push({points,size:Math.abs(area(points)),parent:null,depth:0});
 }
 function contains(poly,p){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
 loops.sort((a,b)=>b.size-a.size);for(let i=0;i<loops.length;i++){const o=loops[i];for(let j=i-1;j>=0;j--)if(contains(loops[j].points,o.points[0])){o.parent=loops[j];o.depth=o.parent.depth+1;break}}
 const sx=Math.sqrt(aspect),sz=1/sx,shapes=[];for(const o of loops){const points=o.points.map(p=>new T.Vector2((p[0]/n-.5)*radius*2*sx,(.5-p[1]/n)*radius*2*sz));if(o.depth%2===0){o.shape=new T.Shape(points);shapes.push(o.shape)}else{let parent=o.parent;while(parent&&parent.depth%2)parent=parent.parent;parent?.shape.holes.push(new T.Path(points))}}
 if(!shapes.length)throw Error('Empty outline');
 // Preserve cutout artwork: constant thickness, gently rounded edges, no internal inflation.
 const geo=new T.ExtrudeGeometry(shapes,{depth:.07,bevelEnabled:true,bevelSize:.004,bevelThickness:.009,bevelSegments:4,steps:1,curveSegments:12});geo.rotateX(-Math.PI/2);
 const p=geo.attributes.position;
 for(let i=0;i<p.count;i++)geo.attributes.uv.setXY(i,p.getX(i)/(radius*2*sx)+.5,.5-p.getZ(i)/(radius*2*sz));
 geo.setIndex(Array.from({length:p.count},(_,i)=>i));return geo;

}

function foodMesh(img){
  const sample=document.createElement('canvas');sample.width=sample.height=96;
  const c=sample.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,96,96);
  const alpha=c.getImageData(0,0,96,96).data;let minX=96,minY=96,maxX=-1,maxY=-1;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(alpha[(y*96+x)*4+3]>40){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  if(maxX<0)throw Error('Empty alpha');
  const image=document.createElement('canvas');image.width=image.height=1024;
  image.getContext('2d').drawImage(img,minX/96*img.width,minY/96*img.height,(maxX-minX+1)/96*img.width,(maxY-minY+1)/96*img.height,0,0,1024,1024);
  c.clearRect(0,0,96,96);c.drawImage(image,0,0,96,96);const mask=c.getImageData(0,0,96,96).data;
  let empty=0;for(let i=3;i<mask.length;i+=4)if(mask[i]<128)empty++;
  let geo,contourMesh=false;const radius=.66,height=.24;
  if(empty<96){
    // A broad rounded jelly top maps the ENTIRE photograph, including its corners.
    const n=48,pos=[],uvs=[],idx=[],aspect=T.MathUtils.clamp((maxX-minX+1)*img.width/((maxY-minY+1)*img.height),.6,1.65),sx=Math.sqrt(aspect),sz=1/sx;
    for(let layer=0;layer<2;layer++)for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const u=x/n*2-1,v=y/n*2-1;const px=u*Math.sqrt(1-v*v*.16)*radius*sx,pz=v*Math.sqrt(1-u*u*.16)*radius*sz;const h=.085+.155*(1-Math.pow(u,8))*(1-Math.pow(v,8))-.008*v;pos.push(px,layer?0:h,pz);uvs.push(x/n,1-y/n)}
    const stride=n+1,off=stride*stride;const q=(a,b,c,d)=>idx.push(a,b,c,a,c,d);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*stride+x,b=a+stride,c=b+1,d=a+1;q(a,b,c,d);q(a+off,d+off,c+off,b+off);if(!x)q(a+off,b+off,b,a);if(x===n-1)q(d,c,c+off,d+off);if(!y)q(a,d,d+off,a+off);if(y===n-1)q(b+off,c+off,c,b)}
    geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(idx);geo.computeVertexNormals();
  }else{
    const aspect=T.MathUtils.clamp((maxX-minX+1)*img.width/((maxY-minY+1)*img.height),.6,1.65);
    geo=cutoutGeometry(mask,96,radius,aspect);contourMesh=true;
  }
  // Keep the photograph on top; cutout walls inherit nearby opaque edge colors.
  const sourceIndices=Array.from(geo.index.array),layerSize=geo.attributes.position.count/2,topIndices=[],wallIndices=[];
  for(let i=0;i<sourceIndices.length;i+=3){const triangle=sourceIndices.slice(i,i+3);(triangle.every(v=>contourMesh?geo.attributes.normal.getY(v)>.99:v<layerSize)?topIndices:wallIndices).push(...triangle)}
  geo.setIndex(topIndices.concat(wallIndices));geo.clearGroups();geo.addGroup(0,topIndices.length,0);geo.addGroup(topIndices.length,wallIndices.length,1);
  // Extend each opaque edge color down the cutout wall instead of using a gray average.
  {
    const n=96,nearest=new Int32Array(n*n).fill(-1),queue=new Int32Array(n*n);let read=0,write=0;
    for(let i=0;i<n*n;i++)if(mask[i*4+3]>=128){nearest[i]=i;queue[write++]=i}
    while(read<write){const i=queue[read++],x=i%n,y=(i/n)|0;for(const j of [x?i-1:-1,x<n-1?i+1:-1,y?i-n:-1,y<n-1?i+n:-1])if(j>=0&&nearest[j]<0){nearest[j]=nearest[i];queue[write++]=j}}
    const uv=geo.attributes.uv,colors=new Float32Array(uv.count*3),color=new T.Color();
    for(let i=0;i<uv.count;i++){
      const x=Math.max(0,Math.min(n-1,Math.floor(uv.getX(i)*n))),y=Math.max(0,Math.min(n-1,Math.floor((1-uv.getY(i))*n)));
      const source=nearest[y*n+x]*4;
      color.setRGB(mask[source]/255,mask[source+1]/255,mask[source+2]/255,T.SRGBColorSpace).multiplyScalar(.94);
      color.toArray(colors,i*3);
    }
    geo.setAttribute('color',new T.BufferAttribute(colors,3));
  }
  geo.computeBoundingBox();const flatBounds=geo.boundingBox.clone();
  // Tilt the photo-bearing surface toward the viewer while keeping its lowest edge on the tray.
  geo.rotateX(FOOD_TILT);geo.computeBoundingBox();const lift=-geo.boundingBox.min.y;geo.translate(0,lift,0);geo.computeBoundingBox();const standingHeight=geo.boundingBox.max.y;
  const texture=new T.CanvasTexture(image);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
  const material=[new T.MeshBasicMaterial({map:texture,toneMapped:false,alphaTest:.12}),new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,toneMapped:false})];
  const o=mesh(geo,material);o.receiveShadow=false;o.userData.texture=texture;o.userData.height=standingHeight;o.userData.radius=radius;o.userData.body=null;
  const center=flatBounds.getCenter(new T.Vector3()),half=flatBounds.getSize(new T.Vector3()).multiplyScalar(.5),co=Math.cos(FOOD_TILT),si=Math.sin(FOOD_TILT);
  o.userData.collider={center:[center.x,center.y*co-center.z*si+lift,center.y*si+center.z*co],edges:[[half.x+.015,0,0],[0,(half.y+.025)*co,(half.y+.025)*si],[0,-(half.z+.015)*si,(half.z+.015)*co]]};
  // Rest full-size across the rim; only the angle changes when the food is poured.
  const scoopAngle=Math.PI*23/180-FOOD_TILT,sc=Math.cos(scoopAngle),ss=Math.sin(scoopAngle),vertices=geo.attributes.position;
  const scoopBounds=new T.Box3(),point=new T.Vector3();
  for(let i=0;i<vertices.count;i++)scoopBounds.expandByPoint(point.set(vertices.getX(i),vertices.getY(i)*sc-vertices.getZ(i)*ss,vertices.getY(i)*ss+vertices.getZ(i)*sc));
  const boxCenter=scoopBounds.getCenter(new T.Vector3());
  o.userData.scoop={angle:scoopAngle,x:boxCenter.x,z:boxCenter.z,bottom:scoopBounds.min.y};
  o.userData.restVertices=geo.attributes.position.array.slice();geo.attributes.position.setUsage(T.DynamicDrawUsage);geo.computeBoundingSphere();geo.boundingSphere.radius*=2;return o;
}
function holdFood(o){const scoop=o.userData.scoop;o.scale.setScalar(1);o.rotation.set(scoop.angle,0,0);o.position.copy(ladle.position).add(new T.Vector3(-.10-scoop.x,.40-scoop.bottom,.18-scoop.z));}
function release(o){scene.remove(o);o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());o.userData.texture?.dispose()}
async function load(e){const f=e.target.files[0];if(!f)return;const token=++serial;state='loading';ui();const url=URL.createObjectURL(f);try{const img=new Image();img.src=url;await img.decode();if(token!==serial)return;food=foodMesh(img);state='ready';ladle.visible=true;ui()}catch{state=count?'served':'idle';ui();$('status').textContent=w[lang].error}finally{URL.revokeObjectURL(url);e.target.value=''}}$('cameraInput').onchange=load;$('fileInput').onchange=load;
$('startGame').onclick=async()=>{if(started)return;started=true;window.MealSFX?.start();window.MealMusic?.start();state='intro';document.documentElement.classList.remove('prestart');ui();await model3d.beginIntro();state='idle';ui();};
$('feed').onclick=()=>{if(!started||state==='intro')return;if(count>=5){fullRequested=true;reactionVisible=true;ui();return}ui();$('picker').showModal()};$('camera').onclick=()=>{$('picker').close();$('cameraInput').click()};$('gallery').onclick=async()=>{
 $('picker').close();
 // Use a file-only picker where available. Mobile fallback has no camera capture hint.
 if(typeof window.showOpenFilePicker==='function'){
  try{const [handle]=await window.showOpenFilePicker({multiple:false,excludeAcceptAllOption:true,types:[{description:lang==='ko'?'이미지':'Images',accept:{'image/png':['.png'],'image/jpeg':['.jpg','.jpeg'],'image/webp':['.webp'],'image/gif':['.gif'],'image/avif':['.avif']}}]});
   if(handle)await load({target:{files:[await handle.getFile()],value:''}});return;
  }catch(error){if(error.name==='AbortError')return;}
 }
 $('fileInput').click();
};$('close').onclick=()=>$('picker').close();$('picker').onclick=e=>{if(e.target===$('picker')){const r=$('picker').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('picker').close()}};
function resetReaction(){clearReaction=false;fullRequested=false;reactionVisible=true;mood=0;variant=Math.floor(Math.random()*w[lang].say[0].length);facial()}
function chooseReaction(){clearReaction=false;fullRequested=false;
 {let r=Math.random()*expressionConfig.weights.reduce((a,b)=>a+b,0);mood=9;for(let i=0;i<10;i++){r-=expressionConfig.weights[i];if(r<0){mood=i;break}}}
 variant=Math.floor(Math.random()*w[lang].say[mood].length);reactionVisible=true;facial();}


function supportAt(o){let y=window.mealSurface(o.position.x,o.position.z),support=null;const box=MealContacts.box(o);for(const other of items){if(other===o)break;if(o.userData.body?.detached===other)continue;const delta=MealContacts.verticalSupport(box,MealContacts.box(other));if(delta===null)continue;const top=o.position.y+delta;if(top>y){y=top;support=other}}return {y,support}}

function spring(b,key,velocity,target,k,damp,dt){b[velocity]+=(target-b[key])*k*dt;b[velocity]*=Math.exp(-damp*dt);b[key]+=b[velocity]*dt}
function stepJellies(dt){const steps=3,h=dt/steps;for(let j=0;j<steps;j++){for(const o of items){const b=o.userData.body;if(!b)continue;b.flow??=0;b.flowV??=0;b.flowX??=1;b.flowZ??=0;b.cling??=0;b.ripple??=0;let support=supportAt(o);
 const load=items.filter(a=>a!==o&&a.userData.body?.support===o).length,compression=1-Math.min(.12,load*.035);
 if(support.support){const dx=b.x-support.support.position.x,dz=b.z-support.support.position.z,d=Math.hypot(dx,dz);
  if(d>.43){b.sliding=true;b.flowX=dx/d;b.flowZ=dz/d;b.cling+=h;const force=.65+(d-.43)*1.8;b.vx+=(dx/d)*force*h;b.vz+=(dz/d)*force*h;b.vx*=Math.exp(-h*2.4);b.vz*=Math.exp(-h*2.4);b.x+=b.vx*h;b.z+=b.vz*h;b.tx=b.x;b.tz=b.z;
   const atRim=Math.abs(b.x)>1.36||b.z<.92||b.z>1.59;if((d>.78||atRim)&&b.cling>.24){b.detached=support.support;support=supportAt(o);b.vy=Math.min(b.vy,-.16);}
  }else{b.sliding=false;spring(b,'x','vx',b.tx,32,8,h);spring(b,'z','vz',b.tz,32,8,h)}
 }else{b.sliding=false;b.vx*=Math.exp(-h*6);b.vz*=Math.exp(-h*6);b.x+=b.vx*h;b.z+=b.vz*h;b.tx=b.x;b.tz=b.z;}
 b.x=T.MathUtils.clamp(b.x,-1.4,1.4);b.z=T.MathUtils.clamp(b.z,1.6,2.0);o.position.x=b.x;o.position.z=b.z;b.support=support.support;
 const bendTarget=b.sliding?.85:(b.y>support.y+.045?.22:0);spring(b,'flow','flowV',bendTarget,32,11,h);b.ripple*=Math.exp(-h*3);if(b.y>support.y+.045){b.vy-=4.2*h;b.vy*=Math.exp(-h*.9);b.y+=b.vy*h;if(b.y<=support.y){b.y=support.y;b.vy=-b.vy*.08;b.squash=Math.min(b.squash,.86);b.vs-=.25;b.ripple=0;if(support.support?.userData.body)support.support.userData.body.vs-=.5;}}
 else spring(b,'y','vy',support.y,160,12,h);
 spring(b,'squash','vs',compression,85,12,h);const lean=support.support?T.MathUtils.clamp((b.x-support.support.position.x)*(b.sliding?.22:.1),-.12,.12):0;spring(b,'tilt','vt',lean,80,8,h);o.position.y=Math.max(window.mealSurface(o.position.x,o.position.z),b.y);const q=T.MathUtils.clamp(b.squash,.82,1.08);o.scale.set(1/Math.sqrt(q),q,1/Math.sqrt(q));o.rotation.z=b.tilt;o.rotation.x=Math.sin(b.tilt)*.35;
 }MealContacts.solve(items);}}

function refreshFoodCollider(o){const a=o.geometry.attributes.position.array,co=Math.cos(FOOD_TILT),si=Math.sin(FOOD_TILT),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<a.length;i+=3){const p=[a[i],a[i+1]*co+a[i+2]*si,-a[i+1]*si+a[i+2]*co];for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k])}}
 const c=lo.map((v,i)=>(v+hi[i])*.5),h=lo.map((v,i)=>(hi[i]-v)*.5+.008);
 o.userData.collider={center:[c[0],c[1]*co-c[2]*si,c[1]*si+c[2]*co],edges:[[h[0],0,0],[0,h[1]*co,h[1]*si],[0,-h[2]*si,h[2]*co]]};
}
function deformJellies(){for(const o of items){const b=o.userData.body,rest=o.userData.restVertices;if(!b||!rest)continue;
 const verts=o.geometry.attributes.position,a=verts.array,bend=T.MathUtils.clamp(b.flow||0,0,.9),radius=o.userData.radius||.66;
 // Bend the centerline into an arc instead of pulling vertices apart. Arc length is preserved.
 const angle=o.rotation.y||0,wx=b.flowX||0,wz=b.flowZ||0,dx=Math.cos(angle)*wx-Math.sin(angle)*wz,dz=Math.sin(angle)*wx+Math.cos(angle)*wz;
 const hinge=-radius*.1,curvature=bend*.20/radius,mid=(o.userData.height||.6)*.35;
 let minimum=Infinity;
 for(let i=0;i<a.length;i+=3){const x=rest[i],y=rest[i+1],z=rest[i+2],along=x*dx+z*dz,t=Math.max(0,along-hinge);
  if(curvature>.0001&&t>0){const theta=curvature*t,sn=Math.sin(theta),cs=Math.cos(theta);const shifted=sn/curvature-t+(y-mid)*sn;a[i]=x+dx*shifted;a[i+2]=z+dz*shifted;a[i+1]=mid+(y-mid)*cs+(cs-1)/curvature;}
  else{a[i]=x;a[i+1]=y;a[i+2]=z;}
  minimum=Math.min(minimum,a[i+1]);
 }
 // Lift the complete piece if its curled edge touches the tray; never flatten individual vertices.
 const floorLocal=(window.mealSurface(o.position.x,o.position.z)-o.position.y)/Math.max(.82,o.scale.y),lift=Math.max(0,floorLocal-minimum);
 if(lift>0)for(let i=1;i<a.length;i+=3)a[i]+=lift;
 verts.needsUpdate=true;refreshFoodCollider(o);
 }}

function land(f){const o=f.object;o.scale.setScalar(1);o.rotation.x=0;const contact=supportAt(o);o.position.y=contact.y;const side=count%2?-.1:.1;const b={x:o.position.x,y:contact.y,z:o.position.z,tx:T.MathUtils.clamp(o.position.x+side,-1.35,1.35),tz:T.MathUtils.clamp(o.position.z+(count%2?.035:-.035),1.75,1.95),vx:side*1.7,vy:-.55,vz:0,squash:.86,vs:.3,tilt:side*.6,vt:side*2,support:contact.support};o.userData.body=b;
 let parent=contact.support,impact=1;while(parent){const pb=parent.userData.body;if(!pb)break;pb.vs-=.65*impact;pb.vy-=.4*impact;pb.vx+=side*1.3*impact;pb.vt+=side*2*impact;parent=pb.support;impact*=.65;}
 items.push(o);f.landed=true;f.age=0;ladle.visible=false;ladle.rotation.set(0,0,0);count++;food=null;chooseReaction();splat();splash(o);ui();}
function drop(){if(!started||state!=='ready'||!food||count>=5)return;ladle.position.set(aim.x,Math.max(3.65,2.41+count*.495),aim.z);holdFood(food);state='falling';whoosh();fall={object:food,velocity:0,age:0,landed:false,ladleStart:ladle.position.clone()};ui()}


function whoosh(){window.MealSFX?.drop();}
function splat(){
 window.MealSFX?.impact();
 if(navigator.vibrate)navigator.vibrate(22);
}
const droplets=[];function splash(o){for(let i=0;i<9;i++){const d=ball(scene,o.position.x,o.position.y+.08,o.position.z,.045,.045,.045,mat('#d8bba7',.2));d.userData={vx:(Math.random()-.5)*2,vy:1+Math.random(),vz:(Math.random()-.5)*2,life:0};droplets.push(d)}}
$('clear').onclick=()=>{
 if(state==='clearing'||state==='falling'||state==='loading')return;
 const flying=[...items,...(food?[food]:[])];if(!flying.length)return;
 serial++;items=[];food=null;fall=null;count=0;ladle.visible=false;ladle.rotation.set(0,0,0);
 state='clearing';fullRequested=false;clearReaction=true;reactionVisible=true;mood=5;variant=0;facial();model3d?.startle();
 const phase=Math.random()*Math.PI*2;
 flying.forEach((o,i)=>{o.userData.body=null;const angle=phase+i*Math.PI*2/flying.length,speed=3.8+Math.random()*2;scattered.push({o,age:0,vx:Math.cos(angle)*speed,vy:4+Math.random()*2,vz:Math.sin(angle)*speed,spinX:(Math.random()-.5)*8,spinZ:(Math.random()-.5)*10});});
 window.MealSFX?.reset();ui();
};
function stepScatter(dt){
 for(let i=scattered.length-1;i>=0;i--){const f=scattered[i];f.age+=dt;f.vy-=13*dt;f.o.position.x+=f.vx*dt;f.o.position.y+=f.vy*dt;f.o.position.z+=f.vz*dt;f.o.rotation.x+=f.spinX*dt;f.o.rotation.z+=f.spinZ*dt;
  if(f.age>1.15){const shrink=Math.max(.001,1-(f.age-1.15)/.35);f.o.scale.setScalar(shrink);}
  if(f.age>=1.5){release(f.o);scattered.splice(i,1);}
 }
 if(state==='clearing'&&!scattered.length){state='idle';resetReaction();ui();}
}
$('lang').onclick=()=>{lang=lang==='ko'?'en':'ko';ui()};
const speechArt=new Image();speechArt.src='assets/font/말풍선.png';
function makeSnapshot(){
 renderer.render(scene,camera);const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const c=output.getContext('2d');c.drawImage(canvas,0,0);
 if(!$('speech').hidden){const rect=$('speech').getBoundingClientRect(),view=canvas.getBoundingClientRect(),scale=output.width/view.width,x=(rect.left-view.left)*scale,y=(rect.top-view.top)*scale,width=rect.width*scale,height=rect.height*scale,css=getComputedStyle($('speech'));
  if(speechArt.complete&&speechArt.naturalWidth)c.drawImage(speechArt,x,y,width,height);else{c.fillStyle='white';c.fillRect(x,y,width,height);}
  const size=parseFloat(css.fontSize)*scale,lineHeight=parseFloat(css.lineHeight)*scale,pad=parseFloat(css.paddingLeft)*scale,rightPad=parseFloat(css.paddingRight)*scale;c.font=size+'px MealPixel, monospace';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#17221a';
  const lines=[];let line='';for(const char of $('speech').textContent){if(line&&c.measureText(line+char).width>width-pad-rightPad){lines.push(line.trim());line=char;}else line+=char;}if(line)lines.push(line.trim());
  const textCenter=y+(height+parseFloat(css.paddingTop)*scale-parseFloat(css.paddingBottom)*scale)/2;lines.forEach((text,i)=>c.fillText(text,x+(width+pad-rightPad)/2,textCenter+(i-(lines.length-1)/2)*lineHeight));
 }
 // Synchronous encoding preserves the mobile share-sheet user gesture.
 const encoded=output.toDataURL('image/png').split(',')[1],bytes=Uint8Array.from(atob(encoded),v=>v.charCodeAt(0));return new Blob([bytes],{type:'image/png'});
}
$('save').onclick=async()=>{const button=$('save');button.disabled=true;try{
 const blob=makeSnapshot(),file=new File([blob],'super-jjang-lunch.png',{type:'image/png'});let canShare=false;try{canShare=matchMedia('(pointer:coarse)').matches&&!!navigator.share&&!!navigator.canShare?.({files:[file]});}catch{}
 if(canShare){try{await navigator.share({files:[file]});}catch(error){if(error.name==='AbortError')return;download(blob);}}
 else download(blob);$('status').textContent=w[lang].saved;
 }catch{$('status').textContent=w[lang].saveError;}finally{button.disabled=false;}};
function download(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='super-jjang-lunch.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.setFocalLength(150);camera.updateProjectionMatrix();fitBackdrop()}window.addEventListener('resize',resize);resize();ui();
function frame(t){const dt=Math.min((t-last)/1000,.04)||.016;last=t;time+=dt;model3d?.update(dt);stepScatter(dt);if(state==='ready'){ladle.position.set(aim.x,Math.max(3.65,2.41+count*.495),aim.z);holdFood(food)}if(fall){const f=fall;f.age+=dt;if(!f.landed){ladle.position.copy(f.ladleStart);ladle.rotation.set(1.15*(1-Math.exp(-f.age*7)),0,0);const withdraw=T.MathUtils.smoothstep(f.age,.12,.34);ladle.position.z-=withdraw*1.25;if(f.age>.34){const turn=T.MathUtils.smoothstep(f.age,.34,.62);f.object.rotation.x=T.MathUtils.lerp(f.object.userData.scoop.angle,0,turn);f.velocity+=8*dt;f.object.position.y-=f.velocity*dt;}const target=supportAt(f.object).y;if(f.object.position.y<=target)land(f)}else if(f.age>1.05){fall=null;state='served';ui()}}stepJellies(dt);deformJellies();MealContacts.solve(items);for(let i=droplets.length-1;i>=0;i--){const d=droplets[i],u=d.userData;u.life+=dt;u.vy-=7*dt;d.position.x+=u.vx*dt;d.position.y+=u.vy*dt;d.position.z+=u.vz*dt;d.scale.setScalar(Math.max(.001,.045*(1-u.life/.5)));if(u.life>.5){scene.remove(d);d.geometry.dispose();d.material.dispose();droplets.splice(i,1)}}model3d?.shadows([...items,...(food?[food]:[])],dt);renderer.render(scene,camera);requestAnimationFrame(frame)}requestAnimationFrame(frame);


if(new URLSearchParams(location.search).has('test'))window.mealTest={snapshot:()=>({...model3d.snapshot(),state,count,mood,started,aim:{...aim},ladlePosition:ladle.position.toArray(),scatterCount:scattered.length,scatterPositions:scattered.map(f=>f.o.position.toArray()),foodPosition:items.at(-1)?.position.toArray(),ladleRotation:ladle.rotation.toArray(),heldScale:food?.scale.toArray(),heldPosition:food?.position.toArray()}),expression:i=>model3d.expression(i),thumbnail:b=>{model3d.thumbnail(b);$('speech').hidden=b;document.querySelector('.controls').hidden=b;$('status').hidden=b},drop};
})();



