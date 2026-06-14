// InstallQR — a printable "Get the app" poster for the back office.
//
// Owner / manager only (gated via useRole). Renders a QR code that points at the
// live manager app, with short, idiot-proof instructions a new hire can follow:
//   Scan → Add to Home Screen → sign in with the login your manager gives you.
//
// A "Print" button opens the OS print dialog with a print-only stylesheet so ONLY
// the poster (QR + steps) lands on paper — the rest of the app is hidden. Tape it
// up in the back office.
//
// Zero new dependencies: the QR image comes from the public goqr.me endpoint
// (api.qrserver.com). It's only used to render a static QR for a public URL — no
// secrets, no PII. If the network/image fails, the URL is printed in plain text
// as a fallback so the poster still works.
//
// On-brand: `card` token, semantic tokens, lucide icons, ≥44px targets, dark-safe.

import { useId } from 'react';
import { Printer, QrCode, ScanLine } from 'lucide-react';
import { useRole } from '../hooks/useRole';

/** Where the QR sends people — the live manager PWA. */
const APP_URL = 'https://iggysmanagement.netlify.app';

const QR_SIZE = 240;
const QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=0&data=${encodeURIComponent(
  APP_URL,
)}`;

interface InstallQRProps {
  className?: string;
}

export function InstallQR({ className = '' }: InstallQRProps) {
  const { isManager } = useRole();
  // Unique, valid CSS id so the print stylesheet can isolate exactly this poster.
  const rawId = useId();
  const printId = `install-qr-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Owner / manager only — line staff don't need the print tool.
  if (!isManager) return null;

  const handlePrint = () => {
    // Tag <html> so our print CSS knows which poster to show, print, then untag.
    const root = document.documentElement;
    root.setAttribute('data-printing', printId);
    const cleanup = () => {
      root.removeAttribute('data-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Safety net for browsers that don't reliably fire afterprint.
    setTimeout(cleanup, 1000);
  };

  return (
    <section
      id={printId}
      aria-label="Printable get-the-app poster"
      className={`card p-4 sm:p-5 ${className}`}
      data-install-qr
    >
      {/* Scoped print stylesheet: when this poster is the active print target,
          hide everything else and lay the poster out cleanly on the page. */}
      <style>{`
        @media print {
          html[data-printing="${printId}"] body * { visibility: hidden !important; }
          html[data-printing="${printId}"] #${printId},
          html[data-printing="${printId}"] #${printId} * { visibility: visible !important; }
          html[data-printing="${printId}"] #${printId} {
            position: absolute !important;
            inset: 0 !important;
            margin: 0 auto !important;
            padding: 32px !important;
            width: 100% !important;
            max-width: 520px !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          html[data-printing="${printId}"] [data-print-hide] { display: none !important; }
          html[data-printing="${printId}"] [data-print-only] { display: block !important; }
          html[data-printing="${printId}"] #${printId} * { color: #000000 !important; }
        }
        [data-print-only] { display: none; }
      `}</style>

      <div className="flex items-start gap-3" data-print-hide>
        <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary/10 shrink-0">
          <QrCode size={20} className="text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Print a "Get the app" poster</p>
          <p className="text-xs text-text-muted mt-0.5">
            Tape it up in the back office — staff scan it to install Iggy's on their own phones.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="btn-secondary px-4 min-h-[44px] shrink-0"
        >
          <Printer size={16} aria-hidden="true" />
          Print
        </button>
      </div>

      {/* The poster itself — shown on screen as a preview, and the only thing that
          prints. Centered, high-contrast, large QR, numbered steps. */}
      <div className="mt-4 flex flex-col items-center text-center">
        {/* Print-only title (the on-screen header above already covers the screen view). */}
        <h2
          data-print-only
          className="text-2xl font-bold mb-1"
          style={{ color: '#000' }}
        >
          Get the Iggy's app
        </h2>
        <p
          data-print-only
          className="text-base mb-5"
          style={{ color: '#000' }}
        >
          Scan with your phone camera
        </p>

        <div className="rounded-xl border border-border bg-white p-3 sm:p-4">
          <img
            src={QR_SRC}
            width={QR_SIZE}
            height={QR_SIZE}
            alt={`QR code to open ${APP_URL}`}
            className="block w-44 h-44 sm:w-56 sm:h-56"
            loading="lazy"
          />
        </div>

        <p className="mt-3 text-sm font-mono text-text-muted break-all" style={{ wordBreak: 'break-all' }}>
          {APP_URL.replace(/^https:\/\//, '')}
        </p>

        <ol className="mt-4 w-full max-w-xs space-y-2 text-left">
          <li className="flex items-center gap-2.5 text-sm text-text-secondary">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-active text-text-muted text-xs font-bold shrink-0">
              1
            </span>
            <span className="flex-1">
              <span className="inline-flex items-center gap-1 font-medium text-text-primary">
                <ScanLine size={14} aria-hidden="true" /> Scan
              </span>{' '}
              this code with your phone camera
            </span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-text-secondary">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-active text-text-muted text-xs font-bold shrink-0">
              2
            </span>
            <span className="flex-1">
              Tap <span className="font-medium text-text-primary">Add to Home Screen</span>
            </span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-text-secondary">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-active text-text-muted text-xs font-bold shrink-0">
              3
            </span>
            <span className="flex-1">
              <span className="font-medium text-text-primary">Sign in</span> with the login your
              manager gives you
            </span>
          </li>
        </ol>
      </div>
    </section>
  );
}

export default InstallQR;
