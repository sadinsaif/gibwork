import type { Runtime } from './context.js';
import { loadLedger, saveLedger } from '../store/ledger.js';
import { snapshotFromDetails } from '../core/snapshot.js';
import { diffSnapshots, describeChange } from '../core/diff.js';
import { EarnApiError } from '../gibwork/service.js';
import { emitJson, info, warn, c } from '../util/logger.js';
import type { LedgerFile, ChangeRecord } from '../types.js';

export interface SyncOpts {
  /** Milliseconds between status calls; default respects the 60/min limit. */
  delay?: string;
}

interface SyncItemResult {
  taskId: string;
  title: string;
  changed: boolean;
  changes: { field: string; from: unknown; to: unknown }[];
  error?: string;
}

export async function syncCmd(opts: SyncOpts, rt: Runtime): Promise<void> {
  const ledger = loadLedger();
  const targets = ledger.entries.filter((e) => e.environment === rt.env);
  const skipped = ledger.entries.length - targets.length;
  const delayMs = clampDelay(opts.delay);

  if (targets.length === 0) {
    if (rt.json) emitJson({ synced: 0, skipped, results: [] });
    else {
      info(c.yellow(`Nothing to sync for env "${rt.env}".`));
      if (skipped > 0) info(c.dim(`${skipped} entry(ies) tracked under another environment. Try --env stage.`));
    }
    return;
  }

  info(c.dim(`Syncing ${targets.length} bounty(ies) from Gibwork (${rt.env})…`));
  const svc = rt.service();
  const results: SyncItemResult[] = [];
  let working: LedgerFile = ledger;

  for (let i = 0; i < targets.length; i++) {
    const entry = targets[i]!;
    try {
      const details = await svc.getTask(entry.taskId);
      const next = snapshotFromDetails(details);
      const changes = diffSnapshots(entry.snapshot, next);
      const now = new Date().toISOString();
      const history = [...entry.history];
      if (changes.length > 0) {
        const rec: ChangeRecord = { at: now, changes };
        history.push(rec);
      }
      const updated = { ...entry, title: details.title, snapshot: next, lastSyncedAt: now, history };
      working = replaceEntry(working, updated);
      results.push({ taskId: entry.taskId, title: details.title, changed: changes.length > 0, changes });
      if (!rt.json) {
        if (changes.length > 0) {
          info(c.yellow(`  ~ ${entry.title}`));
          for (const ch of changes) info('      · ' + describeChange(ch));
        } else {
          info(c.dim(`  = ${entry.title}`));
        }
      }
    } catch (err) {
      const msg = err instanceof EarnApiError ? `${err.code}: ${err.message}` : String(err);
      results.push({ taskId: entry.taskId, title: entry.title, changed: false, changes: [], error: msg });
      if (!rt.json) warn(c.red(`  ! ${entry.title} — ${msg}`));
      if (err instanceof EarnApiError && err.retryAfter) {
        const wait = Number(err.retryAfter);
        if (Number.isFinite(wait) && wait > 0) await sleep(Math.min(wait * 1000, 30000));
      }
    }
    // Persist incrementally so a mid-run failure never loses progress.
    saveLedger(working);
    if (i < targets.length - 1) await sleep(delayMs);
  }

  const changedCount = results.filter((r) => r.changed).length;
  const errorCount = results.filter((r) => r.error).length;

  if (rt.json) {
    emitJson({ synced: targets.length, skipped, changed: changedCount, errors: errorCount, results });
    return;
  }

  info('');
  info(
    c.green(`✓ Synced ${targets.length}`) +
      c.dim(' · ') +
      (changedCount > 0 ? c.yellow(`${changedCount} changed`) : c.dim('0 changed')) +
      (errorCount > 0 ? c.dim(' · ') + c.red(`${errorCount} error(s)`) : ''),
  );
  if (skipped > 0) info(c.dim(`${skipped} entry(ies) under another environment were skipped.`));
}

function replaceEntry(ledger: LedgerFile, entry: LedgerFile['entries'][number]): LedgerFile {
  const entries = ledger.entries.map((e) => (e.taskId === entry.taskId ? entry : e));
  return { ...ledger, entries };
}

function clampDelay(v: string | undefined): number {
  const n = v !== undefined ? Number(v) : 1100;
  if (!Number.isFinite(n) || n < 0) return 1100;
  return Math.min(n, 60000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
