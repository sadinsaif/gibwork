import type { Snapshot, FieldChange } from '../types.js';

/** Fields worth tracking for change history (stable, meaningful signals). */
const TRACKED_FIELDS: (keyof Snapshot)[] = [
  'title',
  'status',
  'isOpen',
  'deadline',
  'rewardAmount',
  'rewardUsd',
  'pendingCount',
  'approvedCount',
  'rejectedCount',
  'maxSubmissions',
];

/**
 * Compute the meaningful field-level differences between a previous and a
 * freshly fetched snapshot. `fetchedAt` is intentionally ignored (it always
 * changes). Returns [] when nothing tracked has changed.
 */
export function diffSnapshots(prev: Snapshot, next: Snapshot): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of TRACKED_FIELDS) {
    const from = prev[field];
    const to = next[field];
    if (!Object.is(normalize(from), normalize(to))) {
      changes.push({ field, from, to });
    }
  }
  return changes;
}

function normalize(v: unknown): unknown {
  // Treat null/undefined as equal; compare numbers/strings/booleans by value.
  if (v === undefined) return null;
  return v;
}

/** A short human phrase for one field change (used in watch/sync output). */
export function describeChange(ch: FieldChange): string {
  const from = ch.from === null || ch.from === undefined ? '∅' : String(ch.from);
  const to = ch.to === null || ch.to === undefined ? '∅' : String(ch.to);
  return `${ch.field}: ${from} → ${to}`;
}
