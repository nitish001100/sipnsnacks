/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// This file MUST be at the root of public/ for Firebase to find it

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config - will be overridden by frontend but needed for SW init
firebase.initializeApp({
  apiKey: 'PLACEHOLDER',
  authDomain: 'PLACEHOLDER',
  projectId: 'PLACEHOLDER',
  storageBucket: 'PLACEHOLDER',
  messagingSenderId: 'PLACEHOLDER',
  appId: 'PLACEHOLDER',
});

const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const title = payload.notification?.title || payload.data?.title || '🔔 New Order!';
  const body = payload.notification?.body || payload.data?.body || 'A new order has been received in kitchen';

  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'kitchen-order',
    renotify: true,
    data: {
      url: '/kitchen',
    },
  };

  self.registration.showNotification(title, options);
});

// Handle notification click - open kitchen page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/kitchen';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes('/kitchen') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});

// Basic cache for offline support
const CACHE_NAME = 'kitchen-v1';
const STATIC_ASSETS = ['/kitchen', '/logo.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
