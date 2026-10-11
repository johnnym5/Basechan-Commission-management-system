import { describe, it, expect } from 'vitest';
import type { CommissionRate } from '../types';
import {
  formatCommissionValue,
  formatCommissionDifference,
  formatMasterCommission,
  formatAgentCommission,
  formatNetMargin,
  compareCommissionRates,
} from './commissionFormatter';

const sampleRate = (overrides: Partial<CommissionRate> = {}): CommissionRate => ({
  id: 'r1',
  universityId: 'u1',
  universityName: 'Sample University',
  intake: 'Jan 2026',
  studyLevel: 'PG',
  aggregator: 'SI-UK',
  masterRate: 15,
  agentRate: 10,
  diffMargin: 5,
  isFlatFee: false,
  netOrGross: 'GROSS',
  guidance: 'ALLOWED',
  ...overrides,
});

describe('commissionFormatter', () => {
  describe('formatCommissionValue', () => {
    it('formats percentage values correctly with % suffix', () => {
      expect(formatCommissionValue(15, false)).toBe('15%');
      expect(formatCommissionValue(12.5, false)).toBe('12.5%');
    });

    it('formats flat fee values correctly with currency symbol and student suffix without %', () => {
      expect(formatCommissionValue(1500, true)).toBe('£1,500 per eligible student');
      expect(formatCommissionValue(2000, true, '$')).toBe('$2,000 per eligible student');
    });

    it('handles NaN, null, and undefined values gracefully', () => {
      expect(formatCommissionValue(null, false)).toBe('N/A');
      expect(formatCommissionValue(undefined, true)).toBe('N/A');
      expect(formatCommissionValue(NaN, false)).toBe('N/A');
    });
  });

  describe('formatCommissionDifference', () => {
    it('formats percentage differences as percentage points', () => {
      expect(formatCommissionDifference(5, false)).toBe('+5 percentage points');
      expect(formatCommissionDifference(4, false)).toBe('+4 percentage points');
      expect(formatCommissionDifference(-2, false)).toBe('-2 percentage points');
    });

    it('formats flat fee differences as monetary amounts', () => {
      expect(formatCommissionDifference(500, true)).toBe('+£500 per eligible student');
      expect(formatCommissionDifference(750, true)).toBe('+£750 per eligible student');
    });
  });

  describe('formatMasterCommission, formatAgentCommission, formatNetMargin', () => {
    it('formats master commission for Admin', () => {
      const rate = sampleRate({ masterRate: 15, isFlatFee: false });
      expect(formatMasterCommission(rate)).toBe('15%');
    });

    it('formats agent commission based on role', () => {
      const rate = sampleRate({ agentRate: 10, isFlatFee: false });
      expect(formatAgentCommission(rate, 'AGENT')).toBe('10%');
      expect(formatAgentCommission(rate, 'ADMIN')).toBe('10%');
      expect(formatAgentCommission(rate, 'STAFF')).toBe('N/A (Staff View)');
    });

    it('formats net margin for Admin', () => {
      const rate = sampleRate({ diffMargin: 5, isFlatFee: false });
      expect(formatNetMargin(rate)).toBe('+5 percentage points');
    });
  });

  describe('compareCommissionRates', () => {
    it('compares compatible percentage rates successfully', () => {
      const rateA = sampleRate({ diffMargin: 5, agentRate: 10 });
      const rateB = sampleRate({ diffMargin: 3, agentRate: 8 });
      const result = compareCommissionRates(rateA, rateB);
      expect(result.isComparable).toBe(true);
      expect(result.diffMarginDifference).toBe(2);
      expect(result.agentPayoutDifference).toBe(2);
    });

    it('compares compatible flat fee rates successfully', () => {
      const rateA = sampleRate({ isFlatFee: true, diffMargin: 500, agentRate: 1000 });
      const rateB = sampleRate({ isFlatFee: true, diffMargin: 300, agentRate: 800 });
      const result = compareCommissionRates(rateA, rateB);
      expect(result.isComparable).toBe(true);
      expect(result.diffMarginDifference).toBe(200);
      expect(result.agentPayoutDifference).toBe(200);
    });

    it('rejects comparisons between percentage rates and flat fee rates', () => {
      const rateA = sampleRate({ isFlatFee: false });
      const rateB = sampleRate({ isFlatFee: true });
      const result = compareCommissionRates(rateA, rateB);
      expect(result.isComparable).toBe(false);
      expect(result.reason).toContain('Incompatible units');
    });

    it('rejects comparisons between GROSS and NET tuition bases', () => {
      const rateA = sampleRate({ netOrGross: 'GROSS' });
      const rateB = sampleRate({ netOrGross: 'NET' });
      const result = compareCommissionRates(rateA, rateB);
      expect(result.isComparable).toBe(false);
      expect(result.reason).toContain('Calculation basis mismatch');
    });
  });
});
