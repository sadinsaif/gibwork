import type { Runtime } from './context.js';
import { parseTaskId } from '../util/id.js';
import { loadLedger, saveLedger, upsertEntry, findEntry } from '../store/ledger.js';
import { snapshotFromDetails, bountyUrl } from '../core/snapshot.js';
import type { LedgerEntry } from '../types.js';
import { emitJson, info, c } from '../util/logger.js';
import { formatReward } from '../util/amount.js';

export interface TrackOpts {
  note?: string;
}

export async function trackCmd(idOrUrl: string, opts: TrackOpts, rt: Runtime): Promise<void> {
  const taskId = parseTaskId(idOrUrl);
  info(c.dim(`Fetching bounty ${taskId.slice(0, 8)}… from Gibwork (${rt.env})…`));
  const details = await rt.service().getTask(taskId);
  const snapshot = snapshotFromDetails(details);

  const ledger = loadLedger();
  const existing = findEntry(ledger, taskId);
  const now = new Date().toISOString();

  const entry: LedgerEntry = {
    taskId,
    title: details.title,
    url: bountyUrl(taskId),
    environment: rt.env,
    note: opts.note ?? existing?.note,
    trackedAt: existing?.trackedAt ?? now,
    lastSyncedAt: now,
    snapshot,
    history: existing?.history ?? [],
  };

  saveLedger(upsertEntry(ledger, entry));

  if (rt.json) {
    emitJson({ action: existing ? 'updated' : 'tracked', entry });
    return;
  }

  const verb = existing ? 'Updated' : 'Now tracking';
  info(c.green(`✓ ${verb}: `) + c.bold(details.title));
  info(
    `  reward   ${formatReward(details.asset?.amount, details.asset?.decimals ?? 0, details.asset?.symbol)}` +
      (snapshot.rewardUsd !== null ? c.dim(`  (~$${snapshot.rewardUsd})`) : ''),
  );
  info(`  status   ${snapshot.status}${snapshot.isOpen ? c.green(' (open)') : c.dim(' (closed)')}`);
  info(`  subs     ${snapshot.pendingCount} pending / ${snapshot.approvedCount} approved / ${snapshot.rejectedCount} rejected`);
  info(c.dim(`  ${entry.url}`));
}
