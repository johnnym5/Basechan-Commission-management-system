import { beforeEach, describe, expect, it, vi } from 'vitest';
const { getDocFromServer, firestoreDoc } = vi.hoisted(() => ({
  getDocFromServer: vi.fn(), firestoreDoc: vi.fn((_db: unknown, ...parts: string[]) => parts.join('/')),
}));
vi.mock('firebase/firestore', () => ({ getDocFromServer, doc: firestoreDoc }));
vi.mock('../lib/firebase', () => ({ db: {} }));
import { buildRateDeltaFeedRecord, hydrateRateDelta } from './rateChangeFeed';

describe('rate change feed records', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores only a pointer and never snapshots role-sensitive rate values', () => {
    const record = buildRateDeltaFeedRecord('agent', {
      operationId: 'operation-1',
      kind: 'upsert',
      id: 'opaque-rate-id',
      target: 'rates',
      record: {
        id: 'rate-1', universityId: 'university-1', universityName: 'Example University',
        intake: 'Jan 2027', studyLevel: 'PG', aggregator: '', masterRate: 0,
        agentRate: 23, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS',
      },
    }, 12, '2026-10-09T15:00:00.000Z');

    expect(record).toEqual({
      operationId: 'operation-1',
      kind: 'upsert',
      id: 'opaque-rate-id',
      target: 'rates',
      sequence: 12,
      scope: 'agent',
      createdAt: '2026-10-09T15:00:00.000Z',
    });
    expect(record).not.toHaveProperty('record');
  });

  it('uses the canonical record embedded in an Admin delta without another document read', async () => {
    const canonical = {
      id: 'rate-1', universityId: 'university-1', universityName: 'Example University',
      intake: 'Jan 2027', studyLevel: 'PG', aggregator: 'BASECHAN', masterRate: 20,
      agentRate: 12, diffMargin: 8, isFlatFee: false, netOrGross: 'GROSS',
    } as const;
    const delta = { sequence: 13, operationId: 'op-2', kind: 'upsert' as const, id: 'rate-1', target: 'rates' as const, record: canonical };

    await expect(hydrateRateDelta('admin', delta)).resolves.toEqual(delta);
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  it('still hydrates Staff projection deltas without embedded records', async () => {
    getDocFromServer.mockResolvedValue({ exists: () => true, id: 'safe-rate', data: () => ({ universityName: 'Safe University' }) });
    const delta = { sequence: 14, operationId: 'op-3', kind: 'upsert' as const, id: 'safe-rate', target: 'rates' as const };

    await expect(hydrateRateDelta('staff', delta)).resolves.toMatchObject({ record: { id: 'safe-rate', universityName: 'Safe University' } });
    expect(firestoreDoc).toHaveBeenCalledWith({}, 'staff_rates', 'safe-rate');
  });
});
