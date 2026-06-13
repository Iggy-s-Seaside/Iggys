import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  PartyPopper, Loader2, CheckCircle2, FileSignature, CreditCard, ShieldCheck, CalendarClock, Users, MapPin,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  usePublicProposal,
  type ProposalParty,
  type ProposalPartyPackage,
} from '../hooks/usePublicProposal';

/** Public site origin — where this page lives; used for Stripe success/cancel return. */
const SITE_URL = (
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://iggysseaside.com')
).replace(/\/$/, '');

const money = (n: number) => `$${(n || 0).toFixed(2)}`;

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch {
    return d;
  }
}

// ── Invoice math (ported from manager-app/src/utils/invoice.ts) ──
// Gratuity applies to food + beverage ONLY — kept identical to the manager side.

function lineAmount(line: ProposalPartyPackage, guestCount: number | null, roomHours: number | null): number {
  const qty = line.quantity || 0;
  const price = line.unit_price || 0;
  if (line.unit === 'per_person') return price * (guestCount ?? 0) * qty;
  if (line.unit === 'per_hour') return price * (roomHours ?? 0) * qty;
  return price * qty; // flat
}

interface InvoiceLine {
  name: string;
  detail: string;
  amount: number;
}

interface InvoiceBreakdown {
  foodTotal: number;
  drinkTotal: number;
  gratuity: number;
  subtotal: number;
  roomTotal: number;
  addons: number;
  grandTotal: number;
  packageLines: InvoiceLine[];
}

const unitSuffix = (unit: string) => (unit === 'flat' ? '' : ` ${unit.replace('_', ' ')}`);

function computeInvoice(party: ProposalParty, lines: ProposalPartyPackage[]): InvoiceBreakdown {
  const guestCount = party.guest_count;
  const roomHours = party.room_hours ?? 0;
  const gratuityRate = party.gratuity_rate ?? 0.18;

  const bucket = (cat: string) =>
    lines
      .filter((l) => l.category === cat)
      .reduce((sum, l) => sum + lineAmount(l, guestCount, roomHours), 0);

  const foodTotal = (party.food_total || 0) + bucket('food');
  const drinkTotal = (party.drink_total || 0) + bucket('drink');
  const roomManual = (party.room_rate || 0) * roomHours;
  const roomTotal = roomManual + bucket('room');
  const addons = bucket('addon') + bucket('other');
  const gratuity = gratuityRate * (foodTotal + drinkTotal);
  const subtotal = foodTotal + drinkTotal + gratuity;
  const grandTotal = subtotal + roomTotal + addons;

  const packageLines: InvoiceLine[] = lines.map((l) => ({
    name: l.name,
    detail: `${l.quantity} × $${(l.unit_price || 0).toFixed(2)}${unitSuffix(l.unit)}`,
    amount: lineAmount(l, guestCount, roomHours),
  }));

  return { foodTotal, drinkTotal, gratuity, subtotal, roomTotal, addons, grandTotal, packageLines };
}

// ── Sub-views ──

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="section-padding pt-32 min-h-[70vh]">
      <div className="section-container max-w-2xl mx-auto">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? 'border-t border-white/10 mt-1 pt-3' : ''}`}>
      <span className={strong ? 'text-white font-bold' : muted ? 'text-text-dim text-sm' : 'text-text-muted text-sm'}>{label}</span>
      <span className={strong ? 'text-white font-bold text-lg' : 'text-white text-sm font-medium'}>{value}</span>
    </div>
  );
}

export default function ProposalView() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const justPaid = searchParams.get('paid') === '1';

  const { proposal, party, lines, loading, error, refresh } = usePublicProposal(token);

  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  // Stamp the first view exactly once (per token) via the service-role function.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!token || !proposal || viewedRef.current) return;
    viewedRef.current = true;
    if (proposal.viewed_at) return; // already recorded
    supabase.functions
      .invoke('proposal-sign', { body: { token, action: 'view' } })
      .catch(() => { /* a missed view stamp is non-fatal */ });
  }, [token, proposal]);

  const breakdown = useMemo(
    () => (party ? computeInvoice(party, lines) : null),
    [party, lines]
  );

  const signedName = proposal?.signer_name ?? null;
  const isSigned = !!proposal?.signed_at;
  const depositAmount = party?.deposit_amount ?? 0;
  const depositPaid = proposal?.status === 'deposit_paid' || party?.payment_status === 'partial' || party?.payment_status === 'paid';

  const handleSign = async () => {
    if (!token) return;
    const name = signerName.trim();
    if (!name) { setSignError('Please type your full name to sign.'); return; }
    if (!agreed) { setSignError('Please check the box to agree.'); return; }
    setSigning(true);
    setSignError('');
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('proposal-sign', {
        body: { token, action: 'sign', signer_name: name },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      await refresh();
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Could not record your signature. Please try again.');
    }
    setSigning(false);
  };

  const handlePayDeposit = async () => {
    if (!party || !token) return;
    setPaying(true);
    setPayError('');
    try {
      const returnUrl = `${SITE_URL}/p/${token}`;
      const { data, error: invokeErr } = await supabase.functions.invoke('create-checkout', {
        body: {
          purpose: 'party_deposit',
          party_id: party.id,
          success_url: `${returnUrl}?paid=1`,
          cancel_url: returnUrl,
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('Could not start checkout. Please try again.');
      window.location.href = data.url as string;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not start checkout. Please try again or call (503) 738-0672.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  if (error || !proposal || !party || !breakdown) {
    return (
      <Shell>
        <div className="glass-card p-10 text-center">
          <h1 className="font-heading text-2xl font-bold text-white mb-3">Proposal not found</h1>
          <p className="text-text-muted">
            This link may have expired or been revoked. Please reach out and we'll send a fresh one.
          </p>
          <p className="text-text-muted text-sm mt-4">Questions? Call (503) 738-0672.</p>
        </div>
      </Shell>
    );
  }

  const title = party.title?.trim() || `Private Event — ${party.contact_name}`;
  const timeRange = [party.start_time, party.end_time].filter(Boolean).join(' – ');
  const gratuityPct = Math.round((party.gratuity_rate ?? 0.18) * 100);

  return (
    <>
      <section className="relative py-16 lg:py-20 pt-32 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="uppercase tracking-widest text-xs font-bold text-primary mb-4">Your Event Proposal</p>
          <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent mx-auto mb-6" />
          <h1 className="font-heading text-3xl lg:text-4xl font-bold text-white flex items-center justify-center gap-3">
            <PartyPopper className="w-8 h-8 text-primary" /> {title}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-text-muted text-sm mt-4">
            {party.event_date && (
              <span className="flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-primary" /> {fmtDate(party.event_date)}{timeRange ? ` · ${timeRange}` : ''}</span>
            )}
            {party.guest_count != null && (
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" /> {party.guest_count} guests</span>
            )}
            {party.space_name && (
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" /> {party.space_name}</span>
            )}
          </div>
        </div>
      </section>

      <section className="section-padding pt-0">
        <div className="section-container max-w-2xl mx-auto space-y-6">
          {justPaid && (
            <div className="glass-card p-5 border border-primary/30 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold">Deposit received — thank you!</p>
                <p className="text-text-muted text-sm mt-0.5">Your date is locked in. We'll be in touch with the final details.</p>
              </div>
            </div>
          )}

          {/* Itemized quote */}
          <div className="glass-card p-6">
            <h2 className="font-heading text-xl font-bold text-white mb-4">Your quote</h2>

            {breakdown.packageLines.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {breakdown.packageLines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-white/85">
                      {l.name} <span className="text-text-dim">({l.detail})</span>
                    </span>
                    <span className="text-white/85">{money(l.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 mt-2 pt-1" />
              </div>
            )}

            <SummaryRow label="Food total" value={money(breakdown.foodTotal)} />
            <SummaryRow label="Drink total" value={money(breakdown.drinkTotal)} />
            <SummaryRow label={`Gratuity (${gratuityPct}%)`} value={money(breakdown.gratuity)} />
            <SummaryRow label="Subtotal" value={money(breakdown.subtotal)} muted />
            <SummaryRow label="Room total" value={money(breakdown.roomTotal)} />
            {breakdown.addons > 0 && <SummaryRow label="Add-ons" value={money(breakdown.addons)} />}
            <SummaryRow label="Estimated total" value={money(breakdown.grandTotal)} strong />
            <p className="text-xs text-text-dim mt-3">
              Final amounts may shift slightly with your final guest count and selections.
            </p>
          </div>

          {/* E-signature */}
          <div className="glass-card p-6">
            <h2 className="font-heading text-xl font-bold text-white flex items-center gap-2 mb-1">
              <FileSignature className="w-5 h-5 text-primary" /> Accept &amp; e-sign
            </h2>

            {isSigned ? (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Signed by {signedName}</p>
                  {proposal.signed_at && (
                    <p className="text-text-muted text-sm mt-0.5">
                      {new Date(proposal.signed_at).toLocaleString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <p className="text-text-muted text-sm">
                  Type your full name to accept this proposal. Your typed name is your electronic signature.
                </p>
                <div>
                  <label className="text-sm text-text-muted mb-1 block">Full name *</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-text-dim focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </div>
                <label className="flex items-start gap-2.5 text-sm text-white/85 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-primary shrink-0"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>I agree to this proposal and authorize Iggy's Bar in Seaside to reserve this date for my event.</span>
                </label>
                {signError && <p className="text-amber-400 text-sm">{signError}</p>}
                <button
                  onClick={handleSign}
                  disabled={signing || !signerName.trim() || !agreed}
                  className="btn-primary w-full py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {signing ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing…</> : <><FileSignature className="w-5 h-5" /> Accept &amp; sign</>}
                </button>
              </div>
            )}
          </div>

          {/* Deposit */}
          <div className="glass-card p-6">
            <h2 className="font-heading text-xl font-bold text-white flex items-center gap-2 mb-1">
              <CreditCard className="w-5 h-5 text-primary" /> Pay your deposit
            </h2>

            {depositPaid ? (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-white font-medium">Deposit paid — your date is reserved.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-text-muted text-sm">Deposit due now</span>
                  <span className="text-white font-bold text-lg">{money(depositAmount)}</span>
                </div>
                {!isSigned && (
                  <p className="text-text-muted text-sm">Please accept &amp; sign above before paying your deposit.</p>
                )}
                {payError && <p className="text-amber-400 text-sm">{payError}</p>}
                <button
                  onClick={handlePayDeposit}
                  disabled={paying || !isSigned || depositAmount <= 0}
                  className="btn-primary w-full py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paying ? <><Loader2 className="w-5 h-5 animate-spin" /> Starting checkout…</> : <><CreditCard className="w-5 h-5" /> Pay {money(depositAmount)} deposit</>}
                </button>
                <p className="text-center text-xs text-text-dim flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure payment by Stripe · Apple Pay &amp; Google Pay supported
                </p>
              </div>
            )}
          </div>

          <p className="text-center text-text-muted text-sm">
            Questions about your event? Call us at (503) 738-0672.
          </p>
        </div>
      </section>
    </>
  );
}
