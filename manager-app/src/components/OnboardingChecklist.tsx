// OnboardingChecklist — a dismissible "Get set up" card for new / empty accounts.
// Each row deep-links (react-router <Link>) to where that task gets done and shows
// a check once complete. The whole card auto-hides when every step is done OR the
// manager dismisses it. Completion + dismissal are tracked by useFirstRun, which
// auto-completes the data-backed steps from cheap signals as modules gain data.
//
// On-brand: uses the `card` token, semantic text/border tokens, and lucide check /
// circle icons. Compact + mobile-first; rows are ≥44px tall and labelled for AT.

import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, Rocket, X } from 'lucide-react';
import { useFirstRun } from '../hooks/useFirstRun';

export function OnboardingChecklist() {
  const { steps, dismissed, dismiss, isComplete } = useFirstRun();

  // Quietly stand down once everything's set up or the manager dismissed it.
  if (dismissed || isComplete) return null;

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section
      aria-labelledby="onboarding-heading"
      className="card p-4 sm:p-5 mb-6"
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-primary-50 shrink-0">
          <Rocket size={20} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="onboarding-heading" className="text-sm font-semibold text-text-primary">
            Get set up
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            A few quick steps to get Iggy's running — {doneCount} of {steps.length} done.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          className="btn-ghost -mr-2 -mt-2 p-2 rounded-lg shrink-0 min-h-[44px] min-w-[44px]"
        >
          <X size={18} />
        </button>
      </div>

      <ul className="mt-3 -mx-1.5 divide-y divide-border">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              // Completed rows aren't actionable — show as a static, muted check.
              <div className="flex items-center gap-3 px-1.5 py-2.5 min-h-[44px]">
                <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                <span className="text-sm text-text-muted line-through truncate flex-1">
                  {step.label}
                </span>
                <span className="badge-success shrink-0">Done</span>
              </div>
            ) : (
              <Link
                to={step.to}
                aria-label={`${step.label} — ${step.hint}`}
                className="flex items-center gap-3 px-1.5 py-2.5 min-h-[44px] rounded-lg hover:bg-surface-hover transition-colors group active:scale-[0.99]"
              >
                <Circle size={20} className="text-text-muted shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary truncate">
                    {step.label}
                  </span>
                  <span className="block text-xs text-text-muted truncate">{step.hint}</span>
                </span>
                <ChevronRight
                  size={18}
                  className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors"
                  aria-hidden="true"
                />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default OnboardingChecklist;
