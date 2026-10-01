import type { LedgerEntry } from '../types.js';
import { flattenEntry } from './flatten.js';

/** Pretty JSON export of the tracked ledger (flattened rows). */
export function renderJson(entries: LedgerEntry[]): string {
  const rows = entries.map(flattenEntry);
  return JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, rows }, null, 2);
}
