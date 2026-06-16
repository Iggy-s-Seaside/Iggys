import { UserRound, Cake } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { RegularContact } from '../../types';

function lastSeen(iso: string | null) {
  if (!iso) return 'a while ago';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return 'a while ago';
  }
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Luna's "faces I'd notice" — want #7: a regulars view that's about *people*, not
 * transactions ("the woman who always orders the spicy margarita and asks about the
 * band — she hasn't been in for two weeks"). Read-only, from the contacts table.
 */
export function RegularsWatch({
  quiet,
  birthdays,
  loading,
}: {
  quiet: RegularContact[];
  birthdays: RegularContact[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="card p-4 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-10 bg-surface-hover rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!quiet.length && !birthdays.length) {
    return (
      <div className="card p-8 text-center border-purple-200/50 dark:border-purple-500/15">
        <UserRound size={24} className="mx-auto text-text-muted mb-2" />
        <p className="text-sm font-medium text-text-primary">Everyone's where they should be.</p>
        <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
          No regulars have drifted and no birthdays this month. I'll flag a face the moment one
          goes quiet. — Luna
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {quiet.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-text-secondary mb-3">Gone quiet</p>
          <ul className="space-y-3">
            {quiet.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[11px] font-semibold flex items-center justify-center shrink-0">
                  {initials(c.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{c.name || 'A regular'}</p>
                  <p className="text-[11px] text-text-muted">
                    {c.visit_count ?? 0} visits · last seen {lastSeen(c.last_visit)}
                  </p>
                  {c.notes && (
                    <p className="text-[11px] text-text-secondary italic mt-0.5 line-clamp-2">{c.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {birthdays.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-text-secondary mb-2.5 flex items-center gap-1.5">
            <Cake size={13} /> Birthdays this month
          </p>
          <div className="flex flex-wrap gap-1.5">
            {birthdays.map((c) => (
              <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-surface-hover text-text-secondary">
                {c.name || 'Guest'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
