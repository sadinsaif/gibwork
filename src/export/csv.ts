import type { LedgerEntry } from '../types.js';
import { flattenEntry, FLAT_COLUMNS, type FlatRow } from './flatten.js';

/** RFC-4180-ish CSV escaping: wrap in quotes if needed, double embedded quotes. */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** CSV export of the tracked ledger (one row per bounty). */
export function renderCsv(entries: LedgerEntry[]): string {
  const header = FLAT_COLUMNS.join(',');
  const lines = entries.map((e) => {
    const row = flattenEntry(e);
    return FLAT_COLUMNS.map((col) => csvCell(row[col as keyof FlatRow])).join(',');
  });
  return [header, ...lines].join('\r\n') + '\r\n';
}
