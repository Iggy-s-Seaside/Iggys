/*
 * registerSW — conservative service-worker registration for the manager PWA.
 *
 * Pairs with /public/sw.js (a hand-rolled, network-first worker — vite-plugin-pwa
 * is NOT a dependency). Design goals, in order:
 *   1. NEVER brick the app. The SW is network-first for navigations, so a fresh
 *      deploy is always picked up online. If registration itself fails, the app
 *      still runs exactly as before (no SW === normal web app).
 *   2. Auto-update. When a new worker is found and takes control, reload once so
 *      users get the latest build without a manual hard-refresh.
 *   3. Dev-safe. We only register in production builds; in `vite` dev we actively
 *      UNREGISTER any stale worker so HMR is never shadowed by a cached shell.
 *
 * Call once from main.tsx: `registerSW()`.
 */

const SW_URL = '/sw.js';

/** Tear down any existing worker + caches (used in dev, or for a manual reset). */
export async function unregisterSW(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn('[pwa] unregister failed:', err);
  }
}

export function registerSW(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // In dev, a registered SW + cached shell would mask Vite HMR. Strip it.
  if (import.meta.env.DEV) {
    void unregisterSW();
    return;
  }

  // Register after load so the SW never competes with first paint / app bootstrap.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        // Periodically check for a new deploy while a long-lived tab stays open
        // (e.g. a manager leaving the dashboard up all shift).
        const ONE_HOUR = 60 * 60 * 1000;
        setInterval(() => {
          registration.update().catch(() => {});
        }, ONE_HOUR);

        // A new worker has been found and is installing.
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // Installed + an existing controller === this is an UPDATE (not first
            // install). Ask it to activate immediately; the controllerchange
            // handler below performs the one-time reload.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => {
        // Registration failure is non-fatal — the app runs without the SW.
        console.warn('[pwa] service worker registration failed:', err);
      });

    // When the active worker changes (after SKIP_WAITING), reload exactly once so
    // the page is controlled by the newest build. The guard prevents reload loops.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
