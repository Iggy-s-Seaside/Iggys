import { Link } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';

/**
 * Stripe Checkout cancel landing page.
 *
 * Stripe redirects here when a customer abandons or cancels Checkout. No charge
 * is made in that case — this page is purely informational and never mutates
 * anything. The "Try again" CTA simply sends them back to start a new checkout.
 */
export default function CheckoutCancel() {
  return (
    <section className="gradient-mesh-bg min-h-screen flex items-center justify-center section-padding pt-32">
      <div className="section-container">
        <div className="glass-card p-10 md:p-14 text-center max-w-2xl mx-auto animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-11 h-11 text-accent" aria-hidden="true" />
          </div>

          <p className="uppercase tracking-widest text-xs font-bold text-accent mb-3">
            Checkout Canceled
          </p>
          <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white mb-4">
            No charge was made
          </h1>
          <p className="text-text-muted text-lg leading-relaxed max-w-xl mx-auto">
            Your checkout was canceled and nothing has been charged. No worries —
            you can pick up right where you left off whenever you're ready.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <Link to="/shop" className="btn-primary w-full sm:w-auto">
              Try again
            </Link>
            <Link to="/" className="btn-outline w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to site
            </Link>
          </div>

          <p className="text-text-dim text-sm mt-8">
            Ran into a problem? Call us at{' '}
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
