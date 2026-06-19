import { Link } from 'react-router-dom';

export default function SmsTerms() {
  return (
    <section className="section-padding pt-32 min-h-[70vh]">
      <div className="section-container max-w-3xl mx-auto">
        <p className="uppercase tracking-widest text-xs font-bold text-primary mb-3">
          Iggy's Seaside
        </p>
        <h1 className="font-heading text-4xl font-bold text-white mb-2">
          SMS Terms &amp; Conditions
        </h1>
        <p className="text-text-dim text-sm mb-8">
          Last updated June 2026
        </p>

        <div className="glass-card p-6 sm:p-8 space-y-6 text-text-muted leading-relaxed">
          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              Program description
            </h2>
            <p>
              By opting in, you agree to receive recurring marketing text messages
              from Iggy's (drink specials, events, and happy-hour news). Consent is
              not a condition of any purchase.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              Message frequency &amp; cost
            </h2>
            <p>
              Message frequency varies. <span className="text-white font-semibold">Msg &amp; data
              rates may apply.</span> Your carrier's standard messaging rates apply
              to all messages you send and receive.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              How to opt out
            </h2>
            <p>
              Reply <span className="text-white font-semibold">STOP</span> to any
              message to cancel. After you send STOP, we'll send one confirmation
              message and then stop texting you. Reply{' '}
              <span className="text-white font-semibold">HELP</span> for help, or
              contact us at{' '}
              <a
                href="mailto:iggysbarevents@gmail.com"
                className="text-primary hover:underline"
              >
                iggysbarevents@gmail.com
              </a>{' '}
              /{' '}
              <a href="tel:+15037380672" className="text-primary hover:underline">
                (503) 738-0672
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              Carriers &amp; liability
            </h2>
            <p>
              Carriers are not liable for delayed or undelivered messages. Supported
              carriers may change without notice.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              Privacy
            </h2>
            <p>
              Your information is handled per our{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              . We never sell your phone number or share it for third-party
              marketing.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <Link to="/" className="text-text-dim hover:text-primary transition-colors text-sm">
            &larr; Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
