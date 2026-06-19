import { useId } from 'react';

export interface SparklineProps {
  /** Series values, left → right. Empty/single-point series render a flat baseline. */
  values: number[];
  /** Stroke color. Defaults to the Iggy's teal. */
  color?: string;
  /** Render height in px (width is fluid — the SVG scales to its container). */
  height?: number;
  /** ViewBox width — only affects the internal aspect ratio, not the rendered size. */
  width?: number;
  /** Fill a soft gradient under the line. */
  area?: boolean;
  /** Emphasize the final point with a dot. */
  showLast?: boolean;
  className?: string;
}

/**
 * Dependency-free inline-SVG sparkline. Fluid width (100%), fixed height, dark-mode
 * neutral (colors come from props, default brand teal). Pure presentation — no axes,
 * no labels; pair it with StatTrend for the number.
 */
export function Sparkline({
  values,
  color = '#2dd4bf',
  height = 36,
  width = 120,
  area = false,
  showLast = false,
  className = '',
}: SparklineProps) {
  const gradientId = useId();
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const pts = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;

  const coords = pts.map((v, i) => {
    const x = pad + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const y = pad + innerH - ((v - min) / span) * innerH;
    return { x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const fill = `${line} L${coords[coords.length - 1].x.toFixed(2)},${(height - pad).toFixed(2)} L${coords[0].x.toFixed(2)},${(height - pad).toFixed(2)} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      role="img"
      aria-hidden="true"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showLast && (
        <circle cx={last.x} cy={last.y} r={2.75} fill={color} stroke="var(--color-surface, #ffffff)" strokeWidth={1.5} />
      )}
    </svg>
  );
}
