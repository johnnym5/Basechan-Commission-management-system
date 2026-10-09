import { describe, expect, it } from 'vitest';
import { buildRateDeltaFeedRecord } from './rateChangeFeed';

describe('rate change feed records', () => {
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
});
