/*
 * Iggy's Manager — Service Worker (hand-rolled, conservative).
 *
 * vite-plugin-pwa is NOT a dependency of this app (checked package.json), so this
 * is a minimal hand-rolled worker. The ONE rule that matters: never serve a stale
 * app shell. A cache-first strategy on navigations or the JS bundle can brick the
 * app after a deploy (users stuck on an old index.html that references hashed asset
 * filenames that no longer exist). So:
 *
 *   - NAVIGATIONS (mode === 'navigate'): NETWORK-FIRST. Always try the network for
 *     index.html; only fall back to a cached shell when truly offline. This means a
 *     fresh deploy is picked up on the next online navigation — no stale shell.
 *
 *   - HASHED STATIC ASSETS under /assets/ (Vite emits content-hashed filenames):
 *     cache-first is SAFE here because the filename changes when the content changes,
 *     so a cached copy can never be stale. We stale-while-revalidate to self-heal.
 *
 *   - ICONS / manifest: cache-first with background refresh (cheap, rarely change).
 *
 *   - EVERYTHING ELSE (Supabase API, auth, edge functions, cross-origin, non-GET):
 *     NOT touched — passes straight through to the network. The SW must never sit in
 *     front of the data layer.
 *
 * Update flow: a new SW skipWaiting()s and clients.claim()s immediately so the newest
 * worker controls open tabs without a manual reload. registerSW.ts also listens for
 * `updatefound` and reloads once the new worker activates.
 *
 * Bump CACHE_VERSION on any change to this file to evict old caches.
 */

const CACHE_VERSION = 'iggys-mgr-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

// Minimal precache: just the shell + icons. We deliberately do NOT precache the
// hashed JS/CSS bundle (their names are unknown at SW-install time and they are
// cached lazily + safely below).
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  // Take over as soon as installed — no waiting for old tabs to close.
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // addAll fails atomically if any URL 404s; add individually so one bad
        // asset can't block the whole install.
        Promise.allSettled(SHELL_URLS.map((u) => cache.add(u)))
      )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Evict caches from older versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Allow the page to force activation of a freshly installed worker.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isHashedAsset(url) {
  // Vite emits content-hashed files under /assets/. Safe to cache-first.
  return url.origin === self.location.origin && url.pathname.startsWith('/assets/');
}

function isStaticIcon(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname === '/manifest.webmanifest' ||
      /\.(png|svg|ico|webp)$/.test(url.pathname))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET. Everything else (Supabase REST/realtime/auth,
  // edge functions, POSTs, cross-origin) goes straight to the network untouched.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1) NAVIGATIONS → network-first (never a stale shell).
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // Keep the shell fallback fresh for offline use — but never cache an
          // error/redirect (non-2xx) response as the offline shell, or an
          // offline user could be served a cached error page.
          if (fresh && fresh.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put('/', fresh.clone());
          }
          return fresh;
        } catch {
          // Offline: serve the last good shell, then the precached root.
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match('/')) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // 2) HASHED ASSETS → cache-first (filename == content hash ⇒ never stale),
  //    with a background revalidate to self-heal a partial cache.
  if (isHashedAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((resp) => {
            if (resp && resp.ok) cache.put(request, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
    return;
  }

  // 3) ICONS / manifest → stale-while-revalidate (cheap, rarely change).
  if (isStaticIcon(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((resp) => {
            if (resp && resp.ok) cache.put(request, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
    return;
  }

  // 4) Anything else same-origin → network, falling back to cache only if present.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// ── Web Push (display side) ──────────────────────────────────────────────────
// The web-push edge function (supabase/functions/web-push) sends notifications to
// subscriptions stored in push_subscriptions. This worker renders them. Sending is
// gated behind VAPID keys that are intentionally absent until configured, so in
// practice these handlers are dormant until push is wired up.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Iggy's Manager", body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || "Iggy's Manager";
  const options = {
    body: payload.body || '',
    icon: '/apple-touch-icon.png',
    badge: '/favicon-32x32.png',
    tag: payload.tag || 'iggys-mgr',
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
