import type { ReactNode } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  /** The page title — renders as the standard text-2xl bold h1. */
  title: string;
  /** Optional lucide icon, rendered in the brand teal beside the title. */
  icon?: LucideIcon;
  /** A muted line of context under the title. */
  subtitle?: string;
  /** Right-aligned action(s) — typically a <button className="btn-primary">. */
  children?: ReactNode;
  /**
   * Optional back affordance. Pass an onClick (e.g. () => navigate('/events'))
   * to render a ghost "back" button above the title.
   */
  onBack?: () => void;
  /** Label for the back button (also its aria-label). */
  backLabel?: string;
  /** Extra classes for the wrapping <header>. */
  className?: string;
}

/**
 * The app's standard page heading — replaces the ~32 hand-rolled
 * `<h1 className="text-2xl font-bold text-text-primary">` blocks (see Parties,
 * Reports, Invoices). Title + optional icon + subtitle, with a right-action slot
 * and an optional back button. Mobile-first: actions stack under the title on
 * narrow screens and sit to the right from sm: up.
 */
export function PageHeader({
  title,
  icon: Icon,
  subtitle,
  children,
  onBack,
  backLabel = 'Back',
  className,
}: PageHeaderProps) {
  return (
    <header className={className}>
      {onBack && (
        <div className="mb-4">
          <button type="button" onClick={onBack} aria-label={backLabel} className="btn-ghost -ml-3">
            <ArrowLeft size={18} /> {backLabel}
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={22} className="text-primary shrink-0" aria-hidden="true" />}
            <h1 className="text-2xl font-bold text-text-primary truncate">{title}</h1>
          </div>
          {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}

export default PageHeader;
