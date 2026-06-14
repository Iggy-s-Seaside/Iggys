import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail, Waves } from 'lucide-react';

/**
 * Stripe Checkout success landing page.
 *
 * Stripe redirects here after a completed Checkout Session. The session id
 * arrives as `?session_id=cs_...` (and our flows may also pass `?purpose=...`).
 * This page is read-only and reassuring — it never triggers a send/email or any
 * mutation. Order confirmation + fulfilment (including emailing gift-card codes)
 * is handled server-side by the Stripe webhook, not the browser.
 */
export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const purpose = searchParams.get('purpose');
  const isGiftCard = purpose === 'gift_card' || purpose === 'giftcard';

  return (
    <section className="gradient-mesh-bg min-h-screen flex items-center justify-center section-padding pt-32">
      <div className="section-container">
        <div className="glass-card p-10 md:p-14 text-center max-w-2xl mx-auto animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-11 h-11 text-primary" aria-hidden="true" />
          </div>

          <p className="uppercase tracking-widest text-xs font-bold text-primary mb-3">
            Payment Received
          </p>
          <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white mb-4">
            Thank you!
          </h1>
          <p className="text-text-muted text-lg leading-relaxed max-w-xl mx-auto">
            Your payment went through — cheers from all of us at Iggy's on the
            Oregon Coast. A confirmation will be on its way to your inbox shortly.
          </p>

          {isGiftCard && (
            <div className="mt-6 flex items-start gap-3 text-left rounded-xl bg-white/5 border border-white/10 p-4 max-w-md mx-auto">
              <Mail className="w-5 h-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-text-muted text-sm leading-relaxed">
                Your gift card code will be emailed to the address you provided at
                checkout. Keep an eye on your inbox — it usually lands within a few
                minutes.
              </p>
            </div>
          )}

          {sessionId && (
            <p className="text-text-dim text-xs mt-6 break-all">
              Confirmation reference:{' '}
              <span className="font-mono text-text-muted">{sessionId}</span>
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <Link to="/" className="btn-primary w-full sm:w-auto">
              <Waves className="w-4 h-4" aria-hidden="true" />
              Back to site
            </Link>
            <Link to="/food" className="btn-outline w-full sm:w-auto">
              Browse the menu
            </Link>
          </div>

          <p className="text-text-dim text-sm mt-8">
            Questions about your order? Call us at{' '}
            <a
              href="tel:+15037380672"
              className="text-primary hover:text-primary-hover transition-colors"
            >
              (503) 738-0672
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
