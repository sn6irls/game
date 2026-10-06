// Download responses are created entirely on this device, never uploaded.
const CACHE='frame-downloads-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL('./download/',self.location).pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),response=await cache.match(url.href);
  return response||new Response('촬영 파일이 만료됐어요. 다시 촬영해주세요.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 })());
});
