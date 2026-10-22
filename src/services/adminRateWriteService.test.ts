import { describe, expect, it } from 'vitest';
import type { CommissionRate } from '../types';
import { buildRateFieldPatch, buildRateWriteNotice, computeRateFingerprint } from './adminRateWriteService';

const rate = (id: string, universityId: string, universityName: string): CommissionRate => ({
  id,
  universityId,
  universityName,
  intake: 'Sept 2027',
  aggregator: 'Route A',
  studyLevel: 'PG',
  masterRate: 20,
  agentRate: 12,
  diffMargin: 8,
  isFlatFee: false,
  netOrGross: 'GROSS',
  guidance: 'FOCUS',
});

describe('grouped Admin rate change notices', () => {
  it('summarizes all changed routes under unique affected schools', () => {
    const notice = buildRateWriteNotice([
      { next: rate('one-pg', 'one', 'One University') },
      { next: rate('one-ug', 'one', 'One University') },
      { next: rate('two-pg', 'two', 'Two University') },
    ], 'guidance');

    expect(notice.rates).toHaveLength(3);
    expect(notice.summary).toContain('School guidance changed to FOCUS.');
    expect(new Set(notice.rates.map((item) => item.universityId)).size).toBe(2);
  });

  it('does not include values that differ by role in the notice copy', () => {
    const notice = buildRateWriteNotice([{ next: { ...rate('one-pg', 'one', 'One University'), agentRate: 99, aggregator: 'Private Route' } }], 'rates');
    expect(notice.summary).not.toContain('99');
    expect(notice.summary).not.toContain('Private Route');
  });
});

describe('compact canonical rate patches', () => {
  it('contains only fields changed by a same-ID edit', () => {
    const before = rate('same-id', 'uni', 'University');
    const after = { ...before, guidance: 'ALLOWED' as const, updatedAt: 'now' };
    expect(buildRateFieldPatch(before, after)).toEqual({ guidance: 'ALLOWED', updatedAt: 'now' });
  });

  it('produces deterministic rate fingerprints ignoring volatile timestamps and key order', () => {
    const rateA: CommissionRate = { ...rate('id1', 'u1', 'Uni'), updatedAt: '2026-03-31T10:00:00.000Z' };
    const rateB: CommissionRate = { ...rate('id1', 'u1', 'Uni'), updatedAt: '2026-03-31T12:34:56.789Z' };
    expect(computeRateFingerprint(rateA)).toBe(computeRateFingerprint(rateB));
  });
});
