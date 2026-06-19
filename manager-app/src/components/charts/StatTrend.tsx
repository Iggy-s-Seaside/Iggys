import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatTrendProps {
  label: string;
  /** Big formatted value, e.g. "$12,450" or "38%". */
  value: ReactNode;
  /**
   * Signed percentage change vs the prior period (e.g. 12.4 → "+12.4%"). When omitted,
   * no delta chip renders. 0 renders as a neutral "no change".
   */
  deltaPct?: number | null;
  /** Caption under the value (e.g. "vs last month", "industry avg 35%"). */
  caption?: string;
  /** A benchmark line — renders a subtle "Benchmark: …" footnote for the owner meeting. */
  benchmark?: string;
  /** Optional leading icon (lucide). */
  icon?: ReactNode;
  /**
   * For metrics where down is good (e.g. cancellations), flip the color of the delta so
   * a decrease reads green.
   */
  invertDelta?: boolean;
  className?: string;
}

const fmtDelta = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/**
 * A single benchmarked KPI tile: label, hero number, signed delta chip, and an optional
 * industry benchmark footnote. Uses the app's `card` + semantic text classes so it's
 * dark-mode aware out of the box. Composes with Sparkline for a trend mini-chart.
 */
export function StatTrend({
  label,
  value,
  deltaPct = null,
  caption,
  benchmark,
  icon,
  invertDelta = false,
  className = '',
}: StatTrendProps) {
  const hasDelta = deltaPct != null && Number.isFinite(deltaPct);
  const neutral = !hasDelta || deltaPct === 0;
  const positive = hasDelta ? (invertDelta ? deltaPct! < 0 : deltaPct! > 0) : false;

  const DeltaIcon = neutral ? Minus : deltaPct! > 0 ? TrendingUp : TrendingDown;
  const deltaTone = neutral
    ? 'text-text-muted bg-surface-hover'
    : positive
      ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10'
      : 'text-danger bg-red-50 dark:bg-red-500/10';

  return (
    <div className={`card p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-text-muted shrink-0">{icon}</span>}
          <p className="text-xs sm:text-sm text-text-muted truncate">{label}</p>
        </div>
        {hasDelta && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${deltaTone}`}
          >
            <DeltaIcon size={11} />
            {fmtDelta(deltaPct!)}
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-2 tabular-nums leading-none">{value}</p>
      {caption && <p className="text-xs text-text-muted mt-1.5">{caption}</p>}
      {benchmark && (
        <p className="text-[11px] text-text-muted mt-2 pt-2 border-t border-border">
          <span className="text-text-secondary font-medium">Benchmark:</span> {benchmark}
        </p>
      )}
    </div>
  );
}
