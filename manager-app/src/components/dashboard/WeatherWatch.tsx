import { Link } from 'react-router-dom';
import { CloudRain, ThermometerSun, Umbrella, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWeatherWatch } from '../../hooks/useWeatherWatch';
import type { WeatherFlag, WeatherFlagKind, WeatherFlagSeverity } from '../../lib/weatherWatch';

// Weather Watch — Luna's weather × reservation cross-signal on the dashboard.
// Her contract: no header, no "I noticed," no preamble. Each flag is one sentence
// that points to an action; tap it to go do the thing. Renders nothing when the
// next 48h hold no flag worth surfacing — silence is the default.

const ICON: Record<WeatherFlagKind, LucideIcon> = {
  rain_party_indoor: CloudRain,
  heat_understaffed: ThermometerSun,
  rain_deck: Umbrella,
};

// 'action' = do something now (amber). 'plan' = a softer heads-up (blue).
const ACCENT: Record<WeatherFlagSeverity, { card: string; iconWrap: string; icon: string }> = {
  action: {
    card: 'border-amber-500/30 bg-amber-500/5',
    iconWrap: 'bg-amber-500/15',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  plan: {
    card: 'border-blue-500/20 bg-blue-500/5',
    iconWrap: 'bg-blue-500/10',
    icon: 'text-blue-600 dark:text-blue-400',
  },
};

export function WeatherWatch() {
  const { flags } = useWeatherWatch();
  return <WeatherWatchView flags={flags} />;
}

// Presentational half — pure render over flags, so it can be previewed/tested in
// isolation without the data hooks.
export function WeatherWatchView({ flags }: { flags: WeatherFlag[] }) {
  if (flags.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {flags.map((flag) => {
        const Icon = ICON[flag.kind];
        const accent = ACCENT[flag.severity];
        return (
          <Link
            key={flag.id}
            to={flag.deepLink}
            className={`card-hover p-4 flex items-center gap-3 group active:scale-[0.99] transition-transform ${accent.card}`}
          >
            <div className={`p-2.5 rounded-lg shrink-0 ${accent.iconWrap}`}>
              <Icon size={20} className={accent.icon} aria-hidden="true" />
            </div>
            <p className="min-w-0 flex-1 text-sm font-medium text-text-primary leading-snug">
              {flag.message}
            </p>
            <ChevronRight size={18} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
          </Link>
        );
      })}
    </div>
  );
}
