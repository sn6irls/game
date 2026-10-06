import { GIFEncoder } from './vendor/gifenc.js';
let gif, count = 0;
const palette = Array.from({length:256},(_,i)=>[Math.round((i>>5)*255/7),Math.round(((i>>2)&7)*255/7),Math.round((i&3)*255/3)]);
self.onmessage=({data})=>{
 try {
  if(data.type==='start'){gif=GIFEncoder();count=0;}
  if(data.type==='frame' && gif){
   const rgba=new Uint8ClampedArray(data.buffer), indexed=new Uint8Array(data.width*data.height);
   for(let i=0,j=0;i<indexed.length;i++,j+=4) indexed[i]=(rgba[j]&224)|((rgba[j+1]&224)>>3)|(rgba[j+2]>>6);
   gif.writeFrame(indexed,data.width,data.height,{palette:count===0?palette:undefined,delay:100,repeat:0});count++;
  }
  if(data.type==='finish' && gif){gif.finish();const bytes=gif.bytes();self.postMessage({type:'done',bytes,count},[bytes.buffer]);gif=null;}
 }catch(e){self.postMessage({type:'error',message:e.message});gif=null;}
};
