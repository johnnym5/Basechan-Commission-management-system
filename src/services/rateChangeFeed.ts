import {
  collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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

export async function appendRateDelta(scope: string, delta: Omit<RateDelta, 'sequence'>): Promise<void> {
  const metadataRef = feedRef(scope);
  await runTransaction(db, async (transaction) => {
    const markerId = encodeURIComponent([delta.operationId, delta.target, delta.id, delta.kind].join('|'));
    const markerRef = doc(metadataRef, 'operations', markerId);
    if ((await transaction.get(markerRef)).exists()) return;
    const metadata = await transaction.get(metadataRef);
    const sequence = Number(metadata.data()?.sequence || 0) + 1;
    const recordRef = doc(collection(metadataRef, 'changes'), String(sequence).padStart(16, '0'));
    transaction.set(metadataRef, { sequence, updatedAt: new Date().toISOString() }, { merge: true });
    transaction.set(recordRef, buildRateDeltaFeedRecord(scope, delta, sequence, new Date().toISOString()));
    transaction.set(markerRef, { sequence });
  });
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
