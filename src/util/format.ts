import { c } from './logger.js';

/** Truncate to `n` chars with an ellipsis. */
export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  if (n <= 1) return s.slice(0, n);
  return s.slice(0, n - 1) + '…';
}

/** Format an ISO timestamp as YYYY-MM-DD (or '—' when empty/invalid). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toISOString().slice(0, 10);
}

/** Relative "time ago" for a timestamp (compact). */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Render a simple fixed-width table to a string. Column widths are computed
 * from raw (uncolored) cell text so alignment is always correct. The header
 * row is emphasized as a whole line (safe with padding).
 */
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => {
    let w = h.length;
    for (const r of rows) {
      const cell = r[i] ?? '';
      if (cell.length > w) w = cell.length;
    }
    return w;
  });
  const pad = (s: string, i: number) => s.padEnd(widths[i] ?? 0, ' ');
  const headerLine = c.bold(headers.map((h, i) => pad(h, i)).join('  '));
  const sep = c.dim(widths.map((w) => '─'.repeat(w)).join('  '));
  const body = rows.map((r) => r.map((cell, i) => pad(cell ?? '', i)).join('  '));
  return [headerLine, sep, ...body].join('\n');
}
