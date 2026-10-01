import { createGibworkClient } from '@gibwork/sdk/node';
import {
  GibworkApiError,
  GibworkTimeoutError,
  GibworkNetworkError,
  GibworkValidationError,
  type AvailableTask,
  type AvailableTaskPage,
  type TaskDetails,
} from '@gibwork/sdk';
import type { Environment } from '../util/config.js';
import { resolveWallet, type ResolvedWallet } from '../wallet/manager.js';

export type { AvailableTask, TaskDetails };

/** A friendly, typed error surface for the CLI layer. */
export class EarnApiError extends Error {
  constructor(
    override readonly message: string,
    readonly code: string,
    readonly status?: number,
    readonly retryAfter?: string,
  ) {
    super(message);
    this.name = 'EarnApiError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GibworkServiceOptions {
  environment: Environment;
  timeoutMs: number;
}

/**
 * Thin wrapper over the official @gibwork/sdk client.
 *
 * Only READ endpoints are exposed here — discovery and task details.
 * No create / submit / approve / refund method is imported or called,
 * by design (read-only tool, zero funds).
 */
export class GibworkService {
  private readonly client: ReturnType<typeof createGibworkClient>;
  readonly wallet: ResolvedWallet;
  readonly environment: Environment;

  constructor(opts: GibworkServiceOptions) {
    this.wallet = resolveWallet();
    this.environment = opts.environment;
    this.client = createGibworkClient({
      privateKey: this.wallet.privateKey,
      production: opts.environment === 'production',
      timeoutMs: opts.timeoutMs,
    });
  }

  /** One page of cross-creator available bounties (free, wallet-authenticated). */
  async listAvailable(page: number, limit: number): Promise<AvailableTaskPage> {
    return this.call(() => this.client.tasks.listAvailable({ page, limit }));
  }

  /**
   * Fetch multiple pages of available bounties, throttled to respect the
   * documented discovery rate limit (30/min). Stops at `maxPages` or when
   * the last page is reached.
   */
  async listAvailableMany(maxPages: number, limit: number): Promise<AvailableTask[]> {
    const all: AvailableTask[] = [];
    let page = 1;
    let lastPage = 1;
    do {
      const res = await this.listAvailable(page, limit);
      all.push(...res.results);
      lastPage = res.lastPage;
      page += 1;
      if (page <= Math.min(maxPages, lastPage)) {
        await sleep(400); // gentle throttle between discovery pages
      }
    } while (page <= Math.min(maxPages, lastPage));
    return all;
  }

  /** Full public details for one bounty by UUID. */
  async getTask(taskId: string): Promise<TaskDetails> {
    return this.call(() => this.client.tasks.get(taskId));
  }

  /** Lightweight reachability probe used by `earn doctor`. */
  async ping(): Promise<{ reachable: boolean; total: number }> {
    const res = await this.listAvailable(1, 1);
    return { reachable: true, total: res.total };
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw mapError(err);
    }
  }
}

function mapError(err: unknown): EarnApiError {
  if (err instanceof GibworkApiError) {
    const body = err.body as { message?: string | string[] } | undefined;
    const detail = Array.isArray(body?.message) ? body?.message.join('; ') : body?.message;
    return new EarnApiError(
      detail || `Gibwork API error (HTTP ${err.status})`,
      'API_ERROR',
      err.status,
      err.retryAfter,
    );
  }
  if (err instanceof GibworkTimeoutError) {
    return new EarnApiError('Request timed out contacting Gibwork', 'TIMEOUT');
  }
  if (err instanceof GibworkNetworkError) {
    return new EarnApiError(`Network error contacting Gibwork: ${err.message}`, 'NETWORK');
  }
  if (err instanceof GibworkValidationError) {
    return new EarnApiError(`Invalid request: ${err.message}`, 'VALIDATION');
  }
  if (err instanceof Error) {
    return new EarnApiError(err.message, 'UNKNOWN');
  }
  return new EarnApiError('Unknown error', 'UNKNOWN');
}
