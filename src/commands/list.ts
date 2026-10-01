import type { Runtime } from './context.js';
import { loadLedger } from '../store/ledger.js';
import { emitJson, info, c } from '../util/logger.js';
import { renderTable, truncate, shortDate, timeAgo } from '../util/format.js';

export interface ListOpts {
  open?: boolean;
}

export async function listCmd(opts: ListOpts, rt: Runtime): Promise<void> {
  const ledger = loadLedger();
  let entries = ledger.entries;
  if (opts.open) entries = entries.filter((e) => e.snapshot.isOpen);

  if (rt.json) {
    emitJson({ count: entries.length, entries });
    return;
  }

  if (entries.length === 0) {
    info(c.yellow('No bounties tracked yet.'));
    info(c.dim('Find some with:  ') + c.cyan('earn discover') + c.dim('   then  ') + c.cyan('earn track <ID>'));
    return;
  }

  const table = renderTable(
    ['STATUS', 'REWARD', 'SUBS', 'DEADLINE', 'SYNCED', 'TITLE', 'ID'],
    entries.map((e) => {
      const s = e.snapshot;
      const reward = s.rewardSymbol ? `${trimNum(s.rewardAmount)} ${s.rewardSymbol}` : trimNum(s.rewardAmount);
      return [
        s.isOpen ? c.green('open') : c.dim('closed'),
        reward,
        `${s.pendingCount}/${s.approvedCount}/${s.rejectedCount}`,
        shortDate(s.deadline),
        timeAgo(e.lastSyncedAt ?? e.trackedAt),
        truncate(e.title, 34),
        e.taskId,
      ];
    }),
  );
  process.stderr.write(table + '\n');
  info(c.dim(`\n${entries.length} bounty(ies) tracked · SUBS = pending/approved/rejected · refresh with `) + c.cyan('earn sync'));
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '');
}
