import fs from 'node:fs';
import type { Runtime } from './context.js';
import { loadLedger } from '../store/ledger.js';
import { renderJson } from '../export/json.js';
import { renderCsv } from '../export/csv.js';
import { renderMarkdown } from '../export/md.js';
import { emitJson, info, warn, c } from '../util/logger.js';

export type ExportFormat = 'json' | 'csv' | 'md';

export interface ExportOpts {
  format?: string;
  out?: string;
  open?: boolean;
}

export function isExportFormat(s: string): s is ExportFormat {
  return s === 'json' || s === 'csv' || s === 'md';
}

export async function exportCmd(opts: ExportOpts, rt: Runtime): Promise<void> {
  const format: ExportFormat = opts.format && isExportFormat(opts.format) ? opts.format : 'json';
  const ledger = loadLedger();
  let entries = ledger.entries;
  if (opts.open) entries = entries.filter((e) => e.snapshot.isOpen);

  const content = format === 'json' ? renderJson(entries) : format === 'csv' ? renderCsv(entries) : renderMarkdown(entries);

  if (opts.out) {
    fs.writeFileSync(opts.out, content, 'utf8');
    if (rt.json) emitJson({ wrote: opts.out, format, count: entries.length });
    else info(c.green(`✓ Wrote ${entries.length} bounty(ies) to `) + opts.out + c.dim(` (${format})`));
    return;
  }

  // No --out: write the raw export to stdout (pipe-friendly). In --json mode we
  // still honor the requested format on stdout rather than wrapping it.
  process.stdout.write(content.endsWith('\n') ? content : content + '\n');
  if (!rt.json && entries.length === 0) warn(c.yellow('(no tracked bounties — exported an empty set)'));
}
