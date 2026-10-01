import type { Runtime } from './context.js';
import { rowFromAvailable, type DiscoverRow } from '../core/snapshot.js';
import { withScores } from '../core/score.js';
import { applyFilters, isSortKey, type FilterOptions, type SortKey } from '../core/filter.js';
import { emitJson, info, c } from '../util/logger.js';
import { renderTable, truncate, timeAgo } from '../util/format.js';
import { formatReward } from '../util/amount.js';

export interface DiscoverOpts {
  limit?: string;
  pages?: string;
  tag?: string[];
  symbol?: string;
  minReward?: string;
  query?: string;
  sort?: string;
  open?: boolean;
  excludePremium?: boolean;
}

export async function discoverCmd(opts: DiscoverOpts, rt: Runtime): Promise<void> {
  const perPage = clampInt(opts.limit, rt.cfg.defaultLimit, 1, 100);
  const pages = clampInt(opts.pages, 1, 1, 10);
  const sort: SortKey = opts.sort && isSortKey(opts.sort) ? opts.sort : 'score';

  info(c.dim(`Fetching available bounties from Gibwork (${rt.env}, up to ${pages} page(s))…`));
  const raw = await rt.service().listAvailableMany(pages, perPage);
  const rows = withScores(raw.map(rowFromAvailable));

  const filters: FilterOptions = {
    query: opts.query,
    tags: opts.tag,
    symbol: opts.symbol,
    minReward: opts.minReward !== undefined ? Number(opts.minReward) : undefined,
    excludePremium: Boolean(opts.excludePremium),
    openOnly: Boolean(opts.open),
    sort,
  };
  const filtered = applyFilters(rows, filters);

  if (rt.json) {
    emitJson({ environment: rt.env, fetched: rows.length, matched: filtered.length, sort, bounties: filtered });
    return;
  }

  if (filtered.length === 0) {
    info(c.yellow('No bounties matched your filters.'));
    return;
  }

  const table = renderTable(
    ['SCORE', 'REWARD', 'SUBS', 'AGE', 'TITLE', 'ID'],
    filtered.map((r) => [
      String(r.score),
      formatReward(r.rewardRaw, r.decimals, r.rewardSymbol),
      subsCell(r),
      timeAgo(r.createdAt),
      truncate(r.title, 34),
      r.id,
    ]),
  );
  process.stderr.write(table + '\n');
  info(
    c.dim(
      `\n${filtered.length} of ${rows.length} bounties shown · sorted by ${sort} · ` +
        `score is earn's local heuristic (freshness+scarcity), not a Gibwork field.`,
    ),
  );
  info(c.dim('Track one with:  ') + c.cyan('earn track <ID>'));
}

function subsCell(r: DiscoverRow): string {
  if (r.maxSubmissions && r.maxSubmissions > 0) {
    return `${r.totalSubmissions}/${r.maxSubmissions}`;
  }
  return String(r.totalSubmissions);
}

function clampInt(v: string | undefined, dflt: number, min: number, max: number): number {
  const n = v !== undefined ? Number(v) : dflt;
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
