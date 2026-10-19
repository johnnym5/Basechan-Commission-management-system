import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deleteLocalRateDatabase, stageRatesToLocalDatabase } from './localRateDatabase';
import { getPendingRateOperations, stageRateOperation, updatePendingRateOperation } from './rateWriteQueue';
import type { CommissionRate } from '../types';

const rate: CommissionRate = {
  id: 'test-rate', universityId: 'test', universityName: 'Test University', intake: 'Sept 2027',
  aggregator: 'BASECHAN', studyLevel: 'UG', masterRate: 10, agentRate: 5, diffMargin: 5,
  isFlatFee: false, netOrGross: 'GROSS',
};
const uid = 'operation-status-admin';

describe('local rate operation status', () => {
  it('updates state without changing the operation ID', async () => {
    await deleteLocalRateDatabase(uid);
    await stageRatesToLocalDatabase(uid, [rate]);
    await stageRateOperation(uid, {
      operationId: 'stable-status-id', adminEmail: 'admin@example.com',
      mutations: [{ kind: 'update', id: rate.id, nextId: rate.id, patch: { guidance: 'FOCUS' }, baseFields: {} }],
    });

    await updatePendingRateOperation(uid, 'stable-status-id', { status: 'quota-paused', attemptCount: 1, lastError: 'quota' });
    const [stored] = await getPendingRateOperations(uid);

    expect(stored).toMatchObject({ operationId: 'stable-status-id', status: 'quota-paused', attemptCount: 1, lastError: 'quota' });
    await deleteLocalRateDatabase(uid);
  });
});

