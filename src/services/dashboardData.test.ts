import { describe, expect, it } from 'vitest';
import type { CommissionRate, UserRole } from '../types';
import { buildDashboardRates, selectAgentPayoutRates } from './dashboardData';

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
    const [agent] = buildDashboardRates('AGENT', [{ ...rate, aggregator: 'BASECHAN' }]);
    expect(agent).not.toHaveProperty('masterRate');
    expect(agent).not.toHaveProperty('diffMargin');
    expect(agent).not.toHaveProperty('aggregator');
    expect(agent).toMatchObject({ role: 'AGENT', agentRate: 10, isFlatFee: false });
  });
  it('buildDashboardRates retains full fields for Admin', () => {
    const [admin] = buildDashboardRates('ADMIN', [rate]);
    expect(admin).toMatchObject({ role: 'ADMIN', masterRate: 20, agentRate: 10, diffMargin: 10, aggregator: 'SI-UK' });
  });

  it('Agent chooses the exact Basechan payout even when a third-party FOCUS route exists', () => {
    const basechan = { ...rate, id: 'basechan', aggregator: 'BASECHAN', agentRate: 8, guidance: 'ALLOWED' as const };
    const [agent] = buildDashboardRates('AGENT', [rate, basechan]);
    expect(agent).toMatchObject({ id: 'basechan', agentRate: 8 });
  });

  it('Agent never substitutes a third-party or different-intake route for a missing tuple', () => {
    const differentIntake = { ...rate, id: 'basechan-sept', aggregator: 'BASECHAN', intake: 'Sept 2026' };
    const agent = buildDashboardRates('AGENT', [rate, differentIntake]);
    expect(agent).toHaveLength(1);
    expect(agent[0]).toMatchObject({ id: 'basechan-sept', intake: 'Sept 2026' });
  });

  it('Staff keeps FOCUS route then top yield behavior', () => {
    const basechan = { ...rate, id: 'basechan', aggregator: 'BASECHAN', diffMargin: 5, guidance: 'ALLOWED' as const };
    expect(buildDashboardRates('STAFF', [basechan, rate])[0].id).toBe(rate.id);
    expect(buildDashboardRates('STAFF', [{ ...rate, guidance: 'ALLOWED', diffMargin: 3 }, basechan])[0].id).toBe('basechan');
  });
});

describe('selectAgentPayoutRates', () => {
  it('keeps only eligible payouts for each exact school, level, and intake tuple', () => {
    const basechan = { ...rate, id: 'basechan', aggregator: 'BASECHAN', agentRate: 8 };
    const differentIntake = { ...basechan, id: 'sept', intake: 'Sept 2026' };
    expect(selectAgentPayoutRates([rate, basechan, differentIntake]).map((item) => item.id)).toEqual(['basechan', 'sept']);
  });
});

