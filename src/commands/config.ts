import type { Runtime } from './context.js';
import {
  loadConfig,
  saveConfig,
  setConfigValue,
  isConfigKey,
  configKeys,
  type EarnConfig,
  type ConfigKey,
} from '../util/config.js';
import { configPath, ledgerPath, earnHome } from '../util/paths.js';
import { emitJson, emitJsonError, info, warn, c } from '../util/logger.js';

export async function configCmd(action: string | undefined, key: string | undefined, value: string | undefined, rt: Runtime): Promise<void> {
  const cfg = loadConfig();

  if (!action || action === 'list') {
    if (rt.json) emitJson({ config: cfg, paths: paths() });
    else {
      info(c.bold('earn config'));
      for (const k of configKeys()) info(`  ${k.padEnd(14)} ${String(cfg[k])}`);
      info('');
      info(c.dim('  config file   ') + configPath());
      info(c.dim('  ledger file   ') + ledgerPath());
    }
    return;
  }

  if (action === 'path') {
    if (rt.json) emitJson(paths());
    else {
      info(c.dim('home    ') + earnHome());
      info(c.dim('config  ') + configPath());
      info(c.dim('ledger  ') + ledgerPath());
    }
    return;
  }

  if (action === 'get') {
    if (!key || !isConfigKey(key)) return fail(rt, `Unknown config key: ${key}. Valid: ${configKeys().join(', ')}`);
    if (rt.json) emitJson({ key, value: cfg[key] });
    else info(String(cfg[key as ConfigKey]));
    return;
  }

  if (action === 'set') {
    if (!key || !isConfigKey(key)) return fail(rt, `Unknown config key: ${key}. Valid: ${configKeys().join(', ')}`);
    if (value === undefined) return fail(rt, `Missing value for: earn config set ${key} <value>`);
    let next: EarnConfig;
    try {
      next = setConfigValue(cfg, key, value);
    } catch (err) {
      return fail(rt, err instanceof Error ? err.message : String(err));
    }
    saveConfig(next);
    if (rt.json) emitJson({ action: 'set', key, value: next[key] });
    else info(c.green(`✓ ${key} = ${String(next[key])}`));
    return;
  }

  fail(rt, `Unknown config action: ${action}. Use: list | get <key> | set <key> <value> | path`);
}

function paths() {
  return { home: earnHome(), config: configPath(), ledger: ledgerPath() };
}

function fail(rt: Runtime, message: string): void {
  if (rt.json) emitJsonError('CONFIG', message);
  else warn(c.red(message));
  process.exitCode = 1;
}
