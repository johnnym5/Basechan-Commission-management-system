import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionRate, RateSheetBucket } from '../types';

const { runTransaction, firestoreDoc } = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  firestoreDoc: vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id, path: `${collectionName}/${id}` })),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), collectionGroup: vi.fn(), deleteDoc: vi.fn(), deleteField: vi.fn(), doc: firestoreDoc,
  getDoc: vi.fn(), getDocs: vi.fn(), query: vi.fn(), runTransaction, setDoc: vi.fn(), writeBatch: vi.fn(),
}));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('./adminRateWriteService', () => ({ sanitizeFirestoreData: (value: unknown) => value }));
vi.mock('./accessRequestService', () => ({ normalizeOrganizationName: vi.fn() }));
vi.mock('./userUpdates', () => ({ publishRelevantUpdates: vi.fn() }));
vi.mock('../utils/auditLogger', () => ({ logRateChange: vi.fn() }));
vi.mock('./rateChangeFeed', () => ({ appendRateDelta: vi.fn() }));
vi.mock('./firestoreWriteGuard', () => ({ assertFirestoreWritesAllowed: vi.fn() }));

import { updateRateSheetBucketsForMutations } from './rateReadModels';

const rate = (id: string, intake: string, value: number): CommissionRate => ({
  id, universityId: id, universityName: id, intake, sourceSheet: intake, studyLevel: 'UG', aggregator: 'BASECHAN',
  masterRate: value, agentRate: value, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS',
});

describe('targeted rate sheet bucket updates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates only affected existing buckets and preserves unrelated routes', async () => {
    const oldRate = rate('old', 'Sept 2027', 8);
    const sibling = rate('sibling', 'Sept 2027', 5);
    const target = rate('new', 'Jan 2028', 11);
    const buckets = new Map<string, RateSheetBucket>([
      ['rate_sheets/sept_2027', { sheetKey: 'sept_2027', sheetName: 'Sept 2027', rateCount: 2, updatedAt: '', updatedBy: '', rates: [oldRate, sibling] }],
      ['rate_sheets/jan_2028', { sheetKey: 'jan_2028', sheetName: 'Jan 2028', rateCount: 1, updatedAt: '', updatedBy: '', rates: [rate('another', 'Jan 2028', 6)] }],
    ]);
    const reads: string[] = [];
    const writes: Array<{ path: string; value: unknown }> = [];
    runTransaction.mockImplementation(async (_db, callback) => callback({
      get: async (ref: { path: string }) => {
        reads.push(ref.path);
        const value = buckets.get(ref.path);
        return { exists: () => Boolean(value), data: () => value };
      },
      set: (ref: { path: string }, value: unknown) => writes.push({ path: ref.path, value }),
    }));

    await updateRateSheetBucketsForMutations([{ previous: oldRate, next: target }], 'admin@example.com');

    expect(reads).toEqual(['rate_sheets/sept_2027', 'rate_sheets/jan_2028']);
    expect(reads).not.toContain('rate_sheets/unrelated');
    const septWrite = writes.find((write) => write.path === 'rate_sheets/sept_2027')?.value as RateSheetBucket;
    const janWrite = writes.find((write) => write.path === 'rate_sheets/jan_2028')?.value as RateSheetBucket;
    expect(septWrite.rates.map((item) => item.id)).toEqual(['sibling']);
    expect(janWrite.rates.map((item) => item.id)).toEqual(['another', 'new']);
    expect(janWrite.rateCount).toBe(2);
    expect(writes.filter((write) => write.path.startsWith('rate_sheets/'))).toHaveLength(2);
  });

  it('does not create an incomplete bucket when the target sheet has not been bootstrapped', async () => {
    const created = rate('new', 'New Intake', 11);
    const writes: string[] = [];
    runTransaction.mockImplementation(async (_db, callback) => callback({
      get: async () => ({ exists: () => false, data: () => undefined }),
      set: (ref: { path: string }) => writes.push(ref.path),
    }));
    await updateRateSheetBucketsForMutations([{ next: created }]);
    expect(writes).not.toContain('rate_sheets/new_intake');
    expect(writes).toContain('settings/system_config');
  });
});
