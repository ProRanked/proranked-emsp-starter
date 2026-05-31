// Web-push subscription helper. The app holds only the VAPID *public* key; the private
// key lives on the server and is used to sign pushes. Subscribing hands the browser's
// push endpoint + keys to the backend so it can deliver notifications when the app is closed.

const VAPID_PUBLIC_KEY = 'BFWKkczPLGq-LikoeS1Mr_woUO8DqSmn77AUW-WSfWD_qiWuDhMfczHu2UGu3fXNC9qIc_yrUsQ2Zm43dqDokfE';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

interface PushClient {
  subscribePush(subscription: unknown): Promise<unknown>;
}

/**
 * Subscribe this device to web push and register the subscription with the backend.
 * Best-effort: returns false (never throws) when unsupported, not permitted, or on error.
 * Requires notification permission to already be granted.
 */
export async function subscribeToPush(client: PushClient): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
    }
    await client.subscribePush(sub.toJSON());
    return true;
  } catch {
    return false;
  }
}
