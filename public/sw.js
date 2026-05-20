// Fidevo Service Worker — handles push notifications
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch (_) { data = { title: 'Fidevo', body: event.data?.text() ?? '' }; }

  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/icon-192.png',
    badge:   '/badge-72.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/my-card' },
    actions: [
      { action: 'view', title: 'Voir ma carte' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Fidevo', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/my-card';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(url) && 'focus' in c);
      if (existing) return existing.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
