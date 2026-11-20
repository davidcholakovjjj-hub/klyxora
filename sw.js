self.addEventListener("push", (event) => {
  let payload = {
    title: "PIXIECHAT // Incoming Call",
    body: "Incoming call — tap to answer.",
    callId: "",
    mode: "video",
    url: "./",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (_) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const targetUrl = payload.callId
    ? `./?callId=${encodeURIComponent(payload.callId)}`
    : payload.url || "./";

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: "pixiechat-incoming-call",
      renotify: true,
      requireInteraction: true,
      vibrate: [600, 200, 600, 200, 600],
      data: { url: targetUrl, callId: payload.callId || "" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({
            type: "PIXIECHAT_OPEN_CALL",
            callId: event.notification.data?.callId || "",
            url: targetUrl,
          });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
