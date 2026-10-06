// Retire the old browser-local download route.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{await caches.delete('frame-downloads-v1');await self.registration.unregister();})()));
