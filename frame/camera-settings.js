// Samsung Internet also runs on other brands; identify the device model instead.
export function isSamsungPhone(ua, model='') {
 return /Android/i.test(ua) && /(?:\bSAMSUNG\b|\bSM-|\bGT-|\bSCH-|\bSGH-)/i.test(ua+' '+model);
}
export async function detectSamsungPhone(nav) {
 if(isSamsungPhone(nav.userAgent))return true;
 if(!/Android/i.test(nav.userAgent)||!nav.userAgentData?.getHighEntropyValues)return false;
 let timer;
 try {
  const hints=await Promise.race([nav.userAgentData.getHighEntropyValues(['model']),new Promise(resolve=>{timer=setTimeout(()=>resolve({}),600);})]);
  return isSamsungPhone(nav.userAgent,hints.model||'');
 }catch{return false;}finally{clearTimeout(timer);}
}
export function cameraConstraints(facing,samsung) {
 const video={facingMode:{ideal:facing},width:{ideal:720},height:{ideal:960},aspectRatio:{ideal:.75},frameRate:{ideal:24,max:30}};
 if(samsung&&facing==='user') {
  // Prefer native frames over browser cropping to the requested dimensions.
  video.resizeMode={ideal:'none'};
  delete video.aspectRatio;
 }
 return {audio:false,video};
}
export function cameraZoom(range,samsung,facing) {
 return samsung&&facing==='user'?range.min:Math.max(range.min,Math.min(1,range.max));
}
