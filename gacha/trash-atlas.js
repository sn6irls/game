// Pixel bounds in the user's unchanged transparent 1240 × 812 atlas.
// Two contact lenses are one prize; all other objects have their own silhouette.
export const TRASH_CROPS={
 tissue:[14,8,296,214],capsule:[318,13,172,172],curler:[527,36,273,180],kelp:[909,33,306,206],
 gimbap:[2,228,282,204],lenses:[295,198,321,238],hairball:[642,235,192,182],anchovy:[839,243,273,270],banana:[28,431,419,202]
};
export function cropTrash(atlas,id){
 const [x,y,w,h]=TRASH_CROPS[id],canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 canvas.getContext('2d').drawImage(atlas,x,y,w,h,0,0,w,h);return canvas;
}
