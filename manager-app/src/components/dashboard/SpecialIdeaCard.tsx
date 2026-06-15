import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LunaInsight } from '../../types';

/**
 * Luna's creative special-of-the-day — a fun, invented drink riffed off a
 * holiday / famous birthday / on-this-day fact (not a menu pick). One tap drops
 * it into the special designer.
 */
export function SpecialIdeaCard({ special }: { special: LunaInsight | null }) {
  const navigate = useNavigate();
  if (!special) return null;

  const data = (special.data ?? {}) as Record<string, unknown>;
  const action = data.action as { draft?: string; label?: string } | undefined;
  const draft = action?.draft || special.body;

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
          <button
            onClick={() => navigate('/specials/editor', { state: { lunaDraft: draft, fromInsight: special.id } })}
            className="btn-primary text-xs mt-3"
          >
            {action?.label || 'Make this special'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
