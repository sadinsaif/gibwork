import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { configPath, earnHome } from './paths.js';

export const EnvironmentSchema = z.enum(['production', 'stage']);
export type Environment = z.infer<typeof EnvironmentSchema>;

const ConfigSchema = z.object({
  environment: EnvironmentSchema.default('production'),
  timeoutMs: z.number().int().positive().default(20000),
  defaultLimit: z.number().int().positive().max(100).default(20),
});
export type EarnConfig = z.infer<typeof ConfigSchema>;

const CONFIG_KEYS = ['environment', 'timeoutMs', 'defaultLimit'] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

export function isConfigKey(k: string): k is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(k);
}

function ensureHome(): void {
  fs.mkdirSync(earnHome(), { recursive: true });
}

/** Load persisted config, apply env overrides, validate. */
export function loadConfig(): EarnConfig {
  let fromDisk: unknown = {};
  const p = configPath();
  if (fs.existsSync(p)) {
    try {
      fromDisk = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      fromDisk = {};
    }
  }

  const base = ConfigSchema.parse(fromDisk ?? {});

  // Environment variable overrides (highest priority for a run).
  const envOverride = process.env.EARN_ENVIRONMENT?.trim();
  if (envOverride && (envOverride === 'production' || envOverride === 'stage')) {
    base.environment = envOverride;
  }
  const timeoutOverride = process.env.EARN_TIMEOUT_MS?.trim();
  if (timeoutOverride && Number.isFinite(Number(timeoutOverride))) {
    base.timeoutMs = Number(timeoutOverride);
  }

  return base;
}

export function saveConfig(cfg: EarnConfig): void {
  ensureHome();
  const validated = ConfigSchema.parse(cfg);
  const tmp = configPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(validated, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, configPath());
}

export function setConfigValue(cfg: EarnConfig, key: ConfigKey, value: string): EarnConfig {
  const next = { ...cfg };
  switch (key) {
    case 'environment': {
      next.environment = EnvironmentSchema.parse(value);
      break;
    }
    case 'timeoutMs': {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) throw new Error('timeoutMs must be a positive number');
      next.timeoutMs = Math.floor(n);
      break;
    }
    case 'defaultLimit': {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0 || n > 100) throw new Error('defaultLimit must be 1..100');
      next.defaultLimit = Math.floor(n);
      break;
    }
  }
  return next;
}

export function configKeys(): readonly ConfigKey[] {
  return CONFIG_KEYS;
}

export { path };
