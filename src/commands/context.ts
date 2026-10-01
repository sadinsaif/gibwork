import { loadConfig, type EarnConfig, type Environment } from '../util/config.js';
import { GibworkService } from '../gibwork/service.js';
import { setJsonMode } from '../util/logger.js';

export interface GlobalOpts {
  json?: boolean;
  env?: string;
  timeout?: string;
}

export interface Runtime {
  cfg: EarnConfig;
  env: Environment;
  json: boolean;
  /** Lazily constructs the Gibwork service (only when a network call is needed). */
  service(): GibworkService;
}

/** Merge persisted config with per-invocation global flags into a Runtime. */
export function resolveRuntime(g: GlobalOpts): Runtime {
  const cfg = loadConfig();
  const json = Boolean(g.json);
  setJsonMode(json); // set before any validation so error envelopes honor --json

  let env: Environment = cfg.environment;
  if (g.env !== undefined) {
    if (g.env === 'production' || g.env === 'stage') env = g.env;
    else throw new Error(`Invalid --env "${g.env}". Use "production" or "stage".`);
  }

  const timeoutMs = g.timeout && Number.isFinite(Number(g.timeout)) ? Number(g.timeout) : cfg.timeoutMs;

  let svc: GibworkService | undefined;
  return {
    cfg,
    env,
    json,
    service() {
      if (!svc) svc = new GibworkService({ environment: env, timeoutMs });
      return svc;
    },
  };
}
