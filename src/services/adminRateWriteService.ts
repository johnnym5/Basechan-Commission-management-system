import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';
import { logRateChange } from '../utils/auditLogger';
import { removeRateReadModels, resolveAgentTargets, syncRateReadModels } from './rateReadModels';
import { publishRelevantUpdates } from './userUpdates';
import { enterQuotaOfflineMode, isQuotaError } from './firestoreOfflineMode';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';
import { appendRateDelta } from './rateChangeFeed';

export type RateWriteMutation = { previous?: CommissionRate; next?: CommissionRate };
export type RateWriteCategory = 'rates' | 'guidance' | 'intake' | 'routing';

function safeOperationId(value?: string): string {
  const id = value || crypto.randomUUID();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) throw new Error('Invalid rate operation ID.');
  return id;
}

export function buildRateWriteNotice(mutations: RateWriteMutation[], category: RateWriteCategory) {
  const rates = mutations.flatMap((mutation) => mutation.next ? [mutation.next] : []);
  const guidanceValues = Array.from(new Set(rates.map((rate) => rate.guidance || 'ALLOWED')));
  const title = category === 'guidance' ? 'School guidance updated' : category === 'routing' ? 'Application routing updated' : category === 'intake' ? 'School intake updated' : 'Commission rates updated';
  const summary = category === 'guidance'
    ? guidanceValues.length === 1 ? `School guidance changed to ${guidanceValues[0]}.` : 'School guidance was updated.'
    : category === 'routing'
      ? 'Application routing information was updated.'
      : category === 'intake'
        ? 'School intake information was updated.'
        : 'Commission rate information was updated.';
  return { rates, title, summary };
}

function updateCategory(mutations: RateWriteMutation[]): RateWriteCategory {
  const fields = new Set<string>();
  mutations.forEach(({ previous, next }) => {
    if (!previous || !next) return;
    for (const field of ['guidance', 'aggregator', 'intake', 'agentRate', 'masterRate', 'studyLevel', 'isFlatFee', 'netOrGross'] as const) {
      if (previous[field] !== next[field]) fields.add(field);
    }
  });
  if (fields.size === 1 && fields.has('guidance')) return 'guidance';
  if (fields.size === 1 && fields.has('aggregator')) return 'routing';
  if (fields.size === 1 && fields.has('intake')) return 'intake';
  return 'rates';
}

async function recordOperation(operationId: string, stage: string, details: Record<string, unknown> = {}) {
  const ref = doc(db, 'admin_rate_operations', operationId);
  await setDoc(ref, { operationId, stage, updatedAt: new Date().toISOString(), ...details }, { merge: true });
}

/**
 * Idempotent client-side Admin mutation pipeline. Re-running with the same operationId
 * safely repeats canonical/projection writes and update notice paths after a partial failure.
 */
export interface RateWriteOperationInput {
  mutations: RateWriteMutation[];
  adminEmail: string;
  operationId?: string;
  category?: RateWriteCategory;
  notify?: boolean;
  allowUpsert?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

async function executeRateOperation(input: RateWriteOperationInput): Promise<{ operationId: string; completed: number }> {
  assertFirestoreWritesAllowed('Rate changes');
  const operationId = safeOperationId(input.operationId);
  const opRef = doc(db, 'admin_rate_operations', operationId);
  const previousOperation = await getDoc(opRef);
  if (previousOperation.exists() && previousOperation.get('stage') === 'complete') {
    return { operationId, completed: input.mutations.length };
  }
  const mutations = await Promise.all(input.mutations.map(async (mutation) => {
    if (!mutation.next) return mutation;
    if (mutation.previous && mutation.previous.id !== mutation.next.id) {
      const collision = await getDoc(doc(db, 'rates', mutation.next.id));
      if (collision.exists()) throw new Error(`A rate already exists for ${mutation.next.universityName}, ${mutation.next.intake}, ${mutation.next.studyLevel}.`);
      return mutation;
    }
    if (mutation.previous) return mutation;
    const existing = await getDoc(doc(db, 'rates', mutation.next.id));
    if (!existing.exists()) return mutation;
    if (!input.allowUpsert) throw new Error(`A rate already exists for ${mutation.next.universityName}, ${mutation.next.intake}, ${mutation.next.studyLevel}.`);
    return { ...mutation, previous: { ...existing.data(), id: existing.id } as CommissionRate };
  }));
  if (!previousOperation.exists()) {
    await recordOperation(operationId, 'preparing', {
      count: mutations.length,
      rateIds: mutations.flatMap(({ previous, next }) => [previous?.id, next?.id]).filter(Boolean),
      adminEmail: input.adminEmail,
      category: input.category || updateCategory(mutations.filter((item) => item.next)),
      notify: input.notify !== false,
      allowUpsert: input.allowUpsert === true,
    });
    for (let offset = 0; offset < mutations.length; offset += 400) {
      const batch = writeBatch(db);
      mutations.slice(offset, offset + 400).forEach((mutation, index) => batch.set(
        doc(db, 'admin_rate_operations', operationId, 'mutations', String(offset + index).padStart(8, '0')),
        mutation,
      ));
      await batch.commit();
    }
  }
  await recordOperation(operationId, 'started');

  const canonicalBatchSize = 150;
  for (let offset = 0; offset < mutations.length; offset += canonicalBatchSize) {
    const batch = writeBatch(db);
    for (const mutation of mutations.slice(offset, offset + canonicalBatchSize)) {
      const { previous, next } = mutation;
      if (previous && (!next || previous.id !== next.id)) batch.delete(doc(db, 'rates', previous.id));
      if (next) {
        batch.set(doc(db, 'rates', next.id), next, { merge: true });
        batch.set(doc(db, 'universities', next.universityId), {
          id: next.universityId,
          name: next.universityName,
          lastUpdated: next.updatedAt || new Date().toISOString(),
          status: 'ACTIVE',
          ...(next.country && next.country !== '-' ? { country: next.country } : {}),
        }, { merge: true });
      }
    }
    if (mutations.length) await batch.commit();
    const completed = Math.min(offset + canonicalBatchSize, mutations.length);
    await recordOperation(operationId, 'canonical', { canonicalCompleted: completed });
    input.onProgress?.(completed, mutations.length);
  }

  const needsOverrideCleanup = mutations.some(({ previous, next }) => previous && (!next || previous.id !== next.id));
  const agentTargets = needsOverrideCleanup ? await resolveAgentTargets() : undefined;
  for (let index = 0; index < mutations.length; index++) {
    const mutation = mutations[index];
    if (mutation.next) await syncRateReadModels(mutation.next, { previousRate: mutation.previous, updateType: updateCategory([mutation]), publishUpdate: false, agentTargets, operationId: `${operationId}-${index}-projection` });
    else if (mutation.previous) await removeRateReadModels(mutation.previous, agentTargets, `${operationId}-${index}-projection`);
  }
  await recordOperation(operationId, 'projections');

  for (let index = 0; index < mutations.length; index++) {
    const { previous, next } = mutations[index];
    const suffix = `${operationId}-${index}-canonical`;
    if (previous && (!next || previous.id !== next.id)) {
      await appendRateDelta('admin', { operationId: `${suffix}-delete`, kind: 'delete', id: previous.id, target: 'rates' });
    }
    if (next) {
      await appendRateDelta('admin', { operationId: `${suffix}-upsert`, kind: 'upsert', id: next.id, target: 'rates', record: next });
    }
  }

  for (let index = 0; index < mutations.length; index++) {
    const { previous, next } = mutations[index];
    const auditId = `${operationId}-${index}`;
    if (next && !previous) await logRateChange(input.adminEmail, 'CREATE', next.id, next.universityName, undefined, auditId);
    else if (next && previous) await logRateChange(input.adminEmail, 'EDIT', next.id, next.universityName, Object.fromEntries(
      (Object.keys(next) as Array<keyof CommissionRate>).filter((key) => previous[key] !== next[key]).map((key) => [key, { oldVal: previous[key], newVal: next[key] }]),
    ), auditId);
    else if (previous) await logRateChange(input.adminEmail, 'DELETE', previous.id, previous.universityName, undefined, auditId);
  }
  await recordOperation(operationId, 'audited');

  const activeMutations = mutations.filter((mutation) => mutation.next);
  if (input.notify !== false && activeMutations.length) {
    const category = input.category || updateCategory(activeMutations);
    const notice = buildRateWriteNotice(activeMutations, category);
    const agentVisibleFields = new Set(['universityId', 'universityName', 'country', 'intake', 'studyLevel', 'agentRate', 'isFlatFee', 'netOrGross', 'guidance', 'notes', 'sourceSheet']);
    const staffVisibleFields = new Set(['universityId', 'universityName', 'country', 'intake', 'studyLevel', 'aggregator', 'guidance', 'notes', 'sourceSheet']);
    const changedFields = new Set(activeMutations.flatMap(({ previous, next }) => previous && next
      ? Object.keys(next).filter((key) => previous[key as keyof CommissionRate] !== next[key as keyof CommissionRate])
      : ['created']));
    const roles: Array<'AGENT' | 'STAFF'> = [];
    if (!activeMutations.every(({ previous }) => previous)) roles.push('AGENT', 'STAFF');
    else {
      if (Array.from(changedFields).some((field) => agentVisibleFields.has(field))) roles.push('AGENT');
      if (Array.from(changedFields).some((field) => staffVisibleFields.has(field))) roles.push('STAFF');
    }
    if (roles.length) await publishRelevantUpdates({
      type: category,
      title: notice.title,
      summary: notice.summary,
      rates: notice.rates,
      roles,
      includeStaff: roles.includes('STAFF'),
      operationId,
    });
  }
  await recordOperation(operationId, 'complete', { completedAt: new Date().toISOString() });
  const savedMutations = await getDocs(collection(db, 'admin_rate_operations', operationId, 'mutations'));
  for (let offset = 0; offset < savedMutations.docs.length; offset += 400) {
    const cleanup = writeBatch(db);
    savedMutations.docs.slice(offset, offset + 400).forEach((item) => cleanup.delete(item.ref));
    await cleanup.commit();
  }
  return { operationId, completed: mutations.length };
}

export async function writeRateOperation(input: RateWriteOperationInput): Promise<{ operationId: string; completed: number }> {
  const operationId = safeOperationId(input.operationId);
  assertFirestoreWritesAllowed('Rate changes');

  try {
    return await executeRateOperation({ ...input, operationId });
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    await enterQuotaOfflineMode();
    throw new Error('Rate changes are paused because the database quota has been reached. Your offline school data is still available.');
  }
}

export interface PendingRateOperation {
  operationId: string;
  stage: string;
  count: number;
  updatedAt: string;
  adminEmail: string;
}

export async function loadPendingRateOperations(): Promise<PendingRateOperation[]> {
  const operations = await getDocs(query(collection(db, 'admin_rate_operations')));
  return operations.docs
    .filter((item) => item.get('stage') !== 'complete')
    .map((item) => ({
      operationId: item.id,
      stage: String(item.get('stage') || 'unknown'),
      count: Number(item.get('count') || 0),
      updatedAt: String(item.get('updatedAt') || ''),
      adminEmail: String(item.get('adminEmail') || ''),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function subscribeToPendingRateOperations(
  onChange: (operations: PendingRateOperation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'admin_rate_operations'), (snapshot) => {
    const pending = snapshot.docs
      .filter((item) => item.get('stage') !== 'complete')
      .map((item) => ({
        operationId: item.id,
        stage: String(item.get('stage') || 'unknown'),
        count: Number(item.get('count') || 0),
        updatedAt: String(item.get('updatedAt') || ''),
        adminEmail: String(item.get('adminEmail') || ''),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    onChange(pending);
  }, (error) => onError?.(error));
}

export async function resumeRateOperation(operationId: string, adminEmail: string): Promise<{ operationId: string; completed: number }> {
  const safeId = safeOperationId(operationId);
  const operationRef = doc(db, 'admin_rate_operations', safeId);
  const operation = await getDoc(operationRef);
  if (!operation.exists()) throw new Error('That rate operation could not be found.');
  const mutationSnapshot = await getDocs(collection(db, 'admin_rate_operations', safeId, 'mutations'));
  if (mutationSnapshot.empty) throw new Error('This operation has no saved mutation details and cannot be resumed.');
  if (mutationSnapshot.size !== Number(operation.get('count') || 0)) throw new Error('The saved operation details are incomplete; resume was stopped to avoid applying only part of the Admin change.');
  const mutations = mutationSnapshot.docs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => item.data() as RateWriteMutation);
  return writeRateOperation({
    mutations,
    adminEmail,
    operationId: safeId,
    category: operation.get('category') as RateWriteCategory,
    notify: operation.get('notify') !== false,
    allowUpsert: operation.get('allowUpsert') === true,
  });
}

export async function discardUnstartedRateOperation(operationId: string): Promise<void> {
  const safeId = safeOperationId(operationId);
  const operationRef = doc(db, 'admin_rate_operations', safeId);
  const operation = await getDoc(operationRef);
  if (!operation.exists()) return;
  if (operation.get('stage') !== 'preparing') throw new Error('Only an operation that stopped before canonical rate writes can be discarded.');
  const savedMutations = await getDocs(collection(db, 'admin_rate_operations', safeId, 'mutations'));
  for (let offset = 0; offset < savedMutations.docs.length; offset += 400) {
    const cleanup = writeBatch(db);
    savedMutations.docs.slice(offset, offset + 400).forEach((item) => cleanup.delete(item.ref));
    await cleanup.commit();
  }
  await deleteDoc(operationRef);
}

export const createRate = (rate: CommissionRate, adminEmail: string) => writeRateOperation({ mutations: [{ next: rate }], adminEmail, category: 'intake' });
export const updateRate = (previous: CommissionRate, next: CommissionRate, adminEmail: string) => writeRateOperation({ mutations: [{ previous, next }], adminEmail });
export const updateRates = (previousRates: CommissionRate[], transform: (rate: CommissionRate) => CommissionRate, adminEmail: string, category?: RateWriteCategory) =>
  writeRateOperation({ mutations: previousRates.map((previous) => ({ previous, next: transform(previous) })), adminEmail, category });
export const deleteRates = (rates: CommissionRate[], adminEmail: string) => writeRateOperation({ mutations: rates.map((previous) => ({ previous })), adminEmail, notify: false });

export async function importRateChunk(rates: CommissionRate[]): Promise<void> {
  await writeRateOperation({ mutations: rates.map((next) => ({ next })), adminEmail: 'Import', notify: false, allowUpsert: true });
}
