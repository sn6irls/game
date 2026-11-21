// Render the current guestbook page as a PNG without exporting private data files.
async function saveGuestbookImage(entries,page,pages){
 const english=I18N.get()==='en',title=english?'Guestbook':'방명록';
 await document.fonts.ready;await document.fonts.load('24px Galmuri11');await document.fonts.load('bold 24px Galmuri11');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),width=960,pad=42,lineHeight=36;
 const font="24px 'Galmuri11', sans-serif";ctx.font=font;
 function wrap(text){const lines=[];for(const paragraph of String(text).split('\n')){let line='';for(const char of paragraph){if(line&&ctx.measureText(line+char).width>width-pad*2){lines.push(line);line=char;}else line+=char;}lines.push(line);}return lines;}
 const blocks=entries.map(entry=>({entry,lines:wrap(entry.msg)}));
 canvas.width=width;canvas.height=Math.max(310,120+blocks.reduce((sum,block)=>sum+66+block.lines.length*lineHeight,0)+70);
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,canvas.height);ctx.fillStyle='#155bca';ctx.fillRect(0,0,width,68);ctx.fillStyle='#ffffff';ctx.font="bold 28px 'Galmuri11', sans-serif";ctx.textBaseline='top';ctx.fillText(title,pad,20);
 ctx.font=font;let y=104;
 for(const {entry,lines}of blocks){
  ctx.fillStyle='#17488d';ctx.font="bold 24px 'Galmuri11', sans-serif";ctx.fillText(entry.name,pad,y);
  if(entry.date){ctx.fillStyle='#747474';ctx.font="18px 'Galmuri11', sans-serif";ctx.textAlign='right';ctx.fillText(entry.date,width-pad,y+4);ctx.textAlign='left';}
  y+=42;ctx.fillStyle='#172331';ctx.font=font;for(const line of lines){ctx.fillText(line,pad,y);y+=lineHeight;}
  y+=12;ctx.strokeStyle='#dedede';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(width-pad,y);ctx.stroke();y+=12;
 }
 ctx.fillStyle='#ece9d8';ctx.fillRect(0,canvas.height-54,width,54);ctx.fillStyle='#4b5664';ctx.font="18px 'Galmuri11', sans-serif";ctx.textAlign='right';ctx.fillText(`${page+1} / ${pages}`,width-pad,canvas.height-37);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG export failed')),'image/png'));
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${english?'guestbook':'방명록'}-${page+1}.png`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
