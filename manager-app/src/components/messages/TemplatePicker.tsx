import { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { useMessageTemplates } from '../../hooks/useMessageTemplates';
import { fillTemplate } from '../../utils/fillTemplate';
import { TEMPLATE_CATEGORY_LABELS, type Party, type TemplateCategory } from '../../types';

interface TemplatePickerProps {
  /** Receives the filled body (and subject when present) of the chosen template. */
  onPick: (body: string, subject?: string) => void;
  /** Values used to substitute {{placeholders}}. */
  fillContext?: Partial<Party>;
  label?: string;
}

export function TemplatePicker({ onPick, fillContext = {}, label = 'Use template' }: TemplatePickerProps) {
  const { templates } = useMessageTemplates();
  const [open, setOpen] = useState(false);

  if (templates.length === 0) return null;

  const byCategory = templates.reduce<Record<string, typeof templates>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs py-1.5 px-2.5">
        <FileText size={14} /> {label} <ChevronDown size={13} />
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="absolute z-50 mt-1 w-64 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface shadow-modal p-1">
            {Object.entries(byCategory).map(([cat, list]) => (
              <div key={cat} className="py-1">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {TEMPLATE_CATEGORY_LABELS[cat as TemplateCategory] ?? cat}
                </p>
                {list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onPick(fillTemplate(t.body, fillContext), t.subject ? fillTemplate(t.subject, fillContext) : undefined);
                      setOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-md text-sm text-text-primary hover:bg-surface-hover transition-colors truncate"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
