// Pixel-registered to the existing head UVs; the sheet is not a uniform grid.
// The bottom faces match the original facial landmarks at y + 508, not 512/518.
export const FACE_IDS={neutral:1,blink:2,joy:3,crying:4,teary:5,exhausted:6,sulking:7,ambivalent:8};
export const FACE_OFFSETS=[[0,0],[430,0],[904,0],[1369,0],[0,508],[430,508],[904,508],[1369,508]];
export function applyFaceFrame(texture,id){
 const frame=FACE_OFFSETS[id-1];if(!frame)throw new Error('Unknown face frame: '+id);
 texture.repeat.set(1,1);texture.offset.set(frame[0]/2048,frame[1]/1024);texture.updateMatrix();
}
