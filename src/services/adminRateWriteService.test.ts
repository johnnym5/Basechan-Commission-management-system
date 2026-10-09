import { describe, expect, it } from 'vitest';
import type { CommissionRate } from '../types';
import { buildRateWriteNotice } from './adminRateWriteService';

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
