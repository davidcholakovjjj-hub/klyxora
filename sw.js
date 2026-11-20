const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((ch) => ch.charCodeAt(0)));
}

export async function enableLockScreenAlerts() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("Push notifications are not supported on this browser.", "error");
    return;
  }
  if (!me) {
    showToast("Sign in first to enable lock-screen alerts.", "error");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    showToast("Notification permission was not granted.", "error");
    return;
  }

  const reg = await navigator.serviceWorker.register("./sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: me.id,
      endpoint: sub.endpoint,
      subscription: json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) return showToast("Failed to save push subscription: " + errText(error), "error");
  showToast("Lock-screen call alerts enabled!", "success");
}

async function openIncomingCallById(callId) {
  if (!callId || !me || activeCall) return;
  const { data: call } = await sb
    .from("calls")
    .select("*")
    .eq("id", callId)
    .eq("status", "ringing")
    .maybeSingle();

  if (call && call.caller_id !== me.id && isFresh(call)) {
    presentIncomingCall(call);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "PIXIECHAT_OPEN_CALL" && event.data.callId) {
      openIncomingCallById(event.data.callId);
    }
  });
}
