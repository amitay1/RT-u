// Advanced Service Worker with comprehensive offline support
// Version 2.0.0 - Multi-tenant PWA with sync capabilities

const CACHE_VERSION = 'rtpt-inspector-v1.0.0';
const STATIC_CACHE = 'rtpt-inspector-static-v1';
const DYNAMIC_CACHE = 'rtpt-inspector-dynamic-v1';
const API_CACHE = 'rtpt-inspector-api-v1';
const OFFLINE_QUEUE = 'rtpt-inspector-offline-queue-v1';

// Static resources to cache on install
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  // Add more static assets as needed
];

// API routes that can be cached
const CACHEABLE_API_ROUTES = [
  '/api/standards',
  '/api/organizations',
  '/api/user-standard-access',
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static resources');
      return cache.addAll(STATIC_RESOURCES);
    }).then(() => {
      console.log('[SW] Service Worker installed successfully - waiting for user approval');
      // DO NOT auto skip waiting - wait for user to click update button
      // User will trigger skipWaiting via SKIP_WAITING message
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== STATIC_CACHE && 
                   cacheName !== DYNAMIC_CACHE && 
                   cacheName !== API_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - implement sophisticated caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  // Handle static assets
  if (request.destination === 'image' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'font') {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Handle API requests with network-first strategy and offline queue
async function handleAPIRequest(request) {
  try {
    // Try network first
    const response = await fetch(request.clone());
    
    // Cache successful GET requests
    if (request.method === 'GET' && response && response.status === 200) {
      const responseToCache = response.clone();
      const cache = await caches.open(API_CACHE);
      
      // Only cache specific API endpoints
      if (CACHEABLE_API_ROUTES.some(route => request.url.includes(route))) {
        await cache.put(request, responseToCache);
      }
    }
    
    return response;
  } catch (error) {
    // Network failed, check cache for GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('[SW] Serving API response from cache:', request.url);
        return cachedResponse;
      }
    }
    
    // For POST/PUT/DELETE, queue for later sync
    if (request.method !== 'GET') {
      await queueOfflineRequest(request);
      
      // Return a synthetic response
      return new Response(
        JSON.stringify({ 
          queued: true, 
          message: 'Request queued for sync when online' 
        }),
        { 
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Return offline error
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static resources with cache-first strategy
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Return cached response and update cache in background
    updateCacheInBackground(request);
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    // Return fallback for images
    if (request.destination === 'image') {
      return caches.match('/fallback-image.png');
    }
    throw error;
  }
}

// Handle navigation requests (HTML pages)
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    // Fall back to cached version
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fall back to offline page
    return caches.match('/index.html');
  }
}

// Update cache in background without blocking
async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response);
    }
  } catch (error) {
    console.log('[SW] Background cache update failed:', error);
  }
}

// Queue offline requests for later sync
async function queueOfflineRequest(request) {
  const queue = await getOfflineQueue();
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: request.method !== 'GET' ? await request.text() : null,
    timestamp: Date.now(),
  };
  
  queue.push(requestData);
  await saveOfflineQueue(queue);
  
  // Register for background sync if available
  if ('sync' in self.registration) {
    await self.registration.sync.register('offline-sync');
  }
}

// Get offline queue from IndexedDB
async function getOfflineQueue() {
  // In a real implementation, use IndexedDB
  // For simplicity, using cache storage here
  const cache = await caches.open(OFFLINE_QUEUE);
  const response = await cache.match('queue');
  
  if (response) {
    return await response.json();
  }
  
  return [];
}

// Save offline queue to IndexedDB
async function saveOfflineQueue(queue) {
  const cache = await caches.open(OFFLINE_QUEUE);
  const response = new Response(JSON.stringify(queue));
  await cache.put('queue', response);
}

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-sync') {
    console.log('[SW] Starting background sync...');
    event.waitUntil(syncOfflineRequests());
  }
});

// Sync queued offline requests
async function syncOfflineRequests() {
  const queue = await getOfflineQueue();
  const failedRequests = [];
  
  for (const requestData of queue) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body,
      });
      
      if (!response.ok) {
        failedRequests.push(requestData);
      }
    } catch (error) {
      console.error('[SW] Sync failed for request:', requestData.url);
      failedRequests.push(requestData);
    }
  }
  
  // Save failed requests back to queue
  await saveOfflineQueue(failedRequests);
  
  // Notify clients about sync completion
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      successful: queue.length - failedRequests.length,
      failed: failedRequests.length,
    });
  });
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      event.ports[0].postMessage({ cleared: true });
    });
  }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icon-96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-96.png'
      },
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('RT-PT Inspector', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[SW] Service Worker script loaded');
