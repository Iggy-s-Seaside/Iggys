// Lightweight, fire-and-forget funnel tracking. Posts to the track-event edge
// function; never blocks the UI and silently no-ops on any failure (including
// before the function/table are deployed). Also forwards to Microsoft Clarity
// when VITE_CLARITY_ID is configured (inert until then).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

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
