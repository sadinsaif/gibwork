import type { Runtime } from './context.js';
import { loadLedger } from '../store/ledger.js';
import { buildReport } from '../core/report.js';
import { emitJson, info, c } from '../util/logger.js';
import { shortDate } from '../util/format.js';

export async function reportCmd(rt: Runtime): Promise<void> {
  const ledger = loadLedger();
  const report = buildReport(ledger);

  if (rt.json) {
    emitJson(report);
    return;
  }

  if (report.totalTracked === 0) {
    info(c.yellow('No bounties tracked yet — nothing to report.'));
    info(c.dim('Start with:  ') + c.cyan('earn discover') + c.dim('  then  ') + c.cyan('earn track <ID>'));
    return;
  }

  info(c.bold('earn — bounty pipeline report'));
  info(c.dim(`generated ${report.generatedAt}`));
  info('');
  info(`  tracked      ${report.totalTracked}  (${c.green(String(report.open) + ' open')} / ${c.dim(String(report.closed) + ' closed')})`);
  info(`  submissions  ${report.totalPendingSubmissions} pending · ${report.totalApprovedSubmissions} approved · ${report.totalRejectedSubmissions} rejected  ${c.dim('(across tracked bounties)')}`);

  info('');
  info(c.bold('  Reward pools by token'));
  if (report.rewardPools.length === 0) info(c.dim('    (none)'));
  for (const p of report.rewardPools) {
    const usd = p.totalUsd !== null ? c.dim(`  (~$${round(p.totalUsd)})`) : '';
    info(`    ${trim(p.totalAmount)} ${p.symbol}  ${c.dim(`× ${p.count} bounty(ies)`)}${usd}`);
  }

  info('');
  info(c.bold('  Status breakdown'));
  for (const [status, count] of Object.entries(report.byStatus)) {
    info(`    ${status.padEnd(12)} ${count}`);
  }

  if (report.upcomingDeadlines.length > 0) {
    info('');
    info(c.bold('  Upcoming deadlines'));
    for (const d of report.upcomingDeadlines) {
      const urgent = d.daysLeft <= 2 ? c.red : d.daysLeft <= 7 ? c.yellow : c.dim;
      info(`    ${shortDate(d.deadline)}  ${urgent(`${d.daysLeft}d left`)}  ${d.title}`);
    }
  }

  if (report.recentlyChanged.length > 0) {
    info('');
    info(c.bold('  Recently changed'));
    for (const r of report.recentlyChanged) {
      info(`    ${shortDate(r.at)}  ${c.yellow(`${r.changeCount} change(s)`)}  ${r.title}`);
    }
  }

  info('');
  info(c.dim('  Note: Gibwork does not expose a participant\'s own payout history,'));
  info(c.dim('  so this summarizes the bounties you track, not personal earnings.'));
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '');
}
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
