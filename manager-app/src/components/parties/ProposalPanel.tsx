import { useMemo, useState } from 'react';
import {
  FileSignature, Link2, Copy, Check, Loader2, Eye, PenLine, CreditCard, Send, ExternalLink, Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { Party } from '../../types';
import { useProposals, type Proposal, type ProposalStatus } from '../../hooks/useProposals';

interface ProposalPanelProps {
  party: Party;
}

/** Public site origin the client-facing proposal lives on (NOT the manager app). */
const PUBLIC_SITE_URL = (
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) || 'https://iggysseaside.com'
).replace(/\/$/, '');

const proposalUrl = (token: string) => `${PUBLIC_SITE_URL}/p/${token}`;

function fmtStamp(d: string | null): string | null {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d, yyyy h:mm a'); } catch { return d; }
}

/** Chips shown for each lifecycle milestone the client has reached. */
function StatusChips({ p }: { p: Proposal }) {
  const chips: { icon: React.ElementType; label: string; on: boolean; at: string | null }[] = [
    { icon: Send, label: 'Sent', on: !!p.sent_at, at: p.sent_at },
    { icon: Eye, label: 'Viewed', on: !!p.viewed_at, at: p.viewed_at },
    { icon: PenLine, label: 'Signed', on: !!p.signed_at, at: p.signed_at },
    { icon: CreditCard, label: 'Deposit paid', on: !!p.deposit_paid_at, at: p.deposit_paid_at },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(({ icon: Icon, label, on, at }) => (
        <span
          key={label}
          title={at ? fmtStamp(at) ?? undefined : 'Not yet'}
          className={
            on
              ? 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-primary/15 text-primary'
              : 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-surface-hover text-text-muted'
          }
        >
          <Icon size={12} /> {label}
        </span>
      ))}
    </div>
  );
}

function ProposalRow({ p, onRevoke, onMarkSent }: { p: Proposal; onRevoke: (id: number) => void; onMarkSent: (id: number) => void }) {
  const url = proposalUrl(p.token);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — long-press the link to copy.');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-hover/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <StatusChips p={p} />
        <button
          onClick={() => onRevoke(p.id)}
          className="btn-ghost text-xs text-text-muted hover:text-danger shrink-0"
          type="button"
          title="Revoke this link"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="input-field text-xs flex-1 min-w-0"
        />
        <button onClick={copy} className="btn-secondary text-xs shrink-0" type="button">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <ExternalLink size={12} /> Open proposal page
        </a>
        {/* Truth, not presumption: "Sent" is the manager's call, made after they
            actually deliver the link — not auto-claimed when it was generated. */}
        {!p.sent_at && (
          <button
            onClick={() => onMarkSent(p.id)}
            className="btn-secondary text-xs shrink-0"
            type="button"
            title="Stamp the Sent milestone once you've emailed/texted this link"
          >
            <Send size={13} /> Mark as sent
          </button>
        )}
      </div>
      {p.signer_name && (
        <p className="text-xs text-text-muted">
          Signed by <span className="text-text-secondary font-medium">{p.signer_name}</span>
          {p.signed_at ? ` · ${fmtStamp(p.signed_at)}` : ''}
        </p>
      )}
    </div>
  );
}

const STATUS_RANK: Record<ProposalStatus, number> = {
  draft: 0, sent: 1, viewed: 2, signed: 3, deposit_paid: 4,
};

export function ProposalPanel({ party }: ProposalPanelProps) {
  const { proposals, loading, creating, createProposal, markSent, removeProposal } = useProposals(party.id);

  // Surface the most-advanced live link first (most-recently created wins ties).
  const latest = useMemo(() => {
    if (proposals.length === 0) return null;
    return [...proposals].sort(
      (a, b) =>
        STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
        (b.created_at > a.created_at ? 1 : -1)
    )[0];
  }, [proposals]);

  const handleCreate = async () => {
    const created = await createProposal();
    if (!created) return;
    const url = proposalUrl(created.token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Proposal link created & copied');
    } catch {
      toast.success('Proposal link created');
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <FileSignature size={14} /> Proposal &amp; e-sign
        </h3>
        {latest && <StatusChips p={latest} />}
      </div>
      <p className="text-xs text-text-muted mb-4">
        One link the client opens with no login — they review the quote, e-sign, and pay the deposit.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted py-2">
          <Loader2 size={15} className="animate-spin" /> Loading proposals…
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <ProposalRow key={p.id} p={p} onRevoke={removeProposal} onMarkSent={markSent} />
          ))}

          {proposals.length === 0 && (
            <p className="text-sm text-text-muted flex items-center gap-2">
              <Link2 size={14} /> No proposal link yet.
            </p>
          )}

          <button onClick={handleCreate} disabled={creating} className="btn-primary text-sm" type="button">
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            {proposals.length === 0 ? 'Create proposal link' : 'Create another link'}
          </button>
        </div>
      )}
    </div>
  );
}
