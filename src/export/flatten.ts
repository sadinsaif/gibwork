import type { LedgerEntry } from '../types.js';

/** A flat, export-friendly projection of a ledger entry. */
export interface FlatRow {
  taskId: string;
  title: string;
  url: string;
  environment: string;
  status: string;
  isOpen: boolean;
  rewardAmount: number;
  rewardSymbol: string;
  rewardUsd: number | null;
  pending: number;
  approved: number;
  rejected: number;
  deadline: string;
  trackedAt: string;
  lastSyncedAt: string;
  note: string;
}

export function flattenEntry(e: LedgerEntry): FlatRow {
  const s = e.snapshot;
  return {
    taskId: e.taskId,
    title: e.title,
    url: e.url,
    environment: e.environment,
    status: s.status,
    isOpen: s.isOpen,
    rewardAmount: s.rewardAmount,
    rewardSymbol: s.rewardSymbol,
    rewardUsd: s.rewardUsd,
    pending: s.pendingCount,
    approved: s.approvedCount,
    rejected: s.rejectedCount,
    deadline: s.deadline ?? '',
    trackedAt: e.trackedAt,
    lastSyncedAt: e.lastSyncedAt ?? '',
    note: e.note ?? '',
  };
}

export const FLAT_COLUMNS: (keyof FlatRow)[] = [
  'taskId',
  'title',
  'url',
  'environment',
  'status',
  'isOpen',
  'rewardAmount',
  'rewardSymbol',
  'rewardUsd',
  'pending',
  'approved',
  'rejected',
  'deadline',
  'trackedAt',
  'lastSyncedAt',
  'note',
];
