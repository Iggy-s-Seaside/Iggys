import { useMemo, useState } from 'react';
import {
  Banknote,
  Calculator,
  FileText,
  Loader2,
  Mail,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useCloseOut,
  DENOMINATIONS,
  totalFromDenominations,
  formatCents,
} from '../hooks/useCloseOut';
import { useConfirm } from '../hooks/useConfirm';
import type { EonReport } from '../types';

interface CloseOutProps {
  /** Optional shift to scope the close-out to. Works standalone when omitted. */
  shiftId?: number | null;
}

// ── Big stepper for one denomination row (glove-friendly tap targets) ──
function DenomRow({
  label,
  cents,
  count,
  onChange,
}: {
  label: string;
  cents: number;
  count: number;
  onChange: (next: number) => void;
}) {
  const lineTotal = cents * count;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-16 shrink-0 text-base font-semibold text-text-primary tabular-nums">{label}</div>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, count - 1))}
        className="h-12 w-12 shrink-0 rounded-xl bg-surface-hover text-2xl font-bold text-text-secondary active:scale-95 transition-transform"
        aria-label={`One fewer ${label}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={count === 0 ? '' : count}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        placeholder="0"
        className="input-field h-12 w-16 shrink-0 text-center text-lg tabular-nums"
        aria-label={`Count of ${label}`}
      />
      <button
        type="button"
        onClick={() => onChange(count + 1)}
        className="h-12 w-12 shrink-0 rounded-xl bg-surface-hover text-2xl font-bold text-text-secondary active:scale-95 transition-transform"
        aria-label={`One more ${label}`}
      >
        +
      </button>
      <div className="ml-auto w-24 text-right text-sm tabular-nums text-text-muted">
        {lineTotal > 0 ? formatCents(lineTotal) : '—'}
      </div>
    </div>
  );
}

export function CloseOut({ shiftId }: CloseOutProps) {
  const {
    loading,
    saving,
    generating,
    counts,
    reports,
    recordCashCount,
    composePreview,
    generateAndEmail,
    closeTheBar,
  } = useCloseOut(shiftId);

  const confirm = useConfirm();

  // ── Cash count state ──
  const [denoms, setDenoms] = useState<Record<string, number>>({});
  const [expectedDollars, setExpectedDollars] = useState('');
  const [note, setNote] = useState('');

  const countedCents = useMemo(() => totalFromDenominations(denoms), [denoms]);
  const expectedCents = useMemo(() => {
    const n = Number(expectedDollars);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [expectedDollars]);
  const overShortCents = countedCents - expectedCents;
  const hasExpected = expectedDollars.trim() !== '';

  const setDenom = (cents: number, next: number) =>
    setDenoms((prev) => ({ ...prev, [String(cents)]: next }));

  const handleSaveCount = async () => {
    const ok = await recordCashCount({
      expectedCents,
      denominations: denoms,
      note: note || null,
    });
    if (ok) {
      setDenoms({});
      setExpectedDollars('');
      setNote('');
    }
  };

  // ── EON report state ──
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [savedReport, setSavedReport] = useState<EonReport | null>(null);

  const latestSavedReport = savedReport ?? reports[0] ?? null;

  const handlePreview = async () => {
    setPreviewing(true);
    const { summary } = await composePreview();
    setPreview(summary);
    setPreviewing(false);
  };

  const handleGenerate = async () => {
    const report = await generateAndEmail();
    if (report) {
      setSavedReport(report);
      setPreview(report.summary);
    }
  };

  // ── Close the bar ──
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const handleClose = async () => {
    const confirmed = await confirm({
      title: 'Close the bar',
      message: 'Close the bar for the night? This ends the shift.',
      confirmLabel: 'Close the bar',
      danger: true,
    });
    if (!confirmed) return;
    setClosing(true);
    const ok = await closeTheBar();
    setClosing(false);
    if (ok) setClosed(true);
  };

  const overShortColor =
    overShortCents === 0 ? 'text-success' : overShortCents > 0 ? 'text-accent' : 'text-danger';
  const overShortLabel =
    overShortCents === 0 ? 'Balanced' : overShortCents > 0 ? 'Over' : 'Short';

  return (
    <div className="max-w-3xl pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Close-Out</h1>
        <p className="text-sm text-text-muted mt-1">
          Count the till, compose the night, send it to the owner.
        </p>
      </div>

      {/* ── Cash Count panel ── */}
      <section className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Banknote size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Cash Count</h2>
        </div>

        <div className="divide-y divide-border">
          {DENOMINATIONS.map((d) => (
            <DenomRow
              key={d.cents}
              label={d.label}
              cents={d.cents}
              count={denoms[String(d.cents)] ?? 0}
              onChange={(next) => setDenom(d.cents, next)}
            />
          ))}
        </div>

        {/* Totals */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-hover p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Counted</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
              {formatCents(countedCents)}
            </p>
          </div>
          <div className="rounded-xl bg-surface-hover p-4">
            <label className="text-xs uppercase tracking-wide text-text-muted" htmlFor="expected">
              Expected
            </label>
            <div className="mt-1 flex items-center">
              <span className="text-2xl font-bold text-text-muted">$</span>
              <input
                id="expected"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={expectedDollars}
                onChange={(e) => setExpectedDollars(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-2xl font-bold tabular-nums text-text-primary outline-none"
              />
            </div>
          </div>
          <div className={`rounded-xl bg-surface-hover p-4 ${hasExpected ? '' : 'opacity-50'}`}>
            <p className="text-xs uppercase tracking-wide text-text-muted">Over / Short</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${hasExpected ? overShortColor : 'text-text-muted'}`}>
              {hasExpected ? `${overShortLabel} ${formatCents(Math.abs(overShortCents))}` : '—'}
            </p>
          </div>
        </div>

        <input
          className="input-field mt-4"
          placeholder="Note (optional) — pulled $200 to safe, rolled coin…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          onClick={handleSaveCount}
          disabled={saving || countedCents === 0}
          className="btn-primary mt-4 h-12 w-full text-base sm:w-auto"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
          Save cash count
        </button>

        {/* Recent counts */}
        {counts.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              Recent counts
            </p>
            <div className="space-y-1.5">
              {counts.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">
                    {format(new Date(c.created_at), 'MMM d, h:mm a')}
                    {c.counted_by ? ` · ${c.counted_by.split('@')[0]}` : ''}
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      c.over_short_cents === 0
                        ? 'text-success'
                        : c.over_short_cents > 0
                          ? 'text-accent'
                          : 'text-danger'
                    }`}
                  >
                    {c.over_short_cents === 0
                      ? 'Balanced'
                      : `${c.over_short_cents > 0 ? 'Over' : 'Short'} ${formatCents(Math.abs(c.over_short_cents))}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── End-of-Night panel ── */}
      <section className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">End-of-Night Report</h2>
        </div>

        {!preview ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-text-muted">
              Preview pulls together today's events, checklist, line-checks, log
              highlights, low stock, and the cash over/short.
            </p>
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="btn-secondary mt-4 h-11"
            >
              {previewing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Preview report
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {latestSavedReport ? 'Saved summary' : 'Preview'}
              </p>
              <button
                onClick={handlePreview}
                disabled={previewing || generating}
                className="text-xs text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw size={12} className={previewing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-surface-hover p-4 text-sm leading-relaxed text-text-primary font-sans">
              {preview}
            </pre>

            {latestSavedReport?.emailed_at && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 size={15} />
                Emailed to owner {format(new Date(latestSavedReport.emailed_at), 'MMM d, h:mm a')}
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary mt-4 h-12 w-full text-base"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
              {latestSavedReport ? 'Re-generate & email owner' : 'Generate & email owner'}
            </button>
          </div>
        )}
      </section>

      {/* ── Close the Bar ── */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={20} className="text-danger" />
          <h2 className="text-lg font-semibold text-text-primary">Close the Bar</h2>
        </div>
        {closed ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 p-4 text-success">
            <CheckCircle2 size={18} />
            <span className="font-medium">Shift closed. Good night.</span>
          </div>
        ) : (
          <>
            <p className="mb-4 flex items-start gap-2 text-sm text-text-muted">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent" />
              Ends the shift and locks it. Count the till and send the report first.
            </p>
            <button
              onClick={handleClose}
              disabled={closing}
              className="btn-secondary h-12 w-full text-base text-danger sm:w-auto"
            >
              {closing ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
              Close the bar
            </button>
          </>
        )}
      </section>

      {loading && counts.length === 0 && reports.length === 0 && (
        <p className="mt-4 text-center text-sm text-text-muted">Loading shift data…</p>
      )}
    </div>
  );
}
