import type { Runtime } from './context.js';
import { parseTaskId } from '../util/id.js';
import { loadLedger, saveLedger, findEntry, upsertEntry } from '../store/ledger.js';
import { snapshotFromDetails, bountyUrl } from '../core/snapshot.js';
import { diffSnapshots, describeChange } from '../core/diff.js';
import { EarnApiError } from '../gibwork/service.js';
import { emitJson, info, warn, c } from '../util/logger.js';
import type { Snapshot } from '../types.js';

export interface WatchOpts {
  interval?: string;
  count?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function watchCmd(idsOrUrls: string[], opts: WatchOpts, rt: Runtime): Promise<void> {
  const ledger = loadLedger();
  let ids: string[];
  if (idsOrUrls.length > 0) {
    ids = idsOrUrls.map(parseTaskId);
  } else {
    ids = ledger.entries.filter((e) => e.environment === rt.env).map((e) => e.taskId);
  }

  if (ids.length === 0) {
    if (rt.json) emitJson({ watching: 0, message: 'nothing to watch' });
    else warn(c.yellow('Nothing to watch. Pass a bounty id/URL, or track some bounties first.'));
    process.exitCode = 1;
    return;
  }

  const intervalMs = clampInterval(opts.interval);
  const maxPolls = clampCount(opts.count);
  const svc = rt.service();
  const baseline = new Map<string, Snapshot>();

  info(
    c.dim(
      `Watching ${ids.length} bounty(ies) every ${Math.round(intervalMs / 1000)}s` +
        (maxPolls > 0 ? ` for ${maxPolls} poll(s)` : ' (Ctrl+C to stop)') +
        ` · env ${rt.env}`,
    ),
  );

  let poll = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    poll += 1;
    const stamp = new Date().toISOString();
    for (let i = 0; i < ids.length; i++) {
      const taskId = ids[i]!;
      try {
        const details = await svc.getTask(taskId);
        const next = snapshotFromDetails(details);
        const prev = baseline.get(taskId);
        if (!prev) {
          baseline.set(taskId, next);
          if (rt.json) emitJson({ event: 'baseline', at: stamp, taskId, title: details.title, snapshot: next });
          else info(c.dim(`[${hhmm(stamp)}] baseline · ${details.title}`));
        } else {
          const changes = diffSnapshots(prev, next);
          if (changes.length > 0) {
            baseline.set(taskId, next);
            persistIfTracked(taskId, details.title, next, stamp, changes);
            if (rt.json) emitJson({ event: 'change', at: stamp, taskId, title: details.title, changes });
            else {
              info(c.yellow(`[${hhmm(stamp)}] CHANGED · ${details.title}`));
              for (const ch of changes) info('    · ' + describeChange(ch));
              info(c.dim('    ' + bountyUrl(taskId)));
            }
          } else if (!rt.json) {
            info(c.dim(`[${hhmm(stamp)}] no change · ${details.title}`));
          }
        }
      } catch (err) {
        const msg = err instanceof EarnApiError ? `${err.code}: ${err.message}` : String(err);
        if (rt.json) emitJson({ event: 'error', at: stamp, taskId, error: msg });
        else warn(c.red(`[${hhmm(stamp)}] error · ${taskId.slice(0, 8)} — ${msg}`));
      }
      if (i < ids.length - 1) await sleep(1100); // spread status calls (60/min limit)
    }

    if (maxPolls > 0 && poll >= maxPolls) break;
    await sleep(intervalMs);
  }
}

function persistIfTracked(taskId: string, title: string, snap: Snapshot, at: string, changes: ReturnType<typeof diffSnapshots>): void {
  const ledger = loadLedger();
  const entry = findEntry(ledger, taskId);
  if (!entry) return;
  const updated = {
    ...entry,
    title,
    snapshot: snap,
    lastSyncedAt: at,
    history: [...entry.history, { at, changes }],
  };
  saveLedger(upsertEntry(ledger, updated));
}

function hhmm(iso: string): string {
  return new Date(iso).toISOString().slice(11, 19);
}

function clampInterval(v: string | undefined): number {
  const secs = v !== undefined ? Number(v) : 60;
  if (!Number.isFinite(secs)) return 60000;
  // Minimum 30s to stay well within the 60/min status limit.
  return Math.max(30, Math.floor(secs)) * 1000;
}

function clampCount(v: string | undefined): number {
  const n = v !== undefined ? Number(v) : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}
