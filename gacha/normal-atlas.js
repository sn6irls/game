// Individual cutouts from the user's unchanged transparent 1240 × 812 sheet.
// The two glitter-glue tubes form one prize. No placeholder art is generated.
export const NORMAL_CROPS={
 gum:[52,38,393,339],book:[516,90,287,337],mini:[893,49,234,311],
 glue:[20,421,393,386],beef:[432,474,390,310]
};
export function cropNormal(atlas,id){
 const [x,y,w,h]=NORMAL_CROPS[id],canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 canvas.getContext('2d').drawImage(atlas,x,y,w,h,0,0,w,h);return canvas;
}
