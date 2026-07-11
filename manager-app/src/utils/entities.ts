// Decode the small set of HTML entities that reach us through scraped/feed
// text stored by the bridge (event names, review snippets) — e.g. WordPress
// feeds encode "&" as "&#038;", which otherwise renders verbatim in the reach
// banner and Luna cards. Numeric (decimal/hex) plus the common named few;
// anything unrecognized stays verbatim. Pure, and a no-op on plain text.

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

const ENTITY_RE = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]{2,8}));/g;

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(ENTITY_RE, (match, dec?: string, hex?: string, name?: string) => {
    if (name) return NAMED[name] ?? match;
    const cp = dec ? Number(dec) : parseInt(hex!, 16);
    // Refuse control characters, lone surrogates, and out-of-range code
    // points — keep the raw text rather than injecting something invisible.
    if (
      !Number.isFinite(cp) ||
      cp > 0x10ffff ||
      (cp >= 0xd800 && cp <= 0xdfff) ||
      (cp < 0x20 && cp !== 0x09 && cp !== 0x0a)
    ) {
      return match;
    }
    return String.fromCodePoint(cp);
  });
}
