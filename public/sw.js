// MAINT-REL-1: Self-retiring service worker.
// Safely decommissions any previously installed service worker,
// purges application-owned kiosk cache, and unregisters itself.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.delete('kiosk-cache-v1')
            .then(() => self.registration.unregister())
            .then(() => self.clients.claim())
    );
});
