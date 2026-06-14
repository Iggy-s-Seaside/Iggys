// Reusable, dependency-free CSV export helpers.
//
// `toCsv` turns an array of row objects into RFC-4180-ish CSV text (quotes a
// field only when it contains a comma, quote, or newline, and doubles embedded
// quotes). `downloadCsv` triggers a browser download of that text. Use the
// shared display formatters from utils/format inside your column accessors so
// the exported numbers/dates read exactly like the on-screen ones.
//
//   const csv = toCsv(rows, [
//     { header: 'Space', value: (r) => r.label },
//     { header: 'Revenue', value: (r) => money(r.revenue) },
//   ]);
//   downloadCsv('iggys-report.csv', csv);

export interface CsvColumn<T> {
  /** Column header text (first row of the file). */
  header: string;
  /**
   * Cell accessor. Return a string/number/null — it's coerced and escaped.
   * Reuse money()/safeFmtDate() here so exports match the screen.
   */
  value: (row: T) => string | number | null | undefined;
}

/** Escape a single CSV field per RFC 4180: quote when it contains , " or newline. */
function escapeCell(raw: string | number | null | undefined): string {
  const s = raw == null ? '' : String(raw);
  if (s === '') return '';
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build CSV text from rows + a typed column spec. Always emits a header row.
 * Lines are joined with CRLF for maximum spreadsheet compatibility (Excel).
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(','),
  );
  return [headerLine, ...body].join('\r\n');
}

/**
 * Trigger a client-side download of CSV text. Prepends a UTF-8 BOM so Excel
 * renders accented characters and currency symbols correctly. No-ops outside
 * the browser (SSR-safe).
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revocation so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
