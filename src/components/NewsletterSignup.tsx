import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Check } from 'lucide-react';
import { track } from '../lib/track';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

interface NewsletterSignupProps {
  /** Optional heading override. */
  title?: string;
  /** Optional subheading override. */
  subtitle?: string;
  /** Visual variant. `footer` is compact + dark-surface tuned; `card` adds a glass panel. */
  variant?: 'footer' | 'card';
  className?: string;
}

/**
 * Reusable email + SMS marketing opt-in.
 * - SEPARATE per-channel checkboxes, both UNCHECKED by default (explicit consent).
 * - Phone field appears only when the visitor wants texts.
 * - Posts to the `subscribe` edge fn (records consent only; never sends).
 * - Fires a `newsletter_signup` funnel event on success.
 */
export default function NewsletterSignup({
  title = 'Get the inside scoop',
  subtitle = 'Drinks, events, and happy-hour news — straight to you.',
  variant = 'footer',
  className = '',
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  // Honeypot — humans never see or fill this; bots do.
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!emailOptIn && !smsOptIn) {
      setError('Pick at least one — email or text.');
      return;
    }
    if (emailOptIn && !email.trim()) {
      setError('Add your email to get email updates.');
      return;
    }
    if (smsOptIn && !phone.trim()) {
      setError('Add your mobile number to get texts.');
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setError('Sign-up is unavailable right now. Please try again later.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          email: emailOptIn ? email.trim() : null,
          phone: smsOptIn ? phone.trim() : null,
          email_opt_in: emailOptIn,
          sms_opt_in: smsOptIn,
          company_website: companyWebsite, // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Something went wrong. Please try again.');
      }
      track('newsletter_signup', { email: emailOptIn, sms: smsOptIn });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass =
    variant === 'card'
      ? `glass-card p-6 ${className}`
      : className;

  if (success) {
    return (
      <div className={wrapperClass}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">You're on the list!</p>
            <p className="text-white/50 text-sm mt-0.5">
              We'll be in touch with the good stuff. Cheers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition';
  const checkboxClass =
    'mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/[0.06] text-primary focus:ring-primary/40 focus:ring-offset-0 cursor-pointer';

  return (
    <div className={wrapperClass}>
      <div className="flex items-center gap-2 mb-1.5">
        <Mail className="w-4 h-4 text-primary/70" />
        <h4 className="text-sm font-bold text-white">{title}</h4>
      </div>
      <p className="text-white/45 text-sm mb-4">{subtitle}</p>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {/* Honeypot — hidden from humans, bots fill it and get dropped */}
        <input
          type="text"
          name="company_website"
          value={companyWebsite}
          onChange={(e) => setCompanyWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        <div>
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
          />
        </div>

        {/* Per-channel consent — SEPARATE, both unchecked by default */}
        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOptIn}
              onChange={(e) => setEmailOptIn(e.target.checked)}
              className={checkboxClass}
            />
            <span className="text-sm text-white/55 leading-snug">
              Email me drinks, events &amp; happy-hour news.
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
              className={checkboxClass}
            />
            <span className="text-sm text-white/55 leading-snug">
              Text me drink specials &amp; events.
            </span>
          </label>
        </div>

        {/* Phone — only when texts are wanted */}
        {smsOptIn && (
          <div>
            <label htmlFor="newsletter-phone" className="sr-only">
              Mobile number
            </label>
            <input
              id="newsletter-phone"
              type="tel"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number"
              autoComplete="tel"
              className={inputClass}
            />
            <p className="text-[11px] leading-snug text-white/35 mt-2">
              By checking SMS you agree to receive recurring marketing texts from
              Iggy's. Msg &amp; data rates apply. Reply STOP to opt out.
            </p>
          </div>
        )}

        {error && <p className="text-amber-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-sm px-5 py-2.5 rounded-full bg-primary text-background font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing up…' : 'Sign Me Up'}
        </button>

        <p className="text-[11px] leading-snug text-white/30">
          We never sell your info. See our{' '}
          <Link to="/privacy" className="text-white/45 hover:text-primary underline transition-colors">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/sms-terms" className="text-white/45 hover:text-primary underline transition-colors">
            SMS Terms
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
