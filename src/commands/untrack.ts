import type { Runtime } from './context.js';
import { parseTaskId } from '../util/id.js';
import { loadLedger, saveLedger, removeEntry, findEntry } from '../store/ledger.js';
import { emitJson, emitJsonError, info, warn, c } from '../util/logger.js';

export async function untrackCmd(idOrUrl: string, rt: Runtime): Promise<void> {
  const taskId = parseTaskId(idOrUrl);
  const ledger = loadLedger();
  const existing = findEntry(ledger, taskId);

  if (!existing) {
    if (rt.json) emitJsonError('NOT_FOUND', `Not tracked: ${taskId}`);
    else warn(c.yellow(`Not tracked: ${taskId}`));
    process.exitCode = 1;
    return;
  }

  const { ledger: next } = removeEntry(ledger, taskId);
  saveLedger(next);

  if (rt.json) emitJson({ action: 'untracked', taskId, title: existing.title });
  else info(c.green('✓ Untracked: ') + existing.title);
}
