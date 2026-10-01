/**
 * Amount helpers for Gibwork token values.
 *
 * IMPORTANT (verified against the live prod API):
 * The reward `asset.amount` arrives as a STRING in base units
 * (e.g. "100000000" for 100 USDC at 6 decimals) from BOTH
 * `tasks.listAvailable` and `tasks.get`, even though the SDK's
 * TypeScript declarations type the `tasks.get` variant as `number`.
 * We therefore parse defensively from `string | number | null`.
 *
 * `asset.amount` is the ORIGINAL reward pool, not the remaining balance.
 */

/** Parse a base-unit amount (string or number) into a plain integer number of base units. */
export function parseBaseUnits(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Convert base units to a human decimal number using the token's decimals. */
export function toHuman(rawBaseUnits: string | number | null | undefined, decimals: number): number {
  const base = parseBaseUnits(rawBaseUnits);
  const d = Number.isFinite(decimals) && decimals >= 0 ? decimals : 0;
  return base / 10 ** d;
}

/** Format a token reward for human display, e.g. "100 USDC". */
export function formatReward(
  rawBaseUnits: string | number | null | undefined,
  decimals: number,
  symbol: string | null | undefined,
): string {
  const human = toHuman(rawBaseUnits, decimals);
  const sym = symbol && symbol.length > 0 ? symbol : 'tokens';
  // Trim trailing zeros but keep it readable.
  const pretty = Number.isInteger(human) ? String(human) : human.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, '');
  return `${pretty} ${sym}`;
}

/** Compact reward number (no symbol) for tables/scoring. */
export function rewardHuman(
  rawBaseUnits: string | number | null | undefined,
  decimals: number,
): number {
  return toHuman(rawBaseUnits, decimals);
}
