import type { TaskDetails, AvailableTask } from '../gibwork/service.js';
import type { Snapshot } from '../types.js';
import { toHuman, parseBaseUnits } from '../util/amount.js';

/** Canonical public URL for a bounty on gib.work. */
export function bountyUrl(id: string): string {
  return `https://gib.work/bounty/${id}`;
}

/**
 * Build a stored Snapshot from a real `tasks.get` (TaskDetails) response.
 * Only fields the API actually returns are read here.
 */
export function snapshotFromDetails(t: TaskDetails): Snapshot {
  const asset = t.asset;
  const decimals = asset?.decimals ?? 0;
  const rawAmount = asset?.amount ?? null;
  return {
    fetchedAt: new Date().toISOString(),
    title: t.title,
    status: t.status,
    isOpen: t.isOpen,
    deadline: t.deadline ?? null,
    rewardAmount: toHuman(rawAmount, decimals),
    rewardSymbol: asset?.symbol ?? '',
    rewardMint: asset?.mintAddress ?? '',
    // `asset.price` is the USD value the API reports for the reward asset.
    rewardUsd: typeof asset?.price === 'number' ? asset.price : null,
    tags: Array.isArray(t.tags) ? t.tags : [],
    pendingCount: t.taskSubmissionsPendingCount ?? 0,
    approvedCount: t.taskSubmissionsApprovedCount ?? 0,
    rejectedCount: t.taskSubmissionsRejectedCount ?? 0,
    minSubmissionAmountRaw: t.minSubmissionAmount ?? null,
    maxSubmissions: t.maxSubmissions ?? null,
  };
}

/**
 * A normalized discovery row derived from a real `listAvailable`
 * (AvailableTask) entry. Note: discovery responses do NOT include a USD
 * price, so `rewardHuman` is in native token units only.
 */
export interface DiscoverRow {
  id: string;
  title: string;
  url: string;
  status: string;
  isOpen: boolean;
  createdAt: string;
  deadline: string | null;
  tags: string[];
  rewardRaw: string | number | null;
  rewardHuman: number;
  rewardSymbol: string;
  rewardMint: string;
  decimals: number;
  totalSubmissions: number;
  maxSubmissions: number | null;
  slotsRemaining: number | null;
  requiresPremium: boolean;
  /** earn's local opportunity heuristic (see core/score.ts). Not a Gibwork field. */
  score: number;
}

export function rowFromAvailable(t: AvailableTask): DiscoverRow {
  const asset = t.asset;
  const decimals = asset?.decimals ?? 0;
  const rawAmount = asset?.amount ?? null;
  return {
    id: t.id,
    title: t.title,
    url: bountyUrl(t.id),
    status: t.status,
    isOpen: t.isOpen,
    createdAt: t.createdAt,
    deadline: t.deadline ?? null,
    tags: Array.isArray(t.tags) ? t.tags : [],
    rewardRaw: rawAmount,
    rewardHuman: toHuman(rawAmount, decimals),
    rewardSymbol: asset?.symbol ?? '',
    rewardMint: asset?.mintAddress ?? '',
    decimals,
    totalSubmissions: t.totalSubmissions ?? 0,
    maxSubmissions: t.maxSubmissions ?? null,
    slotsRemaining: t.standardSubmissionSlotsRemaining ?? null,
    requiresPremium: Boolean(t.requiresPremium),
    score: 0,
  };
}

/** Human-readable minimum submission fee, when the API reports one. */
export function minSubmissionHuman(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  // minSubmissionAmount is reported in whole USDC by the API (not base units).
  const n = parseBaseUnits(raw);
  return Number.isFinite(n) ? n : null;
}
