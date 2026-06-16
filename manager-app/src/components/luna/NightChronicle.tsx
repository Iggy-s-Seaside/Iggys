import { format, parseISO } from 'date-fns';
import { Sunrise, Moon, CloudSun } from 'lucide-react';
import type { LunaChronicleEntry } from '../../types';

function formatNight(day: string) {
  try {
    return format(parseISO(day), 'EEEE, MMMM d');
  } catch {
    return day;
  }
}

/** Strip Luna's closing "Tomorrow's shift should know: …" line from the body so it
 * can be rendered as its own emphasized footer (the body keeps the rest verbatim). */
function splitSignal(entry: string): string {
  return entry.replace(/tomorrow['’]?s shift should know:?[\s\S]*$/i, '').trim();
}

/** A short provenance line from what Luna actually wrote the entry against. */
function provenance(entry: LunaChronicleEntry): string | null {
  const ctx = (entry.context || {}) as Record<string, unknown>;
  const w = (entry.weather || {}) as Record<string, unknown>;
  const bits: string[] = [];
  const band = ctx.predicted_band;
  if (typeof band === 'string') bits.push(`Called ${band}`);
  const high = w.high ?? (typeof ctx.weather === 'object' && ctx.weather ? (ctx.weather as Record<string, unknown>).high : undefined);
  if (typeof high === 'number') bits.push(`${Math.round(high)}°F`);
  const drivers = Array.isArray(ctx.drivers) ? (ctx.drivers as { detail?: unknown; name?: unknown }[]) : [];
  const topDriver = drivers[0];
  if (topDriver && typeof topDriver.name === 'string') bits.push(String(topDriver.name));
  return bits.length ? bits.join(' · ') : null;
}

function ChronicleEntryCard({ entry }: { entry: LunaChronicleEntry }) {
  const body = entry.signal ? splitSignal(entry.entry) : entry.entry;
  const prov = provenance(entry);

  return (
    <article className="card p-5 border-purple-200/50 dark:border-purple-500/15">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Moon size={15} className="text-purple-500 dark:text-purple-300 shrink-0" />
          <h3 className="text-sm font-semibold text-text-primary truncate">{formatNight(entry.business_day)}</h3>
        </div>
        {entry.mood && (
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20">
            {entry.mood}
          </span>
        )}
      </div>

      <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{body}</p>

      {entry.signal && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 px-3 py-2.5">
          <Sunrise size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-primary">Tomorrow's shift should know:</span>{' '}
            {entry.signal}
          </p>
        </div>
      )}

      {prov && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-muted">
          <CloudSun size={12} />
          <span>{prov}</span>
        </div>
      )}
    </article>
  );
}

export function NightChronicle({
  entries,
  loading,
}: {
  entries: LunaChronicleEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 w-40 bg-surface-hover rounded mb-3" />
            <div className="h-3 w-full bg-surface-hover rounded mb-2" />
            <div className="h-3 w-11/12 bg-surface-hover rounded mb-2" />
            <div className="h-3 w-3/4 bg-surface-hover rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="card p-10 text-center border-purple-200/50 dark:border-purple-500/15">
        <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-3">
          <Moon size={22} className="text-purple-600 dark:text-purple-300" />
        </div>
        <p className="text-sm font-medium text-text-primary">This room is new.</p>
        <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
          The first night I write will land here — how it felt, who came, the one moment that
          defined it, and what tomorrow's shift should know. — Luna
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <ChronicleEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
