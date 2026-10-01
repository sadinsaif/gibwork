import type { DiscoverRow } from './snapshot.js';

/**
 * earn's local "opportunity" heuristic.
 *
 * IMPORTANT: This score is computed entirely by earn from real Gibwork
 * fields. Gibwork does NOT provide a ranking/score — this is a convenience
 * for the hunter, and the formula is fully documented so it can be trusted
 * or ignored.
 *
 * Inputs (all from the real `listAvailable` response):
 *   - freshness: newer bounties score higher (exponential decay, ~14-day half-life-ish).
 *   - scarcity:  less competition scores higher. Uses remaining slots when the
 *                bounty caps submissions, otherwise falls back to 1/(1+totalSubmissions).
 *
 * A closed bounty (isOpen === false) always scores 0.
 *
 * Reward VALUE is deliberately NOT folded into the score: discovery responses
 * carry no USD price, and comparing raw token amounts across different mints
 * (USDC vs SOL vs BONK …) would be misleading. Reward is surfaced separately.
 */
const DAY_MS = 86_400_000;
const FRESHNESS_TAU_DAYS = 14;
const W_FRESHNESS = 0.55;
const W_SCARCITY = 0.45;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export function freshness(createdAt: string, now = Date.now()): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return 0;
  const ageDays = Math.max(0, (now - created) / DAY_MS);
  return Math.exp(-ageDays / FRESHNESS_TAU_DAYS);
}

export function scarcity(row: Pick<DiscoverRow, 'maxSubmissions' | 'slotsRemaining' | 'totalSubmissions'>): number {
  if (row.maxSubmissions && row.maxSubmissions > 0) {
    const remaining = row.slotsRemaining ?? row.maxSubmissions - row.totalSubmissions;
    return clamp01(remaining / row.maxSubmissions);
  }
  return 1 / (1 + Math.max(0, row.totalSubmissions));
}

/** Returns an integer 0..100. */
export function opportunityScore(row: DiscoverRow, now = Date.now()): number {
  if (!row.isOpen) return 0;
  const f = freshness(row.createdAt, now);
  const s = scarcity(row);
  return Math.round(100 * (W_FRESHNESS * f + W_SCARCITY * s));
}

/** Attach scores to a batch of rows (mutates copies, returns new array). */
export function withScores(rows: DiscoverRow[], now = Date.now()): DiscoverRow[] {
  return rows.map((r) => ({ ...r, score: opportunityScore(r, now) }));
}
