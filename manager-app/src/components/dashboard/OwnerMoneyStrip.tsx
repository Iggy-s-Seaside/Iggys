import { Link } from 'react-router-dom';
import { TrendingUp, CalendarCheck, AlertCircle, Clock } from 'lucide-react';
import { usePipeline } from '../../hooks/usePipeline';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/**
 * Owner-only money snapshot — the four numbers an owner opens the app to see
 * first: live pipeline value, booked revenue, deposits still owed, and
 * follow-ups due. Sourced entirely from usePipeline (parties + invoice math),
 * so it adds no new queries. Managers/employees never see this — their home
 * leads with the ops cockpit (shift, low stock, messages, todos).
 */
export function OwnerMoneyStrip() {
  const { columns, openValue, loading } = usePipeline();

  const confirmed = columns.find((c) => c.stage === 'confirmed');
  const paid = columns.find((c) => c.stage === 'paid');
  const bookedValue = (confirmed?.total ?? 0) + (paid?.total ?? 0);

  const allCards = columns.flatMap((c) => c.cards);
  const depositsOwed = allCards.filter((c) => c.depositOwed);
  const depositsOwedValue = depositsOwed.reduce((s, c) => s + c.estValue, 0);
  const followUpsDue = allCards.filter((c) => c.followUpDue).length;

  const tiles = [
    {
      label: 'Open pipeline', value: money(openValue), icon: TrendingUp,
      tone: 'text-primary', bg: 'bg-primary-50', to: '/pipeline', alert: false,
    },
    {
      label: 'Booked', value: money(bookedValue), icon: CalendarCheck,
      tone: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', to: '/pipeline', alert: false,
    },
    {
      label: depositsOwed.length ? `Deposits owed (${depositsOwed.length})` : 'Deposits owed',
      value: money(depositsOwedValue), icon: AlertCircle,
      tone: depositsOwed.length ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted',
      bg: depositsOwed.length ? 'bg-amber-500/10' : 'bg-surface-hover', to: '/pipeline', alert: depositsOwed.length > 0,
    },
    {
      label: 'Follow-ups due', value: String(followUpsDue), icon: Clock,
      tone: followUpsDue ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted',
      bg: followUpsDue ? 'bg-amber-500/10' : 'bg-surface-hover', to: '/parties', alert: followUpsDue > 0,
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Your numbers today</h2>
        <Link to="/pipeline" className="text-xs text-primary hover:text-primary-hover">Pipeline →</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(({ label, value, icon: Icon, tone, bg, to, alert }) => (
          <Link
            key={label}
            to={to}
            className={`card-hover p-3 sm:p-4 active:scale-[0.98] transition-transform ${alert ? 'border-amber-500/30' : ''}`}
          >
            <div className={`p-1.5 rounded-lg w-fit mb-1.5 ${bg}`}><Icon size={15} className={tone} /></div>
            <p className={`text-lg sm:text-xl font-bold ${loading ? 'text-text-muted/40' : 'text-text-primary'}`}>
              {loading ? '—' : value}
            </p>
            <p className="text-[11px] text-text-muted leading-tight">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
