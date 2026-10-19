import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';
import type { PendingRateConflict, PendingRateMutation, PendingRateOperation } from '../types/rateWriteQueue';
import { finishLocalRateOperation, getLocalRateOperations, updateLocalRateOperation } from './localRateDatabase';
import { writeRateOperation, type RateWriteMutation } from './adminRateWriteService';
import { updatePendingRateOperation } from './rateWriteQueue';
import { isQuotaError, isQuotaOffline } from './firestoreOfflineMode';

function matchesBase(current: CommissionRate, base: Partial<CommissionRate>): boolean {
  return Object.entries(base).every(([key, value]) => current[key as keyof CommissionRate] === value);
}

function fingerprint(rate: CommissionRate): string {
  const { id: _id, ...fields } = rate;
  return JSON.stringify(fields);
}

async function readCurrent(id: string): Promise<CommissionRate | null> {
  const snapshot = await getDocFromServer(doc(db, 'rates', id));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id || id } as CommissionRate : null;
}

export async function syncRateOperation(operation: PendingRateOperation): Promise<'synced' | 'conflict'> {
  await updatePendingRateOperation(operation.uid, operation.operationId, { status: 'syncing', lastError: undefined });
  try {
    const mutations: RateWriteMutation[] = [];
    const canonical: CommissionRate[] = [];
    const conflicts: PendingRateConflict[] = [];
    for (let index = 0; index < operation.mutations.length; index++) {
      const mutation: PendingRateMutation = operation.mutations[index];
      if (mutation.kind === 'create') {
        const current = await readCurrent(mutation.next.id);
        if (current) conflicts.push({ mutationIndex: index, id: current.id, reason: 'A rate with this ID already exists in Firestore.', cloudRate: current });
        else { mutations.push({ next: mutation.next }); canonical.push(mutation.next); }
        continue;
      }
      const current = await readCurrent(mutation.id);
      if (mutation.kind === 'update') {
        if (!current) {
          conflicts.push({ mutationIndex: index, id: mutation.id, reason: 'This rate was deleted in Firestore.' });
          continue;
        }
        if (!matchesBase(current, mutation.baseFields)) {
          conflicts.push({ mutationIndex: index, id: mutation.id, reason: 'One or more edited fields changed in Firestore.', cloudRate: current });
          continue;
        }
        if (mutation.nextId !== mutation.id) {
          const collision = await readCurrent(mutation.nextId);
          if (collision) {
            conflicts.push({ mutationIndex: index, id: mutation.nextId, reason: 'The new rate ID already exists in Firestore.', cloudRate: collision });
            continue;
          }
        }
        const next = { ...current, ...mutation.patch, id: mutation.nextId };
        mutations.push({ previous: current, next }); canonical.push(next);
      } else {
        if (!current) continue;
        if (fingerprint(current) !== mutation.baseFingerprint) {
          conflicts.push({ mutationIndex: index, id: mutation.id, reason: 'This rate changed in Firestore before it could be deleted.', cloudRate: current });
          continue;
        }
        mutations.push({ previous: current });
      }
    }
    if (conflicts.length) {
      await updatePendingRateOperation(operation.uid, operation.operationId, { status: 'conflict', conflicts, lastError: 'Review cloud changes before applying this package.' });
      return 'conflict';
    }
    await writeRateOperation({
      operationId: operation.operationId,
      adminEmail: operation.adminEmail,
      category: operation.category,
      notify: operation.notify,
      mutations,
    });
    await finishLocalRateOperation(operation.uid, operation.operationId, canonical);
    return 'synced';
  } catch (error) {
    const quota = isQuotaError(error) || isQuotaOffline(operation.uid);
    await updatePendingRateOperation(operation.uid, operation.operationId, {
      status: quota ? 'quota-paused' : 'failed',
      attemptCount: operation.attemptCount + 1,
      lastError: error instanceof Error ? error.message : 'The change could not be synced.',
    });
    throw error;
  }
}


export async function resolveRateOperationConflict(
  uid: string,
  operationId: string,
  resolution: 'keep-cloud' | 'apply-local',
): Promise<void> {
  const operation = (await getLocalRateOperations(uid)).find((item) => item.operationId === operationId);
  if (!operation || operation.status !== 'conflict') throw new Error('This operation is no longer waiting for conflict resolution.');
  if (resolution === 'keep-cloud') {
    const database = await import('./localRateDatabase');
    const conflicts = new Map((operation.conflicts || []).map((item) => [item.mutationIndex, item]));
    await database.resolveLocalRateOperationWithCloud(uid, operationId, conflicts);
    return;
  }
  const mutations: PendingRateMutation[] = [];
  for (const mutation of operation.mutations) {
    if (mutation.kind === 'create') throw new Error('A new rate now exists in Firestore. Review it before creating another rate.');
    const current = await readCurrent(mutation.id);
    if (!current) throw new Error('This rate was deleted in Firestore. Choose keep-cloud or create a new rate.');
    if (mutation.kind === 'update') {
      const baseFields: Partial<CommissionRate> = {};
      Object.keys(mutation.patch).forEach((key) => { (baseFields as Record<string, unknown>)[key] = current[key as keyof CommissionRate]; });
      mutations.push({ ...mutation, baseFields, baseSnapshot: current });
    } else mutations.push({ ...mutation, baseFingerprint: fingerprint(current), baseRate: current });
  }
  await updateLocalRateOperation(uid, operationId, {
    mutations,
    status: 'pending',
    conflicts: undefined,
    lastError: undefined,
  });
}

