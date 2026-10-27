import { getAuth } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot, orderBy, query, runTransaction, where, type Unsubscribe } from 'firebase/firestore';
import type { AgentRateReadModel, CommissionRate, StaffRateReadModel } from '../types';
import type { PendingRateMutation, PendingRateOperation } from '../types/rateWriteQueue';
import type { RatePackageAudit, RatePackageChunk, RatePackageDelta, RatePackageEnvelope, RatePackageHead, RatePackageScope } from '../types/ratePackages';
import { db } from '../lib/firebase';
import { applyLocalRatePackage, getLocalRatePackageCursor, type RateScope } from './localRateDatabase';
import { buildAgentProjection, buildStaffProjection, isEligibleAgentPayout, opaqueRateId } from './rateReadModels';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';

const MAX_PACKAGE_BYTES = 850_000;
const MAX_PACKAGE_CHANGES_PER_CHUNK = 100;
const MAX_PACKAGE_TRANSACTION_BYTES = 8_000_000;
const PACKAGE_SCHEMA_VERSION = 1 as const;

function packageRef(scope: RatePackageScope, packageId: string) {
  return doc(db, 'rate_packages', scope, 'packages', packageId);
}

function chunkRef(scope: RatePackageScope, packageId: string, chunkId: string) {
  return doc(db, 'rate_packages', scope, 'packages', packageId, 'chunks', chunkId);
}

function headRef(scope: RatePackageScope) {
  return doc(db, 'rate_package_heads', scope);
}

function toRate(mutation: PendingRateMutation): CommissionRate | undefined {
  if (mutation.kind === 'create') return mutation.next;
  if (mutation.kind === 'delete') return undefined;
  return { ...(mutation.baseSnapshot || { id: mutation.id }), ...mutation.patch, id: mutation.nextId } as CommissionRate;
}

function previousRate(mutation: PendingRateMutation): CommissionRate | undefined {
  if (mutation.kind === 'create') return undefined;
  if (mutation.kind === 'delete') return mutation.baseRate;
  return mutation.baseSnapshot;
}

function pushDelta(target: RatePackageDelta[], operationId: string, kind: 'upsert' | 'delete', id: string, record?: Partial<CommissionRate> | Partial<StaffRateReadModel> | Partial<AgentRateReadModel>, unsetFields?: string[], audit?: RatePackageAudit) {
  target.push({ operationId, kind, id, ...(record ? { record } : {}), ...(unsetFields?.length ? { unsetFields } : {}), ...(audit ? { audit } : {}) });
}

function projectionPatch<T extends { id: string }>(before: T, after: T): Partial<T> {
  const patch: Record<string, unknown> = { id: after.id };
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  keys.forEach((key) => {
    if (key === 'id' || before[key as keyof T] === after[key as keyof T]) return;
    if (Object.prototype.hasOwnProperty.call(after, key)) patch[key] = after[key as keyof T];
    else patch[key] = null;
  });
  return patch as Partial<T>;
}

function buildRoleChanges(operations: PendingRateOperation[]) {
  const byScope: Record<RatePackageScope, RatePackageDelta[]> = { admin: [], staff: [], agent: [] };
  for (const operation of operations) {
    for (const mutation of operation.mutations) {
      const before = previousRate(mutation);
      const after = toRate(mutation);
      const audit: RatePackageAudit = {
        rateId: after?.id || before?.id || '',
        universityName: after?.universityName || before?.universityName || 'Unknown school',
        actionType: mutation.kind === 'create' ? 'CREATE' : mutation.kind === 'delete' ? 'DELETE' : 'EDIT',
        updatedBy: operation.adminEmail || 'Admin',
        ...(mutation.kind === 'update' ? { changes: Object.fromEntries(Object.entries(mutation.patch).map(([key, newVal]) => [key, {
          oldVal: before?.[key as keyof CommissionRate] ?? null,
          newVal: newVal ?? null,
        }])) } : {}),
      };
      if (mutation.kind === 'update' && mutation.id === mutation.nextId) {
        const unsetFields = Object.entries(mutation.patch).filter(([, value]) => value === undefined).map(([key]) => key);
        const patch = Object.fromEntries(Object.entries(mutation.patch).filter(([, value]) => value !== undefined));
        pushDelta(byScope.admin, operation.operationId, 'upsert', mutation.id, { id: mutation.id, ...patch }, unsetFields, audit);
      } else {
        if (before) pushDelta(byScope.admin, operation.operationId, 'delete', before.id, after ? undefined : undefined, undefined, after ? undefined : audit);
        if (after) pushDelta(byScope.admin, operation.operationId, 'upsert', after.id, after, undefined, audit);
      }

      const beforeStaff = before ? buildStaffProjection(before) : undefined;
      const afterStaff = after ? buildStaffProjection(after) : undefined;
      const beforeStaffId = before ? opaqueRateId(before) : undefined;
      const afterStaffId = after ? opaqueRateId(after) : undefined;
      if (beforeStaffId && beforeStaffId !== afterStaffId) pushDelta(byScope.staff, `${operation.operationId}-staff`, 'delete', beforeStaffId);
      if (afterStaff && beforeStaff && beforeStaffId === afterStaffId) {
        const patch = projectionPatch(beforeStaff, afterStaff);
        if (Object.keys(patch).length > 1) pushDelta(byScope.staff, `${operation.operationId}-staff`, 'upsert', afterStaffId!, patch);
      } else if (afterStaff) {
        pushDelta(byScope.staff, `${operation.operationId}-staff`, 'upsert', afterStaffId!, afterStaff);
      }

      const beforeAgent = before && isEligibleAgentPayout(before.aggregator) ? buildAgentProjection(before) : undefined;
      const afterAgent = after && isEligibleAgentPayout(after.aggregator) ? buildAgentProjection(after) : undefined;
      const beforeAgentId = beforeAgent ? opaqueRateId(before!) : undefined;
      const afterAgentId = afterAgent ? opaqueRateId(after!) : undefined;
      if (beforeAgentId && beforeAgentId !== afterAgentId) pushDelta(byScope.agent, `${operation.operationId}-agent`, 'delete', beforeAgentId);
      if (afterAgent && beforeAgent && beforeAgentId === afterAgentId) {
        const patch = projectionPatch(beforeAgent, afterAgent);
        if (Object.keys(patch).length > 1) pushDelta(byScope.agent, `${operation.operationId}-agent`, 'upsert', afterAgentId!, patch);
      } else if (afterAgent) {
        pushDelta(byScope.agent, `${operation.operationId}-agent`, 'upsert', afterAgentId!, afterAgent);
      }
    }
  }
  return byScope;
}

function utf8Size(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function splitChanges(scope: RatePackageScope, packageId: string, changes: RatePackageDelta[]) {
  const chunks: RatePackageDelta[][] = [];
  let current: RatePackageDelta[] = [];
  for (const change of changes) {
    const candidate = [...current, change];
    if (current.length && (candidate.length > MAX_PACKAGE_CHANGES_PER_CHUNK
      || utf8Size({ changes: candidate }) > MAX_PACKAGE_BYTES)) {
      chunks.push(current);
      current = [change];
    } else current = candidate;
    if (utf8Size({ changes: current }) > MAX_PACKAGE_BYTES) {
      throw new Error(`One ${scope} rate change is too large to publish safely.`);
    }
  }
  if (current.length) chunks.push(current);
  return chunks.map((chunk, chunkIndex): RatePackageChunk => ({
    packageId, scope, cursor: 0, chunkIndex, changes: chunk,
  }));
}

function packageFits(operations: PendingRateOperation[]): boolean {
  const byScope = buildRoleChanges(operations);
  const scopes = (Object.keys(byScope) as RatePackageScope[]).filter((scope) => scope === 'admin' || byScope[scope].length > 0);
  let writes = 0;
  let bytes = 0;
  try {
    for (const scope of scopes) {
      const chunks = splitChanges(scope, 'size-check', byScope[scope]);
      writes += chunks.length + 2;
      bytes += utf8Size(chunks);
    }
  } catch {
    return false;
  }
  return writes <= 450 && bytes <= MAX_PACKAGE_TRANSACTION_BYTES;
}

/** Split fresh selections into independently publishable packages. Existing ambiguous
 * retries stay together so they retain the same package ID and idempotency boundary. */
export function partitionRatePackageOperations(operations: PendingRateOperation[]): {
  batches: PendingRateOperation[][];
  oversized: PendingRateOperation[][];
} {
  const batches: PendingRateOperation[][] = [];
  const oversized: PendingRateOperation[][] = [];
  const seen = new Set<string>();
  const units: PendingRateOperation[][] = [];
  for (const operation of operations) {
    if (seen.has(operation.operationId)) continue;
    const linkedIds = operation.packageId ? operation.packageChangeIds || [operation.operationId] : [operation.operationId];
    const unit = linkedIds.map((id) => operations.find((candidate) => candidate.operationId === id)).filter((item): item is PendingRateOperation => Boolean(item));
    if (unit.length !== linkedIds.length) {
      oversized.push(unit.length ? unit : [operation]);
      linkedIds.forEach((id) => seen.add(id));
      continue;
    }
    unit.forEach((item) => seen.add(item.operationId));
    units.push(unit);
  }

  let current: PendingRateOperation[] = [];
  for (const unit of units) {
    // A prior ambiguous package must be retried with exactly the original membership.
    if (unit[0]?.packageId) {
      if (current.length) { batches.push(current); current = []; }
      if (packageFits(unit)) batches.push(unit); else oversized.push(unit);
      continue;
    }
    const candidate = [...current, ...unit];
    if (packageFits(candidate)) {
      current = candidate;
    } else {
      if (current.length) batches.push(current);
      current = [];
      if (packageFits(unit)) current = unit;
      else oversized.push(unit);
    }
  }
  if (current.length) batches.push(current);
  return { batches, oversized };
}

export async function publishRateChangePackage(input: {
  uid: string;
  operations: PendingRateOperation[];
  packageId: string;
}): Promise<{ packageId: string; scopes: RatePackageScope[] }> {
  if (!input.operations.length) throw new Error('Select at least one change to upload.');
  if (getAuth().currentUser?.uid !== input.uid) throw new Error('Sign in again before publishing rate changes.');
  assertFirestoreWritesAllowed('Rate package upload');
  const byScope = buildRoleChanges(input.operations);
  const scopes = (Object.keys(byScope) as RatePackageScope[]).filter((scope) => scope === 'admin' || byScope[scope].length > 0);
  const chunksByScope = Object.fromEntries(scopes.map((scope) => [scope, splitChanges(scope, input.packageId, byScope[scope])])) as Record<RatePackageScope, RatePackageChunk[]>;
  const writeCount = scopes.reduce((count, scope) => count + chunksByScope[scope].length + 2, 0);
  const transactionBytes = scopes.reduce((count, scope) => count + utf8Size(chunksByScope[scope]), 0);
  if (writeCount > 450 || transactionBytes > MAX_PACKAGE_TRANSACTION_BYTES) {
    throw new Error('This selection is too large for one safe package. Select fewer changes and upload them as a separate package.');
  }
  const actorUid = input.uid;
  const createdAt = new Date().toISOString();
  const packageRefs = scopes.map((scope) => packageRef(scope, input.packageId));
  const chunkRefs = scopes.map((scope) => chunksByScope[scope].map((_chunk, index) => chunkRef(scope, input.packageId, `${input.packageId}_${index}`)));
  const headRefs = scopes.map(headRef);

  await runTransaction(db, async (transaction) => {
    const [existingPackages, heads] = await Promise.all([
      Promise.all(packageRefs.map((ref) => transaction.get(ref))),
      Promise.all(headRefs.map((ref) => transaction.get(ref))),
    ]);
    if (existingPackages.every((snapshot) => snapshot.exists())) return;
    if (existingPackages.some((snapshot) => snapshot.exists())) {
      throw new Error('This package ID is only partially published. Contact an Admin before retrying.');
    }

    const envelopes = scopes.map((scope, index): RatePackageEnvelope => ({
      packageId: input.packageId,
      scope,
      cursor: Number(heads[index].data()?.cursor || 0) + 1,
      schemaVersion: PACKAGE_SCHEMA_VERSION,
      createdAt,
      ...(scope === 'admin' ? { actorUid } : {}),
      changeCount: byScope[scope].length,
      chunkIds: chunkRefs[index].map((ref) => ref.id),
    }));

    envelopes.forEach((envelope, index) => {
      chunksByScope[envelope.scope].forEach((chunk, chunkIndex) => {
        transaction.set(chunkRefs[index][chunkIndex], { ...chunk, cursor: envelope.cursor });
      });
      transaction.set(packageRefs[index], envelope);
      transaction.set(headRefs[index], {
        cursor: envelope.cursor,
        packageId: envelope.packageId,
        updatedAt: envelope.createdAt,
      });
    });
  });
  return { packageId: input.packageId, scopes };
}

export async function isRatePackagePublished(packageId: string): Promise<boolean> {
  const snapshot = await getDocFromServer(packageRef('admin', packageId));
  return snapshot.exists();
}

export function subscribeToRatePackageHead(
  scope: RatePackageScope,
  onHead: (head: RatePackageHead) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(headRef(scope), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (typeof data.packageId !== 'string' || typeof data.cursor !== 'number') return;
    onHead({ packageId: data.packageId, cursor: data.cursor, updatedAt: String(data.updatedAt || '') });
  }, (error) => onError?.(error));
}

export interface RatePackageAuditLog extends RatePackageAudit {
  id: string;
  timestamp: string;
}

export function subscribeToAdminRatePackageAudit(
  onEntries: (entries: RatePackageAuditLog[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const packages = collection(db, 'rate_packages', 'admin', 'packages');
  const entriesByPackage = new Map<string, RatePackageAuditLog[]>();
  return onSnapshot(query(packages, orderBy('cursor', 'desc'), limit(50)), (snapshot) => {
    const added = snapshot.docChanges().filter((change) => change.type === 'added');
    void Promise.all(added.map(async ({ doc: packageDoc }) => {
      const envelope = packageDoc.data() as RatePackageEnvelope;
      const chunks = await Promise.all((envelope.chunkIds || []).map(async (chunkId) => {
        const chunk = await getDocFromServer(chunkRef('admin', packageDoc.id, chunkId));
        return chunk.exists() ? chunk.data() as RatePackageChunk : null;
      }));
      const logs = chunks.flatMap((chunk) => chunk?.changes || []).flatMap((change, index) => change.audit ? [{
        ...change.audit,
        id: `${packageDoc.id}:${change.operationId}:${index}`,
        timestamp: envelope.createdAt,
      }] : []);
      entriesByPackage.set(packageDoc.id, logs);
    })).then(() => {
      onEntries(Array.from(entriesByPackage.values()).flat().sort((left, right) => right.timestamp.localeCompare(left.timestamp)));
    }).catch((error) => onError?.(error instanceof Error ? error : new Error('Could not load rate package audit history.')));
  }, (error) => onError?.(error));
}

async function loadRatePackagesAfter(scope: RatePackageScope, cursor: number): Promise<RatePackageEnvelope[]> {
  const packages = collection(db, 'rate_packages', scope, 'packages');
  const snapshot = await getDocsFromServer(query(packages, where('cursor', '>', cursor), orderBy('cursor'), limit(100)));
  return snapshot.docs.map((item) => {
    const envelope = item.data() as RatePackageEnvelope;
    if (envelope.packageId !== item.id) throw new Error('A rate package ID does not match its manifest path.');
    return envelope;
  })
    .sort((left, right) => left.cursor - right.cursor);
}

async function loadPackageChanges(envelope: RatePackageEnvelope): Promise<RatePackageDelta[]> {
  const chunks = await Promise.all(envelope.chunkIds.map(async (chunkId) => {
    const snapshot = await getDocFromServer(chunkRef(envelope.scope, envelope.packageId, chunkId));
    if (!snapshot.exists()) throw new Error('A rate package chunk is missing. This package was not applied.');
    const chunk = snapshot.data() as RatePackageChunk;
    if (chunk.packageId !== envelope.packageId || chunk.scope !== envelope.scope || chunk.cursor !== envelope.cursor
      || !Array.isArray(chunk.changes)) throw new Error('A rate package chunk is invalid. This package was not applied.');
    return chunk;
  }));
  chunks.sort((left, right) => left.chunkIndex - right.chunkIndex);
  if (chunks.some((chunk, index) => chunk.chunkIndex !== index)) throw new Error('Rate package chunks are out of order.');
  const changes = chunks.flatMap((chunk) => chunk.changes);
  if (changes.length !== envelope.changeCount) throw new Error('Rate package change count does not match its manifest.');
  return changes;
}

function assertPackageFieldsAreRoleSafe(scope: RatePackageScope, changes: RatePackageDelta[]) {
  const staffFields = new Set(['id', 'universityId', 'universityName', 'country', 'intake', 'studyLevel', 'aggregator', 'guidance', 'isDefaultRoute', 'notes', 'updatedAt', 'sourceSheet']);
  const agentFields = new Set(['id', 'universityId', 'universityName', 'country', 'intake', 'studyLevel', 'agentRate', 'isFlatFee', 'netOrGross', 'guidance', 'notes', 'updatedAt', 'sourceSheet']);
  const adminFields = new Set(['id', 'universityId', 'universityName', 'country', 'intake', 'aggregator', 'studyLevel', 'masterRate', 'agentRate', 'diffMargin', 'isFlatFee', 'currency', 'netOrGross', 'guidance', 'isDefaultRoute', 'notes', 'updatedAt', 'rowColor', 'sourceSheet', 'sourceRow']);
  const allowed = scope === 'admin' ? adminFields : scope === 'staff' ? staffFields : agentFields;
  for (const change of changes) {
    if (!change || typeof change.operationId !== 'string' || typeof change.id !== 'string'
      || (change.kind !== 'upsert' && change.kind !== 'delete')
      || (change.kind === 'upsert' && !change.record)) {
      throw new Error('The published rate package contains an invalid change entry.');
    }
    if (!change.record) continue;
    if (String(change.record.id || '') !== change.id || Object.keys(change.record).some((key) => !allowed.has(key))
      || change.unsetFields?.some((key) => !allowed.has(key))) {
      throw new Error(`The ${scope} package contains fields outside its approved data shape.`);
    }
  }
}

export function packageScopesForUser(scope: RateScope): RatePackageScope[] {
  if (scope.role === 'ADMIN') return ['admin'];
  if (scope.role === 'STAFF') return ['staff'];
  return ['agent'];
}

export async function syncRatePackages(scope: RateScope, packageScope: RatePackageScope, knownHead?: RatePackageHead): Promise<number> {
  const expectedRole = packageScope === 'admin' ? 'ADMIN' : packageScope === 'staff' ? 'STAFF' : 'AGENT';
  if (scope.role !== expectedRole) throw new Error('This package is not available to the current role.');
  let cursor = await getLocalRatePackageCursor(scope.uid, packageScope);
  const head = knownHead ? null : await getDocFromServer(headRef(packageScope));
  const latestCursor = Number(knownHead?.cursor ?? head?.data()?.cursor ?? 0);
  while (cursor < latestCursor) {
    const packages = await loadRatePackagesAfter(packageScope, cursor);
    if (!packages.length || packages[0].cursor !== cursor + 1) {
      throw new Error('Rate update history has a gap. Reload the authorized rate package to continue.');
    }
    for (const envelope of packages) {
      if (envelope.scope !== packageScope || envelope.schemaVersion !== PACKAGE_SCHEMA_VERSION
        || typeof envelope.packageId !== 'string' || !envelope.packageId || envelope.cursor !== cursor + 1
        || !Array.isArray(envelope.chunkIds) || !envelope.chunkIds.length
        || new Set(envelope.chunkIds).size !== envelope.chunkIds.length) {
        throw new Error('The published rate package is incomplete or has an unsupported version.');
      }
      const changes = await loadPackageChanges(envelope);
      assertPackageFieldsAreRoleSafe(packageScope, changes);
      await applyLocalRatePackage(scope, packageScope, envelope.cursor, changes);
      cursor = envelope.cursor;
    }
  }
  return cursor;
}

export function subscribeToRatePackages(
  scope: RateScope,
  onApplied: (scope: RatePackageScope) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const unsubscriptions = packageScopesForUser(scope).map((packageScope) => subscribeToRatePackageHead(
    packageScope,
    (head) => {
      void getLocalRatePackageCursor(scope.uid, packageScope)
        .then((cursor) => head.cursor > cursor ? syncRatePackages(scope, packageScope, head) : cursor)
        .then(() => onApplied(packageScope))
        .catch((error) => onError?.(error instanceof Error ? error : new Error('Could not apply the published rate package.')));
    },
    onError,
  ));
  return () => unsubscriptions.forEach((unsubscribe) => unsubscribe());
}

