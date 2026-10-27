import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingRateOperation } from '../types/rateWriteQueue';

const { getPendingRateOperations, updatePendingRateOperation, discardPendingRateOperation, syncRateOperation, resolveRateOperationConflict, subscribeToLocalRateChanges } = vi.hoisted(() => ({
  getPendingRateOperations: vi.fn(), updatePendingRateOperation: vi.fn(), discardPendingRateOperation: vi.fn(),
  syncRateOperation: vi.fn(), resolveRateOperationConflict: vi.fn(), subscribeToLocalRateChanges: vi.fn(() => vi.fn()),
}));
vi.mock('../services/rateWriteQueue', () => ({ getPendingRateOperations, updatePendingRateOperation, discardPendingRateOperation }));
vi.mock('../services/rateWriteSyncService', () => ({ syncRateOperation, resolveRateOperationConflict }));
vi.mock('../services/localRateDatabase', () => ({ subscribeToLocalRateChanges }));
vi.mock('../services/firestoreOfflineMode', () => ({ isQuotaOffline: vi.fn(() => false), getQuotaRetryAt: vi.fn(() => 0) }));
import { usePendingRateChanges } from './usePendingRateChanges';

const operation: PendingRateOperation = { operationId: 'op', uid: 'admin', adminEmail: 'a@x', category: 'rates', notify: true, status: 'pending', attemptCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01', mutations: [] };
describe('usePendingRateChanges', () => {
  beforeEach(() => { vi.clearAllMocks(); getPendingRateOperations.mockResolvedValue([operation]); syncRateOperation.mockResolvedValue('synced'); });
  it('loads and flushes pending operations for the Admin account', async () => {
    const { result } = renderHook(() => usePendingRateChanges('admin', true));
    await waitFor(() => expect(syncRateOperation).toHaveBeenCalledWith(operation));
    expect(result.current.operations).toEqual([operation]);
  });
  it('keeps queue access disabled for other roles', async () => {
    const { result } = renderHook(() => usePendingRateChanges('staff', false));
    await act(async () => {});
    expect(getPendingRateOperations).not.toHaveBeenCalled();
    expect(result.current.operations).toEqual([]);
  });

  it('reports a saved outcome only after the sync operation succeeds', async () => {
    const onSyncOutcome = vi.fn();
    renderHook(() => usePendingRateChanges('admin', true, onSyncOutcome));
    await waitFor(() => expect(onSyncOutcome).toHaveBeenCalledWith({ operationId: 'op', status: 'saved' }));
  });

  it('reports failed syncs so the UI can show the rollback toast', async () => {
    const onSyncOutcome = vi.fn();
    syncRateOperation.mockRejectedValueOnce(Object.assign(new Error('Network unavailable'), { canonicalCommitted: false }));
    renderHook(() => usePendingRateChanges('admin', true, onSyncOutcome));
    await waitFor(() => expect(onSyncOutcome).toHaveBeenCalledWith({ operationId: 'op', status: 'failed', error: 'Network unavailable' }));
  });

  it('rebases a conflicted edit onto the latest cloud values when retrying', async () => {
    const conflictedOperation: PendingRateOperation = { ...operation, status: 'conflict', conflicts: [{ mutationIndex: 0, id: 'rate', reason: 'Cloud value changed.' }] };
    getPendingRateOperations.mockImplementation(async () => [conflictedOperation]);
    resolveRateOperationConflict.mockImplementation(async (_uid, _operationId, resolution) => {
      expect(resolution).toBe('apply-local');
      conflictedOperation.status = 'pending';
    });
    const { result } = renderHook(() => usePendingRateChanges('admin', true));
    await waitFor(() => expect(result.current.operations[0]?.status).toBe('conflict'));

    await act(async () => { await result.current.retry('op'); });

    expect(resolveRateOperationConflict).toHaveBeenCalledWith('admin', 'op', 'apply-local');
    expect(syncRateOperation).toHaveBeenCalledWith(conflictedOperation);
  });
});




