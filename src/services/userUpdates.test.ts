import { describe, expect, it } from 'vitest';
import type { CommissionRate } from '../types';
import { buildUserUpdateNotice, filterUpdateRatesForRole, selectUpdateRecipients } from './userUpdates';

const rates: CommissionRate[] = [
  { id: 'visible', universityId: 'school-1', universityName: 'Visible School', intake: 'Sept 2027', sourceSheet: 'Public', studyLevel: 'PG', aggregator: 'Route', masterRate: 20, agentRate: 12, diffMargin: 8, isFlatFee: false, netOrGross: 'GROSS' },
  { id: 'hidden', universityId: 'school-2', universityName: 'Hidden School', intake: 'Sept 2027', sourceSheet: 'Private', studyLevel: 'PG', aggregator: 'Private Route', masterRate: 20, agentRate: 12, diffMargin: 8, isFlatFee: false, netOrGross: 'GROSS' },
];

describe('role-safe update fanout', () => {
  it('omits schools hidden from each role before building notices', () => {
    const visibility = { private: { AGENT: true, STAFF: false } };
    expect(filterUpdateRatesForRole(rates, 'AGENT', visibility).map((rate) => rate.id)).toEqual(['visible']);
    expect(filterUpdateRatesForRole(rates, 'STAFF', visibility).map((rate) => rate.id)).toEqual(['visible', 'hidden']);
  });

  it('targets approved Agents by organization and excludes pending, rejected, revoked, and other organizations', () => {
    const change = { type: 'rates' as const, title: 'Rates changed', summary: 'Rates changed.', rates, organizationIds: ['org-a'], operationId: 'op-1' };
    const users = [
      { uid: 'agent-a', email: 'a@example.com' },
      { uid: 'agent-b', email: 'b@example.com' },
      { uid: 'pending', email: 'p@example.com' },
    ];
    const requests = [
      { uid: 'agent-a', status: 'approved' as const, organizationId: 'org-a' },
      { uid: 'agent-b', status: 'approved' as const, organizationId: 'org-b' },
      { uid: 'pending', status: 'pending' as const, organizationId: 'org-a' },
    ];
    expect(selectUpdateRecipients(change, users, requests).map((recipient) => recipient.uid)).toEqual(['agent-a']);
  });

  it('targets an explicitly named account for access notices even after approval is revoked', () => {
    const change = { type: 'access' as const, title: 'Access changed', summary: 'Your access changed.', rates: [], agentUids: ['revoked'], roles: ['AGENT' as const], operationId: 'access-1' };
    const users = [{ uid: 'revoked', email: 'revoked@example.com' }, { uid: 'other', email: 'other@example.com' }];
    const requests = [{ uid: 'revoked', status: 'revoked' as const }, { uid: 'other', status: 'approved' as const, organizationId: 'org-a' }];
    expect(selectUpdateRecipients(change, users, requests).map((recipient) => recipient.uid)).toEqual(['revoked']);
  });

  it('targets all Staff only for shared changes and excludes them from organization-specific changes', () => {
    const users = [{ uid: 'staff', email: 'sara.basechaninternational@gmail.com' }];
    expect(selectUpdateRecipients({ type: 'guidance', title: 'Guidance', summary: 'Guidance changed.', rates, roles: ['STAFF'], operationId: 'staff-1' }, users, []).map((recipient) => recipient.uid)).toEqual(['staff']);
    expect(selectUpdateRecipients({ type: 'guidance', title: 'Guidance', summary: 'Guidance changed.', rates, organizationIds: ['org-a'], operationId: 'org-1' }, users, []).map((recipient) => recipient.uid)).toEqual([]);
  });

  it('serializes only role-safe notice fields after sheet visibility filtering', () => {
    const hidden = { private: { AGENT: true, STAFF: false } };
    const change = { type: 'rates' as const, title: 'Rates changed', summary: 'Commission rate information was updated.', rates, operationId: 'op-safe' };
    const agent = buildUserUpdateNotice(change, { uid: 'agent-a', email: 'a@example.com', role: 'AGENT' }, hidden, '2026-10-09T12:00:00.000Z');
    const staff = buildUserUpdateNotice(change, { uid: 'staff', email: 'sara.basechaninternational@gmail.com', role: 'STAFF' }, hidden, '2026-10-09T12:00:00.000Z');
    expect(agent).toMatchObject({ id: 'op-safe-agent-a', affectedSchoolIds: ['school-1'], changedSchoolCount: 1 });
    expect(staff).toMatchObject({ id: 'op-safe-staff', affectedSchoolIds: ['school-1', 'school-2'], changedSchoolCount: 2 });
    expect(JSON.stringify(agent)).not.toMatch(/agentRate|masterRate|diffMargin|aggregator|Private Route/);
    expect(JSON.stringify(staff)).not.toMatch(/agentRate|masterRate|diffMargin|aggregator|Private Route/);
  });
});
