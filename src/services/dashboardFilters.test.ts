import { describe, expect, it } from 'vitest';
import type { CommissionRate } from '../types';
import type { DashboardRate } from '../types/dashboard';
import { applyDashboardFilters, createEmptyDashboardFilters } from './dashboardFilters';
import { buildDashboardRates } from './dashboardData';

const base: CommissionRate = {
  id: '1', universityId: 'u1', universityName: 'Alpha School', country: 'UK', intake: 'Jan 2026', aggregator: 'SI-UK',
  studyLevel: 'UG', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS',
};
const rates = [base, { ...base, id: '2', universityId: 'u2', universityName: 'Beta College', country: 'Ghana', aggregator: 'UAP', agentRate: 500, isFlatFee: true, guidance: 'ALLOWED' as const }];

describe('applyDashboardFilters', () => {
  it('applyDashboardFilters combines common filters', () => {
    const filters = { ...createEmptyDashboardFilters(), query: 'alpha', countries: ['UK'], levels: ['UG'] };
    expect(applyDashboardFilters('ADMIN', buildDashboardRates('ADMIN', rates), filters)).toHaveLength(1);
  });
  it('Staff filters include portal while excluding payout', () => {
    const filters = { ...createEmptyDashboardFilters(), aggregators: ['SI-UK'], payoutMinimum: 999 };
    expect(applyDashboardFilters('STAFF', buildDashboardRates('STAFF', rates), filters)).toHaveLength(1);
  });
  it('Agent filters include payout but exclude aggregator', () => {
    const filters = { ...createEmptyDashboardFilters(), aggregators: ['UAP'], agentPayoutKind: 'PERCENTAGE' as const, payoutMinimum: 5, payoutMaximum: 20 };
    expect(applyDashboardFilters('AGENT', buildDashboardRates('AGENT', rates), filters)).toHaveLength(1);
  });
  it('Agent payout range stays within selected fee type', () => {
    const agentRates = buildDashboardRates('AGENT', rates) as DashboardRate[];
    const percent = applyDashboardFilters('AGENT', agentRates, { ...createEmptyDashboardFilters(), agentPayoutKind: 'PERCENTAGE', payoutMinimum: 5, payoutMaximum: 20 });
    const missingType = applyDashboardFilters('AGENT', agentRates, { ...createEmptyDashboardFilters(), payoutMinimum: 5 });
    expect(percent.map(rate => rate.id)).toEqual(['1']);
    expect(missingType).toEqual([]);
  });
});
