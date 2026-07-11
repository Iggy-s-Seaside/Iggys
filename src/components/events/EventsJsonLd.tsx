import { useEffect } from 'react';
import { eventDateKeys, todayKey } from '../../lib/calendarDates';
import type { IggyEvent } from '../../types/menu';

/**
 * schema.org Event structured data for Google event rich results — so
 * "things to do in Seaside tonight/tomorrow" searches can surface Iggy's
 * events directly. Data-driven from the same rows the page renders: every
 * future event added in the manager app gets markup for free.
 *
 * Injected as a <script type="application/ld+json"> in <head> (Google reads
 * client-rendered JSON-LD). Cleans up after itself on unmount/data change.
 */

const SITE = 'https://www.iggysseaside.com';

const VENUE = {
  '@type': 'BarOrPub',
  name: "Iggy's",
  address: {
    '@type': 'PostalAddress',
    streetAddress: '200 S Franklin St',
    addressLocality: 'Seaside',
    addressRegion: 'OR',
    postalCode: '97138',
    addressCountry: 'US',
  },
};

/** UTC offset (e.g. "-07:00") for America/Los_Angeles on a given date —
 *  DST-correct without a date library. */
function pacificOffset(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT-07:00"
  const m = tzName?.match(/GMT([+-]\d{2}:\d{2})/);
  return m?.[1] ?? '-08:00';
}

function isoAt(dateStr: string, minutes: number): string {
  // end_min > 1440 means the window crosses midnight into the next day
  // (usePublicCalendar spillover convention).
  let d = dateStr;
  let mins = minutes;
  if (mins >= 1440) {
    mins -= 1440;
    const next = new Date(`${dateStr}T00:00:00`);
    next.setDate(next.getDate() + 1);
    d = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
      next.getDate(),
    ).padStart(2, '0')}`;
  }
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${d}T${hh}:${mm}:00${pacificOffset(d)}`;
}

/** Generic words after "DJ" that name a series, not an act — never a performer. */
const GENERIC_DJ_WORDS = /^(night|nights|saturday|saturdays|friday|fridays|set|sets|party|dance)$/i;

function toJsonLd(ev: IggyEvent, dateOverride?: string) {
  const date = dateOverride ?? ev.date;
  const node: Record<string, unknown> = {
    '@type': 'Event',
    name: ev.title,
    description: ev.description,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: VENUE,
    organizer: { '@type': 'Organization', name: "Iggy's", url: SITE },
    url: `${SITE}/events`,
  };
  if (ev.start_min != null) node.startDate = isoAt(date, ev.start_min);
  else node.startDate = date;
  if (ev.end_min != null) node.endDate = isoAt(date, ev.end_min);
  if (ev.image_url) {
    node.image = ev.image_url.startsWith('http') ? ev.image_url : `${SITE}${ev.image_url}`;
  }
  // Only claim free entry when the copy actually says so.
  if (/\b(no cover|never a cover|free)\b/i.test(`${ev.title} ${ev.description}`)) {
    node.isAccessibleForFree = true;
    node.offers = {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE}/events`,
    };
  }
  const copy = `${ev.title} ${ev.description}`;
  const dj = ev.title.match(/\bDJ\s+([A-Z][\w'-]*)/);
  // A named collective in the copy ("... the Hit Squad collective ...") beats both.
  const collective = copy.match(/\bthe\s+([A-Z][A-Za-z' ]+?)\s+collective\b/);
  if (collective) {
    node.performer = { '@type': 'PerformingGroup', name: `The ${collective[1]}` };
  } else if (dj && !GENERIC_DJ_WORDS.test(dj[1])) {
    node.performer = { '@type': 'PerformingGroup', name: dj[0] };
  } else if (ev.is_recurring && /\bDJ\b/i.test(copy)) {
    // Rotating series with no billed act — validators want a performer; an honest
    // generic one beats omitting it (Gemini's flag, 2026-07-09 partnership session).
    node.performer = { '@type': 'PerformingGroup', name: 'Rotating Guest DJs' };
  }
  // 21+ only when the copy says so — never inferred.
  if (/\b21\s*\+/.test(`${ev.title} ${ev.description}`)) {
    node.typicalAgeRange = '21-';
  }
  return node;
}

/** How far ahead to materialize a recurring event with no recurring_until. */
const OPEN_ENDED_HORIZON_DAYS = 60;

function horizonKey(fromKey: string, days: number): string {
  const [y, m, d] = fromKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

/** A recurring event becomes one concrete Event node per upcoming occurrence —
 *  the markup shape Google's event rich results support (a bare weekly
 *  "schedule" node is not surfaced). Capped by recurring_until when set. */
function recurringToJsonLd(ev: IggyEvent): Record<string, unknown>[] {
  const from = todayKey();
  const to = horizonKey(from, OPEN_ENDED_HORIZON_DAYS);
  return eventDateKeys(
    {
      date: ev.date,
      is_recurring: ev.is_recurring,
      recurring_day: ev.recurring_day,
      recurring_until: ev.recurring_until,
    },
    from,
    to,
  ).map((key) => toJsonLd(ev, key));
}

export default function EventsJsonLd({ events }: { events: IggyEvent[] }) {
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneOff = events.filter((ev) => {
      if (!ev.active || ev.is_recurring || !ev.date) return false;
      return new Date(`${ev.date}T23:59:59`) >= today;
    });
    const recurring = events.filter((ev) => ev.active && ev.is_recurring);
    const nodes = [...oneOff.map((ev) => toJsonLd(ev)), ...recurring.flatMap(recurringToJsonLd)];
    if (nodes.length === 0) return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-iggys-events', '1');
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': nodes,
    });
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [events]);

  return null;
}
