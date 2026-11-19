import './eye-detection.js?v=20261119';
let loading;
function loadVision() {
 if (!loading) loading = new Promise((resolve,reject)=>{
  // The bundled MediaPipe build is CommonJS. Expose exports only while loading.
  const previous=globalThis.exports,vision={};globalThis.exports=vision;
  const script=document.createElement('script');script.src=new URL('./vendor/mediapipe/vision_bundle.js',import.meta.url).href;
  const restore=()=>{if(previous===undefined)delete globalThis.exports;else globalThis.exports=previous;script.remove();};
  script.onload=()=>{restore();resolve(vision);};
  script.onerror=()=>{restore();loading=null;reject(Error('Lens model library could not load'));};
  document.head.append(script);
 });
 return loading;
}
export async function createMainDetector() {
 const vision=await loadVision();
 return globalThis.createLensDetector(vision,document.createElement('canvas'),import.meta.url);
}
