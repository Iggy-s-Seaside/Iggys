import { useId, useState } from 'react';

export interface BarDatum {
  /** Axis label under the bar (e.g. "Jan", "Upstairs"). */
  label: string;
  value: number;
  /** Per-bar color override; falls back to the chart `color`. */
  color?: string;
  /** Optional richer tooltip text; defaults to `${label}: ${formatValue(value)}`. */
  hint?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Default bar color. Per-datum `color` wins. Defaults to the Iggy's teal. */
  color?: string;
  /** Render height in px. */
  height?: number;
  /** Format a value for the tooltip + optional bar-top labels. Defaults to rounded number. */
  formatValue?: (n: number) => string;
  /** Print the formatted value above each bar. */
  showValues?: boolean;
  /** Highlight the largest bar in the accent color. */
  highlightMax?: boolean;
  className?: string;
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString();

/**
 * Dependency-free vertical bar chart (inline SVG bars + an HTML label row, so text stays
 * crisp and doesn't scale). Phone-first: bars fill the width, tap/hover reveals the value.
 * Dark-mode aware via semantic text classes; colors come from props (brand teal/amber).
 */
export function BarChart({
  data,
  color = '#2dd4bf',
  height = 160,
  formatValue = defaultFormat,
  showValues = false,
  highlightMax = false,
  className = '',
}: BarChartProps) {
  const baseId = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const maxIdx = highlightMax ? data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0) : -1;

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-text-muted ${className}`} style={{ height }}>
        No data yet
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0);
          const barColor = i === maxIdx ? '#f59e0b' : d.color ?? color;
          const isActive = active === i;
          const tip = d.hint ?? `${d.label}: ${formatValue(d.value)}`;
          return (
            <div
              key={`${baseId}-${i}`}
              className="relative flex-1 h-full flex flex-col justify-end items-center group"
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              role="img"
              aria-label={tip}
            >
              {(showValues || isActive) && (
                <span
                  className={`mb-1 text-[10px] font-semibold tabular-nums whitespace-nowrap transition-opacity ${
                    isActive ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {formatValue(d.value)}
                </span>
              )}
              <div
                className="w-full max-w-[40px] rounded-t-md transition-[height,opacity] duration-300 ease-out"
                style={{
                  height: `${pct}%`,
                  minHeight: d.value > 0 ? 4 : 0,
                  backgroundColor: barColor,
                  opacity: active == null || isActive ? 1 : 0.55,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 sm:gap-2 mt-1.5">
        {data.map((d, i) => (
          <span
            key={`${baseId}-lbl-${i}`}
            className="flex-1 text-center text-[10px] sm:text-[11px] text-text-muted truncate"
            title={d.label}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
