import type { LedgerFile, LedgerEntry } from '../types.js';

export interface RewardPoolBySymbol {
  symbol: string;
  totalAmount: number;
  totalUsd: number | null;
  count: number;
}

export interface DeadlineItem {
  taskId: string;
  title: string;
  deadline: string;
  daysLeft: number;
}

export interface ReportResult {
  generatedAt: string;
  totalTracked: number;
  open: number;
  closed: number;
  byStatus: Record<string, number>;
  rewardPools: RewardPoolBySymbol[];
  totalPendingSubmissions: number;
  totalApprovedSubmissions: number;
  totalRejectedSubmissions: number;
  upcomingDeadlines: DeadlineItem[];
  recentlyChanged: { taskId: string; title: string; at: string; changeCount: number }[];
}

const DAY_MS = 86_400_000;

/**
 * Aggregate the local ledger into a pipeline report.
 *
 * NOTE on scope: Gibwork's API does not expose a participant's own
 * submission/payout history, so this report summarizes the BOUNTIES the
 * hunter is tracking (their opportunity pipeline), not personal earnings.
 * Every number here is derived from real, stored `tasks.get` snapshots.
 */
export function buildReport(ledger: LedgerFile, now = Date.now()): ReportResult {
  const entries = ledger.entries;
  const byStatus: Record<string, number> = {};
  const pools = new Map<string, RewardPoolBySymbol>();
  let open = 0;
  let closed = 0;
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  const deadlines: DeadlineItem[] = [];
  const changed: { taskId: string; title: string; at: string; changeCount: number }[] = [];

  for (const e of entries) {
    const s = e.snapshot;
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    if (s.isOpen) open += 1;
    else closed += 1;
    pending += s.pendingCount;
    approved += s.approvedCount;
    rejected += s.rejectedCount;

    if (s.rewardSymbol) {
      const key = s.rewardSymbol;
      const cur = pools.get(key) ?? { symbol: key, totalAmount: 0, totalUsd: null, count: 0 };
      cur.totalAmount += s.rewardAmount;
      cur.count += 1;
      if (s.rewardUsd !== null) cur.totalUsd = (cur.totalUsd ?? 0) + s.rewardUsd;
      pools.set(key, cur);
    }

    if (s.isOpen && s.deadline) {
      const dl = Date.parse(s.deadline);
      if (Number.isFinite(dl) && dl >= now) {
        deadlines.push({
          taskId: e.taskId,
          title: e.title,
          deadline: s.deadline,
          daysLeft: Math.ceil((dl - now) / DAY_MS),
        });
      }
    }

    const last = lastChange(e);
    if (last) {
      changed.push({ taskId: e.taskId, title: e.title, at: last.at, changeCount: last.count });
    }
  }

  deadlines.sort((a, b) => a.daysLeft - b.daysLeft);
  changed.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    generatedAt: new Date(now).toISOString(),
    totalTracked: entries.length,
    open,
    closed,
    byStatus,
    rewardPools: [...pools.values()].sort((a, b) => b.count - a.count),
    totalPendingSubmissions: pending,
    totalApprovedSubmissions: approved,
    totalRejectedSubmissions: rejected,
    upcomingDeadlines: deadlines.slice(0, 10),
    recentlyChanged: changed.slice(0, 10),
  };
}

function lastChange(e: LedgerEntry): { at: string; count: number } | null {
  if (!e.history || e.history.length === 0) return null;
  const last = e.history[e.history.length - 1];
  if (!last) return null;
  return { at: last.at, count: last.changes.length };
}
