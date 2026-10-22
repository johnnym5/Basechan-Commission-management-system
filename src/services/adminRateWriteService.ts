import { getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';
import { logRateChange } from '../utils/auditLogger';
import { buildAgentProjection, buildStaffProjection, isEligibleAgentPayout, loadVisibilitySettings, opaqueRateId, removeRateReadModels, resolveAgentTargets, syncRateReadModels } from './rateReadModels';
import { publishRelevantUpdates } from './userUpdates';
import { enterQuotaOfflineMode, isQuotaError } from './firestoreOfflineMode';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';
import { appendRateDeltas } from './rateChangeFeed';
import { stageRateOperation } from './rateWriteQueue';
import type { PendingRateMutation } from '../types/rateWriteQueue';

export type RateWriteMutation = { previous?: CommissionRate; next?: CommissionRate };
export type RateWriteCategory = 'rates' | 'guidance' | 'intake' | 'routing';

export function buildRateFieldPatch(previous: CommissionRate, next: CommissionRate): Partial<CommissionRate> {
  return Object.fromEntries(Object.keys(next)
    .filter((key) => previous[key as keyof CommissionRate] !== next[key as keyof CommissionRate])
    .map((key) => [key, next[key as keyof CommissionRate]])) as Partial<CommissionRate>;
}

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

/**
 * Recursively strips undefined fields from an object before passing to Firestore batch.set() or setDoc().
 * Firestore strictly forbids 'undefined' values.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      clean[key] = sanitizeFirestoreData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean as T;
}

async function recordOperation(operationId: string, stage: string, details: Record<string, unknown> = {}) {
  const ref = doc(db, 'admin_rate_operations', operationId);
  await setDoc(ref, sanitizeFirestoreData({ operationId, stage, updatedAt: new Date().toISOString(), ...details }), { merge: true });
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
  canonicalAlreadyCommitted?: boolean;
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
  const mutations = input.canonicalAlreadyCommitted ? input.mutations : await Promise.all(input.mutations.map(async (mutation) => {
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
        sanitizeFirestoreData(mutation),
      ));
      await batch.commit();
    }
  }
  await recordOperation(operationId, 'started');

  const canonicalBatchSize = 150;
  for (let offset = 0; !input.canonicalAlreadyCommitted && offset < mutations.length; offset += canonicalBatchSize) {
    const batch = writeBatch(db);
    for (const mutation of mutations.slice(offset, offset + canonicalBatchSize)) {
      const { previous, next } = mutation;
      if (previous && (!next || previous.id !== next.id)) batch.delete(doc(db, 'rates', previous.id));
      if (next) {
        const rateRef = doc(db, 'rates', next.id);
        if (previous && previous.id === next.id) {
          const patch = buildRateFieldPatch(previous, next);
          if (Object.keys(patch).length) batch.update(rateRef, sanitizeFirestoreData(patch));
        } else {
          batch.set(rateRef, sanitizeFirestoreData(next));
        }
        if (!previous || previous.universityId !== next.universityId || previous.universityName !== next.universityName || previous.country !== next.country) {
          batch.set(doc(db, 'universities', next.universityId), sanitizeFirestoreData({
            id: next.universityId,
            name: next.universityName,
            lastUpdated: next.updatedAt || new Date().toISOString(),
            status: 'ACTIVE',
            ...(next.country && next.country !== '-' ? { country: next.country } : {}),
          }), { merge: true });
        }
      }    }
    if (mutations.length) await batch.commit();
    const completed = Math.min(offset + canonicalBatchSize, mutations.length);
    await recordOperation(operationId, 'canonical', { canonicalCompleted: completed });
    input.onProgress?.(completed, mutations.length);
  }

  const needsOverrideCleanup = mutations.some(({ previous, next }) => previous && (!next || previous.id !== next.id));
  const agentTargets = needsOverrideCleanup ? await resolveAgentTargets() : undefined;
  const visibility = await loadVisibilitySettings();
  try {
    for (let index = 0; index < mutations.length; index++) {
      const mutation = mutations[index];
      if (mutation.next) await syncRateReadModels(mutation.next, { previousRate: mutation.previous, updateType: updateCategory([mutation]), publishUpdate: false, publishFeed: false, agentTargets, operationId: `${operationId}-${index}-projection` });
      else if (mutation.previous) await removeRateReadModels(mutation.previous, agentTargets, `${operationId}-${index}-projection`, false);
    }
  } catch (err) {
    console.error('[RateSync sub-step failure] syncRateReadModels:', err);
    throw err;
  }
  await recordOperation(operationId, 'projections');

  const groupedFeeds = new Map<string, Array<{ operationId: string; kind: 'upsert' | 'delete'; id: string; target: 'rates' | 'organizationOverrides' | 'personalOverrides'; record?: CommissionRate }>>();
  const addFeed = (scope: string, delta: { operationId: string; kind: 'upsert' | 'delete'; id: string; target: 'rates' | 'organizationOverrides' | 'personalOverrides'; record?: CommissionRate }) => {
    const group = groupedFeeds.get(scope) || [];
    group.push(delta);
    groupedFeeds.set(scope, group);
  };
  const addRoleFeed = (scope: 'staff' | 'agent', rate: CommissionRate, opId: string, oldRate?: CommissionRate) => {
    const previousKey = oldRate ? opaqueRateId(oldRate) : undefined;
    const nextKey = opaqueRateId(rate);
    if (previousKey && previousKey !== nextKey) addFeed(scope, { operationId: `${opId}-${scope}-old`, kind: 'delete', id: previousKey, target: 'rates' });
    const sheet = String(rate.sourceSheet || rate.intake || '').trim();
    const visible = visibility[sheet]?.[scope === 'staff' ? 'STAFF' : 'AGENT'] !== false;
    const eligible = scope === 'staff' || isEligibleAgentPayout(rate.aggregator);
    const projection = scope === 'staff' ? buildStaffProjection(rate) : (eligible ? buildAgentProjection(rate) : undefined);
    addFeed(scope, visible && eligible && projection
      ? { operationId: `${opId}-${scope}`, kind: 'upsert', id: nextKey, target: 'rates', record: projection as CommissionRate }
      : { operationId: `${opId}-${scope}`, kind: 'delete', id: nextKey, target: 'rates' });
  };
  for (let index = 0; index < mutations.length; index++) {
    const { previous, next } = mutations[index];
    const suffix = `${operationId}-${index}-canonical`;
    if (previous && (!next || previous.id !== next.id)) {
      addFeed('admin', { operationId: `${suffix}-delete`, kind: 'delete', id: previous.id, target: 'rates' });
      addFeed('staff', { operationId: `${operationId}-${index}-projection-staff`, kind: 'delete', id: opaqueRateId(previous), target: 'rates' });
      addFeed('agent', { operationId: `${operationId}-${index}-projection-agent`, kind: 'delete', id: opaqueRateId(previous), target: 'rates' });
    }
    if (next) {
      addFeed('admin', { operationId: `${suffix}-upsert`, kind: 'upsert', id: next.id, target: 'rates', record: next });
      addRoleFeed('staff', next, `${operationId}-${index}-projection`, previous);
      addRoleFeed('agent', next, `${operationId}-${index}-projection`, previous);
    }
    if (previous && (!next || previous.id !== next.id)) {
      for (const target of agentTargets || []) {
        const previousKey = opaqueRateId(previous);
        addFeed(`org_${target.organizationId}`, { operationId: `${operationId}-${index}-projection-org-old-${target.uid}`, kind: 'delete', id: previousKey, target: 'organizationOverrides' });
        addFeed(`user_${target.uid}`, { operationId: `${operationId}-${index}-projection-user-old-${target.uid}`, kind: 'delete', id: previousKey, target: 'personalOverrides' });
      }
    }
  }
  try {
    for (const [scope, deltas] of groupedFeeds) {
      for (let offset = 0; offset < deltas.length; offset += 150) await appendRateDeltas(scope, deltas.slice(offset, offset + 150));
    }
  } catch (err) {
    console.error('[RateSync sub-step failure] appendRateDeltas:', err);
    throw err;
  }
  try {
    for (let index = 0; index < mutations.length; index++) {
      const { previous, next } = mutations[index];
      const auditId = `${operationId}-${index}`;
      if (next && !previous) await logRateChange(input.adminEmail, 'CREATE', next.id, next.universityName, undefined, auditId);
      else if (next && previous) await logRateChange(input.adminEmail, 'EDIT', next.id, next.universityName, Object.fromEntries(
        (Object.keys(next) as Array<keyof CommissionRate>).filter((key) => previous[key] !== next[key]).map((key) => [key, { oldVal: previous[key] ?? null, newVal: next[key] ?? null }]),
      ), auditId);
      else if (previous) await logRateChange(input.adminEmail, 'DELETE', previous.id, previous.universityName, undefined, auditId);
    }
  } catch (err) {
    console.error('[RateSync sub-step failure] logRateChange:', err);
    throw err;
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
    try {
      if (roles.length) await publishRelevantUpdates({
        type: category,
        title: notice.title,
        summary: notice.summary,
        rates: notice.rates,
        roles,
        includeStaff: roles.includes('STAFF'),
        operationId,
      });
    } catch (err) {
      console.error('[RateSync sub-step failure] publishRelevantUpdates:', err);
      throw err;
    }
  }
  await recordOperation(operationId, 'complete', { completedAt: new Date().toISOString() });
  try {
    const savedMutations = await getDocs(collection(db, 'admin_rate_operations', operationId, 'mutations'));
    for (let offset = 0; offset < savedMutations.docs.length; offset += 400) {
      const cleanup = writeBatch(db);
      savedMutations.docs.slice(offset, offset + 400).forEach((item) => cleanup.delete(item.ref));
      await cleanup.commit();
    }
  } catch (err) {
    console.error('[RateSync sub-step failure] cleanup savedMutations:', err);
    throw err;
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

export async function deleteRateOperationLog(operationId: string): Promise<void> {
  assertFirestoreWritesAllowed('Delete operation log');
  const safeId = safeOperationId(operationId);
  const operationRef = doc(db, 'admin_rate_operations', safeId);
  const savedMutations = await getDocs(collection(db, 'admin_rate_operations', safeId, 'mutations'));
  for (let offset = 0; offset < savedMutations.docs.length; offset += 400) {
    const cleanup = writeBatch(db);
    savedMutations.docs.slice(offset, offset + 400).forEach((item) => cleanup.delete(item.ref));
    await cleanup.commit();
  }
  await deleteDoc(operationRef);
}

function changedFields(previous: CommissionRate, next: CommissionRate): Partial<CommissionRate> {
  const patch: Partial<CommissionRate> = {};
  (Object.keys(next) as Array<keyof CommissionRate>).forEach((key) => {
    if (previous[key] !== next[key]) (patch as Record<string, unknown>)[key] = next[key];
  });
  return patch;
}

function queueMutation(mutation: RateWriteMutation): PendingRateMutation {
  if (!mutation.previous && mutation.next) return { kind: 'create', next: mutation.next };
  if (mutation.previous && mutation.next) {
    return { kind: 'update', id: mutation.previous.id, nextId: mutation.next.id,
      patch: changedFields(mutation.previous, mutation.next), baseFields: changedFields(mutation.next, mutation.previous), baseSnapshot: mutation.previous };
  }
  if (mutation.previous) {
    const { id, ...base } = mutation.previous;
    return { kind: 'delete', id, baseFingerprint: JSON.stringify(base), baseRate: mutation.previous };
  }
  throw new Error('A rate change needs a create, update, or delete value.');
}

async function queueAdminRateOperation(input: RateWriteOperationInput) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Sign in as an Admin before changing rates.');
  return stageRateOperation(uid, {
    operationId: input.operationId,
    adminEmail: input.adminEmail,
    category: input.category || updateCategory(input.mutations),
    notify: input.notify,
    mutations: input.mutations.map(queueMutation),
  });
}

export const createRate = (rate: CommissionRate, adminEmail: string) => queueAdminRateOperation({ mutations: [{ next: rate }], adminEmail, category: 'intake' });
export const createRates = (rates: CommissionRate[], adminEmail: string) => queueAdminRateOperation({ mutations: rates.map((next) => ({ next })), adminEmail, category: 'intake' });

export const updateRate = (previous: CommissionRate, next: CommissionRate, adminEmail: string) => queueAdminRateOperation({ mutations: [{ previous, next }], adminEmail });
export const updateRates = (previousRates: CommissionRate[], transform: (rate: CommissionRate) => CommissionRate, adminEmail: string, category?: RateWriteCategory) =>
  queueAdminRateOperation({ mutations: previousRates.map((previous) => ({ previous, next: transform(previous) })), adminEmail, category });
export const deleteRates = (rates: CommissionRate[], adminEmail: string) => queueAdminRateOperation({ mutations: rates.map((previous) => ({ previous })), adminEmail, notify: false });

export async function importRateChunk(rates: CommissionRate[]): Promise<void> {
  await writeRateOperation({ mutations: rates.map((next) => ({ next })), adminEmail: 'Import', notify: false, allowUpsert: true });
}
