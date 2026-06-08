const pad = (n: number) => String(n).padStart(2, '0');

export type Space = 'upstairs' | 'downstairs' | 'whole';

export const SPACES: { value: Space; label: string }[] = [
  { value: 'upstairs', label: 'Upstairs' },
  { value: 'downstairs', label: 'Downstairs' },
  { value: 'whole', label: 'Entire building' },
];

/** Display label for a space; "" when null/undefined. */
export function spaceLabel(s: Space | null | undefined): string {
  if (s == null) return '';
  return SPACES.find((x) => x.value === s)?.label ?? '';
}

/**
 * Two bookings share physical space IFF either is the whole building or they're the
 * same space. null/undefined === "whole" (conservative; legacy rows). So upstairs vs
 * downstairs = NO conflict.
 */
export function spacesConflict(a: Space | null | undefined, b: Space | null | undefined): boolean {
  const sa = a ?? 'whole';
  const sb = b ?? 'whole';
  return sa === 'whole' || sb === 'whole' || sa === sb;
}

/** 540->"9:00 AM", 1290->"9:30 PM", 1500->"1:00 AM" */
export function minToLabel(min: number): string {
  const clock = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(clock / 60);
  const mm = clock % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(mm)} ${period}`;
}

/** allDay || start == null -> "All day"; else `${minToLabel(start)} – ${minToLabel(end)}` */
export function formatRange(start: number | null, end: number | null, allDay?: boolean): string {
  if (allDay || start === null) return 'All day';
  if (end === null || end === start) return minToLabel(start);
  return `${minToLabel(start)} – ${minToLabel(end)}`;
}

/** 480..1560 step 30; label = minToLabel(value) + (value >= 1440 ? " (next day)" : "") */
export function timeOptions(): { value: number; label: string }[] {
  const opts: { value: number; label: string }[] = [];
  for (let v = 480; v <= 1560; v += 30) {
    opts.push({ value: v, label: minToLabel(v) + (v >= 1440 ? ' (next day)' : '') });
  }
  return opts;
}

/** 12-hour clock label for legacy start_time/end_time/time text fields; "" for null. */
export function timeText(min: number | null): string {
  if (min === null) return '';
  return minToLabel(min);
}

export function windowsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** A busy span on a date — drives per-slot disabling in the time picker. */
export interface BusyWindow {
  date?: string;
  start_min: number | null;
  end_min: number | null;
  all_day: boolean;
  space?: Space | null;
}

/** A time slot shaped for <Select>/<TimeSelect>: presentation + disabled flag derived from existing data. */
export interface TimeSlotOption {
  value: number;
  label: string;
  disabled?: boolean;
  hint?: string;   // 'next day' (amber chip) | 'booked' | 'overlaps' (dim)
  group?: string;  // Morning | Afternoon | Evening | Late night
}

function slotGroup(min: number): string {
  if (min < 720) return 'Morning';
  if (min < 1020) return 'Afternoon';
  if (min < 1440) return 'Evening';
  return 'Late night';
}

/**
 * Build the time-picker options from timeOptions(), deriving the section group, the
 * "next day" chip, and per-slot DISABLED state so conflicts show inline instead of
 * being pickable-then-rejected.
 * - minValue set (END picker): disable slots <= start, and any slot whose [start, slot]
 *   window overlaps a busy window.
 * - minValue null (START picker): disable any slot that falls inside a busy window.
 * - all-day / untimed busy windows disable every slot.
 */
export function timeSelectOptions(
  opts: { minValue?: number | null; busyWindows?: BusyWindow[]; space?: Space | null } = {}
): TimeSlotOption[] {
  const { minValue = null, busyWindows = [], space = null } = opts;
  return timeOptions().map(({ value }) => {
    let disabled = false;
    let hint: string | undefined = value >= 1440 ? 'next day' : undefined;

    if (minValue != null && value <= minValue) disabled = true;

    if (!disabled) {
      for (const w of busyWindows) {
        // A non-conflicting space can't disable a slot (upstairs vs downstairs, etc.).
        if (!spacesConflict(space, w.space)) continue;
        if (w.all_day || w.start_min == null || w.end_min == null) { disabled = true; hint = 'booked'; break; }
        const ws = w.start_min, we = w.end_min;
        if (minValue != null) {
          if (windowsOverlap(minValue, value, ws, we)) { disabled = true; hint = 'overlaps'; break; }
        } else if (value >= ws && value < we) {
          disabled = true; hint = 'booked'; break;
        }
      }
    }

    return { value, label: minToLabel(value), hint, disabled, group: slotGroup(value) };
  });
}
