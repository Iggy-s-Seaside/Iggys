import { useEffect, useState } from 'react';
import { size, subscribeOnline } from '../lib/outbox';

/**
 * Number of writes currently queued in the offline outbox. Polls size() on a
 * short interval (the outbox is plain localStorage — no event to subscribe to),
 * re-reads when the connection returns, and on tab refocus. Used to reassure the
 * manager that a "Saved offline" write is still pending — or, when online but
 * non-zero, that a replay is in progress / stuck.
 */
export function useOutboxPending(): number {
  const [pending, setPending] = useState(() => size());

  useEffect(() => {
    const read = () => setPending(size());
    read();
    const interval = setInterval(read, 4000);
    const unsub = subscribeOnline(read);
    const onVisible = () => {
      if (document.visibilityState === 'visible') read();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return pending;
}
