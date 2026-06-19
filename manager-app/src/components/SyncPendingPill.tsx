import { ArrowUpCircle } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOutboxPending } from '../hooks/useOutboxPending';

/**
 * When the app is ONLINE but the offline outbox still has queued writes — i.e.
 * a replay is in progress or wedged — show a slim reassurance pill so changes
 * saved offline are never silently stranded. (The offline case is covered by
 * OfflineBanner; this is the "back online, still catching up" signal.)
 */
export function SyncPendingPill() {
  const online = useOnlineStatus();
  const pending = useOutboxPending();
  if (!online || pending <= 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-fit items-center gap-2 px-3 py-1.5 mb-4 rounded-lg bg-accent/10 text-accent text-xs font-medium"
    >
      <ArrowUpCircle size={14} className="shrink-0" aria-hidden="true" />
      Syncing {pending} change{pending === 1 ? '' : 's'}&hellip;
    </div>
  );
}

export default SyncPendingPill;
