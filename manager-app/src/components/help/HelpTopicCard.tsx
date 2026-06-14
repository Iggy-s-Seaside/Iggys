import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ArrowRight } from 'lucide-react';
import type { HelpTopic } from '../../data/helpContent';

interface HelpTopicCardProps {
  topic: HelpTopic;
  /** Start expanded (e.g. when there's a single search match). */
  defaultOpen?: boolean;
}

/**
 * One collapsible how-to card. Tap the header to reveal the steps; the deep-link
 * sits at the bottom so the reader can jump straight into the real page.
 * Matches the app's card pattern, glove-friendly tap targets, dark-mode safe.
 */
export function HelpTopicCard({ topic, defaultOpen = false }: HelpTopicCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { icon: Icon } = topic;
  const bodyId = `help-${topic.id}-body`;

  return (
    <div className="card overflow-hidden" id={`help-${topic.id}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full flex items-start gap-3 px-4 py-4 text-left hover:bg-surface-hover transition-colors min-h-[60px]"
      >
        <span className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">{topic.title}</span>
          <span className="block text-xs text-text-muted mt-0.5">{topic.summary}</span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 mt-1 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id={bodyId} className="border-t border-border px-4 py-4 bg-surface/40 space-y-4">
          {topic.steps && topic.steps.length > 0 && (
            <ol className="space-y-2.5">
              {topic.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-sm text-text-secondary leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}

          {topic.body && topic.body.length > 0 && (
            <div className="space-y-2">
              {topic.body.map((para, i) => (
                <p key={i} className="text-sm text-text-secondary leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          )}

          {topic.link && (
            <Link
              to={topic.link.to}
              className="btn-secondary text-sm inline-flex w-full sm:w-auto justify-center"
            >
              {topic.link.label}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default HelpTopicCard;
