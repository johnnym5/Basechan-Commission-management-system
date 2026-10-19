import { describe, expect, it } from 'vitest';
import { hasValidCachedAdminMembership, isAdminMembershipValid, resolveUserAccess } from './accessPolicy';

describe('resolveUserAccess', () => {
  it('requires verified membership for the two explicitly approved Admin emails', () => {
    for (const email of ['egbase@basechaninternational.com', 'ithub@basechaninternational.com']) {
      expect(resolveUserAccess({ email, emailVerified: true, adminMembershipVerified: true })).toEqual({
        role: 'ADMIN',
        accessState: 'admin',
      });
    }
    expect(resolveUserAccess({
      email: ' EGBASE@BasechanInternational.com ',
      emailVerified: true,
      adminMembershipVerified: true,
    })).toEqual({ role: 'ADMIN', accessState: 'admin' });
    expect(resolveUserAccess({
      email: 'egbase@basechaninternational.com',
      emailVerified: true,
      adminMembershipVerified: false,
    }).role).toBe('AGENT');
    expect(resolveUserAccess({
      email: 'egbase@basechaninternational.com',
      emailVerified: false,
      adminMembershipVerified: true,
    }).role).toBe('AGENT');
    expect(resolveUserAccess({
      email: 'someone@basechaninternational.com',
      emailVerified: true,
      adminMembershipVerified: true,
    }).role).toBe('AGENT');
  });

  it('matches the Staff domain exactly after normalizing case and whitespace', () => {
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

  it('uses cached Admin membership only for the same verified UID and approved email', () => {
    const metadata = {
      uid: 'admin-uid',
      adminMembershipVerified: true,
      adminEmail: 'egbase@basechaninternational.com',
    };
    expect(hasValidCachedAdminMembership({
      uid: 'admin-uid', email: 'egbase@basechaninternational.com', emailVerified: true, metadata,
    })).toBe(true);
    expect(hasValidCachedAdminMembership({
      uid: 'other-uid', email: 'egbase@basechaninternational.com', emailVerified: true, metadata,
    })).toBe(false);
    expect(hasValidCachedAdminMembership({
      uid: 'admin-uid', email: 'ithub@basechaninternational.com', emailVerified: true, metadata,
    })).toBe(false);
    expect(hasValidCachedAdminMembership({
      uid: 'admin-uid', email: 'egbase@basechaninternational.com', emailVerified: false, metadata,
    })).toBe(false);
  });

  it('accepts server membership only for a verified matching allowlisted identity', () => {
    expect(isAdminMembershipValid({
      email: 'egbase@basechaninternational.com',
      emailVerified: true,
      membershipEmail: 'egbase@basechaninternational.com',
    })).toBe(true);
    expect(isAdminMembershipValid({
      email: 'egbase@basechaninternational.com',
      emailVerified: true,
      membershipEmail: 'ITHUB@BASECHANINTERNATIONAL.COM',
    })).toBe(false);
    expect(isAdminMembershipValid({
      email: 'someone@basechaninternational.com',
      emailVerified: true,
      membershipEmail: 'someone@basechaninternational.com',
    })).toBe(false);
    expect(isAdminMembershipValid({
      email: 'egbase@basechaninternational.com',
      emailVerified: false,
      membershipEmail: 'egbase@basechaninternational.com',
    })).toBe(false);
  });
});
