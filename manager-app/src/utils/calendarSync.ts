import type { IggyEvent } from '../types';

const LOCATION = "Iggy's Seaside Bar, 200 S Franklin St, Seaside, OR 97138";
const DEFAULT_DURATION_HOURS = 2;

/** Map full day names to iCal BYDAY abbreviations */
const DAY_ABBREVS: Record<string, string> = {
  sunday: 'SU',
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
};

/**
 * Parse a date string ("2026-03-20") and time string ("8:00 PM") into a Date.
 */
export function parseEventDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);

  const timeParts = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!timeParts) {
    // Fallback: noon on the given date
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  let hours = parseInt(timeParts[1], 10);
  const minutes = parseInt(timeParts[2], 10);
  const meridiem = timeParts[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, 0);
}

/**
 * Format a Date as a Google Calendar timestamp: YYYYMMDDTHHmmss
 */
function toGoogleCalTs(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * Format a Date as an iCal DTSTART/DTEND value: YYYYMMDDTHHmmss
 */
function toIcsTs(d: Date): string {
  return toGoogleCalTs(d); // same format
}

/**
 * Build a details/description string from the event.
 */
function buildDescription(event: IggyEvent): string {
  let desc = event.description || '';
  if (event.category) {
    desc += `\n\nCategory: ${event.category}`;
  }
  return desc.trim();
}

/**
 * Generate a Google Calendar "add event" URL.
 */
export function generateGoogleCalendarUrl(event: IggyEvent): string {
  const start = parseEventDateTime(event.date, event.time);
  const end = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleCalTs(start)}/${toGoogleCalTs(end)}`,
    location: LOCATION,
    details: buildDescription(event),
  });

  // Add weekly recurrence if applicable
  if (event.is_recurring && event.recurring_day) {
    const abbr = DAY_ABBREVS[event.recurring_day.toLowerCase()];
    if (abbr) {
      params.set('recur', `RRULE:FREQ=WEEKLY;BYDAY=${abbr}`);
    }
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate iCalendar (.ics) content for a single event.
 */
export function generateIcsContent(event: IggyEvent): string {
  const start = parseEventDateTime(event.date, event.time);
  const end = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
  const now = new Date();

  const uid = `iggy-event-${event.id}@iggysseaside.com`;
  const description = buildDescription(event).replace(/\n/g, '\\n');

  let rrule = '';
  if (event.is_recurring && event.recurring_day) {
    const abbr = DAY_ABBREVS[event.recurring_day.toLowerCase()];
    if (abbr) {
      rrule = `RRULE:FREQ=WEEKLY;BYDAY=${abbr}\r\n`;
    }
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Iggys Seaside Bar//Manager App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsTs(now)}`,
    `DTSTART:${toIcsTs(start)}`,
    `DTEND:${toIcsTs(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${LOCATION}`,
    rrule ? rrule.trimEnd() : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Download a single event as an .ics file.
 */
export function downloadIcsFile(event: IggyEvent): void {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const filename = `iggy-${slug}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download multiple events as a single .ics file.
 */
export function downloadBulkIcs(events: IggyEvent[]): void {
  if (events.length === 0) return;

  const now = new Date();
  const vevents = events.map((event) => {
    const start = parseEventDateTime(event.date, event.time);
    const end = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
    const uid = `iggy-event-${event.id}@iggysseaside.com`;
    const description = buildDescription(event).replace(/\n/g, '\\n');

    let rrule = '';
    if (event.is_recurring && event.recurring_day) {
      const abbr = DAY_ABBREVS[event.recurring_day.toLowerCase()];
      if (abbr) {
        rrule = `RRULE:FREQ=WEEKLY;BYDAY=${abbr}\r\n`;
      }
    }

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toIcsTs(now)}`,
      `DTSTART:${toIcsTs(start)}`,
      `DTEND:${toIcsTs(end)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${LOCATION}`,
      rrule ? rrule.trimEnd() : null,
      'END:VEVENT',
    ]
      .filter(Boolean)
      .join('\r\n');
  });

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Iggys Seaside Bar//Manager App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'iggy-events.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
