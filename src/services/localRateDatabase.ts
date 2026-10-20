import type { AgentRateReadModel, ChatConversation, CommissionRate, FavoriteSchool, RateSheetBucket, StaffRateReadModel, UserRole } from '../types';
import type { AgentChatProfile } from '../types/chat';
import type { PendingRateOperation, PendingRateOperationPatch } from '../types/rateWriteQueue';

export interface RateScope {
  uid: string;
  role: UserRole;
  organizationId?: string;
}

export interface LocalRateMetadata extends RateScope {
  id: 'scope';
  complete: boolean;
  cursors: Record<string, number>;
  lastSyncedAt: string;
  lastVerifiedAt: string;
  quotaRetryAt?: number;
  ratesLastUpdatedAt?: string;
  adminMembershipVerified?: boolean;
  adminEmail?: string;
}

const DB_PREFIX = 'basechan-rate-cache-v1-';
const STORES = ['metadata', 'rates', 'organizationOverrides', 'personalOverrides', 'chatProfile', 'chatConversations', 'chatFavorites', 'chatFavoriteDeletes', 'chatUsage', 'sheetBuckets', 'pendingOfflineImports', 'pendingRateOperations'] as const;
const activeConnections = new Map<string, Set<IDBDatabase>>();
const databaseChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('basechan-local-rate-database');
const LOCAL_RATE_CHANGE_EVENT = 'basechan-local-rate-change';

databaseChannel?.addEventListener('message', (event) => {
  if (event.data?.type === 'rates-changed' && typeof event.data?.uid === 'string') {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LOCAL_RATE_CHANGE_EVENT, { detail: { uid: event.data.uid } }));
    return;
  }
  if (event.data?.type !== 'close' || typeof event.data?.uid !== 'string') return;
  for (const database of activeConnections.get(event.data.uid) || []) database.close();
  activeConnections.delete(event.data.uid);
});

function databaseName(uid: string) {
  if (!uid || /[/\\\0]/.test(uid)) throw new Error('A valid signed-in account is required.');
  return `${DB_PREFIX}${encodeURIComponent(uid)}`;
}

function openDatabase(uid: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const name = databaseName(uid);
    const request = indexedDB.open(name, 6);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      const connections = activeConnections.get(uid) || new Set<IDBDatabase>();
      connections.add(database);
      activeConnections.set(uid, connections);
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('Could not open the local school database.'));
    request.onblocked = () => reject(new Error('Close another Basechan tab to update the local school database.'));
  });
}

function transact<T>(uid: string, stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction) => void): Promise<T> {
  return openDatabase(uid).then((database) => new Promise<T>((resolve, reject) => {
    const tx = database.transaction(stores, mode);
    run(tx);
    tx.oncomplete = () => { database.close(); resolve(undefined as T); };
    tx.onerror = () => { database.close(); reject(tx.error); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Local database transaction was interrupted.')); };
  }));
}

function readAll<T>(uid: string, store: string): Promise<T[]> {
  return openDatabase(uid).then((database) => new Promise<T[]>((resolve, reject) => {
    const request = database.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => { database.close(); resolve(request.result as T[]); };
    request.onerror = () => { database.close(); reject(request.error); };
  }));
}

export async function getLocalRateMetadata(uid: string): Promise<LocalRateMetadata | null> {
  const database = await openDatabase(uid);
  return new Promise((resolve, reject) => {
    const request = database.transaction('metadata', 'readonly').objectStore('metadata').get('scope');
    request.onsuccess = () => { database.close(); resolve((request.result as LocalRateMetadata | undefined) || null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

export async function saveLocalRateMetadata(uid: string, metadata: LocalRateMetadata): Promise<void> {
  await transact<void>(uid, ['metadata'], 'readwrite', (tx) => {
    tx.objectStore('metadata').put(metadata);
  });
}

export async function saveLocalSheetBucket(sheetKey: string, bucket: RateSheetBucket, uid = 'global'): Promise<void> {
  await transact<void>(uid, ['sheetBuckets'], 'readwrite', (tx) => {
    tx.objectStore('sheetBuckets').put({ ...bucket, id: sheetKey });
  });
}

export async function getLocalSheetBucket(sheetKey: string, uid = 'global'): Promise<RateSheetBucket | null> {
  const database = await openDatabase(uid);
  return new Promise((resolve, reject) => {
    const request = database.transaction('sheetBuckets', 'readonly').objectStore('sheetBuckets').get(sheetKey);
    request.onsuccess = () => { database.close(); resolve((request.result as RateSheetBucket | undefined) || null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

export async function getAllLocalSheetBuckets(uid = 'global'): Promise<RateSheetBucket[]> {
  return readAll<RateSheetBucket>(uid, 'sheetBuckets');
}

export async function getLocalRates(uid: string): Promise<CommissionRate[]> {
  const [rates, pendingImports] = await Promise.all([
    readAll<CommissionRate>(uid, 'rates'),
    getPendingOfflineImports(uid),
  ]);

  if (!pendingImports || pendingImports.length === 0) return rates;

  const rateMap = new Map<string, CommissionRate>();
  rates.forEach((r) => rateMap.set(r.id, r));
  pendingImports.forEach((item) => {
    (item.rates || []).forEach((r) => rateMap.set(r.id, r));
  });

  return Array.from(rateMap.values());
}

export function subscribeToLocalRateChanges(uid: string, listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    if ((event as CustomEvent<{ uid?: string }>).detail?.uid === uid) listener();
  };
  window.addEventListener(LOCAL_RATE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(LOCAL_RATE_CHANGE_EVENT, handler);
}

function announceLocalRateChanges(uid: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LOCAL_RATE_CHANGE_EVENT, { detail: { uid } }));
  databaseChannel?.postMessage({ type: 'rates-changed', uid });
}

export async function stageLocalRateOperation(
  uid: string,
  operation: PendingRateOperation,
  cancelledOperationId?: string,
): Promise<PendingRateOperation> {
  const database = await openDatabase(uid);
  let result = operation;
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['rates', 'pendingRateOperations'], 'readwrite');
    const ratesStore = tx.objectStore('rates');
    const operationsStore = tx.objectStore('pendingRateOperations');
    const queueRequest = operationsStore.getAll();
    queueRequest.onsuccess = () => {
      try {
      const queued = queueRequest.result as PendingRateOperation[];
      const incoming = operation.mutations.length === 1 ? operation.mutations[0] : undefined;
      const coalesce = incoming?.kind === 'update' && operation.mutations.length === 1
        ? queued.find((candidate) => candidate.status === 'pending'
          && candidate.mutations.length === 1
          && candidate.mutations[0].kind === 'update'
          && candidate.mutations[0].id === incoming.id
          && candidate.mutations[0].nextId === incoming.nextId)
        : undefined;
      const pendingCreate = incoming?.kind === 'delete'
        ? queued.find((candidate) => candidate.status === 'pending'
          && candidate.mutations.length === 1
          && candidate.mutations[0].kind === 'create'
          && candidate.mutations[0].next.id === incoming.id)
        : undefined;

      if (pendingCreate && incoming?.kind === 'delete') {
        operationsStore.delete(pendingCreate.operationId);
        ratesStore.delete(incoming.id);
        result = { ...pendingCreate, status: 'cancelled', updatedAt: operation.updatedAt };
      } else if (coalesce && incoming?.kind === 'update') {
        const prior = coalesce.mutations[0];
        if (prior.kind !== 'update') throw new Error('Only queued update operations can be coalesced.');
        const merged: PendingRateOperation = {
          ...coalesce,
          category: operation.category,
          notify: coalesce.notify || operation.notify,
          updatedAt: operation.updatedAt,
          mutations: [{ ...prior, patch: { ...prior.patch, ...incoming.patch } }],
        };
        operationsStore.put({ ...merged, id: merged.operationId });
        ratesStore.get(incoming.id).onsuccess = (event) => {
          const current = (event.target as IDBRequest<CommissionRate | undefined>).result;
          const next = { ...(current || { id: incoming.id }), ...incoming.patch, id: incoming.nextId } as CommissionRate;
          if (incoming.nextId !== incoming.id) ratesStore.delete(incoming.id);
          ratesStore.put(next);
        };
        result = merged;
      } else {
        operationsStore.put({ ...operation, id: operation.operationId });
        operation.mutations.forEach((mutation) => {
          if (mutation.kind === 'create') ratesStore.put(mutation.next);
          else if (mutation.kind === 'delete') ratesStore.delete(mutation.id);
          else {
            ratesStore.get(mutation.id).onsuccess = (event) => {
              const current = (event.target as IDBRequest<CommissionRate | undefined>).result;
              const next = { ...(current || { id: mutation.id }), ...mutation.patch, id: mutation.nextId } as CommissionRate;
              if (mutation.nextId !== mutation.id) ratesStore.delete(mutation.id);
              ratesStore.put(next);
            };
          }
        });
      }
      if (cancelledOperationId) operationsStore.delete(cancelledOperationId);
      } catch {
        tx.abort();
      }
    };
    queueRequest.onerror = () => tx.abort();
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(tx.error || new Error('Could not save this rate change locally.')); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Could not save this rate change locally.')); };
  });
  announceLocalRateChanges(uid);
  return result;
}

export async function finishLocalRateOperation(
  uid: string,
  operationId: string,
  canonicalRates: CommissionRate[],
): Promise<void> {
  await transact<void>(uid, ['rates', 'pendingRateOperations'], 'readwrite', (tx) => {
    const operations = tx.objectStore('pendingRateOperations');
    const rates = tx.objectStore('rates');
    canonicalRates.forEach((rate) => rates.put(rate));
    operations.delete(operationId);
  });
  announceLocalRateChanges(uid);
}
export async function resolveLocalRateOperationWithCloud(
  uid: string,
  operationId: string,
  conflicts: Map<number, { cloudRate?: CommissionRate }>,
): Promise<void> {
  const database = await openDatabase(uid);
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['rates', 'pendingRateOperations'], 'readwrite');
    const rates = tx.objectStore('rates');
    const operations = tx.objectStore('pendingRateOperations');
    const request = operations.get(operationId);
    request.onsuccess = () => {
      const operation = request.result as PendingRateOperation | undefined;
      if (!operation || operation.status !== 'conflict') return;
      operation.mutations.forEach((mutation, index) => {
        if (mutation.kind === 'create') rates.delete(mutation.next.id);
        else if (mutation.kind === 'update') {
          rates.delete(mutation.nextId);
          if (mutation.baseSnapshot) rates.put(mutation.baseSnapshot);
        } else if (mutation.baseRate) rates.put(mutation.baseRate);
        const cloud = conflicts.get(index)?.cloudRate;
        if (cloud) rates.put(cloud);
      });
      operations.delete(operationId);
    };
    request.onerror = () => tx.abort();
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(tx.error || new Error('Could not keep the Firestore version.')); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Could not keep the Firestore version.')); };
  });
  announceLocalRateChanges(uid);
}
export async function discardLocalRateOperation(uid: string, operationId: string): Promise<boolean> {
  const database = await openDatabase(uid);
  let discarded = false;
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['rates', 'pendingRateOperations'], 'readwrite');
    const rates = tx.objectStore('rates');
    const operations = tx.objectStore('pendingRateOperations');
    const request = operations.get(operationId);
    request.onsuccess = () => {
      const operation = request.result as PendingRateOperation | undefined;
      if (!operation || operation.status === 'syncing') return;
      discarded = true;
      operation.mutations.forEach((mutation) => {
        if (mutation.kind === 'create') rates.delete(mutation.next.id);
        else if (mutation.kind === 'update') {
          rates.delete(mutation.nextId);
          if (mutation.baseSnapshot) rates.put(mutation.baseSnapshot);
        } else if (mutation.baseRate) rates.put(mutation.baseRate);
      });
      operations.delete(operationId);
    };
    request.onerror = () => tx.abort();
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(tx.error || new Error('Could not discard this local rate operation.')); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Could not discard this local rate operation.')); };
  });
  if (discarded) announceLocalRateChanges(uid);
  return discarded;
}
export async function getLocalRateOperations(uid: string): Promise<PendingRateOperation[]> {
  return (await readAll<PendingRateOperation>(uid, 'pendingRateOperations'))
    .filter((operation) => operation.status !== 'cancelled')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateLocalRateOperation(
  uid: string,
  operationId: string,
  patch: PendingRateOperationPatch,
): Promise<void> {
  const database = await openDatabase(uid);
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('pendingRateOperations', 'readwrite');
    const store = tx.objectStore('pendingRateOperations');
    const request = store.get(operationId);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, ...patch, id: operationId });
    };
    request.onerror = () => tx.abort();
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(tx.error || new Error('Could not update local rate operation.')); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Could not update local rate operation.')); };
  });
  announceLocalRateChanges(uid);
}

export async function getLocalAgentOverrides(uid: string): Promise<{ organization: AgentRateReadModel[]; personal: AgentRateReadModel[] }> {
  const [organization, personal] = await Promise.all([
    readAll<AgentRateReadModel>(uid, 'organizationOverrides'),
    readAll<AgentRateReadModel>(uid, 'personalOverrides'),
  ]);
  return { organization, personal };
}

export async function replaceLocalRateSnapshot(
  scope: RateScope,
  rates: CommissionRate[] | StaffRateReadModel[] | AgentRateReadModel[],
  organization: AgentRateReadModel[],
  personal: AgentRateReadModel[],
  cursors: Record<string, number>,
): Promise<void> {
  const incomplete: LocalRateMetadata = {
    id: 'scope', ...scope, complete: false, cursors,
    lastSyncedAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(),
  };
  await transact<void>(scope.uid, ['metadata', 'rates', 'organizationOverrides', 'personalOverrides'], 'readwrite', (tx) => {
    for (const name of ['rates', 'organizationOverrides', 'personalOverrides']) tx.objectStore(name).clear();
    tx.objectStore('metadata').put(incomplete);
  });
  const writeRows = async (store: string, rows: Array<{ id: string }>) => {
    for (let offset = 0; offset < rows.length; offset += 300) {
      const page = rows.slice(offset, offset + 300);
      await transact<void>(scope.uid, [store], 'readwrite', (tx) => {
        for (const row of page) tx.objectStore(store).put(row);
      });
    }
  };
  await writeRows('rates', rates);
  await writeRows('organizationOverrides', organization);
  await writeRows('personalOverrides', personal);
  await transact<void>(scope.uid, ['metadata'], 'readwrite', (tx) => {
    tx.objectStore('metadata').put({ ...incomplete, complete: true });
  });
}

export type RateDelta = {
  sequence: number;
  operationId: string;
  kind: 'upsert' | 'delete';
  id: string;
  target: 'rates' | 'organizationOverrides' | 'personalOverrides';
  record?: CommissionRate | StaffRateReadModel | AgentRateReadModel;
};

export async function applyLocalRateDeltas(scope: RateScope, deltas: RateDelta[], cursors: Record<string, number>): Promise<void> {
  const metadata = await getLocalRateMetadata(scope.uid);
  if (!metadata?.complete || metadata.uid !== scope.uid || metadata.role !== scope.role || metadata.organizationId !== scope.organizationId) {
    throw new Error('The local school database no longer matches this account.');
  }
  await transact<void>(scope.uid, ['metadata', 'rates', 'organizationOverrides', 'personalOverrides'], 'readwrite', (tx) => {
    for (const delta of deltas) {
      const store = tx.objectStore(delta.target);
      if (delta.kind === 'delete') store.delete(delta.id);
      else if (delta.record) store.put({ ...delta.record, id: delta.id });
    }
    tx.objectStore('metadata').put({ ...metadata, cursors, lastSyncedAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString() });
  });
}

export async function saveLocalChatProfile(uid: string, profile: AgentChatProfile): Promise<void> {
  await transact<void>(uid, ['chatProfile'], 'readwrite', (tx) => tx.objectStore('chatProfile').put({ id: 'profile', profile }));
}

export async function getLocalChatProfile(uid: string): Promise<AgentChatProfile | null> {
  const database = await openDatabase(uid);
  return new Promise((resolve, reject) => {
    const request = database.transaction('chatProfile', 'readonly').objectStore('chatProfile').get('profile');
    request.onsuccess = () => { database.close(); resolve((request.result?.profile as AgentChatProfile | undefined) || null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

export async function deleteLocalChatProfile(uid: string): Promise<void> {
  await transact<void>(uid, ['chatProfile'], 'readwrite', (tx) => tx.objectStore('chatProfile').delete('profile'));
}

export interface LocalChatUsage {
  currentConversationId: string;
  queriesThisSession: number;
  queryTimestamps: number[];
  updatedAt: string;
}

export async function saveLocalChatConversation(uid: string, conversation: ChatConversation): Promise<void> {
  const safeMessages = conversation.messages.map(({ resultRates: _resultRates, ...message }) => message);
  const stored = { ...conversation, messages: safeMessages, updatedAt: conversation.updatedAt || new Date().toISOString() };
  await openDatabase(uid).then((database) => new Promise<void>((resolve, reject) => {
    const tx = database.transaction('chatConversations', 'readwrite');
    const store = tx.objectStore('chatConversations');
    const request = store.getAll();
    request.onsuccess = () => {
      const existing = (request.result as ChatConversation[]).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      if (!existing.some((item) => item.id === conversation.id) && existing.length >= 5) {
        for (const item of existing.slice(4)) store.delete(item.id);
      }
      store.put({ ...stored, id: conversation.id });
    };
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(tx.error); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Local chat history transaction was interrupted.')); };
    request.onerror = () => tx.abort();
  }));
}

export async function getLocalChatConversations(uid: string): Promise<ChatConversation[]> {
  const conversations = await readAll<ChatConversation>(uid, 'chatConversations');
  return conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5);
}

export async function saveLocalFavorite(uid: string, favorite: FavoriteSchool): Promise<void> {
  await transact<void>(uid, ['chatFavorites', 'chatFavoriteDeletes'], 'readwrite', (tx) => {
    tx.objectStore('chatFavorites').put({ ...favorite, id: favorite.universityId });
    tx.objectStore('chatFavoriteDeletes').delete(favorite.universityId);
  });
}

export async function deleteLocalFavorite(uid: string, universityId: string): Promise<void> {
  await transact<void>(uid, ['chatFavorites', 'chatFavoriteDeletes'], 'readwrite', (tx) => {
    tx.objectStore('chatFavorites').delete(universityId);
    tx.objectStore('chatFavoriteDeletes').put({ id: universityId, universityId, deletedAt: new Date().toISOString() });
  });
}

export async function getLocalFavorites(uid: string): Promise<FavoriteSchool[]> {
  return readAll<FavoriteSchool>(uid, 'chatFavorites');
}

export async function getLocalFavoriteDeletions(uid: string): Promise<string[]> {
  const rows = await readAll<{ id: string; universityId: string }>(uid, 'chatFavoriteDeletes');
  return rows.map((row) => row.universityId);
}

export async function clearLocalFavoriteDeletion(uid: string, universityId: string): Promise<void> {
  await transact<void>(uid, ['chatFavoriteDeletes'], 'readwrite', (tx) => tx.objectStore('chatFavoriteDeletes').delete(universityId));
}

export async function saveLocalChatUsage(uid: string, usage: LocalChatUsage): Promise<void> {
  await transact<void>(uid, ['chatUsage'], 'readwrite', (tx) => tx.objectStore('chatUsage').put({ ...usage, id: 'usage' }));
}

export async function getLocalChatUsage(uid: string): Promise<LocalChatUsage | null> {
  const database = await openDatabase(uid);
  return new Promise((resolve, reject) => {
    const request = database.transaction('chatUsage', 'readonly').objectStore('chatUsage').get('usage');
    request.onsuccess = () => { database.close(); resolve((request.result as LocalChatUsage | undefined) || null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

export async function deleteLocalRateDatabase(uid: string): Promise<void> {
  const name = databaseName(uid);
  databaseChannel?.postMessage({ type: 'close', uid });
  for (const database of activeConnections.get(uid) || []) database.close();
  activeConnections.delete(uid);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Could not clear this account’s local school data.'));
    request.onblocked = () => reject(new Error('Close other Basechan tabs to finish clearing local school data.'));
  });
  await new Promise<void>((resolve) => {
    const obsoleteQueue = indexedDB.deleteDatabase('basechan-local-rate-queue');
    obsoleteQueue.onsuccess = () => resolve();
    obsoleteQueue.onerror = () => resolve();
    obsoleteQueue.onblocked = () => resolve();
  });
}

export function closeLocalRateDatabase(uid: string): Promise<void> {
  return openDatabase(uid).then((database) => { database.close(); });
}

export interface PendingOfflineImport {
  id: string;
  rates: CommissionRate[];
  sheetNames: string[];
  importedAt: string;
  importedBy: string;
}

export async function saveLocalOfflineImport(uid: string, item: PendingOfflineImport): Promise<void> {
  await transact<void>(uid, ['pendingOfflineImports'], 'readwrite', (tx) => {
    tx.objectStore('pendingOfflineImports').put(item);
  });
}

export async function getPendingOfflineImports(uid: string): Promise<PendingOfflineImport[]> {
  return readAll<PendingOfflineImport>(uid, 'pendingOfflineImports');
}

export async function clearPendingOfflineImports(uid: string): Promise<void> {
  await transact<void>(uid, ['pendingOfflineImports'], 'readwrite', (tx) => {
    tx.objectStore('pendingOfflineImports').clear();
  });
}

export async function stageRatesToLocalDatabase(uid: string, newRates: CommissionRate[]): Promise<void> {
  if (!newRates || newRates.length === 0) return;
  for (let offset = 0; offset < newRates.length; offset += 300) {
    const page = newRates.slice(offset, offset + 300);
    await transact<void>(uid, ['rates'], 'readwrite', (tx) => {
      const store = tx.objectStore('rates');
      for (const rate of page) {
        store.put(rate);
      }
    });
  }
}
