import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AgentAccessRequest, AgentAccessStatus, Organization } from '../types';
import { clearAllOverridesForAgent } from './rateReadModels';
import { redactStoredResultSnapshots } from './chatPersistence';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';

export interface AccessRequestInput {
  uid: string;
  email: string;
  displayName: string;
  organizationId?: string;
  requestedOrganizationName?: string;
}

export interface AgentAccessDecision {
  uid: string;
  status: Exclude<AgentAccessStatus, 'pending'>;
  adminUid: string;
  organizationId?: string;
  decisionNote?: string;
}

const sanitizeText = (value: string): string => value.replace(/[\u0000-\u001F\u007F]/g, '').trim();

export function buildAccessRequestPayload(
  input: AccessRequestInput,
  now: Date = new Date()
): AgentAccessRequest {
  const uid = sanitizeText(input.uid);
  const email = sanitizeText(input.email);
  const displayName = sanitizeText(input.displayName) || email.split('@')[0] || 'Agent';
  const organizationId = input.organizationId ? sanitizeText(input.organizationId) : '';
  const requestedOrganizationName = input.requestedOrganizationName
    ? sanitizeText(input.requestedOrganizationName)
    : '';

  if (!uid || !email || !email.includes('@')) {
    throw new Error('A signed-in account is required to request organization access.');
  }

  if (Boolean(organizationId) === Boolean(requestedOrganizationName)) {
    throw new Error('Choose one organization or enter one organization name to request.');
  }

  if (organizationId && (organizationId.includes('/') || organizationId.length > 128)) {
    throw new Error('The selected organization is invalid.');
  }

  if (requestedOrganizationName && requestedOrganizationName.length > 100) {
    throw new Error('Organization names must be 100 characters or fewer.');
  }

  if (input.requestedOrganizationName && !requestedOrganizationName) {
    throw new Error('Enter an organization name.');
  }

  const timestamp = now.toISOString();
  return {
    uid,
    email,
    displayName,
    status: 'pending',
    ...(organizationId ? { organizationId } : { requestedOrganizationName }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeOrganizationName(name: string): { name: string; id: string; normalizedName: string } {
  const cleanName = sanitizeText(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (cleanName.length < 2 || cleanName.length > 100) {
    throw new Error('Organization names must be between 2 and 100 characters.');
  }

  const normalizedName = cleanName.toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
  const id = normalizedName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!id) throw new Error('Enter an organization name with at least one letter or number.');
  return { name: cleanName, id, normalizedName };
}

export async function requestOrganizationAccess(input: AccessRequestInput): Promise<void> {
  assertFirestoreWritesAllowed('Access requests');
  const payload = buildAccessRequestPayload(input);
  const requestRef = doc(db, 'agent_access_requests', payload.uid);

  await runTransaction(db, async (transaction) => {
    const existingRequest = await transaction.get(requestRef);
    if (existingRequest.exists() && !['rejected', 'revoked'].includes(existingRequest.get('status') as string)) {
      throw new Error('An organization access request already exists for this account.');
    }

    if (payload.organizationId) {
      const organizationRef = doc(db, 'organizations', payload.organizationId);
      const organization = await transaction.get(organizationRef);
      if (!organization.exists()) throw new Error('That organization is no longer available.');
    }

    transaction.set(requestRef, {
      ...payload,
      ...(existingRequest.exists() ? { previousDecisionAt: existingRequest.get('decidedAt') || null } : {}),
    });
  });
}

export async function createOrganization(input: {
  name: string;
  adminUid: string;
}): Promise<Organization> {
  assertFirestoreWritesAllowed('Organization management');
  const parsed = normalizeOrganizationName(input.name);
  const organizationRef = doc(db, 'organizations', parsed.id);
  const timestamp = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(organizationRef);
    if (existing.exists()) throw new Error('An organization with this name already exists.');
    transaction.set(organizationRef, {
      id: parsed.id,
      name: parsed.name,
      normalizedName: parsed.normalizedName,
      createdAt: timestamp,
      createdBy: input.adminUid,
    });
  });

  return {
    id: parsed.id,
    name: parsed.name,
    normalizedName: parsed.normalizedName,
    createdAt: timestamp,
    createdBy: input.adminUid,
  };
}

export async function setAgentOrganization(uid: string, organizationId: string, adminUid: string): Promise<void> {
  assertFirestoreWritesAllowed('Agent access changes');
  const requestRef = doc(db, 'agent_access_requests', uid);
  const organizationRef = doc(db, 'organizations', organizationId);
  const timestamp = new Date().toISOString();
  await runTransaction(db, async (transaction) => {
    const [request, organization] = await Promise.all([transaction.get(requestRef), transaction.get(organizationRef)]);
    if (!request.exists()) throw new Error('The Agent access request no longer exists.');
    if (!organization.exists()) throw new Error('The selected organization no longer exists.');
    transaction.update(requestRef, {
      organizationId,
      ...(request.get('requestedOrganizationName') ? { requestedOrganizationName: null } : {}),
      updatedAt: timestamp,
      organizationChangedAt: timestamp,
      organizationChangedBy: adminUid,
    });
  });
  await redactStoredResultSnapshots(uid);
  const { publishRelevantUpdates } = await import('./userUpdates');
  await publishRelevantUpdates({
    type: 'access',
    title: 'Your organization changed',
    summary: 'Your assigned organization was updated. Your available rates now follow the new organization and your individual overrides.',
    rates: [],
    includeStaff: false,
    roles: ['AGENT'],
    agentUids: [uid],
  });
}

export async function setAgentAccessStatus(input: AgentAccessDecision): Promise<void> {
  assertFirestoreWritesAllowed('Agent access changes');
  const requestRef = doc(db, 'agent_access_requests', input.uid);
  const timestamp = new Date().toISOString();
  const decisionNote = input.decisionNote ? sanitizeText(input.decisionNote).slice(0, 500) : '';
  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists()) throw new Error('The access request no longer exists.');
    const requestData = requestSnapshot.data() as AgentAccessRequest;
    const organizationId = input.organizationId || requestData.organizationId;

    if (input.status === 'approved') {
      if (!organizationId) throw new Error('Choose an organization before approving access.');
      const organization = await transaction.get(doc(db, 'organizations', organizationId));
      if (!organization.exists()) throw new Error('The selected organization no longer exists.');
    }

    transaction.update(requestRef, {
      status: input.status,
      ...(organizationId ? { organizationId } : {}),
      decidedAt: timestamp,
      decidedBy: input.adminUid,
      decisionNote: decisionNote || '',
      updatedAt: timestamp,
    });
  });

  if (input.status === 'revoked') {
    await clearAllOverridesForAgent(input.uid);
  }
  if (input.status !== 'approved') await redactStoredResultSnapshots(input.uid);
  const { publishRelevantUpdates } = await import('./userUpdates');
  const accessCopy = input.status === 'approved'
    ? { title: 'Your access is approved', summary: 'Your Agent access is now active. Sign in to view your organization’s available rates.' }
    : input.status === 'rejected'
      ? { title: 'Your access request was declined', summary: decisionNote || 'Your Agent access request was declined. Contact an administrator if you need help.' }
      : { title: 'Your Agent access was revoked', summary: decisionNote || 'Your Agent access is no longer active. Contact an administrator if you think this was a mistake.' };
  await publishRelevantUpdates({
    type: 'access',
    ...accessCopy,
    rates: [],
    includeStaff: false,
    roles: ['AGENT'],
    agentUids: [input.uid],
  });
}

export function subscribeToOrganizations(
  onChange: (organizations: Organization[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'organizations'), orderBy('name')),
    (snapshot) => onChange(snapshot.docs.map((item) => item.data() as Organization)),
    (error) => onError?.(error)
  );
}

export function subscribeToAgentAccessRequests(
  onChange: (requests: AgentAccessRequest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'agent_access_requests'), orderBy('updatedAt', 'desc')),
    (snapshot) => onChange(snapshot.docs.map((item) => item.data() as AgentAccessRequest)),
    (error) => onError?.(error)
  );
}

export function subscribeToAgentAccessRequest(
  uid: string,
  onChange: (request: AgentAccessRequest | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'agent_access_requests', uid),
    (snapshot) => onChange(snapshot.exists() ? snapshot.data() as AgentAccessRequest : null),
    (error) => onError?.(error)
  );
}

export async function getOrganization(organizationId: string): Promise<Organization | null> {
  const snapshot = await getDoc(doc(db, 'organizations', organizationId));
  return snapshot.exists() ? snapshot.data() as Organization : null;
}
