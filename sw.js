const CACHE_NAME = '8-ball-pool-dynamic-cache-v3';
const version = 'v1.985';

let lastRequestTime = Date.now();

// Installs the service worker and activates it immediately.
self.addEventListener('install', event => {
    self.skipWaiting();
});

// Activates the new service worker, cleans non-static assets from the cache, and notifies clients to reload.
self.addEventListener('activate', event => {
    const cleanupAndNotifyClients = async () => {
        try {
            const cacheNames = await caches.keys();
            const cleanupPromises = cacheNames.map(async (cacheName) => {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();
                const deletePromises = requests.map(async (request) => {
                    const url = new URL(request.url);
                    if (!url.hostname.includes('static')) {
                        await cache.delete(request);
                    }
                });
                await Promise.all(deletePromises);
            });
            await Promise.all(cleanupPromises);

            await self.clients.claim();
            const clientsArr = await self.clients.matchAll({
                type: 'window'
            });
            clientsArr.forEach(client => {
                client.postMessage({
                    type: 'SW_UPDATED'
                });
            });

        } catch (error) { // Intentionally silent in production.
        }
    }

    event.waitUntil(cleanupAndNotifyClients());
});

// Handles network requests using a cache-first strategy, excluding analytics and tracking scripts.
self.addEventListener('fetch', event => {
    lastRequestTime = Date.now();
    if (event.request.method !== 'GET' || !event.request.url.includes('static')) {
        return;
    }

    const respond = async () => {
        if (event.request.url.includes('game.wasm')) {
            await new Promise(resolve => {
                const checkIdle = () => {
                    if (Date.now() - lastRequestTime >= 1000) {
                        resolve();
                    } else {
                        setTimeout(checkIdle, 100);
                    }
                };
                checkIdle();
            });
        }

        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
            return cachedResponse;
        }
        const networkResponse = await fetch(event.request);
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.status !== 0)) {
            return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, responseToCache);
        return networkResponse;
    }

    event.respondWith(respond());
});

