import * as THREE from './vendor/three/three.module.js';

// A bounded mesh follows alpha, including holes and disconnected pieces.
// Distances from the cut edge give the face a soft, inflated profile.
export function buildImageRelief(pixels,cols,rows,aspect=cols/rows){
 const mask=new Uint8Array(cols*rows),dist=new Float32Array(mask.length);
 const inside=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&mask[y*cols+x];
 let occupied=0;
 for(let i=0;i<mask.length;i++){mask[i]=pixels[i*4+3]>=32?1:0;occupied+=mask[i];dist[i]=mask[i]?Math.min(i%cols+1,cols-i%cols,Math.floor(i/cols)+1,rows-Math.floor(i/cols)):0;}
 if(!occupied)throw new Error('This image is fully transparent.');
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(x)dist[i]=Math.min(dist[i],dist[i-1]+1);if(y)dist[i]=Math.min(dist[i],dist[i-cols]+1);if(x&&y)dist[i]=Math.min(dist[i],dist[i-cols-1]+Math.SQRT2);if(y&&x+1<cols)dist[i]=Math.min(dist[i],dist[i-cols+1]+Math.SQRT2);}
 for(let y=rows-1;y>=0;y--)for(let x=cols-1;x>=0;x--){const i=y*cols+x;if(x+1<cols)dist[i]=Math.min(dist[i],dist[i+1]+1);if(y+1<rows)dist[i]=Math.min(dist[i],dist[i+cols]+1);if(x+1<cols&&y+1<rows)dist[i]=Math.min(dist[i],dist[i+cols+1]+Math.SQRT2);if(x&&y+1<rows)dist[i]=Math.min(dist[i],dist[i+cols-1]+Math.SQRT2);}
 const width=1.6*Math.min(aspect,1),height=1.6/Math.max(aspect,1),stride=cols+1;
 const positions=[],uvs=[],indices=[],sidePositions=[],sideColors=[];
 let heights=new Float32Array((cols+1)*(rows+1));const interior=new Uint8Array(heights.length);
 for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
  let d=Infinity;
  for(const [dx,dy] of [[-1,-1],[0,-1],[-1,0],[0,0]])d=Math.min(d,inside(x+dx,y+dy)?dist[(y+dy)*cols+x+dx]:0);
  const i=y*stride+x;interior[i]=d>0?1:0;heights[i]=.17*Math.sin(Math.min(1,d/Math.max(1,Math.min(cols,rows)*.35))*Math.PI/2);
 }
 // Smooth the sampled profile so the light rolls over it instead of showing grid ridges.
 for(let pass=0;pass<6;pass++){const next=new Float32Array(heights.length);for(let y=1;y<rows;y++)for(let x=1;x<cols;x++){const i=y*stride+x;if(interior[i])next[i]=(heights[i]*4+heights[i-1]+heights[i+1]+heights[i-stride]+heights[i+stride])/8;}heights=next;}
 const depthAt=(x,y)=>.025+heights[y*stride+x];
 const point=(x,y,back=false)=>[(x/cols-.5)*width,(.5-y/rows)*height,back?-.025-(depthAt(x,y)-.025)*.32:depthAt(x,y)];
 const vertices=new Map();
 function vertex(x,y,back){const key=(y*stride+x)*2+Number(back);if(vertices.has(key))return vertices.get(key);const id=positions.length/3;vertices.set(key,id);positions.push(...point(x,y,back));uvs.push(x/cols,1-y/rows);return id;}
 function edge(ax,ay,bx,by,pixel){
  const a=point(ax,ay),b=point(bx,by),c=point(bx,by,true),d=point(ax,ay,true);
  sidePositions.push(...a,...c,...b,...a,...d,...c);
  const color=new THREE.Color().setRGB(pixels[pixel*4]/255,pixels[pixel*4+1]/255,pixels[pixel*4+2]/255,THREE.SRGBColorSpace);
  for(let i=0;i<6;i++)sideColors.push(color.r,color.g,color.b);
 }
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(inside(x,y)){
  const a=vertex(x,y,false),b=vertex(x+1,y,false),c=vertex(x+1,y+1,false),d=vertex(x,y+1,false);
  indices.push(a,c,b,a,d,c);
  const e=vertex(x,y,true),f=vertex(x+1,y,true),g=vertex(x+1,y+1,true),h=vertex(x,y+1,true);
  indices.push(e,f,g,e,g,h);
  const i=y*cols+x;
  if(!inside(x,y-1))edge(x,y,x+1,y,i);
  if(!inside(x+1,y))edge(x+1,y,x+1,y+1,i);
  if(!inside(x,y+1))edge(x+1,y+1,x,y+1,i);
  if(!inside(x-1,y))edge(x,y+1,x,y,i);
 }
 return {positions,uvs,indices,sidePositions,sideColors,occupied};
}

const reliefCache=new WeakMap();
export function createImagePrize(image){
 let cached=reliefCache.get(image);
 if(!cached){
  // Crop padding before sampling so a small cutout still has a smooth contour.
  const probe=document.createElement('canvas'),ratio=image.width/image.height;
  probe.width=Math.max(1,Math.round(512*Math.min(ratio,1)));probe.height=Math.max(1,Math.round(512/Math.max(ratio,1)));
  const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,probe.width,probe.height);
  const rgba=ctx.getImageData(0,0,probe.width,probe.height).data;
  let minX=probe.width,minY=probe.height,maxX=-1,maxY=-1;
  for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++)if(rgba[(y*probe.width+x)*4+3]>=32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(maxX<0)throw new Error('This image is fully transparent.');
  const sx=minX/probe.width*image.width,sy=minY/probe.height*image.height,sw=(maxX-minX+1)/probe.width*image.width,sh=(maxY-minY+1)/probe.height*image.height;
  const textureCanvas=document.createElement('canvas'),scale=Math.min(1,1536/Math.max(sw,sh));
  textureCanvas.width=Math.max(1,Math.round(sw*scale));textureCanvas.height=Math.max(1,Math.round(sh*scale));textureCanvas.getContext('2d').drawImage(image,sx,sy,sw,sh,0,0,textureCanvas.width,textureCanvas.height);
  const sample=document.createElement('canvas'),aspect=sw/sh;
  sample.width=Math.max(2,Math.round(112*Math.min(aspect,1)));sample.height=Math.max(2,Math.round(112/Math.max(aspect,1)));
  const sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(textureCanvas,0,0,sample.width,sample.height);
  const data=buildImageRelief(sc.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height,aspect);
  cached={data,textureCanvas};reliefCache.set(image,cached);
 }
 const {data,textureCanvas}=cached,group=new THREE.Group();
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));geo.setIndex(data.indices);geo.computeVertexNormals();
 const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:texture,roughness:.38,metalness:.04,alphaTest:.12,side:THREE.DoubleSide}));
 const sides=new THREE.BufferGeometry();sides.setAttribute('position',new THREE.Float32BufferAttribute(data.sidePositions,3));sides.setAttribute('color',new THREE.Float32BufferAttribute(data.sideColors,3));sides.computeVertexNormals();
 const edge=new THREE.Mesh(sides,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,side:THREE.DoubleSide}));
 face.castShadow=edge.castShadow=true;group.add(face,edge);group.userData.imageRelief=true;return group;
}
