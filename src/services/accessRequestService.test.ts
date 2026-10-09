import { describe, expect, it } from 'vitest';
import { buildAccessRequestPayload } from './accessRequestService';

describe('buildAccessRequestPayload', () => {
  const base = {
    uid: 'agent-1',
    email: 'agent@example.com',
    displayName: 'Agent One',
  };

  it('creates a pending request for an existing organization', () => {
    expect(
      buildAccessRequestPayload({ ...base, organizationId: 'org-1' }, new Date('2026-10-09T12:00:00.000Z'))
    ).toEqual({
      uid: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      status: 'pending',
      organizationId: 'org-1',
      createdAt: '2026-10-09T12:00:00.000Z',
      updatedAt: '2026-10-09T12:00:00.000Z',
    });
  });

  it('creates a pending request for an organization Admin must add', () => {
    expect(
      buildAccessRequestPayload({ ...base, requestedOrganizationName: '  North Coast Partners  ' })
    ).toMatchObject({
      status: 'pending',
      requestedOrganizationName: 'North Coast Partners',
      uid: 'agent-1',
    });
  });

  it('rejects missing, conflicting, or unsafe organization choices', () => {
    expect(() => buildAccessRequestPayload(base)).toThrow(/choose one organization/i);
    expect(() => buildAccessRequestPayload({
      ...base,
      organizationId: 'org-1',
      requestedOrganizationName: 'New Org',
    })).toThrow(/one organization/i);
    expect(() => buildAccessRequestPayload({ ...base, requestedOrganizationName: '  ' })).toThrow(/name/i);
    expect(() => buildAccessRequestPayload({ ...base, requestedOrganizationName: 'x'.repeat(101) })).toThrow(/100/i);
  });
});
