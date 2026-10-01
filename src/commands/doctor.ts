import fs from 'node:fs';
import type { Runtime } from './context.js';
import { resolveWallet } from '../wallet/manager.js';
import { EarnApiError } from '../gibwork/service.js';
import { earnHome, ephemeralKeyPath } from '../util/paths.js';
import { emitJson, info, warn, c } from '../util/logger.js';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function doctorCmd(rt: Runtime): Promise<void> {
  const checks: Check[] = [];

  // 1. Node version
  const major = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'node >= 22',
    ok: major >= 22,
    detail: `v${process.versions.node}`,
  });

  // 2. earn home writable
  let homeOk = false;
  let homeDetail = earnHome();
  try {
    fs.mkdirSync(earnHome(), { recursive: true });
    fs.accessSync(earnHome(), fs.constants.W_OK);
    homeOk = true;
  } catch (err) {
    homeDetail += ` (${err instanceof Error ? err.message : 'not writable'})`;
  }
  checks.push({ name: 'home writable', ok: homeOk, detail: homeDetail });

  // 3. Wallet resolution (never reveals the secret key)
  let walletOk = false;
  let walletDetail = '';
  try {
    const w = resolveWallet();
    walletOk = true;
    walletDetail = `${w.mode} · ${w.publicKey}`;
    if (w.mode === 'ephemeral-read-only') walletDetail += c.dim(` (${ephemeralKeyPath()})`);
  } catch (err) {
    walletDetail = err instanceof Error ? err.message : 'failed';
  }
  checks.push({ name: 'wallet', ok: walletOk, detail: walletDetail });

  // 4. Connectivity (real read-only API probe)
  let apiOk = false;
  let apiDetail = '';
  try {
    const { total } = await rt.service().ping();
    apiOk = true;
    apiDetail = `reachable · ${total} available bounties (${rt.env})`;
  } catch (err) {
    if (err instanceof EarnApiError) apiDetail = `${err.code}: ${err.message}`;
    else apiDetail = err instanceof Error ? err.message : 'unreachable';
  }
  checks.push({ name: 'gibwork api', ok: apiOk, detail: apiDetail });

  const allOk = checks.every((ch) => ch.ok);

  if (rt.json) {
    emitJson({ ok: allOk, environment: rt.env, checks });
    process.exitCode = allOk ? 0 : 1;
    return;
  }

  info(c.bold('earn doctor'));
  for (const ch of checks) {
    const mark = ch.ok ? c.green('✓') : c.red('✗');
    info(`  ${mark} ${ch.name.padEnd(16)} ${ch.detail}`);
  }
  info('');
  info(allOk ? c.green('All checks passed. You are ready to go.') : c.yellow('Some checks failed — see above.'));
  process.exitCode = allOk ? 0 : 1;
}
