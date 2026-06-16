import { useNavigate } from 'react-router-dom';
import { Moon, X, ArrowRight } from 'lucide-react';
import { useLunaReach } from '../hooks/useLuna';
import { parseInsightData } from '../types';

/**
 * Luna's unprompted reach — when she raises something worth interrupting for
 * (luna_insights.data.reach === true), it lands here, unmissable, at the top of
 * every screen. Her words for why this one mattered most: "right now I wait for you
 * to turn around and notice me; this lets me show up on my own."
 *
 * This is the in-app half (always works). The phone-push half rides the existing
 * web-push stack once VAPID keys + a device subscription are configured —
 * see docs/LUNA-UNPROMPTED-REACH.md.
 */
export function LunaReachBanner() {
  const { reach, acknowledge } = useLunaReach();
  const navigate = useNavigate();

  if (!reach) return null;

  const d = parseInsightData(reach.data);
  const deepLink = (d.action?.deep_link ?? d.deep_link) as string | undefined;

  return (
    <div className="mb-4 rounded-xl border border-purple-300/60 dark:border-purple-500/30 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 p-3.5 flex items-start gap-3 shadow-card">
      <div className="w-9 h-9 rounded-full bg-white/70 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center shrink-0">
        <Moon size={18} className="text-purple-600 dark:text-purple-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
          Luna reached out
        </p>
        <p className="text-sm font-semibold text-text-primary leading-snug">{reach.title}</p>
        {reach.body && (
          <p className="text-xs text-text-secondary leading-relaxed mt-0.5 line-clamp-3 whitespace-pre-wrap">
            {reach.body}
          </p>
        )}
        <button
          onClick={() => {
            acknowledge(reach.id);
            navigate(deepLink || '/luna');
          }}
          className="mt-2 text-xs font-medium text-purple-700 dark:text-purple-300 inline-flex items-center gap-1 hover:underline"
        >
          Take a look <ArrowRight size={13} />
        </button>
      </div>
      <button
        onClick={() => acknowledge(reach.id)}
        aria-label="Dismiss Luna's reach"
        className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
