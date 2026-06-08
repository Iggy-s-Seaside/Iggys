import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, PartyPopper, ChevronRight, Users, CalendarClock, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useParties } from '../hooks/useParties';
import { PartyForm } from '../components/parties/PartyForm';
import { PARTY_STATUS_LABELS, PARTY_SOURCE_LABELS, type Party, type PartyStatus } from '../types';

function fmtDate(d: string | null, fmt = 'MMM d, yyyy') {
  if (!d) return null;
  try { return format(parseISO(d), fmt); } catch { return d; }
}

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

const TABS: PartyStatus[] = ['inquiry', 'confirmed', 'cancelled'];

export function Parties() {
  const { parties, loading, create } = useParties();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PartyStatus>('inquiry');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<PartyStatus, number> = { inquiry: 0, confirmed: 0, cancelled: 0 };
    for (const p of parties) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [parties]);

  // Count active (non-cancelled) parties per date to flag same-date conflicts.
  const dateCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of parties) {
      if (p.status !== 'cancelled' && p.event_date) c[p.event_date] = (c[p.event_date] ?? 0) + 1;
    }
    return c;
  }, [parties]);

  const filtered = useMemo(() => {
    let result = parties.filter((p) => p.status === tab);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.contact_name.toLowerCase().includes(q) ||
          (p.company || '').toLowerCase().includes(q) ||
          (p.contact_email || '').toLowerCase().includes(q) ||
          (p.title || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [parties, tab, search]);

  const handleCreate = async (payload: Partial<Party>) => {
    const created = await create({ ...payload, status: 'inquiry' });
    if (created && typeof created !== 'boolean') {
      navigate(`/parties/${created.id}`);
      return created;
    }
    return null;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Parties</h1>
          <p className="text-sm text-text-muted mt-1">Private event inquiries, bookings &amp; follow-ups</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus size={18} /> New Party
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
            }`}
          >
            {PARTY_STATUS_LABELS[t]} ({counts[t]})
          </button>
        ))}
      </div>

      {tab === 'inquiry' && (
        <p className="text-xs text-text-muted mb-3 -mt-1">Tentative — requests aren't on the calendar until you confirm one.</p>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input className="input-field pl-9" placeholder="Search by name, company, email…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-5 bg-surface-hover rounded w-1/3 mb-2" />
              <div className="h-4 bg-surface-hover rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <PartyPopper size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">
            {tab === 'inquiry' ? 'No requests yet' : tab === 'confirmed' ? 'No confirmed parties yet' : 'No cancelled parties'}
          </p>
          <p className="text-sm text-text-muted mt-1">
            {tab === 'inquiry' ? 'Website requests and ones you log will show up here.' : `Parties marked ${tab} will appear here.`}
          </p>
          {tab === 'inquiry' && (
            <button onClick={() => setFormOpen(true)} className="btn-primary mt-4 inline-flex">
              <Plus size={18} /> New Party
            </button>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/parties/${p.id}`)}
              className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-surface-hover transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <PartyPopper size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {p.title?.trim() || p.contact_name}
                  </p>
                  <span className={STATUS_BADGE[p.status]}>{PARTY_STATUS_LABELS[p.status]}</span>
                  {p.source && p.source !== 'manual' && (
                    <span className="text-[10px] uppercase tracking-wide text-text-muted border border-border rounded px-1.5 py-0.5 shrink-0">
                      {PARTY_SOURCE_LABELS[p.source] ?? p.source}
                    </span>
                  )}
                  {p.is_private === false && (
                    <span className="text-[10px] uppercase tracking-wide text-text-muted border border-border rounded px-1.5 py-0.5 shrink-0">
                      General
                    </span>
                  )}
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-text-muted">
                  {p.title?.trim() && <span>{p.contact_name}</span>}
                  {p.company && <span>{p.company}</span>}
                  {p.event_date && (
                    <span className="flex items-center gap-1"><CalendarClock size={11} /> {fmtDate(p.event_date)}</span>
                  )}
                  {p.guest_count != null && (
                    <span className="flex items-center gap-1"><Users size={11} /> {p.guest_count}</span>
                  )}
                  {p.status === 'inquiry' && p.follow_up_date && (
                    <span className="flex items-center gap-1 text-accent"><Clock size={11} /> follow up {fmtDate(p.follow_up_date, 'MMM d')}</span>
                  )}
                  {p.event_date && dateCounts[p.event_date] > 1 && (
                    <span className="flex items-center gap-1 text-accent"><AlertTriangle size={11} /> shared date</span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-text-muted shrink-0" />
            </button>
          ))}
        </div>
      )}

      <PartyForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleCreate} />
    </div>
  );
}
