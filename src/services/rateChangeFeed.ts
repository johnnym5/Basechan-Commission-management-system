import {
  collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';
import type { RateDelta } from './localRateDatabase';

export interface FeedRecord extends RateDelta {
  scope: string;
  createdAt: string;
}

export function buildRateDeltaFeedRecord(
  scope: string,
  delta: Omit<RateDelta, 'sequence'>,
  sequence: number,
  createdAt: string,
): FeedRecord {
  return {
    operationId: delta.operationId,
    kind: delta.kind,
    id: delta.id,
    target: delta.target,
    sequence,
    scope,
    createdAt,
  };
}

function feedRef(scope: string) { return doc(db, 'rate_change_feeds', scope); }

export async function getFeedCursor(scope: string): Promise<number> {
  const snapshot = await getDocFromServer(feedRef(scope));
  return Number(snapshot.data()?.sequence || 0);
}

export async function appendRateDeltas(scope: string, deltas: Array<Omit<RateDelta, 'sequence'>>): Promise<void> {
  if (!deltas.length) return;
  const unique = new Map<string, Omit<RateDelta, 'sequence'>>();
  deltas.forEach((delta) => unique.set(encodeURIComponent([delta.operationId, delta.target, delta.id, delta.kind].join('|')), delta));
  const entries = Array.from(unique.entries());
  if (entries.length > 150) throw new Error('A rate feed package cannot exceed 150 changes per scope.');
  const metadataRef = feedRef(scope);
  await runTransaction(db, async (transaction) => {
    const markerRefs = entries.map(([markerId]) => doc(metadataRef, 'operations', markerId));
    const markerSnapshots = await Promise.all(markerRefs.map((ref) => transaction.get(ref)));
    const metadata = await transaction.get(metadataRef);
    const pending = entries.map(([markerId, delta], index) => ({ markerId, delta, exists: markerSnapshots[index].exists() })).filter((entry) => !entry.exists);
    let sequence = Number(metadata.data()?.sequence || 0);
    const createdAt = new Date().toISOString();
    for (const { markerId, delta } of pending) {
      sequence += 1;
      const recordRef = doc(collection(metadataRef, 'changes'), String(sequence).padStart(16, '0'));
      const markerRef = doc(metadataRef, 'operations', markerId);
      transaction.set(recordRef, buildRateDeltaFeedRecord(scope, delta, sequence, createdAt));
      transaction.set(markerRef, { sequence });
    }
    if (pending.length) transaction.set(metadataRef, { sequence, updatedAt: createdAt }, { merge: true });
  });
}

export async function appendRateDelta(scope: string, delta: Omit<RateDelta, 'sequence'>): Promise<void> {
  return appendRateDeltas(scope, [delta]);
}
export async function readRateDeltas(scope: string, after: number, pageSize = 200): Promise<FeedRecord[]> {
  const changes = collection(feedRef(scope), 'changes');
  const page = await getDocsFromServer(query(changes, where('sequence', '>', after), orderBy('sequence'), limit(pageSize)));
  return page.docs.map((item) => item.data() as FeedRecord);
}

function currentRateRef(scope: string, delta: RateDelta) {
  if (delta.target === 'rates') {
    if (scope === 'admin') return doc(db, 'rates', delta.id);
    if (scope === 'staff') return doc(db, 'staff_rates', delta.id);
    if (scope === 'agent') return doc(db, 'agent_rates', delta.id);
  }
  if (delta.target === 'organizationOverrides' && scope.startsWith('org_')) {
    return doc(db, 'organization_agent_rates', scope.slice(4), 'rates', delta.id);
  }
  if (delta.target === 'personalOverrides' && scope.startsWith('user_')) {
    return doc(db, 'agent_rate_overrides', scope.slice(5), 'rates', delta.id);
  }
  throw new Error(`Rate change feed ${scope} has an unsupported target.`);
}

export async function hydrateRateDelta(scope: string, delta: RateDelta): Promise<RateDelta> {
  if (delta.kind === 'delete') return delta;
  if (scope === 'admin' && delta.target === 'rates' && isCompleteAdminRate(delta.record, delta.id)) {
    return delta;
  }
  try {
    const snapshot = await getDocFromServer(currentRateRef(scope, delta));
    if (!snapshot.exists()) return { ...delta, kind: 'delete', record: undefined };
    return { ...delta, record: { ...snapshot.data(), id: snapshot.id } as RateDelta['record'] };
  } catch (error) {
    if ((error as { code?: string })?.code === 'permission-denied') {
      return { ...delta, kind: 'delete', record: undefined };
    }
    throw error;
  }
}

function isCompleteAdminRate(record: RateDelta['record'], id: string): record is CommissionRate {
  if (!record || record.id !== id) return false;
  const canonical = record as CommissionRate;
  return typeof canonical.universityId === 'string'
    && typeof canonical.universityName === 'string'
    && typeof canonical.intake === 'string'
    && typeof canonical.studyLevel === 'string'
    && typeof canonical.aggregator === 'string'
    && typeof canonical.masterRate === 'number'
    && typeof canonical.agentRate === 'number'
    && typeof canonical.diffMargin === 'number'
    && typeof canonical.isFlatFee === 'boolean'
    && (canonical.netOrGross === 'NET' || canonical.netOrGross === 'GROSS');
}
