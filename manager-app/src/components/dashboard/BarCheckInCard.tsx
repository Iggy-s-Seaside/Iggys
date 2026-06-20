import { useEffect, useRef, useState } from 'react';
import { Video, Loader2, RefreshCw } from 'lucide-react';
import { useLunaMessages } from '../../hooks/useLuna';
import { useAuth } from '../../context/AuthContext';

// Sentinel the bridge routes to bar_look.py (a live camera sweep), NOT the text-only Q&A path.
const LOOK_CMD = '__look_at_bar__';
// Give up the spinner after this long so "Look now" never spins forever (a sweep is ~30-60s).
const LOOK_TIMEOUT_MS = 90_000;

/**
 * Check in on the bar — tap and Luna looks at the customer cameras RIGHT NOW (the bridge runs
 * the sweep on PC1 with the local vision model) and reports back. Reuses the luna_messages
 * round-trip: the button writes the control row, the bridge posts the digest as Luna's reply.
 */
export function BarCheckInCard() {
  const { messages, sendMessage } = useLunaMessages();
  const { user } = useAuth();
  const [looking, setLooking] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The most recent look request + its reply, from the realtime message stream.
  const requests = messages.filter((m) => m.role === 'user' && m.content === LOOK_CMD);
  const lastReq = requests.length ? requests[requests.length - 1] : null;
  const reply =
    lastReq ? messages.find((m) => m.role === 'luna' && m.reply_to === lastReq.id) ?? null : null;

  // Drop the spinner once our reply lands (or the request errors).
  useEffect(() => {
    if (!looking) return;
    if (reply || (lastReq && lastReq.status === 'error')) {
      setLooking(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [reply, lastReq, looking]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const look = async () => {
    setLooking(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setLooking(false), LOOK_TIMEOUT_MS);
    const ok = await sendMessage(LOOK_CMD, user?.email ?? null);
    if (!ok) {
      setLooking(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const lines = (reply?.content ?? '').split('\n').filter((l) => l.trim());
  const when = reply ? new Date(reply.created_at) : null;

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Video size={18} className="text-accent shrink-0" />
          <p className="text-sm font-semibold text-text-primary">Check in on the bar</p>
        </div>
        <button
          onClick={look}
          disabled={looking}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-hover active:scale-[0.97] transition disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
        >
          {looking ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Looking…
            </>
          ) : (
            <>
              <RefreshCw size={13} /> Look now
            </>
          )}
        </button>
      </div>

      {reply ? (
        <div className="space-y-1">
          {lines.map((l, i) => (
            <p key={i} className="text-sm text-text-secondary leading-snug">
              {l}
            </p>
          ))}
          {when && (
            <p className="text-[11px] text-text-muted mt-2">
              Luna looked · {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
      ) : looking ? (
        <p className="text-sm text-text-muted">Luna's looking at the cameras…</p>
      ) : (
        <p className="text-sm text-text-muted">
          Tap “Look now” — Luna will check the floor, patio, lottery, and bar for you.
        </p>
      )}
    </div>
  );
}
