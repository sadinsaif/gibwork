import type { Runtime } from './context.js';
import { parseTaskId } from '../util/id.js';
import { loadLedger, saveLedger, upsertEntry, findEntry } from '../store/ledger.js';
import { snapshotFromDetails } from '../core/snapshot.js';
import { diffSnapshots, describeChange } from '../core/diff.js';
import { emitJson, emitJsonError, info, warn, c } from '../util/logger.js';
import { shortDate, timeAgo } from '../util/format.js';

export interface ShowOpts {
  refresh?: boolean;
  history?: boolean;
}

export async function showCmd(idOrUrl: string, opts: ShowOpts, rt: Runtime): Promise<void> {
  const taskId = parseTaskId(idOrUrl);
  let ledger = loadLedger();
  let entry = findEntry(ledger, taskId);

  if (!entry) {
    if (rt.json) emitJsonError('NOT_FOUND', `Not tracked: ${taskId}. Run: earn track ${taskId}`);
    else {
      warn(c.yellow(`Not tracked: ${taskId}`));
      info(c.dim('Track it first:  ') + c.cyan(`earn track ${taskId}`));
    }
    process.exitCode = 1;
    return;
  }

  let newChanges: ReturnType<typeof diffSnapshots> = [];
  if (opts.refresh) {
    info(c.dim(`Refreshing ${taskId.slice(0, 8)}… from Gibwork (${rt.env})…`));
    const details = await rt.service().getTask(taskId);
    const next = snapshotFromDetails(details);
    newChanges = diffSnapshots(entry.snapshot, next);
    const now = new Date().toISOString();
    const updated = {
      ...entry,
      title: details.title,
      snapshot: next,
      lastSyncedAt: now,
      history: newChanges.length > 0 ? [...entry.history, { at: now, changes: newChanges }] : entry.history,
    };
    ledger = upsertEntry(ledger, updated);
    saveLedger(ledger);
    entry = updated;
  }

  if (rt.json) {
    emitJson({ entry, refreshed: Boolean(opts.refresh), newChanges });
    return;
  }

  const s = entry.snapshot;
  info(c.bold(entry.title));
  info(c.dim(entry.url));
  info('');
  info(`  id        ${entry.taskId}`);
  info(`  env       ${entry.environment}`);
  info(`  status    ${s.status}${s.isOpen ? c.green(' (open)') : c.dim(' (closed)')}`);
  // reward is stored already-humanized in the snapshot (rewardAmount is human units):
  info(`  reward    ${trimNum(s.rewardAmount)} ${s.rewardSymbol}${s.rewardUsd !== null ? c.dim(`  (~$${s.rewardUsd})`) : ''}`);
  info(`  deadline  ${shortDate(s.deadline)}`);
  info(`  subs      ${s.pendingCount} pending / ${s.approvedCount} approved / ${s.rejectedCount} rejected`);
  if (s.maxSubmissions !== null) info(`  maxSubs   ${s.maxSubmissions}`);
  if (s.tags.length) info(`  tags      ${s.tags.join(', ')}`);
  if (entry.note) info(`  note      ${entry.note}`);
  info(c.dim(`  tracked   ${shortDate(entry.trackedAt)} · synced ${timeAgo(entry.lastSyncedAt ?? entry.trackedAt)}`));

  if (opts.refresh) {
    info('');
    if (newChanges.length === 0) info(c.dim('No changes since last snapshot.'));
    else {
      info(c.yellow(`${newChanges.length} change(s) detected:`));
      for (const ch of newChanges) info('  · ' + describeChange(ch));
    }
  }

  if (opts.history && entry.history.length > 0) {
    info('');
    info(c.bold('History:'));
    for (const rec of entry.history) {
      info(c.dim(`  ${shortDate(rec.at)}:`));
      for (const ch of rec.changes) info('    · ' + describeChange(ch));
    }
  }
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(6).replace(/\.?0+$/, '');
}
