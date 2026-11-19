import * as THREE from './vendor/three/three.module.js';

// A sharp printed insert fitted to the scanned price holder. Every grid point
// follows the actual mesh; the label shares the cabinet's depth and movement.
export function installMachinePrice(machine,renderer){
 const paper=document.createElement('canvas');paper.width=1024;paper.height=256;
 const ctx=paper.getContext('2d');ctx.fillStyle='#eeeadd';ctx.fillRect(0,0,1024,256);
 ctx.strokeStyle='#a6aaa1';ctx.lineWidth=3;ctx.strokeRect(4,4,1016,248);
 ctx.fillStyle='#173e60';ctx.font='600 218px Georgia, "Times New Roman", serif';ctx.textBaseline='middle';
 const label='₩4,000',width=ctx.measureText(label).width;ctx.save();ctx.translate(512,134);ctx.scale(954/width,1);ctx.fillText(label,-width/2,0);ctx.restore();
 const texture=new THREE.CanvasTexture(paper);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const corners=[
  [.3981986825,.7550663625,.0098574159],
  [.4528865364,.7572460747,.0729013224],
  [.4518106936,.7394468222,.0676672367],
  [.3990159092,.7375589674,.0065574024]
 ].map(p=>new THREE.Vector3(...p));
 const center=corners.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(.25);
 for(const p of corners)p.sub(center).multiplyScalar(1.10).add(center);
 const outward=new THREE.Vector3(-.756,0,.655).normalize(),ray=new THREE.Raycaster(),positions=[],uv=[],indices=[];
 const columns=28,rows=8,normalMatrix=new THREE.Matrix3();machine.updateWorldMatrix(true,true);normalMatrix.getNormalMatrix(machine.matrixWorld);
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
  const u=x/columns,v=y/rows,top=corners[0].clone().lerp(corners[1],u),bottom=corners[3].clone().lerp(corners[2],u),point=top.lerp(bottom,v);
  ray.set(point.clone().addScaledVector(outward,.025),outward.clone().negate());ray.far=.05;
  const hit=ray.intersectObject(machine,false)[0],normal=hit?hit.face.normal.clone().applyNormalMatrix(normalMatrix):outward;
  if(normal.dot(outward)<0)normal.negate();
  if(hit)point.copy(hit.point);point.addScaledVector(normal,.00045);machine.worldToLocal(point);positions.push(...point.toArray());uv.push(u,1-v);
  if(x<columns&&y<rows){const a=y*(columns+1)+x,b=a+1,c=a+columns+1,d=c+1;indices.push(a,c,b,b,c,d);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
 const decal=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
 decal.name='price-4000';machine.add(decal);return decal;
}
