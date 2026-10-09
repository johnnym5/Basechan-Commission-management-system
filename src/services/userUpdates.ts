import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AgentAccessRequest, CommissionRate, UserUpdate } from '../types';
import { resolveUserAccess } from './accessPolicy';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';

export interface UpdateChange {
  type: UserUpdate['type'];
  title: string;
  summary: string;
  rates: CommissionRate[];
  organizationIds?: string[];
  agentUids?: string[];
  includeStaff?: boolean;
  roles?: Array<'AGENT' | 'STAFF'>;
  operationId?: string;
}

export interface UpdateUser {
  uid: string;
  email: string;
}

export interface UpdateRecipient extends UpdateUser {
  role: 'AGENT' | 'STAFF';
}

export interface UpdateAccessRecord {
  uid: string;
  status: AgentAccessRequest['status'];
  organizationId?: string;
}

export interface PublishUpdateResult {
  operationId: string;
  recipientCount: number;
  createdCount: number;
  alreadyPublishedCount: number;
  filteredCount: number;
  complete: true;
}

const stableId = () => `${Date.now()}-${crypto.randomUUID()}`;

export function buildUpdateNoticeContent(change: UpdateChange) {
  const affectedSchoolIds = Array.from(new Set(change.rates.map((rate) => rate.universityId)));
  return {
    summary: `${change.summary}${affectedSchoolIds.length ? ` ${affectedSchoolIds.length} school${affectedSchoolIds.length === 1 ? '' : 's'} affected.` : ''}`,
    affectedSchoolIds,
    changedSchoolCount: affectedSchoolIds.length,
  };
}

export function filterUpdateRatesForRole(
  rates: CommissionRate[],
  role: 'AGENT' | 'STAFF',
  hiddenBySheet: Record<string, Partial<Record<'AGENT' | 'STAFF', boolean>>>,
): CommissionRate[] {
  return rates.filter((rate) => !hiddenBySheet[String(rate.sourceSheet || rate.intake || '').trim().toLowerCase()]?.[role]);
}

export function selectUpdateRecipients(
  change: UpdateChange,
  users: UpdateUser[],
  requests: UpdateAccessRecord[],
): UpdateRecipient[] {
  const roles = change.roles || (change.includeStaff === false ? ['AGENT'] : ['AGENT', 'STAFF']);
  const requestsByUid = new Map(requests.map((request) => [request.uid, request]));
  return users.flatMap<UpdateRecipient>((user) => {
    const role = resolveUserAccess({ email: user.email }).role;
    if (role === 'STAFF') {
      return roles.includes('STAFF') && !change.agentUids?.length && !change.organizationIds?.length
        ? [{ ...user, role }]
        : [];
    }
    if (role !== 'AGENT' || !roles.includes('AGENT')) return [];
    const request = requestsByUid.get(user.uid);
    if (change.type === 'access' && change.agentUids?.includes(user.uid)) return [{ ...user, role }];
    if (request?.status !== 'approved') return [];
    if (change.agentUids?.length) return change.agentUids.includes(user.uid) ? [{ ...user, role }] : [];
    if (change.organizationIds?.length) return Boolean(request.organizationId && change.organizationIds.includes(request.organizationId)) ? [{ ...user, role }] : [];
    return [{ ...user, role }];
  });
}

export function buildUserUpdateNotice(
  change: UpdateChange,
  recipient: UpdateRecipient,
  hiddenByRole: Record<string, Partial<Record<'AGENT' | 'STAFF', boolean>>>,
  createdAt = new Date().toISOString(),
): UserUpdate | undefined {
  const visibleRates = change.type === 'access' ? [] : filterUpdateRatesForRole(change.rates, recipient.role, hiddenByRole);
  if (change.type !== 'access' && visibleRates.length === 0) return undefined;
  const content = buildUpdateNoticeContent({ ...change, rates: visibleRates });
  const operationId = change.operationId || stableId();
  return {
    id: `${operationId}-${recipient.uid}`,
    title: change.title,
    summary: content.summary,
    type: change.type,
    createdAt,
    isRead: false,
    changedSchoolCount: content.changedSchoolCount,
    affectedSchoolIds: content.affectedSchoolIds,
  };
}

export async function publishRelevantUpdates(change: UpdateChange): Promise<PublishUpdateResult> {
  assertFirestoreWritesAllowed('Activity updates');
  const [requestSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(db, 'agent_access_requests')),
    getDocs(collection(db, 'users')),
  ]);
  const settingsSnapshot = await getDocs(collection(db, 'sheet_settings'));
  const hiddenByRole: Record<string, Partial<Record<'AGENT' | 'STAFF', boolean>>> = {};
  settingsSnapshot.docs.forEach((item) => {
    const data = item.data();
    const hidden = { AGENT: data.disabledForAgents === true, STAFF: data.disabledForStaff === true };
    hiddenByRole[String(data.sheetName || item.id).trim().toLowerCase()] = hidden;
    hiddenByRole[item.id.trim().toLowerCase()] = hidden;
  });
  const users = usersSnapshot.docs.flatMap((item) => typeof item.data().email === 'string' ? [{ uid: item.id, email: item.data().email as string }] : []);
  const requests = requestSnapshot.docs.map((item) => ({ ...item.data(), uid: item.id }) as UpdateAccessRecord);
  const recipients = selectUpdateRecipients(change, users, requests);
  const id = change.operationId || stableId();
  const createdAt = new Date().toISOString();
  let createdCount = 0;
  let alreadyPublishedCount = 0;
  let filteredCount = 0;
  for (let offset = 0; offset < recipients.length; offset += 350) {
    const chunk = recipients.slice(offset, offset + 350);
    const newRecipients = await Promise.all(chunk.map(async (recipient) => {
      const noticeRef = doc(db, 'users', recipient.uid, 'updates', `${id}-${recipient.uid}`);
      return (await getDoc(noticeRef)).exists() ? { recipient, noticeRef, alreadyPublished: true } : { recipient, noticeRef, alreadyPublished: false };
    }));
    const batch = writeBatch(db);
    for (const entry of newRecipients) {
      if (entry.alreadyPublished) {
        alreadyPublishedCount++;
        continue;
      }
      const { recipient, noticeRef } = entry;
      const notice = buildUserUpdateNotice({ ...change, operationId: id }, recipient, hiddenByRole, createdAt);
      if (notice) {
        batch.set(noticeRef, notice);
        createdCount++;
      } else filteredCount++;
    }
    await batch.commit();
  }
  return { operationId: id, recipientCount: recipients.length, createdCount, alreadyPublishedCount, filteredCount, complete: true };
}
