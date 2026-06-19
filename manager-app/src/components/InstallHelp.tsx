// InstallHelp — the "get this app on your phone" on-ramp for staff.
//
// Detects how the app is being viewed and adapts:
//   • Already installed (running standalone) ............ renders nothing.
//   • iOS / iPadOS Safari ............................... friendly card with the
//        exact Share → "Add to Home Screen" steps + a Share-icon illustration,
//        because iOS gives web apps no install prompt. Also notes that
//        installing is what unlocks notifications on iOS.
//   • Android / desktop Chrome (+ Edge) ................. captures the native
//        `beforeinstallprompt` event and offers a real one-tap "Install app".
//
// Usable two ways via the `variant` prop:
//   • "banner" — a slim, dismissible strip (e.g. on the Login screen). Dismissal
//        is remembered in localStorage so a returning hire isn't nagged.
//   • "card"   — a permanent inline card (e.g. the Team "get staff set up" spot).
//
// On-brand: `card` token, semantic text/border tokens, lucide icons, ≥44px
// targets, dark-mode safe, mobile-first.

import { useEffect, useRef, useState } from 'react';
import { Share, PlusSquare, Smartphone, Download, BellRing, X } from 'lucide-react';

/** The Chromium install-prompt event (not yet in the standard lib DOM types). */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'iggys.installHelp.dismissed';

/** True when the app is already running as an installed PWA. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari exposes its own legacy flag instead of display-mode.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return mql || iosStandalone;
}

/** Best-effort iOS / iPadOS detection (incl. iPadOS that reports as Mac + touch). */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
  return iOSDevice || iPadOS;
}

interface InstallHelpProps {
  /** "banner" = slim dismissible strip; "card" = permanent inline card. */
  variant?: 'banner' | 'card';
  /** Banner-only: remember dismissal in localStorage so it stays gone. Default true. */
  persistDismiss?: boolean;
  /** Extra classes on the outer element (e.g. spacing in the host page). */
  className?: string;
}

export function InstallHelp({
  variant = 'card',
  persistDismiss = true,
  className = '',
}: InstallHelpProps) {
  const banner = variant === 'banner';

  // Resolved once on mount — these don't change within a session.
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  // The captured Chromium prompt event, when available.
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [prompting, setPrompting] = useState(false);

  // Banner dismissal — seeded from localStorage so a returning user isn't nagged.
  const [dismissed, setDismissed] = useState(() => {
    if (!banner || !persistDismiss) return false;
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOS());

    // Capture Chromium's prompt so we can fire it on a one-tap button later.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    // If the user installs (via our button or the browser UI), stand down.
    const onInstalled = () => {
      deferredPrompt.current = null;
      setCanPrompt(false);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // Also react if the display-mode flips to standalone mid-session.
    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const onDisplayChange = () => setInstalled(isStandalone());
    mql?.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mql?.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const handleInstall = async () => {
    const evt = deferredPrompt.current;
    if (!evt || prompting) return;
    setPrompting(true);
    try {
      await evt.prompt();
      await evt.userChoice;
    } catch {
      /* user dismissed the OS sheet — nothing to do */
    } finally {
      // The event can only be used once.
      deferredPrompt.current = null;
      setCanPrompt(false);
      setPrompting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (persistDismiss) {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* storage unavailable — dismissed for this session only */
      }
    }
  };

  // Already installed, or this is a banner the user closed: stay out of the way.
  if (installed) return null;
  if (banner && dismissed) return null;

  // ---- Inner content (shared headline + per-platform call to action) --------

  const Headline = (
    <div className="flex items-start gap-3">
      <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary/10 shrink-0">
        <Smartphone size={20} className="text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">Put Iggy's on your phone</p>
        <p className="text-xs text-text-muted mt-0.5">
          Install the app for a full-screen, one-tap shortcut — no app store needed.
        </p>
      </div>
      {banner && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install help"
          className="btn-ghost -mr-2 -mt-2 p-2 rounded-lg shrink-0 min-h-[44px] min-w-[44px]"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  // iOS Safari: no install event exists — walk them through Share → Add to Home Screen.
  const IOSSteps = (
    <div className="mt-3 space-y-2">
      <ol className="space-y-2">
        <li className="flex items-center gap-2.5 text-sm text-text-secondary">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-active text-text-muted text-xs font-bold shrink-0">
            1
          </span>
          <span className="flex-1 min-w-0">
            Tap the <span className="font-medium text-text-primary">Share</span> button
          </span>
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface text-primary shrink-0"
            aria-label="Share icon"
            title="Share"
          >
            <Share size={16} aria-hidden="true" />
          </span>
        </li>
        <li className="flex items-center gap-2.5 text-sm text-text-secondary">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-active text-text-muted text-xs font-bold shrink-0">
            2
          </span>
          <span className="flex-1 min-w-0">
            Choose <span className="font-medium text-text-primary">Add to Home Screen</span>
          </span>
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface text-primary shrink-0"
            aria-label="Add to Home Screen icon"
            title="Add to Home Screen"
          >
            <PlusSquare size={16} aria-hidden="true" />
          </span>
        </li>
        <li className="flex items-center gap-2.5 text-sm text-text-secondary">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-active text-text-muted text-xs font-bold shrink-0">
            3
          </span>
          <span className="flex-1 min-w-0">
            Tap <span className="font-medium text-text-primary">Add</span> — then open Iggy's from
            your home screen
          </span>
        </li>
      </ol>
      <p className="flex items-start gap-1.5 text-xs text-text-muted bg-surface-hover border border-border rounded-lg px-3 py-2.5">
        <BellRing size={13} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          On iPhone &amp; iPad, installing to the home screen is what lets the app send you{' '}
          <span className="font-medium text-text-secondary">notifications</span>.
        </span>
      </p>
    </div>
  );

  // Android / desktop Chrome with a captured prompt: real one-tap install.
  const ChromeInstall = (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleInstall}
        disabled={prompting}
        className="btn-primary w-full sm:w-auto px-4 min-h-[44px]"
      >
        <Download size={16} aria-hidden="true" />
        {prompting ? 'Installing…' : 'Install app'}
      </button>
      <p className="flex items-start gap-1.5 text-xs text-text-muted mt-2.5">
        <BellRing size={13} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <span>Installing lets the app send you notifications and open full-screen.</span>
      </p>
    </div>
  );

  // Fallback: not iOS, and no prompt captured yet (e.g. Firefox, already-eligible
  // Chrome that hasn't fired the event, or desktop Safari). Give generic guidance
  // rather than a dead button.
  const GenericHint = (
    <p className="mt-3 text-xs text-text-muted bg-surface-hover border border-border rounded-lg px-3 py-2.5">
      Open this page in <span className="font-medium text-text-secondary">Chrome</span> (Android /
      desktop) or <span className="font-medium text-text-secondary">Safari</span> (iPhone / iPad),
      then use your browser's <span className="font-medium text-text-secondary">Install</span> or{' '}
      <span className="font-medium text-text-secondary">Add to Home Screen</span> option.
    </p>
  );

  const Body = ios ? IOSSteps : canPrompt ? ChromeInstall : GenericHint;

  return (
    <section
      aria-label="Install Iggy's on your device"
      className={`card p-4 sm:p-5 ${className}`}
    >
      {Headline}
      {Body}
    </section>
  );
}

export default InstallHelp;
