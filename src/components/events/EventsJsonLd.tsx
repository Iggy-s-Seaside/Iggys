import { useEffect } from 'react';
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

function toJsonLd(ev: IggyEvent) {
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
  if (ev.start_min != null) node.startDate = isoAt(ev.date, ev.start_min);
  else node.startDate = ev.date;
  if (ev.end_min != null) node.endDate = isoAt(ev.date, ev.end_min);
  if (ev.image_url) {
    node.image = ev.image_url.startsWith('http') ? ev.image_url : `${SITE}${ev.image_url}`;
  }
  // Only claim free entry when the copy actually says so.
  if (/\b(no cover|free)\b/i.test(`${ev.title} ${ev.description}`)) {
    node.isAccessibleForFree = true;
    node.offers = {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE}/events`,
    };
  }
  const dj = ev.title.match(/\bDJ\s+[A-Z][\w'-]*/);
  if (dj) node.performer = { '@type': 'PerformingGroup', name: dj[0] };
  return node;
}

export default function EventsJsonLd({ events }: { events: IggyEvent[] }) {
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events.filter((ev) => {
      if (!ev.active || ev.is_recurring || !ev.date) return false;
      return new Date(`${ev.date}T23:59:59`) >= today;
    });
    if (upcoming.length === 0) return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-iggys-events', '1');
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': upcoming.map(toJsonLd),
    });
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [events]);

  return null;
}
