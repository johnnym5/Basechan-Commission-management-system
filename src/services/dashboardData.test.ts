import { describe, expect, it } from 'vitest';
import type { CommissionRate, UserRole } from '../types';
import { buildDashboardRates } from './dashboardData';

const rate: CommissionRate = {
  id: 'school-jan-siuk-UG', universityId: 'school', universityName: 'Example School', country: 'UK',
  intake: 'Jan 2026', aggregator: 'SI-UK', studyLevel: 'UG', masterRate: 20, agentRate: 10,
  diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS',
};

describe('buildDashboardRates', () => {
  it('buildDashboardRates omits financial fields for Staff', () => {
    const [staff] = buildDashboardRates('STAFF' satisfies UserRole, [rate]);
    expect(staff).not.toHaveProperty('masterRate');
    expect(staff).not.toHaveProperty('agentRate');
    expect(staff).not.toHaveProperty('diffMargin');
    expect(staff).toMatchObject({ role: 'STAFF', aggregator: 'SI-UK', universityName: 'Example School' });
  });
  it('buildDashboardRates omits Admin margin and aggregator for Agent', () => {
    const [agent] = buildDashboardRates('AGENT', [rate]);
    expect(agent).not.toHaveProperty('masterRate');
    expect(agent).not.toHaveProperty('diffMargin');
    expect(agent).not.toHaveProperty('aggregator');
    expect(agent).toMatchObject({ role: 'AGENT', agentRate: 10, isFlatFee: false });
  });
  it('buildDashboardRates retains full fields for Admin', () => {
    const [admin] = buildDashboardRates('ADMIN', [rate]);
    expect(admin).toMatchObject({ role: 'ADMIN', masterRate: 20, agentRate: 10, diffMargin: 10, aggregator: 'SI-UK' });
  });
});

