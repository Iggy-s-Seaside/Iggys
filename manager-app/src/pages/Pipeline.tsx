import { useNavigate } from 'react-router-dom';
import { KanbanSquare, CalendarClock, Users, MapPin, Clock, DollarSign, PartyPopper } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { usePipeline, type PipelineCard, type PipelineColumn } from '../hooks/usePipeline';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-US')}`;

function fmtDate(d: string | null) {
  if (!d) return null;
  try {
    return format(parseISO(d), 'MMM d');
  } catch {
    return d;
  }
}

function Card({ card, onOpen }: { card: PipelineCard; onOpen: () => void }) {
  const { party: p, estValue, followUpDue, depositOwed } = card;
  const space = p.space_name || p.space;
  return (
    <button
      onClick={onOpen}
      className="card card-hover w-full text-left p-3.5 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary truncate">
          {p.title?.trim() || p.contact_name}
        </p>
        {estValue > 0 && (
          <span className="shrink-0 text-sm font-bold text-primary tabular-nums">{money(estValue)}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        {p.event_date ? (
          <span className="flex items-center gap-1">
            <CalendarClock size={11} /> {fmtDate(p.event_date)}
          </span>
        ) : (
          <span className="text-text-muted/70">No date</span>
        )}
        {p.guest_count != null && (
          <span className="flex items-center gap-1">
            <Users size={11} /> {p.guest_count}
          </span>
        )}
        {space && (
          <span className="flex items-center gap-1 truncate">
            <MapPin size={11} /> {space}
          </span>
        )}
      </div>

      {(followUpDue || depositOwed) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {followUpDue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning-light text-accent-hover">
              <Clock size={11} /> Follow-up due
            </span>
          )}
          {depositOwed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full badge-danger">
              <DollarSign size={11} /> Deposit owed
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function Column({ column, onOpen }: { column: PipelineColumn; onOpen: (id: number) => void }) {
  return (
    <div className="shrink-0 w-[82vw] sm:w-72 flex flex-col">
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
          <div className="card border-dashed py-8 text-center text-xs text-text-muted">Nothing here</div>
        ) : (
          column.cards.map((card) => (
            <Card key={card.party.id} card={card} onOpen={() => onOpen(card.party.id)} />
          ))
        )}
      </div>
    </div>
  );
}

export function Pipeline() {
  const { columns, openValue, loading } = usePipeline();
  const navigate = useNavigate();

  const isEmpty = !loading && columns.every((c) => c.count === 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <KanbanSquare size={22} className="text-primary" /> Pipeline
          </h1>
          <p className="text-sm text-text-muted mt-1">Your private-events sales board, inquiry to paid</p>
        </div>
        {!loading && openValue > 0 && (
          <div className="card px-4 py-2.5 flex items-center gap-3 sm:gap-2">
            <span className="text-xs text-text-secondary">Open pipeline</span>
            <span className="text-lg font-bold text-text-primary tabular-nums">{money(openValue)}</span>
          </div>
        )}
      </div>

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
        <div className="card p-12 text-center">
          <PartyPopper size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No parties in the pipeline yet</p>
          <p className="text-sm text-text-muted mt-1">
            New inquiries land here automatically — track each one from request to paid.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory">
          {columns.map((column) => (
            <div key={column.stage} className="snap-start">
              <Column column={column} onOpen={(id) => navigate(`/parties/${id}`)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
