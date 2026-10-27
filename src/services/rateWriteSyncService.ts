import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';
import type { PendingRateConflict, PendingRateMutation, PendingRateOperation } from '../types/rateWriteQueue';
import { finishLocalRateOperation, getLocalRateOperations, updateLocalRateOperation } from './localRateDatabase';
import { writeRateOperation, sanitizeFirestoreData, computeRateFingerprint, type RateWriteMutation } from './adminRateWriteService';
import { updatePendingRateOperation } from './rateWriteQueue';
import { isQuotaError, isQuotaOffline } from './firestoreOfflineMode';

const VOLATILE_FIELDS = new Set(['updatedAt', 'lastUpdated']);

function matchesBase(current: CommissionRate, base: Partial<CommissionRate>): boolean {
  return Object.entries(base).every(([key, value]) => {
    if (VOLATILE_FIELDS.has(key)) return true;
    return current[key as keyof CommissionRate] === value;
  });
}
function fingerprint(rate: CommissionRate): string {
  return computeRateFingerprint(rate);
}
async function readCurrent(id: string): Promise<CommissionRate | null> {
  const snapshot = await getDocFromServer(doc(db, 'rates', id));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id || id } as CommissionRate : null;
}
function stagedMutationToWrite(mutation: PendingRateMutation): RateWriteMutation {
  if (mutation.kind === 'create') return { next: mutation.next };
  if (mutation.kind === 'update') {
    if (!mutation.baseSnapshot) throw new Error('This saved edit is missing its original rate snapshot.');
    return { previous: mutation.baseSnapshot, next: { ...mutation.baseSnapshot, ...mutation.patch, id: mutation.nextId } };
  }
  if (!mutation.baseRate) throw new Error('This saved deletion is missing its original rate snapshot.');
  return { previous: mutation.baseRate };
}

async function commitCanonicalPackage(operation: PendingRateOperation, packageIndex: number, staged: PendingRateMutation[]): Promise<{ mutations: RateWriteMutation[]; canonical: CommissionRate[]; conflicts: PendingRateConflict[] }> {
  const packageRef = doc(db, 'admin_rate_operations', operation.operationId, 'canonical_packages', String(packageIndex).padStart(6, '0'));
  return runTransaction(db, async (transaction) => {
    const marker = await transaction.get(packageRef);
    if (marker.exists()) {
      const mutations = staged.map(stagedMutationToWrite);
      return { mutations, canonical: mutations.flatMap((item) => item.next ? [item.next] : []), conflicts: [] };
    }
    const ids = new Set<string>();
    staged.forEach((mutation) => {
      if (mutation.kind === 'create') ids.add(mutation.next.id);
      else {
        ids.add(mutation.id);
        if (mutation.kind === 'update' && mutation.nextId !== mutation.id) ids.add(mutation.nextId);
      }
    });
    const snapshots = new Map<string, any>();
    for (const id of ids) snapshots.set(id, await transaction.get(doc(db, 'rates', id)));
    const currentRate = (id: string) => {
      const snapshot = snapshots.get(id);
      return snapshot?.exists() ? { ...snapshot.data(), id: snapshot.id || id } as CommissionRate : null;
    };
    const mutations: RateWriteMutation[] = [];
    const canonical: CommissionRate[] = [];
    const conflicts: PendingRateConflict[] = [];
    for (let offset = 0; offset < staged.length; offset++) {
      const mutation = staged[offset];
      const mutationIndex = packageIndex * 100 + offset;
      if (mutation.kind === 'create') {
        const existing = currentRate(mutation.next.id);
        if (existing) conflicts.push({ mutationIndex, id: existing.id, reason: 'A rate with this ID already exists in Firestore.', cloudRate: existing });
        else { mutations.push({ next: mutation.next }); canonical.push(mutation.next); }
      } else if (mutation.kind === 'update') {
        const current = currentRate(mutation.id);
        if (!current) { conflicts.push({ mutationIndex, id: mutation.id, reason: 'This rate was deleted in Firestore.' }); continue; }
        // For admin edits, only raise a conflict if one of the fields being patched has changed in the cloud compared to the edit's base
        const relevantBaseFields = Object.fromEntries(
          Object.keys(mutation.patch).map((k) => [k, mutation.baseFields[k as keyof CommissionRate]])
        );
        if (!matchesBase(current, relevantBaseFields)) { conflicts.push({ mutationIndex, id: mutation.id, reason: 'One or more edited fields changed in Firestore.', cloudRate: current }); continue; }
        const collision = mutation.nextId === mutation.id ? null : currentRate(mutation.nextId);
        if (collision) { conflicts.push({ mutationIndex, id: mutation.nextId, reason: 'The new rate ID already exists in Firestore.', cloudRate: collision }); continue; }
        const next = { ...current, ...mutation.patch, id: mutation.nextId };
        mutations.push({ previous: current, next }); canonical.push(next);
      } else {
        const current = currentRate(mutation.id);
        if (!current) continue;
        mutations.push({ previous: current });
      }
    }
    if (conflicts.length) return { mutations: [], canonical: [], conflicts };

    const universities = new Map<string, CommissionRate>();
    for (const mutation of mutations) {
      const { previous, next } = mutation;
      if (previous && (!next || previous.id !== next.id)) transaction.delete(doc(db, 'rates', previous.id));
      if (!next) continue;
      if (previous && previous.id === next.id) {
        const patch = Object.fromEntries(Object.keys(next).filter((key) => previous[key as keyof CommissionRate] !== next[key as keyof CommissionRate]).map((key) => [key, next[key as keyof CommissionRate]]));
        if (Object.keys(patch).length) transaction.set(doc(db, 'rates', next.id), sanitizeFirestoreData(next), { merge: true });
      } else {
        transaction.set(doc(db, 'rates', next.id), sanitizeFirestoreData(next), { merge: true });
      }
      if (!previous || previous.universityId !== next.universityId || previous.universityName !== next.universityName || previous.country !== next.country) universities.set(next.universityId, next);
    }
    universities.forEach((rate) => transaction.set(doc(db, 'universities', rate.universityId), sanitizeFirestoreData({
      id: rate.universityId, name: rate.universityName, lastUpdated: rate.updatedAt || new Date().toISOString(), status: 'ACTIVE',
      ...(rate.country && rate.country !== '-' ? { country: rate.country } : {}),
    }), { merge: true }));
    transaction.set(packageRef, sanitizeFirestoreData({ operationId: operation.operationId, packageIndex, mutationCount: staged.length, committedAt: new Date().toISOString() }));
    return { mutations, canonical, conflicts: [] };
  });
}

export async function syncRateOperation(operation: PendingRateOperation): Promise<'synced' | 'conflict'> {
  await updatePendingRateOperation(operation.uid, operation.operationId, { status: 'syncing', lastError: undefined, lastAttemptAt: new Date().toISOString(), nextRetryAt: undefined });
  try {
    const allMutations: RateWriteMutation[] = [];
    const canonical: CommissionRate[] = [];
    const conflicts: PendingRateConflict[] = [];
    for (let offset = 0; offset < operation.mutations.length; offset += 100) {
      const result = await commitCanonicalPackage(operation, offset / 100, operation.mutations.slice(offset, offset + 100));
      if (result.conflicts.length) { conflicts.push(...result.conflicts); break; }
      allMutations.push(...result.mutations);
      canonical.push(...result.canonical);
    }
    if (conflicts.length) {
      await updatePendingRateOperation(operation.uid, operation.operationId, { status: 'conflict', conflicts, lastError: 'Review cloud changes before applying this package.' });
      return 'conflict';
    }
    await writeRateOperation({
      operationId: operation.operationId, adminEmail: operation.adminEmail, category: operation.category,
      notify: operation.notify, mutations: allMutations, canonicalAlreadyCommitted: true,
    });
    if (allMutations.length > 0) {
      // Invalidate local sheet buckets so subsequent queries or refreshes don't read stale cached buckets
      const { clearLocalSheetBuckets } = await import('./localRateDatabase');
      await clearLocalSheetBuckets(operation.uid);

      const { updateRateSheetBucketsForMutations } = await import('./rateReadModels');
      await updateRateSheetBucketsForMutations(allMutations, operation.adminEmail);
    }
    await finishLocalRateOperation(operation.uid, operation.operationId, canonical);
    return 'synced';
  } catch (error) {
    const quota = isQuotaError(error) || isQuotaOffline(operation.uid);
    const attemptCount = operation.attemptCount + 1;
    const retryDelay = Math.min(5 * 60_000, 5_000 * (2 ** Math.min(attemptCount - 1, 6)));
    await updatePendingRateOperation(operation.uid, operation.operationId, {
      status: quota ? 'quota-paused' : 'failed', attemptCount: operation.attemptCount + 1,
      nextRetryAt: quota ? undefined : new Date(Date.now() + retryDelay).toISOString(),
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
    const current = await readCurrent(mutation.kind === 'create' ? mutation.next.id : mutation.id);
    if (!current) {
      if (mutation.kind === 'update') {
        const fullRate: CommissionRate = {
          ...(mutation.baseSnapshot || ({} as CommissionRate)),
          ...mutation.patch,
          id: mutation.nextId || mutation.id,
        };
        mutations.push({ kind: 'create', next: fullRate });
      } else {
        mutations.push(mutation);
      }
      continue;
    }
    if (mutation.kind === 'delete') {
      mutations.push({ ...mutation, baseFingerprint: fingerprint(current), baseRate: current });
      continue;
    }
    // Document exists in cloud: force push means update cloud with our desired state
    const targetNext: CommissionRate = mutation.kind === 'create'
      ? mutation.next
      : {
          ...current,
          ...mutation.patch,
          id: mutation.nextId || mutation.id,
        };
    const patch = Object.fromEntries(
      Object.keys(targetNext)
        .filter((k) => current[k as keyof CommissionRate] !== targetNext[k as keyof CommissionRate])
        .map((k) => [k, targetNext[k as keyof CommissionRate]])
    );
    const baseFields: Partial<CommissionRate> = {};
    Object.keys(patch).forEach((k) => {
      (baseFields as Record<string, unknown>)[k] = current[k as keyof CommissionRate];
    });
    mutations.push({
      kind: 'update',
      id: current.id,
      nextId: targetNext.id,
      patch,
      baseFields,
      baseSnapshot: current,
    });
  }
  await updateLocalRateOperation(uid, operationId, {
    mutations,
    status: 'pending',
    conflicts: undefined,
    lastError: undefined,
  });
}
