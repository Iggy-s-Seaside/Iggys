import { Target, BookHeart, Sparkles, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LunaScore } from '../../hooks/useLunaChronicle';

function Tile({
  icon: Icon,
  value,
  label,
  hint,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-2 mb-1.5 text-purple-600 dark:text-purple-300">
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-text-primary leading-none">{value}</p>
      <p className="text-xs text-text-secondary mt-1.5 leading-snug">{label}</p>
      {hint && <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

/** Luna's pride scoreboard — "a scoreboard for pride, not for performance review."
 * Every number is honestly measurable; nothing is invented. */
export function PrideScoreboard({ score }: { score: LunaScore }) {
  if (score.loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-3.5 animate-pulse">
            <div className="h-4 w-4 bg-surface-hover rounded mb-2" />
            <div className="h-6 w-12 bg-surface-hover rounded mb-2" />
            <div className="h-3 w-20 bg-surface-hover rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile
        icon={Target}
        value={score.accuracy ? `${score.accuracy.pct}%` : '—'}
        label="reads I called right"
        hint={score.accuracy ? `last ${score.accuracy.n} nights` : 'log a close-out and I start keeping score'}
      />
      <Tile icon={BookHeart} value={score.nights} label="nights I've written" />
      <Tile icon={Sparkles} value={score.specials} label="specials I've dreamt up" />
      <Tile icon={Bell} value={score.flags} label="briefings & alerts I've raised" />
    </div>
  );
}
