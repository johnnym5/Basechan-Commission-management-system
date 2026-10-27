import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionRate } from '../types';
import { getLocalRates, deleteLocalRateDatabase, finishLocalRateOperation, stageRatesToLocalDatabase, subscribeToLocalRateChanges } from './localRateDatabase';
import { getPendingRateOperations, stageRateOperation } from './rateWriteQueue';

const uid = 'local-write-admin';
const otherUid = 'local-write-other-admin';
const existingRate: CommissionRate = {
  id: 'alpha__sept_2027__basechan__pg', universityId: 'alpha', universityName: 'Alpha University',
  country: 'UK', intake: 'Sept 2027', aggregator: 'BASECHAN', studyLevel: 'PG', masterRate: 20,
  agentRate: 12, diffMargin: 8, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

beforeEach(async () => {
  await deleteLocalRateDatabase(uid);
  await deleteLocalRateDatabase(otherUid);
});
afterEach(async () => {
  await deleteLocalRateDatabase(uid);
  await deleteLocalRateDatabase(otherUid);
});

describe('local-first rate write queue', () => {
  it('confirms canonical values and removes the queue item in one local transaction', async () => {
    await stageRatesToLocalDatabase(uid, [existingRate]);
    await stageRateOperation(uid, {
      operationId: 'confirmed-edit', adminEmail: 'admin@example.com', category: 'guidance',
      mutations: [{ kind: 'update', id: existingRate.id, nextId: existingRate.id,
        patch: { guidance: 'ALLOWED' }, baseFields: { guidance: 'FOCUS' } }],
    });
    const canonical: CommissionRate = { ...existingRate, guidance: 'ALLOWED', updatedAt: '2026-10-19T00:00:00.000Z' };
    await finishLocalRateOperation(uid, 'confirmed-edit', [canonical]);
    expect(await getPendingRateOperations(uid)).toEqual([]);
    expect(await getLocalRates(uid)).toEqual([canonical]);
  });

  it('persists an edit and applies the optimistic rate atomically', async () => {
    await stageRatesToLocalDatabase(uid, [existingRate]);
    const operation = await stageRateOperation(uid, {
      operationId: 'edit-guidance-1', adminEmail: 'admin@example.com', category: 'guidance',
      mutations: [{ kind: 'update', id: existingRate.id, nextId: existingRate.id,
        patch: { guidance: 'ALLOWED' }, baseFields: { guidance: 'FOCUS' } }],
    });

    expect(operation.status).toBe('pending');
    expect((await getPendingRateOperations(uid)).map((item) => item.operationId)).toEqual(['edit-guidance-1']);
    expect((await getLocalRates(uid)).find((rate) => rate.id === existingRate.id)?.guidance).toBe('ALLOWED');
  });

  it('preserves the full edited rate when the admin rate store only has sheet buckets', async () => {
    await stageRateOperation(uid, {
      operationId: 'edit-with-bucket-cache-only', adminEmail: 'admin@example.com', category: 'routing',
      mutations: [{ kind: 'update', id: existingRate.id, nextId: existingRate.id,
        patch: { aggregator: 'SI-UK', masterRate: 30 },
        baseFields: { aggregator: 'BASECHAN', masterRate: 20 }, baseSnapshot: existingRate }],
    });

    expect(await getLocalRates(uid)).toEqual([{ ...existingRate, aggregator: 'SI-UK', masterRate: 30 }]);
  });

  it('keeps queued operations isolated by Admin UID', async () => {
    await stageRateOperation(uid, {
      operationId: 'admin-a-create', adminEmail: 'a@example.com', category: 'intake',
      mutations: [{ kind: 'create', next: existingRate }],
    });

    expect(await getPendingRateOperations(otherUid)).toEqual([]);
    expect(await getLocalRates(otherUid)).toEqual([]);
  });

  it('coalesces repeated pending edits and preserves the first conflict base', async () => {
    await stageRatesToLocalDatabase(uid, [existingRate]);
    await stageRateOperation(uid, {
      operationId: 'first-edit', adminEmail: 'admin@example.com', category: 'guidance',
      mutations: [{ kind: 'update', id: existingRate.id, nextId: existingRate.id,
        patch: { guidance: 'ALLOWED' }, baseFields: { guidance: 'FOCUS' } }],
    });
    await stageRateOperation(uid, {
      operationId: 'second-edit', adminEmail: 'admin@example.com', category: 'guidance',
      mutations: [{ kind: 'update', id: existingRate.id, nextId: existingRate.id,
        patch: { guidance: 'DO_NOT_USE' }, baseFields: { guidance: 'ALLOWED' } }],
    });

    const pending = await getPendingRateOperations(uid);
    expect(pending).toHaveLength(1);
    expect(pending[0].operationId).toBe('first-edit');
    expect(pending[0].mutations).toEqual([expect.objectContaining({
      kind: 'update', baseFields: { guidance: 'FOCUS' }, patch: { guidance: 'DO_NOT_USE' },
    })]);
    expect((await getLocalRates(uid))[0].guidance).toBe('DO_NOT_USE');
  });

  it('cancels a locally created rate when it is deleted before sync', async () => {
    await stageRateOperation(uid, {
      operationId: 'create-then-delete', adminEmail: 'admin@example.com', category: 'intake',
      mutations: [{ kind: 'create', next: existingRate }],
    });
    await stageRateOperation(uid, {
      operationId: 'delete-unsynced-create', adminEmail: 'admin@example.com', category: 'rates',
      mutations: [{ kind: 'delete', id: existingRate.id, baseFingerprint: 'not-used-for-local-create' }],
    });

    expect(await getPendingRateOperations(uid)).toEqual([]);
    expect(await getLocalRates(uid)).toEqual([]);
  });

  it('rekeys the local snapshot atomically when an ID-defining field changes', async () => {
    await stageRatesToLocalDatabase(uid, [existingRate]);
    const nextId = 'alpha__jan_2028__basechan__pg';
    await stageRateOperation(uid, {
      operationId: 'rekey-intake', adminEmail: 'admin@example.com', category: 'intake',
      mutations: [{ kind: 'update', id: existingRate.id, nextId,
        patch: { id: nextId, intake: 'Jan 2028' }, baseFields: { intake: 'Sept 2027' } }],
    });

    expect(await getLocalRates(uid)).toEqual([expect.objectContaining({ id: nextId, intake: 'Jan 2028' })]);
  });

  it('does not leave a queue entry or optimistic rate if IndexedDB rejects the package', async () => {
    const invalidRate = { ...existingRate, unexpected: () => 'not cloneable' } as unknown as CommissionRate;
    await expect(stageRateOperation(uid, {
      operationId: 'invalid-create', adminEmail: 'admin@example.com', category: 'intake',
      mutations: [{ kind: 'create', next: invalidRate }],
    })).rejects.toBeTruthy();

    expect(await getPendingRateOperations(uid)).toEqual([]);
    expect(await getLocalRates(uid)).toEqual([]);
  });

  it('announces local snapshot changes to subscribers for the same UID', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLocalRateChanges(uid, listener);
    await stageRateOperation(uid, {
      operationId: 'notify-local-view', adminEmail: 'admin@example.com', category: 'intake',
      mutations: [{ kind: 'create', next: existingRate }],
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});







