import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <section className="section-padding pt-32 min-h-[70vh]">
      <div className="section-container max-w-3xl mx-auto">
        <p className="uppercase tracking-widest text-xs font-bold text-primary mb-3">
          Iggy's Seaside
        </p>
        <h1 className="font-heading text-4xl font-bold text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-text-dim text-sm mb-8">
          Last updated June 2026
        </p>

        <div className="glass-card p-6 sm:p-8 space-y-6 text-text-muted leading-relaxed">
          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              What we collect
            </h2>
            <p>
              When you reach out through our website — signing up for updates,
              requesting an event, or sending us a message — we collect the
              details you give us, such as your name, email address, and phone
              number. We don't sell your information, and we never share it with
              third parties for their own marketing.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              How we use it
            </h2>
            <p>
              We use your information to reply to you, plan your event, and — only
              if you've opted in — send you news about drinks, events, and happy
              hour. You choose each channel (email and text) separately, and you
              can opt out at any time.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              Marketing email &amp; text
            </h2>
            <p>
              Marketing messages are sent only to people who have explicitly opted
              in. Every marketing email includes an unsubscribe link. For text
              messages, reply <span className="text-white font-semibold">STOP</span> at
              any time to opt out, or <span className="text-white font-semibold">HELP</span> for
              help. See our{' '}
              <Link to="/sms-terms" className="text-primary hover:underline">
                SMS Terms
              </Link>{' '}
              for details.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              Your choices
            </h2>
            <p>
              You can ask us to update or delete your information, or to stop
              contacting you, by emailing{' '}
              <a
                href="mailto:iggysbarevents@gmail.com"
                className="text-primary hover:underline"
              >
                iggysbarevents@gmail.com
              </a>{' '}
              or calling{' '}
              <a href="tel:+15037380672" className="text-primary hover:underline">
                (503) 738-0672
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-2">
              Contact
            </h2>
            <p>
              Iggy's Seaside &middot; 200 S Franklin St, Seaside, OR 97138 &middot;{' '}
              <a
                href="mailto:iggysbarevents@gmail.com"
                className="text-primary hover:underline"
              >
                iggysbarevents@gmail.com
              </a>
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
