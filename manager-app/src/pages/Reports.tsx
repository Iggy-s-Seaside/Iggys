import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  CalendarClock,
  Target,
  Receipt,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { StatTrend } from '../components/charts/StatTrend';
import { BarChart } from '../components/charts/BarChart';
import { Sparkline } from '../components/charts/Sparkline';

const usd = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
    : `$${Math.round(n).toLocaleString()}`;

const usdFull = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Owner-facing revenue dashboard. Reads only the private-events the bar already books,
 * so it ships value on day one with zero POS. Benchmarks the headline KPIs against
 * private-events industry norms so the numbers have context in the owner meeting.
 */
export function Reports() {
  const r = useReports();

  const trailing = useMemo(() => r.byMonth.map((m) => m.revenue), [r.byMonth]);
  const trailingTotal = useMemo(() => trailing.reduce((s, v) => s + v, 0), [trailing]);

  const spaceData = useMemo(
    () =>
      r.bySpace.map((s) => ({
        label: s.label,
        value: s.revenue,
        hint: `${s.label}: ${usdFull(s.revenue)} · ${s.events} event${s.events === 1 ? '' : 's'}`,
      })),
    [r.bySpace]
  );

  const monthData = useMemo(
    () =>
      r.byMonth.map((m) => ({
        label: m.label,
        value: m.revenue,
        hint: `${m.label}: ${usdFull(m.revenue)} · ${m.events} event${m.events === 1 ? '' : 's'}`,
      })),
    [r.byMonth]
  );

  const topSpace = useMemo(
    () => [...r.bySpace].sort((a, b) => b.revenue - a.revenue)[0],
    [r.bySpace]
  );

  if (r.loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-8 w-40 bg-surface-hover rounded animate-pulse" />
          <div className="h-4 w-64 bg-surface-hover rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 h-28 animate-pulse" />
          ))}
        </div>
        <div className="card p-5 h-64 animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 h-56 animate-pulse" />
          <div className="card p-5 h-56 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={22} className="text-primary" />
            <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Private-events revenue, conversion, and what's on the books — straight from your parties.
          </p>
        </div>
        <Link to="/invoices" className="btn-secondary flex items-center gap-2 self-start sm:self-auto">
          <Receipt size={16} />
          View invoices
        </Link>
      </div>

      {/* KPI strip — benchmarked */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTrend
          label="Revenue (12 mo)"
          value={usd(trailingTotal)}
          deltaPct={r.momRevenuePct}
          caption="Last full month vs prior"
          icon={<DollarSign size={15} />}
        />
        <StatTrend
          label="Forward book (90 days)"
          value={usd(r.forwardBook90)}
          caption={`${r.forwardBookCount} confirmed event${r.forwardBookCount === 1 ? '' : 's'} ahead`}
          icon={<CalendarClock size={15} />}
        />
        <StatTrend
          label="Avg event value"
          value={usd(r.avgEventValue)}
          caption={`${r.confirmedCount} confirmed event${r.confirmedCount === 1 ? '' : 's'}`}
          benchmark="Private events typically run $1.5k–$5k"
          icon={<TrendingUp size={15} />}
        />
        <StatTrend
          label="Inquiry → booked"
          value={`${Math.round(r.conversionPct)}%`}
          caption={`${r.confirmedCount} of ${r.inquiryCount} inquiries`}
          benchmark="Venue avg ~30–40%"
          icon={<Target size={15} />}
        />
      </div>

      {/* Revenue trend — the hero chart */}
      <div className="card p-5 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-text-primary">Revenue by month</h2>
            <p className="text-xs text-text-muted mt-0.5">Trailing 12 months · confirmed events</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-text-primary tabular-nums leading-none">{usdFull(trailingTotal)}</p>
            <p className="text-[11px] text-text-muted mt-1">total booked</p>
          </div>
        </div>
        <BarChart data={monthData} height={180} formatValue={usd} highlightMax />
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
          <span className="text-xs text-text-muted shrink-0">Trend</span>
          <div className="flex-1">
            <Sparkline values={trailing} area showLast height={28} />
          </div>
        </div>
      </div>

      {/* Revenue by space + Forward book detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue by space */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-text-muted" />
            <h2 className="font-semibold text-text-primary">Revenue by space</h2>
          </div>
          <p className="text-xs text-text-muted mb-4">Where the money comes from</p>
          <BarChart data={spaceData} height={150} formatValue={usd} highlightMax />
          {topSpace && topSpace.revenue > 0 && (
            <p className="text-xs text-text-muted mt-4 pt-4 border-t border-border">
              <span className="text-accent font-semibold">{topSpace.label}</span> leads with{' '}
              <span className="text-text-secondary font-medium">{usdFull(topSpace.revenue)}</span> across{' '}
              {topSpace.events} event{topSpace.events === 1 ? '' : 's'}.
            </p>
          )}
        </div>

        {/* Space breakdown table — exact numbers for the meeting */}
        <div className="card p-5">
          <h2 className="font-semibold text-text-primary mb-1">Space breakdown</h2>
          <p className="text-xs text-text-muted mb-4">Confirmed revenue and event counts</p>
          <div className="divide-y divide-border">
            {r.bySpace.map((s) => {
              const share = r.totalRevenue > 0 ? (s.revenue / r.totalRevenue) * 100 : 0;
              return (
                <div key={s.space} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">{s.label}</p>
                      <p className="text-sm font-bold text-text-primary tabular-nums">{usdFull(s.revenue)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-text-muted tabular-nums shrink-0 w-20 text-right">
                        {s.events} evt · {Math.round(share)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
            <span className="text-sm text-text-secondary font-medium">Total confirmed</span>
            <span className="text-base font-bold text-text-primary tabular-nums">{usdFull(r.totalRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Conversion funnel — the pipeline at a glance */}
      <div className="card p-5">
        <h2 className="font-semibold text-text-primary mb-1">Inquiry funnel</h2>
        <p className="text-xs text-text-muted mb-5">Every lead, and how many you close</p>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <FunnelStep label="Inquiries" value={r.inquiryCount} tone="muted" />
          <FunnelStep label="Confirmed" value={r.confirmedCount} tone="primary" />
          <FunnelStep
            label="Conversion"
            value={`${Math.round(r.conversionPct)}%`}
            tone="accent"
          />
        </div>
        <Link
          to="/parties"
          className="mt-5 flex items-center justify-between px-4 py-3 rounded-lg bg-surface-hover hover:bg-surface-active transition-colors group"
        >
          <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary">
            Work the pipeline
          </span>
          <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary transition-colors" />
        </Link>
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'muted' | 'primary' | 'accent';
}) {
  const valueTone =
    tone === 'primary' ? 'text-primary' : tone === 'accent' ? 'text-accent' : 'text-text-primary';
  return (
    <div className="rounded-xl border border-border bg-surface-hover/40 p-4 text-center">
      <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${valueTone}`}>{value}</p>
      <p className="text-[11px] sm:text-xs text-text-muted mt-1">{label}</p>
    </div>
  );
}
