import type { Environment } from './util/config.js';

/**
 * A point-in-time snapshot of a bounty's state, derived from a real
 * `tasks.get` (TaskDetails) response. Stored in the ledger so we can
 * diff how a bounty changes over time.
 */
export interface Snapshot {
  fetchedAt: string;
  title: string;
  status: string;
  isOpen: boolean;
  deadline: string | null;
  /** Human-readable reward pool (original allocation, not remaining). */
  rewardAmount: number;
  rewardSymbol: string;
  rewardMint: string;
  /** USD value of the pool when the API provides it (tasks.get only). */
  rewardUsd: number | null;
  tags: string[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  minSubmissionAmountRaw: string | number | null;
  maxSubmissions: number | null;
}

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ChangeRecord {
  at: string;
  changes: FieldChange[];
}

export interface LedgerEntry {
  taskId: string;
  title: string;
  url: string;
  environment: Environment;
  note?: string;
  trackedAt: string;
  lastSyncedAt?: string;
  snapshot: Snapshot;
  history: ChangeRecord[];
}

export interface LedgerFile {
  version: 1;
  entries: LedgerEntry[];
}
