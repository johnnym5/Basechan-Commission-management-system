import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
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

  const uniqueSchoolNames = Array.from(new Set(visibleRates.map((r) => r.universityName).filter(Boolean)));
  const uniqueSchoolIds = Array.from(new Set(visibleRates.map((r) => r.universityId).filter(Boolean)));

  let formattedTitle = change.title;
  if (uniqueSchoolNames.length === 1) {
    const schoolName = uniqueSchoolNames[0];
    if (change.type === 'rates') formattedTitle = `New rate update for ${schoolName}`;
    else if (change.type === 'intake') formattedTitle = `New intake update for ${schoolName}`;
    else if (change.type === 'routing') formattedTitle = `New route update for ${schoolName}`;
    else if (change.type === 'guidance') formattedTitle = `New guidance update for ${schoolName}`;
  }

  return {
    id: `${operationId}-${recipient.uid}`,
    title: formattedTitle,
    summary: content.summary,
    type: change.type,
    createdAt,
    isRead: false,
    changedSchoolCount: content.changedSchoolCount,
    affectedSchoolIds: content.affectedSchoolIds,
    universityId: uniqueSchoolIds.length === 1 ? uniqueSchoolIds[0] : undefined,
    universityName: uniqueSchoolNames.length === 1 ? uniqueSchoolNames[0] : undefined,
  };
}

export function getFavoriteSchoolUpdates(updates: UserUpdate[], favoriteSchoolIds: string[]): UserUpdate[] {
  if (!updates.length || !favoriteSchoolIds.length) return [];
  const normalizedFavs = favoriteSchoolIds.map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (!normalizedFavs.length) return [];

  return updates.filter((update) => {
    if (update.affectedSchoolIds?.length) {
      const hasAffectedMatch = update.affectedSchoolIds.some((id) =>
        favoriteSchoolIds.includes(id) || normalizedFavs.includes(id.trim().toLowerCase())
      );
      if (hasAffectedMatch) return true;
    }
    const titleLower = (update.title || '').toLowerCase();
    const summaryLower = (update.summary || '').toLowerCase();
    return normalizedFavs.some((favId) => titleLower.includes(favId) || summaryLower.includes(favId));
  });
}

export function splitChangeBySchool(change: UpdateChange): UpdateChange[] {
  if (!change.rates || change.rates.length <= 1) return [change];
  const ratesBySchool = new Map<string, CommissionRate[]>();
  change.rates.forEach((rate) => {
    const key = rate.universityId || 'general';
    if (!ratesBySchool.has(key)) ratesBySchool.set(key, []);
    ratesBySchool.get(key)!.push(rate);
  });
  if (ratesBySchool.size <= 1) return [change];
  return Array.from(ratesBySchool.entries()).map(([schoolId, schoolRates]) => ({
    ...change,
    rates: schoolRates,
    operationId: `${change.operationId || stableId()}-${schoolId}`,
  }));
}

export async function publishRelevantUpdates(change: UpdateChange): Promise<PublishUpdateResult> {
  assertFirestoreWritesAllowed('Activity updates');
  let requestSnapshot, usersSnapshot, settingsSnapshot;
  try {
    [requestSnapshot, usersSnapshot] = await Promise.all([
      getDocs(collection(db, 'agent_access_requests')),
      getDocs(collection(db, 'users')),
    ]);
    settingsSnapshot = await getDocs(collection(db, 'sheet_settings'));
  } catch (readErr) {
    console.error('[publishRelevantUpdates read error]:', readErr);
    throw readErr;
  }
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
  const schoolChanges = splitChangeBySchool({ ...change, operationId: id });
  let createdCount = 0;
  let alreadyPublishedCount = 0;
  let filteredCount = 0;

  for (let offset = 0; offset < recipients.length; offset += 350) {
    const chunk = recipients.slice(offset, offset + 350);
    const batch = writeBatch(db);
    for (const subChange of schoolChanges) {
      const subId = subChange.operationId || id;
      for (const recipient of chunk) {
        const noticeRef = doc(db, 'users', recipient.uid, 'updates', `${subId}-${recipient.uid}`);
        const notice = buildUserUpdateNotice({ ...subChange, operationId: subId }, recipient, hiddenByRole, createdAt);
        if (notice) {
          batch.set(noticeRef, notice);
          createdCount++;
        } else {
          filteredCount++;
        }
      }
    }
    try {
      await batch.commit();
    } catch (commitErr) {
      console.error('[publishRelevantUpdates batch commit error]:', commitErr);
      throw commitErr;
    }
  }
  return { operationId: id, recipientCount: recipients.length, createdCount, alreadyPublishedCount, filteredCount, complete: true };
}
