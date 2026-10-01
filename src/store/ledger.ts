import fs from 'node:fs';
import { ledgerPath, earnHome } from '../util/paths.js';
import type { LedgerFile, LedgerEntry } from '../types.js';

const EMPTY: LedgerFile = { version: 1, entries: [] };

/** Load the local ledger, tolerating a missing or corrupt file. */
export function loadLedger(): LedgerFile {
  const p = ledgerPath();
  if (!fs.existsSync(p)) return { ...EMPTY, entries: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as LedgerFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return { ...EMPTY, entries: [] };
    }
    return parsed;
  } catch {
    return { ...EMPTY, entries: [] };
  }
}

/** Persist the ledger atomically (tmp + rename), owner-only permissions. */
export function saveLedger(ledger: LedgerFile): void {
  fs.mkdirSync(earnHome(), { recursive: true });
  const tmp = ledgerPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, ledgerPath());
}

export function findEntry(ledger: LedgerFile, taskId: string): LedgerEntry | undefined {
  return ledger.entries.find((e) => e.taskId === taskId);
}

export function upsertEntry(ledger: LedgerFile, entry: LedgerEntry): LedgerFile {
  const idx = ledger.entries.findIndex((e) => e.taskId === entry.taskId);
  const entries = [...ledger.entries];
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  return { ...ledger, entries };
}

export function removeEntry(ledger: LedgerFile, taskId: string): { ledger: LedgerFile; removed: boolean } {
  const idx = ledger.entries.findIndex((e) => e.taskId === taskId);
  if (idx < 0) return { ledger, removed: false };
  const entries = ledger.entries.filter((e) => e.taskId !== taskId);
  return { ledger: { ...ledger, entries }, removed: true };
}
