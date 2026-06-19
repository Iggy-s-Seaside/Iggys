import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanSquare, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';
import { useParties } from '../hooks/useParties';
import {
  usePipeline,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineCard as PipelineCardData,
  type PipelineColumn,
  type PipelineStage,
} from '../hooks/usePipeline';
import { money } from '../utils/format';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PipelineCard } from '../components/pipeline/PipelineCard';
import type { Party } from '../types';
import { buzz } from '../utils/haptics';

/**
 * Pipeline stages are *derived* (see usePipeline), so advancing a card means
 * writing the minimal party fields that make `stageFor` land on the target.
 * These writes are honest, reversible manager actions — they never touch prices
 * or menu data:
 *   new → proposal : stamp last_contacted_at (you reached out)
 *   proposal → confirmed : status = confirmed (the booking is won)
 * The board NEVER writes payment_status: the "Paid" column is derived from a
 * REAL recorded payment (Stripe webhook / Deposit panel). Moves into/out of Paid
 * are intercepted in moveCard and routed to the party's deposit panel — dragging
 * must never fabricate (or wipe) a payment. Back-transitions clear contact signals.
 */
function fieldsForStage(target: PipelineStage, card: PipelineCardData): Partial<Party> {
  switch (target) {
    case 'new':
      return { status: 'inquiry', confirmation_sent_at: null, last_contacted_at: null };
    case 'proposal':
      return {
        status: 'inquiry',
        last_contacted_at: card.party.last_contacted_at || new Date().toISOString(),
      };
    case 'confirmed':
      return { status: 'confirmed', cancelled_at: null };
    case 'paid':
      // Never reached: moveCard guards 'paid' transitions before calling this.
      return {};
  }
}

interface DragState {
  partyId: number;
  from: PipelineStage;
  /** Pointer offset within the card so the ghost tracks the grab point. */
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  width: number;
  over: PipelineStage | null;
}

export function Pipeline() {
  const { columns: baseColumns, openValue: baseOpenValue, loading } = usePipeline();
  const { update } = useParties();
  const navigate = useNavigate();

  // Optimistic overlays keyed by party id — applied on top of the derived board
  // so a stage move shows instantly, then reconciles when realtime refreshes.
  const [overrides, setOverrides] = useState<Record<number, PipelineStage>>({});
  // Cards to play the celebratory pop on (cleared after the animation window).
  const [celebrating, setCelebrating] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const columnRefs = useRef<Map<PipelineStage, HTMLElement>>(new Map());
  const dragMoved = useRef(false);

  // Rebuild columns honoring optimistic overrides.
  const columns = useMemo<PipelineColumn[]>(() => {
    if (Object.keys(overrides).length === 0) return baseColumns;

    const byStage: Record<PipelineStage, PipelineCardData[]> = {
      new: [],
      proposal: [],
      confirmed: [],
      paid: [],
    };
    for (const col of baseColumns) {
      for (const card of col.cards) {
        const target = overrides[card.party.id] ?? col.stage;
        byStage[target].push(card);
      }
    }
    return baseColumns.map((col) => ({
      ...col,
      cards: byStage[col.stage],
      count: byStage[col.stage].length,
      total: byStage[col.stage].reduce((sum, c) => sum + c.estValue, 0),
    }));
  }, [baseColumns, overrides]);

  const openValue = useMemo(() => {
    if (Object.keys(overrides).length === 0) return baseOpenValue;
    return columns.filter((c) => c.stage !== 'paid').reduce((sum, c) => sum + c.total, 0);
  }, [columns, overrides, baseOpenValue]);

  const stageOf = useCallback(
    (partyId: number, fallback: PipelineStage): PipelineStage => overrides[partyId] ?? fallback,
    [overrides],
  );

  const moveCard = useCallback(
    async (card: PipelineCardData, from: PipelineStage, target: PipelineStage) => {
      if (target === from) return;

      // The "Paid" column mirrors a real recorded payment (payment_status), never a
      // drag. Route any move into/out of Paid to the party's deposit panel so the
      // manager records (or refunds) actual money — dragging must not fabricate a
      // payment, nor wipe one off a genuinely-paid party.
      if (target === 'paid' || from === 'paid') {
        toast(
          target === 'paid'
            ? 'Record the deposit on the party to move it to Paid.'
            : 'This party has a payment on file — manage it from the party profile.',
        );
        navigate(`/parties/${card.party.id}`);
        return;
      }

      const fields = fieldsForStage(target, card);
      const targetIdx = PIPELINE_STAGES.indexOf(target);
      const fromIdx = PIPELINE_STAGES.indexOf(from);
      // The win: crossing into the confirmed/paid region from a pre-confirmed stage.
      const wonIdx = PIPELINE_STAGES.indexOf('confirmed');
      const won = targetIdx >= wonIdx && fromIdx < wonIdx;

      // Optimistic: move the card now.
      setOverrides((prev) => ({ ...prev, [card.party.id]: target }));
      buzz(won ? [12, 24, 36] : 10);

      if (won) {
        setCelebrating((prev) => new Set(prev).add(card.party.id));
        window.setTimeout(() => {
          setCelebrating((prev) => {
            const next = new Set(prev);
            next.delete(card.party.id);
            return next;
          });
        }, 700);
      }

      const ok = await update(card.party.id, fields);

      // Either way, drop the override: on success useParties has already refreshed
      // (it awaits its own refresh) so baseColumns now reflects the real stage; on
      // failure we roll back and useParties has surfaced the error toast.
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[card.party.id];
        return next;
      });

      if (ok) {
        const label = PIPELINE_STAGE_LABELS[target];
        if (won) toast.success(`Booking confirmed! Moved to ${label}`);
        else if (targetIdx > fromIdx) toast.success(`Advanced to ${label}`);
        else toast.success(`Moved back to ${label}`);
      }
    },
    [update, navigate],
  );

  const stepCard = useCallback(
    (card: PipelineCardData, from: PipelineStage, dir: 1 | -1) => {
      const idx = PIPELINE_STAGES.indexOf(from);
      const target = PIPELINE_STAGES[idx + dir];
      if (!target) return;
      void moveCard(card, from, target);
    },
    [moveCard],
  );

  // ── Pointer drag ──────────────────────────────────────────────────────────
  const columnAtPoint = useCallback((x: number, y: number): PipelineStage | null => {
    for (const [stage, el] of columnRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return stage;
    }
    return null;
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent, card: PipelineCardData, from: PipelineStage) => {
      // Let mouse right-clicks and multi-touch fall through to normal scrolling.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const handle = e.currentTarget as HTMLElement;
      const cardEl = handle.closest('[data-pipeline-card]') as HTMLElement | null;
      const rect = (cardEl ?? handle).getBoundingClientRect();
      handle.setPointerCapture(e.pointerId);
      dragMoved.current = false;
      setDrag({
        partyId: card.party.id,
        from,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        over: from,
      });
    },
    [],
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      dragMoved.current = true;
      const over = columnAtPoint(e.clientX, e.clientY);
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over } : d));
    },
    [drag, columnAtPoint],
  );

  const endDrag = useCallback(
    () => {
      if (!drag) return;
      const target = drag.over;
      const from = drag.from;
      const partyId = drag.partyId;
      setDrag(null);
      if (!dragMoved.current || !target || target === from) return;
      // Find the live card to move.
      const card = baseColumns
        .flatMap((c) => c.cards)
        .find((c) => c.party.id === partyId);
      if (card) void moveCard(card, stageOf(partyId, from), target);
    },
    [drag, baseColumns, moveCard, stageOf],
  );

  const isEmpty = !loading && columns.every((c) => c.count === 0);

  return (
    <div>
      <PageHeader icon={KanbanSquare} title="Pipeline" subtitle="Your private-events sales board, inquiry to paid">
        {!loading && openValue > 0 && (
          <div className="card px-4 py-2.5 flex items-center gap-3 sm:gap-2">
            <span className="text-xs text-text-secondary">Open pipeline</span>
            <span className="text-lg font-bold text-text-primary tabular-nums">{money(openValue)}</span>
          </div>
        )}
      </PageHeader>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0 w-[82vw] sm:w-72 space-y-2.5">
              <div className="h-5 bg-surface-hover rounded w-2/3 animate-pulse mb-3" />
              {[1, 2].map((j) => (
                <div key={j} className="card p-4 animate-pulse">
                  <div className="h-4 bg-surface-hover rounded w-1/2 mb-2" />
                  <div className="h-3 bg-surface-hover rounded w-1/3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={PartyPopper}
          title="No parties in the pipeline yet"
          description="New inquiries land here automatically — track each one from request to paid."
        />
      ) : (
        <div
          className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory"
          onPointerMove={drag ? onDragMove : undefined}
          onPointerUp={drag ? endDrag : undefined}
          onPointerCancel={drag ? endDrag : undefined}
        >
          {columns.map((column) => {
            const stageIdx = PIPELINE_STAGES.indexOf(column.stage);
            const nextStage = PIPELINE_STAGES[stageIdx + 1] ?? null;
            const prevStage = PIPELINE_STAGES[stageIdx - 1] ?? null;
            const isDropTarget = drag?.over === column.stage && drag.from !== column.stage;
            return (
              <div key={column.stage} className="snap-start">
                <div
                  ref={(el) => {
                    if (el) columnRefs.current.set(column.stage, el);
                    else columnRefs.current.delete(column.stage);
                  }}
                  className={`shrink-0 w-[82vw] sm:w-72 flex flex-col rounded-xl transition-colors ${
                    isDropTarget ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-3 px-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-sm font-semibold text-text-primary truncate">{column.label}</h2>
                      <span className="shrink-0 text-xs font-medium text-text-muted bg-surface-hover rounded-full px-2 py-0.5">
                        {column.count}
                      </span>
                    </div>
                    {column.total > 0 && (
                      <span className="shrink-0 text-xs font-semibold text-text-secondary tabular-nums">
                        {money(column.total)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {column.cards.length === 0 ? (
                      <div
                        className={`card border-dashed py-8 text-center text-xs transition-colors ${
                          isDropTarget ? 'text-primary border-primary' : 'text-text-muted'
                        }`}
                      >
                        {isDropTarget ? `Drop in ${column.label}` : 'Nothing here'}
                      </div>
                    ) : (
                      column.cards.map((card) => (
                        <div key={card.party.id} data-pipeline-card>
                          <PipelineCard
                            card={card}
                            onOpen={() => navigate(`/parties/${card.party.id}`)}
                            onAdvance={nextStage ? () => stepCard(card, column.stage, 1) : null}
                            onBack={prevStage ? () => stepCard(card, column.stage, -1) : null}
                            nextLabel={nextStage ? PIPELINE_STAGE_LABELS[nextStage] : null}
                            prevLabel={prevStage ? PIPELINE_STAGE_LABELS[prevStage] : null}
                            dragging={drag?.partyId === card.party.id}
                            celebrate={celebrating.has(card.party.id)}
                            dragHandleProps={{
                              onPointerDown: (e) => startDrag(e, card, column.stage),
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drag ghost — follows the pointer; pure visual, ignores pointer events. */}
      {drag && (
        <div
          className="fixed z-50 pointer-events-none card card-hover px-3.5 py-3 shadow-modal opacity-90"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
          }}
        >
          <p className="text-sm font-semibold text-text-primary truncate">
            {dragLabel(baseColumns, drag.partyId)}
          </p>
          {drag.over && drag.over !== drag.from && (
            <p className="text-xs text-primary font-medium mt-0.5">→ {PIPELINE_STAGE_LABELS[drag.over]}</p>
          )}
        </div>
      )}
    </div>
  );
}

function dragLabel(columns: PipelineColumn[], partyId: number): string {
  for (const col of columns) {
    for (const card of col.cards) {
      if (card.party.id === partyId) return card.party.title?.trim() || card.party.contact_name;
    }
  }
  return 'Moving…';
}
