import type { LedgerEntry } from '../types.js';
import { flattenEntry } from './flatten.js';

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function reward(amount: number, symbol: string, usd: number | null): string {
  const base = symbol ? `${amount} ${symbol}` : String(amount);
  return usd !== null ? `${base} (~$${usd})` : base;
}

/** Markdown-table export of the tracked ledger, suitable for a README or issue. */
export function renderMarkdown(entries: LedgerEntry[]): string {
  const header =
    '| Bounty | Status | Reward | Submissions (P/A/R) | Deadline | Link |\n' +
    '| --- | --- | --- | --- | --- | --- |';
  const rows = entries.map((e) => {
    const r = flattenEntry(e);
    const subs = `${r.pending}/${r.approved}/${r.rejected}`;
    const state = r.isOpen ? r.status + ' (open)' : r.status;
    const deadline = r.deadline ? r.deadline.slice(0, 10) : '—';
    return `| ${esc(r.title)} | ${esc(state)} | ${esc(reward(r.rewardAmount, r.rewardSymbol, r.rewardUsd))} | ${subs} | ${deadline} | [open](${r.url}) |`;
  });
  const title = `# earn — tracked bounties (${entries.length})\n\n_Generated ${new Date().toISOString()}_\n`;
  return `${title}\n${[header, ...rows].join('\n')}\n`;
}
