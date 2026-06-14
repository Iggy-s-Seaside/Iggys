import { useMemo, useState } from 'react';
import { LifeBuoy, Search, X, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useRole } from '../hooks/useRole';
import { HelpTopicCard } from '../components/help/HelpTopicCard';
import {
  HELP_TOPICS,
  HELP_CATEGORIES,
  type HelpCategory,
  type HelpTopic,
} from '../data/helpContent';

type ChipValue = HelpCategory | 'all';

/** Build the searchable haystack for one topic, once. */
function haystack(t: HelpTopic): string {
  return [
    t.title,
    t.summary,
    ...(t.steps ?? []),
    ...(t.body ?? []),
    ...(t.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

export function Help() {
  const { isOwner } = useRole();
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<ChipValue>('all');

  // Owners see everything; everyone else sees only the "all" audience topics.
  const visibleTopics = useMemo(
    () => HELP_TOPICS.filter((t) => isOwner || t.audience === 'all'),
    [isOwner]
  );

  // Category chips, filtered to what this role can actually see.
  const visibleCategories = useMemo(
    () => HELP_CATEGORIES.filter((c) => isOwner || c.audience === 'all'),
    [isOwner]
  );

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    return visibleTopics.filter((t) => {
      if (activeChip !== 'all' && t.category !== activeChip) return false;
      if (q && !haystack(t).includes(q)) return false;
      return true;
    });
  }, [visibleTopics, activeChip, q]);

  // Split into the two tiers for display. A single match auto-expands.
  const friendly = matches.filter((t) => t.audience === 'all');
  const advanced = matches.filter((t) => t.audience === 'owner');
  const autoOpen = matches.length === 1;

  const searching = q.length > 0 || activeChip !== 'all';

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Help & Guide"
        icon={LifeBuoy}
        subtitle="Quick how-tos for every shift. Search, or browse by what you’re doing."
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="search"
          className="input-field pl-11 pr-11"
          placeholder="Search help — e.g. “text a guest”, “86”, “invoice”…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search help topics"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Category chips (horizontally scrollable on narrow screens) */}
      <div role="tablist" aria-label="Help categories" className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 mb-6">
        <button
          type="button"
          role="tab"
          aria-selected={activeChip === 'all'}
          onClick={() => setActiveChip('all')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            activeChip === 'all'
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
          }`}
        >
          All
        </button>
        {visibleCategories.map((cat) => {
          const Icon = cat.icon;
          const active = activeChip === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveChip(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* No results */}
      {matches.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches that"
          description="Try fewer words, or tap All to see every guide."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveChip('all');
              }}
              className="btn-secondary inline-flex"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Friendly tier — everyone */}
          {friendly.length > 0 && (
            <section aria-labelledby="help-friendly-heading">
              {!searching && (
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-primary" aria-hidden="true" />
                  <h2 id="help-friendly-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                    Everyday how-tos
                  </h2>
                </div>
              )}
              <div className="space-y-3">
                {friendly.map((t) => (
                  <HelpTopicCard key={t.id} topic={t} defaultOpen={autoOpen} />
                ))}
              </div>
            </section>
          )}

          {/* Advanced tier — owner only */}
          {isOwner && advanced.length > 0 && (
            <section aria-labelledby="help-advanced-heading">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} className="text-accent" aria-hidden="true" />
                <h2 id="help-advanced-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                  Owner & setup
                </h2>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Admin, integrations and the behind-the-scenes wiring — just for you.
              </p>
              <div className="space-y-3">
                {advanced.map((t) => (
                  <HelpTopicCard key={t.id} topic={t} defaultOpen={autoOpen} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Warm footer */}
      <p className="text-xs text-text-muted text-center mt-10">
        New here? Take a breath — you’ve got this. Start with “Run the waitlist” or “Open the bar.”
      </p>
    </div>
  );
}

export default Help;
