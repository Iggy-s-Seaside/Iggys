import { useMemo } from 'react';
import { Calculator, Check, Loader2, Minus, Plus, Sparkles, UtensilsCrossed, Wine, DoorOpen, Gift, ArrowRight } from 'lucide-react';
import { usePublicPackages, type PublicPackage, type PublicPackageCategory } from '../../hooks/usePublicPackages';

/** Gratuity rate — matches the manager's invoice default (18%, food + drink only). */
const GRATUITY_RATE = 0.18;

const money = (n: number) =>
  `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const moneyPrecise = (n: number) =>
  `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Display grouping. 'other' folds into add-ons, mirroring the invoice's addon bucket. */
const CATEGORY_META: Record<
  PublicPackageCategory,
  { label: string; icon: typeof UtensilsCrossed; group: 'food' | 'drink' | 'room' | 'addon' }
> = {
  food: { label: 'Food', icon: UtensilsCrossed, group: 'food' },
  drink: { label: 'Drinks', icon: Wine, group: 'drink' },
  room: { label: 'Room', icon: DoorOpen, group: 'room' },
  addon: { label: 'Add-ons', icon: Gift, group: 'addon' },
  other: { label: 'Add-ons', icon: Gift, group: 'addon' },
};

const GROUP_ORDER: Array<{ key: 'food' | 'drink' | 'room' | 'addon'; label: string; icon: typeof UtensilsCrossed }> = [
  { key: 'food', label: 'Food', icon: UtensilsCrossed },
  { key: 'drink', label: 'Drinks', icon: Wine },
  { key: 'room', label: 'Room', icon: DoorOpen },
  { key: 'addon', label: 'Add-ons', icon: Gift },
];

/** Dollar amount of one selected package, mirroring invoice.ts `lineAmount` (quantity = 1). */
function lineAmount(pkg: PublicPackage, guests: number, hours: number): number {
  if (pkg.unit === 'per_person') return pkg.price * guests;
  if (pkg.unit === 'per_hour') return pkg.price * hours;
  return pkg.price; // flat
}

function unitDetail(pkg: PublicPackage): string {
  // Prices aren't all locked yet — never show "$0". Anything unpriced reads as a quote.
  if (pkg.price <= 0) return 'Price on request';
  if (pkg.unit === 'per_person') return `${moneyPrecise(pkg.price)} / guest`;
  if (pkg.unit === 'per_hour') return `${moneyPrecise(pkg.price)} / hour`;
  return `${moneyPrecise(pkg.price)} flat`;
}

const clampInt = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : min;

interface StepperProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix: string;
}

function Stepper({ label, value, onChange, min, max, suffix }: StepperProps) {
  return (
    <div>
      <label className="text-sm text-text-muted mb-2 block">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clampInt(value - 1, min, max))}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="shrink-0 w-11 h-11 rounded-xl border border-white/10 bg-white/[0.03] text-white flex items-center justify-center hover:border-primary/40 active:scale-95 transition disabled:opacity-40"
          disabled={value <= min}
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(clampInt(Number(e.target.value), min, max))}
            aria-label={label}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-center text-white text-lg font-semibold tabular-nums focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <p className="text-center text-2xs uppercase tracking-wider text-text-dim mt-1">{suffix}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(clampInt(value + 1, min, max))}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="shrink-0 w-11 h-11 rounded-xl border border-white/10 bg-white/[0.03] text-white flex items-center justify-center hover:border-primary/40 active:scale-95 transition disabled:opacity-40"
          disabled={value >= max}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface PackageCardProps {
  pkg: PublicPackage;
  selected: boolean;
  amount: number;
  onToggle: () => void;
}

function PackageCard({ pkg, selected, amount, onToggle }: PackageCardProps) {
  const Icon = CATEGORY_META[pkg.category].icon;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`relative text-left p-4 rounded-xl border min-h-[44px] transition flex flex-col gap-2 ${
        selected ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
      }`}
    >
      {pkg.featured && (
        <span className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-background">
          <Sparkles className="w-3 h-3" /> Popular
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${
              selected ? 'bg-primary/15 border-primary/30 text-primary' : 'border-white/10 text-text-muted'
            }`}
          >
            <Icon className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-white font-medium leading-tight">{pkg.name}</span>
            <span className="block text-xs text-text-dim mt-0.5">{unitDetail(pkg)}</span>
          </span>
        </div>
        <span
          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
            selected ? 'bg-primary border-primary' : 'border-white/30'
          }`}
        >
          {selected && <Check className="w-3.5 h-3.5 text-background" />}
        </span>
      </div>
      {pkg.publicDescription && <p className="text-xs text-text-muted leading-relaxed">{pkg.publicDescription}</p>}
      {selected && (
        <p className="text-sm font-semibold text-primary tabular-nums mt-auto pt-1">
          {pkg.price > 0 ? moneyPrecise(amount) : 'Quoted by our team'}
        </p>
      )}
    </button>
  );
}

interface PackageEstimatorProps {
  /** Shared, controlled state — BookEvent owns it so the estimator and the
   *  booking form are ONE configurator (single source of truth, no re-entry). */
  guests: number;
  hours: number;
  selectedIds: Set<number>;
  onGuestsChange: (n: number) => void;
  onHoursChange: (n: number) => void;
  onToggle: (id: number) => void;
  /** Continue to the booking form (carries a recap snapshot for the banner). */
  onContinue?: (sel: {
    guests: number;
    hours: number;
    packageIds: number[];
    packageNames: string[];
    estimateTotal: number;
    unpriced: number;
  }) => void;
}

export default function PackageEstimator({
  guests, hours, selectedIds, onGuestsChange, onHoursChange, onToggle, onContinue,
}: PackageEstimatorProps) {
  const { packages, loading } = usePublicPackages();
  const selected = selectedIds;

  const selectedPackages = useMemo(
    () => packages.filter((p) => selected.has(p.id)),
    [packages, selected]
  );

  // Group active packages for display, folding 'other' into add-ons.
  const grouped = useMemo(() => {
    const map = new Map<'food' | 'drink' | 'room' | 'addon', PublicPackage[]>();
    for (const p of packages) {
      const g = CATEGORY_META[p.category].group;
      const arr = map.get(g) ?? [];
      arr.push(p);
      map.set(g, arr);
    }
    return map;
  }, [packages]);

  // Estimate math — identical to manager's computeInvoice:
  //   food/drink totals (+18% gratuity on those only), room + add-ons excluded from gratuity.
  const estimate = useMemo(() => {
    let food = 0;
    let drink = 0;
    let room = 0;
    let addons = 0;
    for (const p of selectedPackages) {
      const amt = lineAmount(p, guests, hours);
      if (p.category === 'food') food += amt;
      else if (p.category === 'drink') drink += amt;
      else if (p.category === 'room') room += amt;
      else addons += amt; // addon + other
    }
    const gratuity = GRATUITY_RATE * (food + drink);
    const grandTotal = food + drink + gratuity + room + addons;
    // How many chosen packages aren't priced yet — surfaced as "on request"
    // instead of silently contributing $0 to the total.
    const unpriced = selectedPackages.filter((p) => p.price <= 0).length;
    return { food, drink, room, addons, gratuity, grandTotal, unpriced };
  }, [selectedPackages, guests, hours]);

  const hasSelection = selectedPackages.length > 0;

  if (loading) {
    return (
      <div className="glass-card p-10 flex items-center justify-center text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading packages…
      </div>
    );
  }

  if (packages.length === 0) return null;

  return (
    <section aria-labelledby="estimator-heading" className="space-y-6">
      <div className="text-center">
        <p className="uppercase tracking-widest text-xs font-bold text-primary mb-3">Group Packages</p>
        <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent mx-auto mb-4" />
        <h2 id="estimator-heading" className="font-heading text-3xl lg:text-4xl font-bold text-white flex items-center justify-center gap-2.5">
          <Calculator className="w-7 h-7 text-primary" /> Build your estimate
        </h2>
        <p className="text-text-muted max-w-xl mx-auto mt-3">
          Pick what sounds good, set your group size and hours, and we'll show a ballpark instantly. No commitment — it just helps you plan.
        </p>
      </div>

      {/* Guests + hours */}
      <div className="glass-card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Stepper label="Guests" value={guests} onChange={onGuestsChange} min={1} max={500} suffix="people" />
          <Stepper label="Hours" value={hours} onChange={onHoursChange} min={1} max={24} suffix="hours" />
        </div>
      </div>

      {/* Package cards, grouped */}
      {GROUP_ORDER.map(({ key, label, icon: GroupIcon }) => {
        const items = grouped.get(key);
        if (!items || items.length === 0) return null;
        return (
          <div key={key} className="glass-card p-6 space-y-3">
            <h3 className="font-heading text-lg font-bold text-white flex items-center gap-2">
              <GroupIcon className="w-5 h-5 text-primary" /> {label}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((p) => (
                <PackageCard
                  key={p.id}
                  pkg={p}
                  selected={selected.has(p.id)}
                  amount={lineAmount(p, guests, hours)}
                  onToggle={() => onToggle(p.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Live estimate */}
      <div className="glass-card p-6 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold text-white">Your estimate</h3>
          <span className="text-xs text-text-dim">
            {guests} {guests === 1 ? 'guest' : 'guests'} · {hours} {hours === 1 ? 'hour' : 'hours'}
          </span>
        </div>

        {hasSelection ? (
          <>
            <dl className="space-y-2 text-sm">
              {estimate.food > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Food</dt>
                  <dd className="text-white tabular-nums">{moneyPrecise(estimate.food)}</dd>
                </div>
              )}
              {estimate.drink > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Drinks</dt>
                  <dd className="text-white tabular-nums">{moneyPrecise(estimate.drink)}</dd>
                </div>
              )}
              {estimate.gratuity > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Gratuity (18%)</dt>
                  <dd className="text-white tabular-nums">{moneyPrecise(estimate.gratuity)}</dd>
                </div>
              )}
              {estimate.room > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Room</dt>
                  <dd className="text-white tabular-nums">{moneyPrecise(estimate.room)}</dd>
                </div>
              )}
              {estimate.addons > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Add-ons</dt>
                  <dd className="text-white tabular-nums">{moneyPrecise(estimate.addons)}</dd>
                </div>
              )}
              {estimate.unpriced > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">
                    {estimate.unpriced} item{estimate.unpriced === 1 ? '' : 's'} on request
                  </dt>
                  <dd className="text-text-dim italic">quoted by our team</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 pt-4 border-t border-white/10 flex items-end justify-between">
              {estimate.grandTotal > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-dim">Starting from</p>
                  <p className="font-heading text-3xl font-bold gradient-text-teal tabular-nums leading-tight">
                    {money(estimate.grandTotal)}{estimate.unpriced > 0 ? '+' : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-dim">Your selection</p>
                  <p className="font-heading text-2xl font-bold gradient-text-teal leading-tight">
                    Custom quote
                  </p>
                </div>
              )}
              <p className="text-2xs text-text-dim text-right max-w-[10rem]">
                Final quote confirmed by our team
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            Select a package or two above to see your starting estimate.
          </p>
        )}

        <p className="mt-4 text-xs text-text-dim leading-relaxed">
          Estimates are a starting point — taxes, custom requests, and final headcount may adjust the total.
          Your team confirms every quote before anything's locked in.
        </p>

        {onContinue && (
          <>
            <button
              type="button"
              onClick={() =>
                onContinue({
                  guests,
                  hours,
                  packageIds: selectedPackages.map((p) => p.id),
                  packageNames: selectedPackages.map((p) => p.name),
                  estimateTotal: estimate.grandTotal,
                  unpriced: estimate.unpriced,
                })
              }
              className="mt-5 w-full btn-primary text-base py-4 flex items-center justify-center gap-2"
            >
              {hasSelection ? "Love it? Let's set a date" : "Let's set a date"}
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-2 text-center text-2xs text-text-dim">
              We'll carry everything you picked into the form — no re-typing. Takes about a minute.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
