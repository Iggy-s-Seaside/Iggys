import { useEffect, useState } from 'react';

/**
 * Tracks the browser's online/offline state.
 *
 * Seeds from `navigator.onLine` and stays in sync via the `online` / `offline`
 * window events. SSR / non-browser environments default to `true` (assume
 * online) so nothing flashes an offline state before hydration.
 *
 * Note: `navigator.onLine` only knows whether the device has a network
 * interface up — it can be `true` on a captive-portal / dead-uplink connection.
 * Good enough for an awareness banner; a later wave can add a real reachability
 * ping + write-outbox.
 *
 * @returns `true` when the browser reports it is online.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Re-sync on mount in case the state changed before listeners attached.
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export default useOnlineStatus;
