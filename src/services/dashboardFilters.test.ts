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

import type { ChatSearchIntent } from '../types/chat';
import { filtersFromChatIntent } from './dashboardFilters';

describe('filtersFromChatIntent', () => {
  it('clear search returns matching dashboard filters', () => {
    const intent: ChatSearchIntent = { schoolIds: ['u1'], country: 'UK', level: 'UG', intake: 'Jan 2026', aggregatorTerms: [], compare: false, compareSchoolIds: [] };
    expect(filtersFromChatIntent('STAFF', intent, createEmptyDashboardFilters())).toMatchObject({ schoolIds: ['u1'], countries: ['UK'], levels: ['UG'], intakes: ['Jan 2026'] });
  });
  it('Agent intent drops aggregator filters', () => {
    const intent: ChatSearchIntent = { schoolIds: [], aggregatorTerms: ['SI-UK'], compare: false, compareSchoolIds: [] };
    expect(filtersFromChatIntent('AGENT', intent, { ...createEmptyDashboardFilters(), aggregators: ['UAP'] }).aggregators).toEqual([]);
  });
});

describe('role boundary edge cases', () => {
  it('rejects records projected for a different role', () => {
    const agentRates = buildDashboardRates('AGENT', rates);
    expect(applyDashboardFilters('STAFF', agentRates, createEmptyDashboardFilters())).toEqual([]);
  });
  it('does not infer a payout fee type from a numeric chat bound', () => {
    const intent: ChatSearchIntent = { schoolIds: [], aggregatorTerms: [], rateMinimum: 10, compare: false, compareSchoolIds: [] };
    const next = filtersFromChatIntent('AGENT', intent, createEmptyDashboardFilters());
    expect(next.agentPayoutKind).toBeUndefined();
    expect(applyDashboardFilters('AGENT', buildDashboardRates('AGENT', rates), next)).toEqual([]);
  });
});
it('matches UK country aliases when Chat normalizes the location', () => {
  const unitedKingdom = [{ ...base, country: 'United Kingdom' }];
  const filtered = applyDashboardFilters('ADMIN', buildDashboardRates('ADMIN', unitedKingdom), { ...createEmptyDashboardFilters(), countries: ['UK'] });
  expect(filtered).toHaveLength(1);
});
