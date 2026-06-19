import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Optional lucide icon, rendered muted and centered above the title. */
  icon?: LucideIcon;
  /** The headline — what's empty or done (e.g. "No invoices yet"). */
  title: string;
  /** A friendly line of context under the title. */
  description?: string;
  /** Optional call-to-action, typically a <button className="btn-primary inline-flex">. */
  action?: ReactNode;
  /** Extra classes for the wrapping card (e.g. tighter padding inside a widget). */
  className?: string;
}

/**
 * The app's standard empty / all-caught-up state. Matches the centered, muted
 * card pattern used on Parties, Invoices and the Pipeline.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`card p-12 text-center ${className ?? ''}`}>
      {Icon && <Icon size={40} className="mx-auto text-text-muted mb-3" />}
      <p className="text-text-secondary font-medium">{title}</p>
      {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
