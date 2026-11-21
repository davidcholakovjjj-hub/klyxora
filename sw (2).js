// Must sit next to index.html (service workers cannot be created from inline code / blob URLs).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

// Server push: works with the tab closed or the phone locked
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === 'visible' && w.focused)) return; // app is open and shows its own UI
    const call = d.kind === 'call' || !!d.callId;
    const url = new URL('./', self.registration.scope);
    if (d.callId) url.searchParams.set('callId', d.callId);
    if (d.roomId) url.searchParams.set('roomId', d.roomId);
    await self.registration.showNotification(d.title || 'PIXIECHAT', {
      body: d.body || '',
      tag: call ? 'call' : 'msg-' + d.roomId,
      renotify: true,
      requireInteraction: call,
      vibrate: call ? [500, 200, 500, 200, 500, 200, 500] : [120],
      data: { url: url.toString(), roomId: d.roomId, callId: d.callId }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
    for (const c of list) {
      if ('focus' in c) {
        await c.focus();
        c.postMessage(data.callId ? { type: 'PIXIECHAT_OPEN_CALL', callId: data.callId } : { roomId: data.roomId });
        return;
      }
    }
    return clients.openWindow(data.url || './');
  }));
});

// Needed by some Chrome versions for the "Install app" option (does nothing else)
self.addEventListener('fetch', () => {});
