import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface ErrorStateProps {
  /** Headline — what failed. Defaults to a connection-flavoured message. */
  title?: string;
  /** A friendly line of context under the title. */
  description?: string;
  /** Called when the manager taps "Try again" — re-run the data fetch. */
  onRetry?: () => void;
  /** Label for the retry button. */
  retryLabel?: string;
  /** Use the WifiOff glyph instead of the warning triangle (offline-flavoured). */
  offline?: boolean;
  /** Extra classes for the wrapping card (e.g. tighter padding inside a widget). */
  className?: string;
}

/**
 * The app's standard load-failure state — distinct from EmptyState so a network
 * hiccup never reads as "your data was deleted". Mirrors EmptyState's centered,
 * muted card; adds a danger-tinted glyph and a retry affordance.
 */
export function ErrorState({
  title = "Couldn't load — check your connection",
  description = 'Something went wrong fetching this. Your data is safe.',
  onRetry,
  retryLabel = 'Try again',
  offline = false,
  className,
}: ErrorStateProps) {
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className={`card p-12 text-center animate-fade-in ${className ?? ''}`} role="alert">
      <Icon size={40} className="mx-auto text-danger mb-3" aria-hidden="true" />
      <p className="text-text-secondary font-medium">{title}</p>
      {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
      {onRetry && (
        <div className="mt-4">
          <button onClick={onRetry} className="btn-secondary inline-flex">
            <RefreshCw size={16} /> {retryLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
