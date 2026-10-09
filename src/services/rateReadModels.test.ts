import { describe, expect, it } from 'vitest';
import { buildAgentProjection, buildStaffProjection, isRedundantOrganizationDefault, mergeAgentRateLayers, shouldClearAgentOverride } from './rateReadModels';
import type { CommissionRate } from '../types';

const masterRate: CommissionRate = {
  id: 'school-sept-aggregator-pg', universityId: 'school', universityName: 'Example University', country: 'UK',
  intake: 'Sept 2027', aggregator: 'Secret Aggregator', studyLevel: 'PG', masterRate: 30, agentRate: 12,
  diffMargin: 18, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS', notes: 'Current routing note', sourceSheet: 'Sheet A',
};

describe('role-specific rate projections', () => {
  it('exposes staff routing fields without payouts or margins', () => {
    const projection = buildStaffProjection(masterRate) as unknown as Record<string, unknown>;
    expect(projection).toMatchObject({ universityName: 'Example University', aggregator: 'Secret Aggregator', guidance: 'FOCUS' });
    expect(projection).not.toHaveProperty('masterRate');
    expect(projection).not.toHaveProperty('agentRate');
    expect(projection).not.toHaveProperty('diffMargin');
  });

  it('exposes only agent payout fields and does not use source id or aggregator in its document id', () => {
    const projection = buildAgentProjection(masterRate) as unknown as Record<string, unknown>;
    expect(projection).toMatchObject({ universityName: 'Example University', agentRate: 12, guidance: 'FOCUS' });
    expect(projection.id).not.toContain('Secret Aggregator');
    expect(projection).not.toHaveProperty('aggregator');
    expect(projection).not.toHaveProperty('masterRate');
    expect(projection).not.toHaveProperty('diffMargin');
    const alternateRoute = buildAgentProjection({ ...masterRate, id: `${masterRate.id}-alternate`, aggregator: 'Other Secret Route' });
    expect(alternateRoute.id).not.toBe(projection.id);
    expect(alternateRoute.id).not.toContain('Other Secret Route');
  });
});

describe('organization rate override precedence', () => {
  it('preserves a personal override when an organization rate changes', () => {
    expect(shouldClearAgentOverride(masterRate, [buildAgentProjection(masterRate).id], true)).toBe(false);
  });

  it('replaces only the selected personal rate when requested', () => {
    expect(shouldClearAgentOverride(masterRate, [buildAgentProjection(masterRate).id, 'another-rate'], false)).toBe(true);
    expect(shouldClearAgentOverride(masterRate, ['another-rate'], false)).toBe(false);
  });

  it('keeps organization overrides sparse and applies personal rates above them', () => {
    const defaults = [{ id: 'school-pg', amount: 10 }, { id: 'other-pg', amount: 5 }];
    const organization = [{ id: 'school-pg', amount: 20 }];
    const personal = [{ id: 'school-pg', amount: 30 }];
    expect(mergeAgentRateLayers(defaults, organization, personal)).toEqual([
      { id: 'school-pg', amount: 30 },
      { id: 'other-pg', amount: 5 },
    ]);
    expect(organization).toHaveLength(1);
  });

  it('recognizes old copied defaults but preserves a distinct organization rate', () => {
    const projection = buildAgentProjection(masterRate);
    expect(isRedundantOrganizationDefault(projection as unknown as Record<string, unknown>, projection)).toBe(true);
    expect(isRedundantOrganizationDefault({ ...projection, agentRate: 18 }, projection)).toBe(false);
  });
});
