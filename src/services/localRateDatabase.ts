import type { AgentRateReadModel, ChatConversation, CommissionRate, FavoriteSchool, StaffRateReadModel, UserRole } from '../types';
import type { AgentChatProfile } from '../types/chat';

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
}

const DB_PREFIX = 'basechan-rate-cache-v1-';
const STORES = ['metadata', 'rates', 'organizationOverrides', 'personalOverrides', 'chatProfile', 'chatConversations', 'chatFavorites', 'chatFavoriteDeletes', 'chatUsage'] as const;
const activeConnections = new Map<string, Set<IDBDatabase>>();
const databaseChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('basechan-local-rate-database');

databaseChannel?.addEventListener('message', (event) => {
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
    const request = indexedDB.open(name, 3);
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

export async function getLocalRates(uid: string): Promise<CommissionRate[]> {
  return readAll<CommissionRate>(uid, 'rates');
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
