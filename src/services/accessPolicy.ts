import type { UserRole } from '../types';

export type AgentAccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type UserAccessState = 'admin' | 'staff' | 'not_requested' | AgentAccessStatus;

export interface UserAccess {
  role: UserRole;
  accessState: UserAccessState;
  organizationId?: string;
}

export interface AccessRequestSummary {
  status: AgentAccessStatus;
  organizationId: string;
}

export const APPROVED_ADMIN_EMAILS = [
  'egbase@basechaninternational.com',
  'ithub@basechaninternational.com',
] as const;

export function isApprovedAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  return APPROVED_ADMIN_EMAILS.includes(normalizedEmail as (typeof APPROVED_ADMIN_EMAILS)[number]);
}

export function hasValidCachedAdminMembership(input: {
  uid: string;
  email: string | null | undefined;
  emailVerified: boolean;
  metadata: {
    uid?: string;
    adminMembershipVerified?: boolean;
    adminEmail?: string;
  } | null;
}): boolean {
  const normalizedEmail = (input.email || '').trim().toLowerCase();
  return input.emailVerified
    && isApprovedAdminEmail(normalizedEmail)
    && input.metadata?.uid === input.uid
    && input.metadata.adminMembershipVerified === true
    && input.metadata.adminEmail === normalizedEmail;
}

export function isAdminMembershipValid(input: {
  email: string | null | undefined;
  emailVerified: boolean;
  membershipEmail: string | null | undefined;
}): boolean {
  const normalizedEmail = (input.email || '').trim().toLowerCase();
  return input.emailVerified
    && isApprovedAdminEmail(normalizedEmail)
    && (input.membershipEmail || '').trim().toLowerCase() === normalizedEmail;
}

export function isSelfServiceEmailAllowed(email: string | null | undefined): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  return normalizedEmail.endsWith('@basechaninternational.com')
    || normalizedEmail.endsWith('.basechaninternational@gmail.com');
}

export function resolveUserAccess(input: {
  email: string | null | undefined;
  emailVerified?: boolean;
  adminMembershipVerified?: boolean;
  accessRequest?: AccessRequestSummary | null;
}): UserAccess {
  const normalizedEmail = (input.email || '').trim().toLowerCase();

  if (input.emailVerified === true
    && input.adminMembershipVerified === true
    && isApprovedAdminEmail(normalizedEmail)) {
    return { role: 'ADMIN', accessState: 'admin' };
  }

  if (normalizedEmail.endsWith('.basechaninternational@gmail.com')) {
    return { role: 'STAFF', accessState: 'staff' };
  }

  return {
    role: 'AGENT',
    accessState: input.accessRequest?.status || 'not_requested',
    ...(input.accessRequest?.organizationId
      ? { organizationId: input.accessRequest.organizationId }
      : {}),
  };
}
