import { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Slim, on-brand awareness banner shown while the browser reports it is
 * offline. Dismissible for the current offline stint; reappears the next time
 * the connection drops so the warning is never permanently silenced.
 *
 * Rendered at the top of the content flow (not fixed) so it never collides with
 * the mobile hamburger bar or the bottom nav. Auto-hides the moment the
 * connection returns.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Clear the dismissal once we're back online, so a fresh drop shows it again.
  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);

  if (online || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 mb-4 rounded-lg border border-amber-500/40 bg-accent/10 text-text-primary text-sm"
    >
      <WifiOff size={16} className="shrink-0 text-accent" aria-hidden="true" />
      <span className="flex-1 min-w-0">
        You&rsquo;re offline &mdash; changes may not save.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline notice"
        className="shrink-0 -mr-1 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export default OfflineBanner;
