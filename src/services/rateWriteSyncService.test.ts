import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import type { CommissionRate } from '../types';
const { runTransaction, firestoreDoc, writeRateOperation, updatePendingRateOperation, finishLocalRateOperation, clearLocalSheetBuckets, partitionMasterIntoRateSheets } = vi.hoisted(() => ({
  runTransaction: vi.fn(), firestoreDoc: vi.fn((_db: unknown, ...parts: string[]) => ({ id: parts.at(-1), path: parts.join('/') })),
  writeRateOperation: vi.fn(), updatePendingRateOperation: vi.fn(), finishLocalRateOperation: vi.fn(), clearLocalSheetBuckets: vi.fn(),
  partitionMasterIntoRateSheets: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({ runTransaction, doc: firestoreDoc }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('./adminRateWriteService', () => ({ writeRateOperation, sanitizeFirestoreData: (data: unknown) => data }));
vi.mock('./localRateDatabase', () => ({ finishLocalRateOperation, clearLocalSheetBuckets }));
vi.mock('./rateReadModels', () => ({ partitionMasterIntoRateSheets }));
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
  beforeEach(() => { vi.clearAllMocks(); mockTransaction(); writeRateOperation.mockResolvedValue({ operationId: 'stable-op', completed: 1 }); partitionMasterIntoRateSheets.mockResolvedValue(1); });
  it('checks the base and commits canonical patch transactionally before completing projections', async () => {
    const result = await syncRateOperation(operation);
    expect(result).toBe('synced');
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(writeRateOperation).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'stable-op', canonicalAlreadyCommitted: true, mutations: [{ previous: cloud, next: { ...cloud, guidance: 'ALLOWED' } }] }));
    expect(partitionMasterIntoRateSheets).toHaveBeenCalledWith('admin@example.com');
    expect(finishLocalRateOperation).toHaveBeenCalledWith('admin-1', 'stable-op', [{ ...cloud, guidance: 'ALLOWED' }]);
  });
  it('keeps the local operation pending if the shared rate-sheet cache cannot rebuild', async () => {
    partitionMasterIntoRateSheets.mockRejectedValueOnce(new Error('rate sheet update failed'));
    await expect(syncRateOperation(operation)).rejects.toThrow('rate sheet update failed');
    expect(finishLocalRateOperation).not.toHaveBeenCalled();
    expect(updatePendingRateOperation).toHaveBeenLastCalledWith('admin-1', 'stable-op', expect.objectContaining({ status: 'failed' }));
  });
  it('preserves the package and reports a conflict when a target field changed in cloud', async () => {
    mockTransaction({ ...cloud, guidance: 'DO_NOT_USE' });
    const result = await syncRateOperation(operation);
    expect(result).toBe('conflict');
    expect(writeRateOperation).not.toHaveBeenCalled();
    expect(updatePendingRateOperation).toHaveBeenCalledWith('admin-1', 'stable-op', expect.objectContaining({ status: 'conflict', conflicts: [expect.objectContaining({ id: cloud.id })] }));
  });
  it('stops a re-key when the target ID already exists', async () => {
    mockTransaction(cloud, { ...cloud, id: 'occupied-id' });
    const rekey: PendingRateOperation = { ...operation, mutations: [{ kind: 'update', id: cloud.id, nextId: 'occupied-id', patch: { intake: 'Jan 2028' }, baseFields: { intake: cloud.intake }, baseSnapshot: cloud }] };
    const result = await syncRateOperation(rekey);
    expect(result).toBe('conflict');
    expect(updatePendingRateOperation).toHaveBeenCalledWith('admin-1', 'stable-op', expect.objectContaining({ status: 'conflict', conflicts: [expect.objectContaining({ id: 'occupied-id', reason: expect.stringContaining('already exists') })] }));
    expect(writeRateOperation).not.toHaveBeenCalled();
  });
});
