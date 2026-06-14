import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/*
 * usePushSubscription — client side of the manager PWA's Web Push channel.
 *
 * The plumbing already exists: /public/sw.js renders `push`/`notificationclick`
 * events, the `push_subscriptions` table stores endpoints, and the `web-push`
 * edge function sends to them (gated behind VAPID secrets, so it's a no-op until
 * configured). The one missing piece was the browser actually *subscribing* — that
 * is this hook.
 *
 * SAFE BY DEFAULT: sending stays off until VAPID secrets are set on the server, and
 * subscribing here is gated behind VITE_VAPID_PUBLIC_KEY. When that env var is
 * absent the hook reports `supported: false` (configured: false) and `enable()` is a
 * clean no-op — it NEVER throws. Nothing happens until the operator opts in by
 * setting the key, granting permission, and tapping the toggle.
 *
 * Flow on enable():
 *   1. Ask for Notification permission (browser prompt).
 *   2. Wait for the service worker to be ready, then
 *      registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }).
 *   3. Upsert { endpoint, p256dh, auth, user_email, user_agent } into
 *      push_subscriptions (onConflict: endpoint — re-subscribing is idempotent).
 *
 * disable() unsubscribes the browser and removes the matching row.
 */

const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/** Browser supports the Web Push primitives we need (independent of VAPID config). */
function browserSupportsPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Convert a base64url VAPID public key into the binary `applicationServerKey` the
 * Push API expects. Returns the raw ArrayBuffer (a valid BufferSource) or null if the
 * key is malformed, so enable() can bail gracefully rather than throw.
 */
function urlBase64ToBuffer(base64String: string): ArrayBuffer | null {
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output.buffer;
  } catch {
    return null;
  }
}

/** Pull the { endpoint, p256dh, auth } a server needs out of a PushSubscription. */
function subscriptionToRow(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  };
}

export interface UsePushSubscription {
  /** True when the browser supports push AND VITE_VAPID_PUBLIC_KEY is configured. */
  supported: boolean;
  /** True when the browser supports push but the VAPID key is not configured. */
  needsConfig: boolean;
  /** Current Notification permission ('default' | 'granted' | 'denied'). */
  permission: NotificationPermission;
  /** True when this device currently has an active push subscription. */
  subscribed: boolean;
  /** True while enable()/disable() is in flight. */
  busy: boolean;
  /** Turn on notifications for this device. Resolves to the resulting state. */
  enable: () => Promise<{ ok: boolean; reason?: string }>;
  /** Turn off notifications for this device. Resolves to the resulting state. */
  disable: () => Promise<{ ok: boolean; reason?: string }>;
}

export function usePushSubscription(): UsePushSubscription {
  const { user } = useAuth();

  const browserOk = browserSupportsPush();
  const configured = !!VAPID_PUBLIC_KEY;
  const supported = browserOk && configured;
  const needsConfig = browserOk && !configured;

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    browserOk ? Notification.permission : 'default',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // On mount, reflect whether this device is already subscribed so the toggle shows
  // the true state. Cheap, read-only, and never throws.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!existing);
      } catch {
        if (!cancelled) setSubscribed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!browserOk) return { ok: false, reason: 'unsupported' };
    if (!configured || !VAPID_PUBLIC_KEY) return { ok: false, reason: 'not configured' };
    if (busy) return { ok: false, reason: 'busy' };

    const applicationServerKey = urlBase64ToBuffer(VAPID_PUBLIC_KEY);
    if (!applicationServerKey) return { ok: false, reason: 'invalid key' };

    setBusy(true);
    try {
      // 1) Permission. requestPermission() resolves with the final state.
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        return { ok: false, reason: perm === 'denied' ? 'permission denied' : 'permission dismissed' };
      }

      // 2) Subscribe via the active service worker. Reuse an existing subscription if
      //    one is already present (idempotent re-enable).
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));

      // 3) Persist. onConflict: endpoint makes repeated subscribes a clean upsert.
      const row = subscriptionToRow(subscription);
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          ...row,
          user_email: user?.email ?? null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
        { onConflict: 'endpoint' },
      );
      if (error) {
        // Roll back the browser-side subscription so state stays truthful — if we
        // couldn't store it, the server can never reach this device anyway.
        try { await subscription.unsubscribe(); } catch { /* best effort */ }
        return { ok: false, reason: error.message };
      }

      setSubscribed(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'subscribe failed' };
    } finally {
      setBusy(false);
    }
  }, [browserOk, configured, busy, user?.email]);

  const disable = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!browserOk) return { ok: false, reason: 'unsupported' };
    if (busy) return { ok: false, reason: 'busy' };

    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const { endpoint } = subscriptionToRow(subscription);
        // Remove the row first so a dropped network on the unsubscribe still leaves
        // the server unable to push (no orphaned live endpoint).
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        if (error) return { ok: false, reason: error.message };
        try { await subscription.unsubscribe(); } catch { /* best effort */ }
      }
      setSubscribed(false);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'unsubscribe failed' };
    } finally {
      setBusy(false);
    }
  }, [browserOk, busy]);

  return { supported, needsConfig, permission, subscribed, busy, enable, disable };
}
