import { describe, expect, it } from 'vitest';
import { resolveUserAccess } from './accessPolicy';

describe('resolveUserAccess', () => {
  it('matches Admin and Staff domains exactly after normalizing case and whitespace', () => {
    expect(resolveUserAccess({ email: ' Admin@BasechanInternational.com ' })).toEqual({
      role: 'ADMIN',
      accessState: 'admin',
    });
    expect(resolveUserAccess({ email: 'sarah.basechaninternational@gmail.com' })).toEqual({
      role: 'STAFF',
      accessState: 'staff',
    });
    expect(resolveUserAccess({ email: 'someone@evilbasechaninternational.com' })).toEqual({
      role: 'AGENT',
      accessState: 'not_requested',
    });
  });

  it('grants an Agent rate access only when an organization request is approved', () => {
    expect(
      resolveUserAccess({
        email: 'agent@example.com',
        accessRequest: { status: 'approved', organizationId: 'org-1' },
      })
    ).toEqual({ role: 'AGENT', accessState: 'approved', organizationId: 'org-1' });

    expect(
      resolveUserAccess({
        email: 'agent@example.com',
        accessRequest: { status: 'pending', organizationId: 'org-1' },
      })
    ).toEqual({ role: 'AGENT', accessState: 'pending', organizationId: 'org-1' });
  });

  it('keeps Staff access independent of Agent organization requests', () => {
    expect(
      resolveUserAccess({
        email: 'sarah.basechaninternational@gmail.com',
        accessRequest: { status: 'revoked', organizationId: 'org-1' },
      })
    ).toEqual({ role: 'STAFF', accessState: 'staff' });
  });
});
