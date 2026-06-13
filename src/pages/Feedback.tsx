import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Star, ExternalLink, MessageCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { images } from '../data/images';
import Select from '../components/ui/Select';

// FTC-SAFE FEEDBACK PAGE (table-side QR → /feedback)
// EVERY guest sees BOTH options, side by side, with NO sentiment gating:
//   1. "Leave a public review" — links to the bar's Google review URL.
//   2. A private feedback box — posts to the submit-feedback edge function.
// We never branch on the rating: happy and unhappy guests get the identical
// page. The public-review tap is recorded only as funnel analytics.
//
// Fallback Google review link, used if the review_sources lookup is missing the
// URL. Replace the placeholder Place ID once it's known.
const FALLBACK_GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=REPLACE_WITH_PLACE_ID';

const areaOptions = [
  { value: 'food', label: 'Food' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'service', label: 'Service' },
  { value: 'atmosphere', label: 'Atmosphere' },
  { value: 'other', label: 'Other' },
];

const inputClasses =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-text-dim focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition';

export default function Feedback() {
  const [reviewUrl, setReviewUrl] = useState(FALLBACK_GOOGLE_REVIEW_URL);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [area, setArea] = useState('');
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  // Honeypot — humans never see or fill this; bots do.
  const [companyWebsite, setCompanyWebsite] = useState('');
  // Tracks whether the guest tapped the public-review button (funnel analytics
  // only — never used to gate or branch).
  const reviewClicked = useRef(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Pull the bar's public Google review URL (anon-readable review_sources row).
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('review_sources')
      .select('review_url')
      .eq('key', 'google')
      .eq('active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.review_url) setReviewUrl(data.review_url);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePublicReview = () => {
    reviewClicked.current = true;
    // Fire-and-forget: record that this guest went to leave a public review, so
    // the owner sees the funnel even if they never submit the private box.
    supabase.functions
      .invoke('submit-feedback', { body: { public_review_clicked: true } })
      .catch(() => {
        /* non-blocking analytics — never surface an error to the guest */
      });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('submit-feedback', {
        body: {
          rating: rating || null,
          area: area || null,
          comment,
          contact_email: email,
          public_review_clicked: reviewClicked.current,
          company_website: companyWebsite,
        },
      });
      if (invokeErr) throw new Error('Something went wrong. Please try again.');
      if (data?.error) throw new Error(data.error);
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="relative py-24 lg:py-28 pt-32 text-center overflow-hidden">
        <img
          src={images.barTop}
          alt="Iggy's bar top"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/75" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="uppercase tracking-widest text-xs font-bold text-primary mb-4">
            How Was Your Visit?
          </p>
          <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent mx-auto mb-6" />
          <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white">
            Share Your Feedback
          </h1>
          <p className="text-text-muted text-lg max-w-2xl mx-auto mt-4">
            We'd love to hear how it went — pick whichever way suits you.
          </p>
        </div>
      </section>

      <section className="section-padding">
        <div className="section-container max-w-3xl">
          {success ? (
            <div className="glass-card p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-heading text-2xl font-bold text-white mb-2">Thank you!</h2>
              <p className="text-text-muted">
                We truly appreciate you taking the time. See you again soon at Iggy's.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Public review — shown to EVERY guest, never gated by sentiment */}
              <div className="glass-card p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="w-5 h-5 text-primary" />
                  <h2 className="font-heading text-xl font-bold text-white">Leave a public review</h2>
                </div>
                <p className="text-text-muted text-sm mb-6 flex-1">
                  Loved your visit? Share it with the world on Google — it helps other folks find
                  us and means a lot to the team.
                </p>
                <a
                  href={reviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handlePublicReview}
                  className="btn-primary w-full justify-center"
                >
                  <Star className="w-4 h-4" />
                  Review us on Google
                </a>
              </div>

              {/* Private feedback — shown to EVERY guest, side by side */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <h2 className="font-heading text-xl font-bold text-white">Tell us privately</h2>
                </div>
                <p className="text-text-muted text-sm mb-5">
                  Prefer to keep it between us? Drop a private note — it goes straight to the owner.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
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

                  {/* Star rating */}
                  <div>
                    <label className="text-sm text-text-muted mb-2 block">Your rating</label>
                    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={rating === n}
                          aria-label={`${n} star${n === 1 ? '' : 's'}`}
                          onClick={() => setRating(n)}
                          onMouseEnter={() => setHover(n)}
                          onMouseLeave={() => setHover(0)}
                          className="p-1 -m-0.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              n <= (hover || rating)
                                ? 'text-accent fill-accent'
                                : 'text-white/25'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Area */}
                  <div>
                    <label htmlFor="feedback-area" className="text-sm text-text-muted mb-1 block">
                      What's this about?
                    </label>
                    <Select
                      id="feedback-area"
                      variant="glass"
                      placeholder="Select an area (optional)"
                      options={areaOptions}
                      value={area || null}
                      onChange={(value) => setArea(value)}
                    />
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Your feedback</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us how it went…"
                      rows={4}
                      className={inputClasses}
                    />
                  </div>

                  {/* Optional email */}
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">
                      Email <span className="text-text-dim">(optional — if you'd like a reply)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClasses}
                    />
                  </div>

                  {error && <p className="text-amber-400 text-sm">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending…' : 'Send Private Feedback'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
