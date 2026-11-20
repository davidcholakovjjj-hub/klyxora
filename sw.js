// Place next to index.html. Lets notifications work on Android Chrome and handles taps.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const roomId = e.notification.data && e.notification.data.roomId;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { c.postMessage({ roomId }); if ('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
