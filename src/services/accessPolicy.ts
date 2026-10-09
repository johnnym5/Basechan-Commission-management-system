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

export function isSelfServiceEmailAllowed(email: string | null | undefined): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  return normalizedEmail.endsWith('@basechaninternational.com')
    || normalizedEmail.endsWith('.basechaninternational@gmail.com');
}

export function resolveUserAccess(input: {
  email: string | null | undefined;
  accessRequest?: AccessRequestSummary | null;
}): UserAccess {
  const normalizedEmail = (input.email || '').trim().toLowerCase();

  if (normalizedEmail.endsWith('@basechaninternational.com')) {
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
