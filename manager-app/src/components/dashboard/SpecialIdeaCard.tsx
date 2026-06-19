import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { LunaInsight } from '../../types';

/** Give up waiting on the bridge after this long so the button never spins forever. */
const REGEN_TIMEOUT_MS = 25_000;

/**
 * Luna's creative special-of-the-day — a fun, invented drink riffed off a
 * holiday / famous birthday / on-this-day fact (not a menu pick). One tap drops
 * it into the special designer.
 */
export function SpecialIdeaCard({ special }: { special: LunaInsight | null }) {
  const navigate = useNavigate();
  const [regenerating, setRegenerating] = useState(false);
  // The special id present at the moment "Try again" was tapped. When the prop's
  // id changes away from this, the bridge's fresh special has landed.
  const pendingFromId = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the spinner once a NEW special arrives (prop id changed from click-time id).
  useEffect(() => {
    if (!regenerating) return;
    if (special && special.id !== pendingFromId.current) {
      setRegenerating(false);
      pendingFromId.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [special, regenerating]);

  // Tidy any pending timeout on unmount.
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (!special) return null;

  const data = (special.data ?? {}) as Record<string, unknown>;
  const action = data.action as { draft?: string; label?: string } | undefined;
  const draft = action?.draft || special.body;

  const handleRegenerate = async () => {
    if (regenerating) return;
    pendingFromId.current = special.id;
    setRegenerating(true);
    toast('Asking Luna for another idea…');

    // Safety net: never spin forever if the bridge is asleep.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setRegenerating(false);
      pendingFromId.current = null;
      toast.error('Couldn’t reach Luna — try again in a moment.');
    }, REGEN_TIMEOUT_MS);

    // Fire-and-forget command row; the bridge polls for it and inserts a new special.
    const { error } = await supabase
      .from('luna_messages')
      .insert({ role: 'user', content: '__regen_special__', status: 'pending' });

    if (error) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setRegenerating(false);
      pendingFromId.current = null;
      toast.error('Couldn’t reach Luna — try again in a moment.');
      console.error(error);
    }
  };

  return (
    <div className="card p-4 mb-6 border-accent/30 bg-accent/5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-accent/15 shrink-0">
          <Sparkles size={20} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            Today's special idea — dreamed up by Luna
          </p>
          <p className="text-sm text-text-primary whitespace-pre-line mt-1 leading-snug">{special.body}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={() => navigate('/specials/editor', { state: { lunaDraft: draft, fromInsight: special.id } })}
              className="btn-primary text-xs"
            >
              {action?.label || 'Make this special'} <ArrowRight size={14} />
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="btn-secondary text-xs"
            >
              {regenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Thinking…
                </>
              ) : (
                <>
                  <RefreshCw size={14} /> Try again
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
