// Lightweight, fire-and-forget funnel tracking. Posts to the track-event edge
// function; never blocks the UI and silently no-ops on any failure (including
// before the function/table are deployed). Also forwards to Microsoft Clarity
// when VITE_CLARITY_ID is configured, and fires Google Ads conversions for
// high-intent events when VITE_GOOGLE_ADS_ID is configured (inert until then).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

// Google Ads conversion tracking. gtag.js is injected in main.tsx ONLY when
// VITE_GOOGLE_ADS_ID is set, so window.gtag is absent (and everything below
// no-ops) until then. Each high-intent funnel event maps to a Google Ads
// conversion label; the send_to value is `<AW-account>/<label>`. The label env
// vars are optional — if unset for an event, we skip the conversion for it.
const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;

// event name -> Google Ads conversion label (from env). Only events with both a
// configured account id AND a label fire a conversion; otherwise this is a no-op.
const CONVERSION_LABELS: Record<string, string | undefined> = {
  booking_submitted: import.meta.env.VITE_GOOGLE_ADS_LABEL_BOOKING as string | undefined,
  newsletter_signup: import.meta.env.VITE_GOOGLE_ADS_LABEL_NEWSLETTER as string | undefined,
};

/** Fire a Google Ads conversion for a high-intent event, if gtag + label exist. */
function fireGoogleAdsConversion(event: string, props: Record<string, unknown>): void {
  if (!GOOGLE_ADS_ID) return;
  const label = CONVERSION_LABELS[event];
  if (!label) return;
  const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  try {
    const payload: Record<string, unknown> = { send_to: `${GOOGLE_ADS_ID}/${label}` };
    // Pass through a monetary value when the event carries one (e.g. booking total).
    if (typeof props.total === 'number') {
      payload.value = props.total;
      payload.currency = 'USD';
    }
    gtag('event', 'conversion', payload);
  } catch {
    /* ignore */
  }
}

function sessionId(): string {
  try {
    const k = 'iggys_sid';
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'anon';
  }
}

export function track(event: string, props: Record<string, unknown> = {}): void {
  // Microsoft Clarity custom event — no-op unless Clarity is loaded (VITE_CLARITY_ID).
  try {
    (window as unknown as { clarity?: (...a: unknown[]) => void }).clarity?.('event', event);
  } catch {
    /* ignore */
  }

  // Google Ads conversion — no-op unless gtag is loaded (VITE_GOOGLE_ADS_ID) and
  // this event has a configured conversion label.
  fireGoogleAdsConversion(event, props);

  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    fetch(`${SUPABASE_URL}/functions/v1/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ event, session_id: sessionId(), props }),
      keepalive: true, // survives the page navigation on submit
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
