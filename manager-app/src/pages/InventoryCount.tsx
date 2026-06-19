import { useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, Play, Search, Trash2, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState } from '../components/ui/ErrorState';
import Select from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import { CountRow } from '../components/inventory/CountRow';
import { useInventoryItems, useInventoryCategories } from '../hooks/useInventory';
import { useInventoryCount } from '../hooks/useInventoryCount';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';
import { money, safeFmtDate } from '../utils/format';

/**
 * Periodic count: a slow-time exact recount that reconciles the system's
 * fiction against the shelf, computing variance + shrink. Complements the
 * quick mark-low chips on the Inventory page — this is the "smart compare
 * what went out vs what's actually here" the owner asked for.
 *
 * Flow:
 *   1. No open count → choose a category (or All) and Start. We snapshot each
 *      active item's current_quantity as `expected`.
 *   2. Walk the list: the ONLY required input per line is the counted_qty.
 *      Variance + $shrink update live; a sticky footer shows running totals.
 *   3. Close count → useConfirm summary ("Apply N adjustments, $X variance?")
 *      writes counts back to stock, stamps last_counted_at, logs adjustments.
 */
export function InventoryCount() {
  const { items, loading: itemsLoading, error: itemsError, refresh: refreshItems } = useInventoryItems();
  const { data: categories } = useInventoryCategories();
  const { user } = useAuth();
  const confirm = useConfirm();

  const {
    count,
    lines,
    totals,
    loading,
    error,
    starting,
    closing,
    start,
    setCounted,
    close,
    discard,
  } = useInventoryCount(items);

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  // Category options: -1 sentinel = "All categories" (start filter only).
  const categoryOptions = useMemo(
    () => [
      { value: -1, label: 'All categories' },
      ...sortedCategories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [sortedCategories]
  );

  const visibleLines = useMemo(() => {
    if (!search.trim()) return lines;
    const q = search.toLowerCase();
    return lines.filter((l) => (l.name ?? '').toLowerCase().includes(q));
  }, [lines, search]);

  // Enter-to-advance: pressing Enter in a count input commits live (CountRow
  // already saves on change) and jumps focus to the next item's input so a
  // counter can fly down the list without reaching for the mouse. Last row =
  // blur (done). Bound at the list container so we don't touch CountRow.
  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || !target.id.startsWith('count-')) return;
    e.preventDefault();
    const inputs = Array.from(
      e.currentTarget.querySelectorAll<HTMLInputElement>('input[id^="count-"]')
    );
    const next = inputs[inputs.indexOf(target) + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      target.blur();
    }
  };

  const handleStart = async () => {
    await start({
      categoryId: categoryId,
      countedBy: user?.email ?? null,
    });
  };

  const handleClose = async () => {
    const { adjustments, countedLines, netVarianceCost, shrinkCost } = totals;
    if (countedLines === 0) {
      await confirm({
        title: 'Nothing counted yet',
        message: 'Enter at least one counted quantity before closing the count.',
        confirmLabel: 'OK',
        cancelLabel: 'Back',
      });
      return;
    }
    const netLabel =
      netVarianceCost === 0
        ? '$0'
        : `${netVarianceCost < 0 ? '-' : '+'}${money(Math.abs(netVarianceCost))}`;
    const ok = await confirm({
      title: 'Close count?',
      message:
        `Apply ${adjustments} adjustment${adjustments === 1 ? '' : 's'} across ${countedLines} counted item${countedLines === 1 ? '' : 's'}.\n\n` +
        `Net variance: ${netLabel}\n` +
        `Shrink (loss): ${money(shrinkCost)}\n\n` +
        `This writes each counted quantity back to stock and logs the adjustments. This can't be undone.`,
      confirmLabel: 'Close & reconcile',
    });
    if (!ok) return;
    const done = await close(user?.email ?? 'unknown');
    if (done) await refreshItems();
  };

  const handleDiscard = async () => {
    const ok = await confirm({
      title: 'Discard count?',
      message: 'This abandons the open count without changing any stock. Your entered counts will be lost.',
      confirmLabel: 'Discard',
      danger: true,
    });
    if (!ok) return;
    await discard();
  };

  // ── Loading / error gates ──
  if (loading || itemsLoading) {
    return (
      <div>
        <PageHeader title="Count Stock" icon={ClipboardCheck} subtitle="Periodic count & variance reconciliation" />
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      </div>
    );
  }

  if ((error || itemsError) && lines.length === 0 && !count) {
    return (
      <div>
        <PageHeader title="Count Stock" icon={ClipboardCheck} subtitle="Periodic count & variance reconciliation" />
        <ErrorState onRetry={refreshItems} description="We couldn't load the count. Your stock is safe." />
      </div>
    );
  }

  // ── START STATE: no open count ──
  if (!count) {
    return (
      <div>
        <PageHeader
          title="Count Stock"
          icon={ClipboardCheck}
          subtitle="Periodic count & variance reconciliation"
        />
        <div className="max-w-md mx-auto">
          <div className="card p-6 space-y-5">
            <p className="text-sm text-text-secondary">
              Start an exact count to reconcile the system against the shelf. We'll snapshot what
              the system <em>thinks</em> you have, you enter what's actually there, and closing the
              count fixes stock and records the variance (shrink).
            </p>

            <Field label="Count which items?">
              <Select<number>
                variant="manager"
                value={categoryId ?? -1}
                onChange={(v) => setCategoryId(v === -1 ? null : v)}
                options={categoryOptions}
                placeholder="All categories"
              />
            </Field>

            <button
              onClick={handleStart}
              disabled={starting}
              className="btn-primary w-full h-12 flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Play size={18} /> Start count
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── WALK STATE: an open count exists ──
  const allCounted = totals.countedLines === totals.totalLines && totals.totalLines > 0;

  return (
    <div className="pb-[calc(160px+env(safe-area-inset-bottom,0px))]">
      <PageHeader
        title="Count Stock"
        icon={ClipboardCheck}
        subtitle={`Started ${safeFmtDate(count.started_at, 'MMM d, h:mm a')} · ${totals.countedLines}/${totals.totalLines} counted`}
      >
        <button onClick={handleDiscard} className="btn-secondary flex items-center gap-2" disabled={closing}>
          <Trash2 size={16} />
          <span className="hidden sm:inline">Discard</span>
        </button>
      </PageHeader>

      {/* Search within the open count */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          className="input-field pl-9 w-full"
          placeholder="Find an item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lines */}
      {visibleLines.length === 0 ? (
        <div className="card p-12 text-center text-text-muted text-sm">
          {search ? 'No items match your search.' : 'No items in this count.'}
        </div>
      ) : (
        <div className="space-y-3" onKeyDown={handleListKeyDown}>
          {visibleLines.map((line) => (
            <CountRow key={line.id} line={line} onCount={setCounted} />
          ))}
        </div>
      )}

      {/* Sticky reconcile footer.
          Mobile: sits above the BottomNav (lg:hidden, ~64px tall) so the two
          don't overlap. Desktop (lg): no BottomNav, and the w-64 sidebar means
          we offset the bar by left-64 and drop it to bottom-0. */}
      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] lg:bottom-0 inset-x-0 lg:left-64 z-30 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              {allCounted && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
              <span className="text-text-secondary tabular-nums">
                {totals.countedLines}/{totals.totalLines} counted
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-text-secondary tabular-nums">
                {totals.adjustments} adj
              </span>
            </div>
            <div className="text-xs mt-0.5 flex items-center gap-3">
              <span className="text-text-muted">
                Net{' '}
                <span
                  className={`tabular-nums font-medium ${
                    totals.netVarianceCost < 0
                      ? 'text-danger'
                      : totals.netVarianceCost > 0
                        ? 'text-emerald-500'
                        : 'text-text-secondary'
                  }`}
                >
                  {totals.netVarianceCost === 0
                    ? '$0'
                    : `${totals.netVarianceCost < 0 ? '-' : '+'}${money(Math.abs(totals.netVarianceCost))}`}
                </span>
              </span>
              <span className="text-text-muted">
                Shrink{' '}
                <span className="tabular-nums font-medium text-danger">{money(totals.shrinkCost)}</span>
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={closing}
            className="btn-primary h-12 px-5 flex items-center justify-center gap-2 shrink-0"
          >
            {closing ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Closing…
              </>
            ) : (
              <>
                <ClipboardCheck size={18} /> Close count
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InventoryCount;
