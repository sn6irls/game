// Copy the displayed WebGL frame before any asynchronous image encoding.
// Include supplied scene overlays (speech, statistics, prize label); controls stay out.
export async function captureGameFrame(canvas,overlays){
 const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
 const ctx=output.getContext('2d');ctx.drawImage(canvas,0,0);
 const bounds=canvas.getBoundingClientRect(),wrapper=document.createElement('div');
 wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
 wrapper.style.cssText=`position:relative;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;`;
 function copyStyles(source,target){
  const style=getComputedStyle(source);for(const key of style)target.style.setProperty(key,style.getPropertyValue(key));
  target.style.animation='none';target.style.transition='none';target.style.filter='none';
  [...source.children].forEach((child,i)=>copyStyles(child,target.children[i]));
 }
 for(const element of overlays){
  if(!element||getComputedStyle(element).display==='none')continue;
  const clone=element.cloneNode(true);copyStyles(element,clone);
  const parent=element.offsetParent?.getBoundingClientRect()||{left:0,top:0};
  clone.style.position='absolute';clone.style.left=`${parent.left+element.offsetLeft-bounds.left}px`;clone.style.top=`${parent.top+element.offsetTop-bounds.top}px`;
  clone.style.right='auto';clone.style.bottom='auto';wrapper.append(clone);
 }
 // SVG images cannot fetch external files when decoded as an Image. Embed the
 // user's transparent bubble and UI atlas so the saved frame keeps the artwork.
 const embedded=new Map();
 async function dataURL(url){const resolved=new URL(url,document.baseURI).href;if(!embedded.has(resolved)){const blob=await (await fetch(resolved)).blob();embedded.set(resolved,await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);}));}return embedded.get(resolved);}
 for(const image of wrapper.querySelectorAll('img,image')){const attr=image.localName==='image'?'href':'src',url=image.getAttribute(attr);if(url&&!url.startsWith('data:'))image.setAttribute(attr,await dataURL(url));}
 const font=document.createElement('style');font.textContent=`@font-face{font-family:GachaPixel;src:url('${await dataURL('./asset/neodgm.woff2')}') format('woff2');font-weight:400}`;wrapper.prepend(font);
 const markup=new XMLSerializer().serializeToString(wrapper);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
 const layer=new Image();layer.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await layer.decode();
 ctx.drawImage(layer,0,0,output.width,output.height);return output;
}
