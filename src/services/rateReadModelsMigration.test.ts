import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionRate } from '../types';
import { ensureRoleRateModelMigration } from './rateReadModels';

const mocks = vi.hoisted(() => ({
  doc: vi.fn((...parts: unknown[]) => ({ path: parts.slice(1).join('/') })),
  collection: vi.fn((...parts: unknown[]) => ({ path: parts.slice(1).join('/') })),
  collectionGroup: vi.fn((name: string) => ({ path: `**/${name}` })),
  getDoc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [], empty: true }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  batchSets: [] as Array<{ path: string; data: unknown }>,
  batchDeletes: [] as string[],
}));

vi.mock('../lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'admin' } } }));
vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  collectionGroup: mocks.collectionGroup,
  deleteDoc: vi.fn(),
  deleteField: vi.fn(() => '__delete__'),
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  query: vi.fn((value) => value),
  setDoc: mocks.setDoc,
  writeBatch: vi.fn(() => ({
    set: (ref: { path: string }, data: unknown) => mocks.batchSets.push({ path: ref.path, data }),
    delete: (ref: { path: string }) => mocks.batchDeletes.push(ref.path),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock('./firestoreWriteGuard', () => ({ assertFirestoreWritesAllowed: vi.fn() }));

const sample = (aggregator: string, id: string): CommissionRate => ({
  id,
  universityId: 'u1',
  universityName: 'Example University',
  country: 'UK',
  intake: 'Sept 2026',
  aggregator,
  studyLevel: 'UG',
  masterRate: 20,
  agentRate: 8,
  diffMargin: 12,
  isFlatFee: false,
  netOrGross: 'GROSS',
});

describe('role rate model migration v3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.batchSets.length = 0;
    mocks.batchDeletes.length = 0;
    mocks.getDocs.mockResolvedValue({ docs: [], empty: true });
    mocks.getDoc.mockImplementation(async (ref: { path: string }) => ref.path === 'admin_migrations/role-rate-models-v3'
      ? { exists: () => false, get: () => undefined }
      : { exists: () => false, get: () => undefined });
  });

  it('rebuilds Agent defaults from Basechan payouts and excludes third-party routes', async () => {
    await ensureRoleRateModelMigration([sample('SI-UK', 'third-party'), sample('Basechan Direct', 'basechan')], 'admin@example.com');
    const writtenAgentRows = mocks.batchSets.filter((write) => write.path.startsWith('agent_rates/'));
    expect(new Set(writtenAgentRows.map((write) => write.path)).size).toBe(1);
    expect(writtenAgentRows.every((write) => !write.path.includes('third-party'))).toBe(true);
    expect(mocks.doc).toHaveBeenCalledWith({}, 'admin_migrations', 'role-rate-models-v3');
  });

  it('does not rerun a completed v3 migration', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, get: (key: string) => key === 'status' ? 'complete' : undefined });
    await expect(ensureRoleRateModelMigration([], 'admin@example.com')).resolves.toEqual({ migrated: false, prunedOrganizationDefaults: 0 });
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});
