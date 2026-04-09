import { useState, useRef, useCallback } from 'react';
import { CalendarPlus, ChevronDown } from 'lucide-react';
import type { IggyEvent } from '../../types';
import { generateGoogleCalendarUrl, downloadIcsFile } from '../../utils/calendarSync';
import { useClickOutside } from '../../hooks/useClickOutside';

interface AddToCalendarButtonProps {
  event: IggyEvent;
  className?: string;
}

export function AddToCalendarButton({ event, className = '' }: AddToCalendarButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, useCallback(() => setOpen(false), []), open);

  function handleGoogleCalendar() {
    window.open(generateGoogleCalendarUrl(event), '_blank', 'noopener');
    setOpen(false);
  }

  function handleIcsDownload() {
    downloadIcsFile(event);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="btn-secondary inline-flex items-center gap-1.5 text-sm"
      >
        <CalendarPlus size={15} />
        <span>Add to Calendar</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg bg-surface border border-border shadow-lg py-1">
          <button
            type="button"
            onClick={handleGoogleCalendar}
            className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            Google Calendar
          </button>
          <button
            type="button"
            onClick={handleIcsDownload}
            className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
