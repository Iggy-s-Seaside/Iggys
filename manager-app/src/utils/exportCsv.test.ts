import { describe, it, expect } from 'vitest';
import { toCsv, type CsvColumn } from './exportCsv';

type Row = { name: string; note: string; n: number | null };
const cols: CsvColumn<Row>[] = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Note', value: (r) => r.note },
  { header: 'N', value: (r) => r.n },
];

describe('toCsv', () => {
  it('emits a header row and CRLF-joined body, coercing numbers', () => {
    const csv = toCsv([{ name: 'Ann', note: 'hi', n: 1 }], cols);
    expect(csv).toBe('Name,Note,N\r\nAnn,hi,1');
  });

  it('emits only the header for empty rows', () => {
    expect(toCsv([], cols)).toBe('Name,Note,N');
  });

  it('quotes fields containing a comma', () => {
    const csv = toCsv([{ name: 'Doe, Jane', note: '', n: null }], cols);
    expect(csv).toBe('Name,Note,N\r\n"Doe, Jane",,');
  });

  it('doubles embedded quotes (RFC 4180)', () => {
    expect(toCsv([{ name: 'he said "hi"', note: '', n: null }], cols)).toContain('"he said ""hi"""');
  });

  it('quotes fields containing a newline', () => {
    expect(toCsv([{ name: 'line1\nline2', note: '', n: null }], cols)).toContain('"line1\nline2"');
  });

  it('renders null / undefined cells as empty', () => {
    expect(toCsv([{ name: '', note: '', n: null }], cols)).toBe('Name,Note,N\r\n,,');
  });

  // Documents a known LOW-severity gap: leading =,+,-,@ are NOT neutralized, so a
  // value like "=HYPERLINK(...)" stays a live formula if the CSV is opened in Excel
  // (CSV injection). Pinned here; hardening (prefix a ') would be a deliberate change.
  it('does NOT currently neutralize spreadsheet-formula leading chars', () => {
    expect(toCsv([{ name: '=1+1', note: '', n: null }], cols)).toContain('\r\n=1+1,,');
  });
});
