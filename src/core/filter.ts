import type { DiscoverRow } from './snapshot.js';

export type SortKey = 'score' | 'reward' | 'newest' | 'oldest' | 'competition';

export interface FilterOptions {
  /** Case-insensitive substring match against title + tags. */
  query?: string;
  /** Require ALL of these tags (case-insensitive). */
  tags?: string[];
  /** Only bounties paying in this token symbol (case-insensitive). */
  symbol?: string;
  /** Minimum reward in native token units (compared within the same symbol). */
  minReward?: number;
  /** Exclude bounties that require a premium account. */
  excludePremium?: boolean;
  /** Only bounties that still have open submission slots. */
  openOnly?: boolean;
  sort?: SortKey;
  limit?: number;
}

const lc = (s: string) => s.toLowerCase();

export function applyFilters(rows: DiscoverRow[], opts: FilterOptions): DiscoverRow[] {
  let out = rows;

  if (opts.openOnly) {
    out = out.filter((r) => r.isOpen);
  }

  if (opts.query) {
    const q = lc(opts.query);
    out = out.filter((r) => lc(r.title).includes(q) || r.tags.some((t) => lc(t).includes(q)));
  }

  if (opts.tags && opts.tags.length > 0) {
    const want = opts.tags.map(lc);
    out = out.filter((r) => {
      const have = r.tags.map(lc);
      return want.every((t) => have.includes(t));
    });
  }

  if (opts.symbol) {
    const sym = lc(opts.symbol);
    out = out.filter((r) => lc(r.rewardSymbol) === sym);
  }

  if (typeof opts.minReward === 'number') {
    out = out.filter((r) => r.rewardHuman >= opts.minReward!);
  }

  if (opts.excludePremium) {
    out = out.filter((r) => !r.requiresPremium);
  }

  out = sortRows(out, opts.sort ?? 'score');

  if (typeof opts.limit === 'number' && opts.limit >= 0) {
    out = out.slice(0, opts.limit);
  }
  return out;
}

function competition(r: DiscoverRow): number {
  // Higher = more competition. Used for ascending sort (least competition first).
  if (r.maxSubmissions && r.maxSubmissions > 0) {
    const remaining = r.slotsRemaining ?? r.maxSubmissions - r.totalSubmissions;
    return 1 - remaining / r.maxSubmissions;
  }
  return r.totalSubmissions;
}

export function sortRows(rows: DiscoverRow[], key: SortKey): DiscoverRow[] {
  const copy = [...rows];
  switch (key) {
    case 'score':
      return copy.sort((a, b) => b.score - a.score);
    case 'reward':
      return copy.sort((a, b) => b.rewardHuman - a.rewardHuman);
    case 'newest':
      return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case 'oldest':
      return copy.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    case 'competition':
      return copy.sort((a, b) => competition(a) - competition(b));
    default:
      return copy;
  }
}

export function isSortKey(s: string): s is SortKey {
  return ['score', 'reward', 'newest', 'oldest', 'competition'].includes(s);
}
