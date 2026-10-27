import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import type { CommissionRate } from '../types';
const { runTransaction, firestoreDoc, writeRateOperation, updatePendingRateOperation, finishLocalRateOperation, clearLocalSheetBuckets, updateRateSheetBucketsForMutations } = vi.hoisted(() => ({
  runTransaction: vi.fn(), firestoreDoc: vi.fn((_db: unknown, ...parts: string[]) => ({ id: parts.at(-1), path: parts.join('/') })),
  writeRateOperation: vi.fn(), updatePendingRateOperation: vi.fn(), finishLocalRateOperation: vi.fn(), clearLocalSheetBuckets: vi.fn(),
  updateRateSheetBucketsForMutations: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({ runTransaction, doc: firestoreDoc }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('./adminRateWriteService', () => ({ writeRateOperation, sanitizeFirestoreData: (data: unknown) => data }));
vi.mock('./localRateDatabase', () => ({ finishLocalRateOperation, clearLocalSheetBuckets }));
vi.mock('./rateReadModels', () => ({ updateRateSheetBucketsForMutations }));
vi.mock('./rateWriteQueue', () => ({ updatePendingRateOperation }));
import { syncRateOperation } from './rateWriteSyncService';

const cloud: CommissionRate = { id: 'rate-1', universityId: 'uni-1', universityName: 'University', intake: 'Sept 2027', aggregator: 'BASECHAN', studyLevel: 'UG', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' };
const operation: PendingRateOperation = { operationId: 'stable-op', uid: 'admin-1', adminEmail: 'admin@example.com', category: 'guidance', notify: true, status: 'pending', attemptCount: 0, createdAt: '', updatedAt: '', mutations: [{ kind: 'update', id: cloud.id, nextId: cloud.id, patch: { guidance: 'ALLOWED' }, baseFields: { guidance: 'FOCUS' }, baseSnapshot: cloud }] };
function mockTransaction(rate: CommissionRate | null = cloud, occupied: CommissionRate | null = null) {
  const reads = new Map<string, CommissionRate | null>([[cloud.id, rate], ['occupied-id', occupied]]);
  runTransaction.mockImplementation(async (_db, callback) => callback({
    get: async (ref: { id: string }) => ({ id: ref.id, exists: () => reads.get(ref.id) != null, data: () => reads.get(ref.id) || undefined }),
    set: vi.fn(), update: vi.fn(), delete: vi.fn(),
  }));
}

describe('syncRateOperation', () => {
  beforeEach(() => { vi.clearAllMocks(); mockTransaction(); writeRateOperation.mockResolvedValue({ operationId: 'stable-op', completed: 1 }); updateRateSheetBucketsForMutations.mockResolvedValue(undefined); });
  it('checks the base and commits canonical patch transactionally before completing projections', async () => {
    const result = await syncRateOperation(operation);
    expect(result).toBe('synced');
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(writeRateOperation).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'stable-op', canonicalAlreadyCommitted: true, mutations: [{ previous: cloud, next: { ...cloud, guidance: 'ALLOWED' } }] }));
    expect(updateRateSheetBucketsForMutations).toHaveBeenCalledWith([{ previous: cloud, next: { ...cloud, guidance: 'ALLOWED' } }], 'admin@example.com');
    expect(finishLocalRateOperation).toHaveBeenCalledWith('admin-1', 'stable-op', [{ ...cloud, guidance: 'ALLOWED' }]);
  });
  it('keeps the local operation pending if the shared rate-sheet cache cannot rebuild', async () => {
    updateRateSheetBucketsForMutations.mockRejectedValueOnce(new Error('rate sheet update failed'));
    await expect(syncRateOperation(operation)).rejects.toThrow('rate sheet update failed');
    expect(finishLocalRateOperation).not.toHaveBeenCalled();
    expect(updatePendingRateOperation).toHaveBeenLastCalledWith('admin-1', 'stable-op', expect.objectContaining({ status: 'failed' }));
  });
  it('overwrites edited cloud fields while preserving unrelated cloud changes', async () => {
    mockTransaction({ ...cloud, guidance: 'DO_NOT_USE', notes: 'changed in cloud' } as CommissionRate);
    const result = await syncRateOperation(operation);
    const merged = { ...cloud, guidance: 'ALLOWED', notes: 'changed in cloud' };
    expect(result).toBe('synced');
    expect(writeRateOperation).toHaveBeenCalledWith(expect.objectContaining({ canonicalAlreadyCommitted: true, mutations: [{ previous: { ...cloud, guidance: 'DO_NOT_USE', notes: 'changed in cloud' }, next: merged }] }));
    expect(updateRateSheetBucketsForMutations).toHaveBeenCalledWith([{ previous: { ...cloud, guidance: 'DO_NOT_USE', notes: 'changed in cloud' }, next: merged }], 'admin@example.com');
  });

  it('recreates a deleted rate from the saved edit instead of requiring Force Push', async () => {
    mockTransaction(null);
    const result = await syncRateOperation(operation);
    expect(result).toBe('synced');
    expect(writeRateOperation).toHaveBeenCalledWith(expect.objectContaining({
      mutations: [{ next: { ...cloud, guidance: 'ALLOWED' } }], canonicalAlreadyCommitted: true,
    }));
  });
  it('stops a re-key when the target ID already exists', async () => {
    mockTransaction(cloud, { ...cloud, id: 'occupied-id' });
    const rekey: PendingRateOperation = { ...operation, mutations: [{ kind: 'update', id: cloud.id, nextId: 'occupied-id', patch: { intake: 'Jan 2028' }, baseFields: { intake: cloud.intake }, baseSnapshot: cloud }] };
    const result = await syncRateOperation(rekey);
    expect(result).toBe('conflict');
    expect(updatePendingRateOperation).toHaveBeenCalledWith('admin-1', 'stable-op', expect.objectContaining({ status: 'conflict', conflicts: [expect.objectContaining({ id: 'occupied-id', reason: expect.stringContaining('already uses') })] }));
    expect(writeRateOperation).not.toHaveBeenCalled();
  });
});
