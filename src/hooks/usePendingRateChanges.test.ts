import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import { usePendingRateChanges } from './usePendingRateChanges';

const {
  getPendingRateOperations,
  updatePendingRateOperation,
  finishPendingRateOperation,
  discardPendingRateOperation,
  subscribeToLocalRateChanges,
  publishRateChangePackage,
  isRatePackagePublished,
} = vi.hoisted(() => ({
  getPendingRateOperations: vi.fn(),
  updatePendingRateOperation: vi.fn(),
  finishPendingRateOperation: vi.fn(),
  discardPendingRateOperation: vi.fn(),
  subscribeToLocalRateChanges: vi.fn(() => vi.fn()),
  publishRateChangePackage: vi.fn(),
  isRatePackagePublished: vi.fn(),
}));

vi.mock('../services/rateWriteQueue', () => ({
  getPendingRateOperations,
  updatePendingRateOperation,
  finishPendingRateOperation,
  discardPendingRateOperation,
}));

vi.mock('../services/localRateDatabase', () => ({
  subscribeToLocalRateChanges,
}));

vi.mock('../services/ratePackageService', () => ({
  publishRateChangePackage,
  isRatePackagePublished,
  partitionRatePackageOperations: (operations: PendingRateOperation[]) => ({
    batches: [operations],
    oversized: [],
  }),
}));

const operation: PendingRateOperation = {
  operationId: 'op-1',
  uid: 'admin',
  adminEmail: 'a@x',
  category: 'rates',
  notify: true,
  status: 'pending',
  attemptCount: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  mutations: [],
};

describe('usePendingRateChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPendingRateOperations.mockResolvedValue([operation]);
    publishRateChangePackage.mockResolvedValue(undefined);
    isRatePackagePublished.mockResolvedValue(false);
  });

  it('loads pending rate operations for Admin account', async () => {
    const { result } = renderHook(() => usePendingRateChanges('admin', true));
    await waitFor(() => expect(result.current.operations).toEqual([operation]));
  });

  it('keeps queue access disabled for other roles', async () => {
    const { result } = renderHook(() => usePendingRateChanges('staff', false));
    await act(async () => {});
    expect(getPendingRateOperations).not.toHaveBeenCalled();
    expect(result.current.operations).toEqual([]);
  });

  it('publishes selected changes and triggers onSyncOutcome when uploaded', async () => {
    const onSyncOutcome = vi.fn();
    const { result } = renderHook(() => usePendingRateChanges('admin', true, onSyncOutcome));

    await waitFor(() => expect(result.current.operations).toEqual([operation]));

    act(() => {
      result.current.selectChanges(['op-1']);
    });

    await act(async () => {
      await result.current.uploadSelected();
    });

    expect(publishRateChangePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'admin',
        operations: [operation],
      })
    );
    expect(finishPendingRateOperation).toHaveBeenCalledWith('admin', 'op-1', []);
    expect(onSyncOutcome).toHaveBeenCalledWith({ operationId: 'op-1', status: 'saved' });
  });

  it('reports failed uploads via onSyncOutcome', async () => {
    const onSyncOutcome = vi.fn();
    publishRateChangePackage.mockRejectedValueOnce(new Error('Network connection failed'));

    const { result } = renderHook(() => usePendingRateChanges('admin', true, onSyncOutcome));

    await waitFor(() => expect(result.current.operations).toEqual([operation]));

    act(() => {
      result.current.selectChanges(['op-1']);
    });

    await act(async () => {
      await result.current.uploadSelected();
    });

    expect(onSyncOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'op-1',
        status: 'failed',
      })
    );
  });

  it('discards selected operations when discard is called', async () => {
    const { result } = renderHook(() => usePendingRateChanges('admin', true));

    await waitFor(() => expect(result.current.operations).toEqual([operation]));

    await act(async () => {
      await result.current.discard(['op-1']);
    });

    expect(discardPendingRateOperation).toHaveBeenCalledWith('admin', 'op-1');
  });
});
