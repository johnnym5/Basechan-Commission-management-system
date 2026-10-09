import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'firebase/firestore';
import type { AgentRateReadModel, CommissionRate, StaffRateReadModel, UserRole } from '../types';
import { db } from '../lib/firebase';
import { isQuotaOffline } from './firestoreOfflineMode';
import {
  applyLocalRateDeltas, getLocalRateMetadata, replaceLocalRateSnapshot,
  type RateDelta, type RateScope,
} from './localRateDatabase';
import { getFeedCursor, hydrateRateDelta, readRateDeltas } from './rateChangeFeed';

export interface RateSyncResult {
  rates: CommissionRate[];
  organizationOverrides: AgentRateReadModel[];
  personalOverrides: AgentRateReadModel[];
  lastSyncedAt: string;
  changed: boolean;
}

export async function verifyServerRateAccess(scope: RateScope): Promise<void> {
  const profile = await getDocFromServer(doc(db, 'users', scope.uid));
  if (profile.data()?.isDisabled === true) {
    throw Object.assign(new Error('Account access has been disabled.'), { code: 'permission-denied' });
  }
  if (scope.role !== 'AGENT') return;
  const request = await getDocFromServer(doc(db, 'agent_access_requests', scope.uid));
  const data = request.data();
  if (!request.exists() || data?.status !== 'approved' || !data.organizationId || data.organizationId !== scope.organizationId) {
    throw Object.assign(new Error('Agent access is no longer approved for this organization.'), { code: 'permission-denied' });
  }
}

function scopeNames(scope: RateScope): string[] {
  if (scope.role === 'ADMIN') return ['admin'];
  if (scope.role === 'STAFF') return ['staff'];
  if (!scope.organizationId) return ['agent'];
  return ['agent', `org_${scope.organizationId}`, `user_${scope.uid}`];
}

function normalizeStaff(id: string, data: StaffRateReadModel): CommissionRate {
  return {
    ...data, id, aggregator: data.aggregator, masterRate: 0, agentRate: 0,
    diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS',
  };
}

function normalizeAgent(id: string, data: AgentRateReadModel): CommissionRate {
  return {
    ...data, id, aggregator: '', masterRate: 0, agentRate: data.agentRate, diffMargin: 0,
  };
}

async function visibleSheetNames(role: Exclude<UserRole, 'ADMIN'>): Promise<string[] | null> {
  const settings = await getDocsFromServer(collection(db, 'sheet_settings'));
  if (settings.empty) return null;
  const disabledField = role === 'AGENT' ? 'disabledForAgents' : 'disabledForStaff';
  return Array.from(new Set(settings.docs
    .filter((item) => item.get(disabledField) !== true)
    .map((item) => String(item.get('sheetName') || item.id).trim())
    .filter(Boolean)));
}

async function readVisibleProjection(collectionPath: ReturnType<typeof collection>, sheets: string[] | null) {
  if (sheets === null) return (await getDocsFromServer(collectionPath)).docs;
  if (!sheets.length) return [];
  const snapshots = [];
  for (let offset = 0; offset < sheets.length; offset += 30) {
    const chunk = sheets.slice(offset, offset + 30);
    snapshots.push(await getDocsFromServer(query(collectionPath, where('sourceSheet', 'in', chunk))));
  }
  return snapshots.flatMap((snapshot) => snapshot.docs);
}

async function fetchRows(scope: RateScope) {
  const sheets = scope.role === 'ADMIN' ? [] : await visibleSheetNames(scope.role);
  const rowsPromise = scope.role === 'ADMIN'
    ? getDocsFromServer(collection(db, 'rates'))
    : readVisibleProjection(collection(db, scope.role === 'STAFF' ? 'staff_rates' : 'agent_rates'), sheets);
  const organizationPromise = scope.role === 'AGENT' && scope.organizationId
    ? readVisibleProjection(collection(db, 'organization_agent_rates', scope.organizationId, 'rates'), sheets)
    : Promise.resolve([]);
  const personalPromise = scope.role === 'AGENT'
    ? readVisibleProjection(collection(db, 'agent_rate_overrides', scope.uid, 'rates'), sheets)
    : Promise.resolve([]);
  const [rows, organization, personal] = await Promise.all([rowsPromise, organizationPromise, personalPromise]);
  const rowDocs = Array.isArray(rows) ? rows : rows.docs;
  const data = rowDocs.map((item) => {
    const record = item.data();
    if (scope.role === 'ADMIN') return { ...record, id: item.id } as CommissionRate;
    if (scope.role === 'STAFF') return normalizeStaff(item.id, record as StaffRateReadModel);
    return normalizeAgent(item.id, record as AgentRateReadModel);
  });
  return {
    rows: data,
    organization: organization.map((item) => ({ ...item.data(), id: item.id } as AgentRateReadModel)),
    personal: personal.map((item) => ({ ...item.data(), id: item.id } as AgentRateReadModel)),
  };
}

async function collectDeltas(scopeNamesToSync: string[], cursors: Record<string, number>) {
  const nextCursors = { ...cursors };
  const latestDeltas = new Map<string, { scope: string; delta: RateDelta }>();
  for (const scopeName of scopeNamesToSync) {
    let cursor = cursors[scopeName] || 0;
    while (true) {
      const page = await readRateDeltas(scopeName, cursor);
      if (!page.length) break;
      for (const row of page) latestDeltas.set(`${scopeName}:${row.target}:${row.id}`, { scope: scopeName, delta: row });
      cursor = page[page.length - 1].sequence;
      if (page.length < 200) break;
    }
    nextCursors[scopeName] = cursor;
  }
  const deltas = await Promise.all(Array.from(latestDeltas.values(), ({ scope, delta }) => hydrateRateDelta(scope, delta)));
  return { deltas, cursors: nextCursors };
}

export async function syncLocalRateData(input: RateScope): Promise<RateSyncResult> {
  if (isQuotaOffline(input.uid)) throw new Error('Rate sync is paused while Firestore quota is limited.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw Object.assign(new Error('You are offline.'), { code: 'unavailable' });

  const names = scopeNames(input);
  const previous = await getLocalRateMetadata(input.uid);
  const sameScope = previous?.complete && previous.uid === input.uid && previous.role === input.role && previous.organizationId === input.organizationId;

  if (!sameScope) {
    const cursors = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await getFeedCursor(name)] as const)));
    const snapshot = await fetchRows(input);
    await replaceLocalRateSnapshot(input, snapshot.rows, snapshot.organization, snapshot.personal, cursors);
    const caughtUp = await collectDeltas(names, cursors);
    await applyLocalRateDeltas(input, caughtUp.deltas, caughtUp.cursors);
    const metadata = await getLocalRateMetadata(input.uid);
    return {
      rates: snapshot.rows,
      organizationOverrides: snapshot.organization,
      personalOverrides: snapshot.personal,
      lastSyncedAt: metadata?.lastSyncedAt || new Date().toISOString(),
      changed: true,
    };
  }

  const currentCursors = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await getFeedCursor(name)] as const)));
  if (names.every((name) => (previous.cursors[name] || 0) === currentCursors[name])) {
    await applyLocalRateDeltas(input, [], previous.cursors || {});
    const verified = await getLocalRateMetadata(input.uid);
    return {
      rates: [], organizationOverrides: [], personalOverrides: [],
      lastSyncedAt: verified?.lastSyncedAt || previous.lastSyncedAt, changed: false,
    };
  }
  const result = await collectDeltas(names, previous.cursors || {});
  await applyLocalRateDeltas(input, result.deltas, result.cursors);
  const metadata = await getLocalRateMetadata(input.uid);
  return {
    rates: [], organizationOverrides: [], personalOverrides: [],
    lastSyncedAt: metadata?.lastSyncedAt || new Date().toISOString(), changed: result.deltas.length > 0,
  };
}

export function scopeForUser(uid: string, role: UserRole, organizationId?: string): RateScope {
  return { uid, role, ...(role === 'AGENT' && organizationId ? { organizationId } : {}) };
}
