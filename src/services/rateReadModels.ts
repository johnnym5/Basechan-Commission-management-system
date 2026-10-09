import { collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AgentRateReadModel, CommissionRate, StaffRateReadModel } from '../types';
import { normalizeOrganizationName } from './accessRequestService';
import { publishRelevantUpdates } from './userUpdates';
import { logRateChange } from '../utils/auditLogger';
import { appendRateDelta } from './rateChangeFeed';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';

const legacyOpaqueRateId = (rate: CommissionRate) => encodeURIComponent(`${rate.universityId}_${rate.intake}_${rate.studyLevel}`.toLowerCase()).replaceAll('.', '%2E');
const ensuredSheetSettings = new Map<string, Promise<void>>();

async function ensureSheetVisibilityRecord(rate: CommissionRate): Promise<void> {
  const sheetName = String(rate.sourceSheet || rate.intake || '').trim();
  if (!sheetName) return;
  const key = sheetName.toLocaleLowerCase();
  const existing = ensuredSheetSettings.get(key);
  if (existing) return existing;
  const ensure = (async () => {
    const settingRef = doc(db, 'sheet_settings', sheetName);
    const setting = await getDoc(settingRef);
    if (!setting.exists()) {
      await setDoc(settingRef, {
        sheetName,
        disabledForStaff: false,
        disabledForAgents: false,
        updatedAt: new Date().toISOString(),
      });
    }
  })();
  ensuredSheetSettings.set(key, ensure);
  try {
    await ensure;
  } catch (error) {
    ensuredSheetSettings.delete(key);
    throw error;
  }
}

export async function ensureSheetVisibilityRecords(rates: CommissionRate[]): Promise<void> {
  await Promise.all(rates.map(ensureSheetVisibilityRecord));
}

export function opaqueRateId(rate: CommissionRate): string {
  const value = `${rate.id}|${rate.universityId}|${rate.intake}|${rate.studyLevel}`;
  let hash = 14695981039346656037n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) || 0);
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn;
  }
  return `r-${hash.toString(36)}`;
}

export function mergeAgentRateLayers<T extends { id: string }>(defaults: T[], organizationOverrides: T[], personalOverrides: T[]): T[] {
  const effective = new Map(defaults.map((rate) => [rate.id, rate]));
  organizationOverrides.forEach((rate) => effective.set(rate.id, rate));
  personalOverrides.forEach((rate) => effective.set(rate.id, rate));
  return Array.from(effective.values());
}

function visibleForRole(rate: CommissionRate, role: 'STAFF' | 'AGENT', settings: Record<string, Record<string, boolean>>) {
  const key = rate.sourceSheet || rate.intake;
  return settings[key]?.[role] !== false;
}

export function buildStaffProjection(rate: CommissionRate): StaffRateReadModel {
  return {
    id: opaqueRateId(rate),
    universityId: rate.universityId,
    universityName: rate.universityName,
    ...(rate.country ? { country: rate.country } : {}),
    intake: rate.intake,
    studyLevel: rate.studyLevel,
    sourceSheet: rate.sourceSheet || rate.intake,
    aggregator: rate.aggregator,
    guidance: rate.guidance || 'ALLOWED',
    ...(rate.notes ? { notes: rate.notes } : {}),
    ...(rate.updatedAt ? { updatedAt: rate.updatedAt } : {}),
  };
}

export function buildAgentProjection(rate: CommissionRate): AgentRateReadModel {
  return {
    id: opaqueRateId(rate),
    universityId: rate.universityId,
    universityName: rate.universityName,
    ...(rate.country ? { country: rate.country } : {}),
    intake: rate.intake,
    studyLevel: rate.studyLevel,
    sourceSheet: rate.sourceSheet || rate.intake,
    agentRate: rate.agentRate,
    isFlatFee: rate.isFlatFee,
    netOrGross: rate.netOrGross,
    guidance: rate.guidance || 'ALLOWED',
    ...(rate.notes ? { notes: rate.notes } : {}),
    ...(rate.updatedAt ? { updatedAt: rate.updatedAt } : {}),
  };
}

export function isRedundantOrganizationDefault(data: Record<string, unknown>, defaultProjection: AgentRateReadModel): boolean {
  const fields: Array<keyof AgentRateReadModel> = [
    'id', 'universityId', 'universityName', 'country', 'intake', 'studyLevel', 'agentRate',
    'isFlatFee', 'netOrGross', 'guidance', 'notes', 'updatedAt', 'sourceSheet',
  ];
  return fields.every((field) => data[field] === defaultProjection[field]);
}

export async function pruneRedundantOrganizationDefaults(rates: CommissionRate[]): Promise<number> {
  const projectionById = new Map(rates.map((rate) => [opaqueRateId(rate), buildAgentProjection(rate)]));
  const snapshots = await getDocs(collectionGroup(db, 'rates'));
  const redundant = snapshots.docs.filter((item) => {
    if (!item.ref.path.startsWith('organization_agent_rates/')) return false;
    const projection = projectionById.get(item.id);
    return projection !== undefined && isRedundantOrganizationDefault(item.data(), projection);
  });
  for (let offset = 0; offset < redundant.length; offset += 400) {
    const batch = writeBatch(db);
    redundant.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  return redundant.length;
}

async function removeLegacyRateFeedSnapshots(): Promise<number> {
  const changes = await getDocs(collectionGroup(db, 'changes'));
  const legacy = changes.docs.filter((item) => item.ref.path.startsWith('rate_change_feeds/') && 'record' in item.data());
  for (let offset = 0; offset < legacy.length; offset += 400) {
    const batch = writeBatch(db);
    legacy.slice(offset, offset + 400).forEach((item) => batch.update(item.ref, { record: deleteField() }));
    await batch.commit();
  }
  return legacy.length;
}

export async function migrateLegacyAgentOverrideIds(rates: CommissionRate[]): Promise<number> {
  const ratesByLegacyId = new Map<string, CommissionRate[]>();
  rates.forEach((rate) => {
    const group = ratesByLegacyId.get(legacyOpaqueRateId(rate)) || [];
    group.push(rate);
    ratesByLegacyId.set(legacyOpaqueRateId(rate), group);
  });
  const snapshots = await getDocs(collectionGroup(db, 'rates'));
  let migrated = 0;
  for (const item of snapshots.docs) {
    const parts = item.ref.path.split('/');
    if ((parts[0] !== 'organization_agent_rates' && parts[0] !== 'agent_rate_overrides') || parts.length !== 4) continue;
    const matchingRates = ratesByLegacyId.get(item.id);
    if (!matchingRates?.length) continue;
    const oldData = item.data();
    const destination = parts[0] === 'organization_agent_rates'
      ? (rate: CommissionRate) => doc(db, 'organization_agent_rates', parts[1], 'rates', opaqueRateId(rate))
      : (rate: CommissionRate) => doc(db, 'agent_rate_overrides', parts[1], 'rates', opaqueRateId(rate));
    for (let offset = 0; offset < matchingRates.length; offset += 200) {
      const batch = writeBatch(db);
      for (const rate of matchingRates.slice(offset, offset + 200)) {
        const projection = buildAgentProjection(rate);
        batch.set(destination(rate), {
          ...projection,
          agentRate: typeof oldData.agentRate === 'number' ? oldData.agentRate : projection.agentRate,
          isFlatFee: typeof oldData.isFlatFee === 'boolean' ? oldData.isFlatFee : projection.isFlatFee,
          netOrGross: oldData.netOrGross === 'NET' || oldData.netOrGross === 'GROSS' ? oldData.netOrGross : projection.netOrGross,
        });
      }
      await batch.commit();
    }
    await deleteDoc(item.ref);
    migrated++;
  }
  return migrated;
}

export async function pruneStaleAgentOverrides(rates: CommissionRate[]): Promise<number> {
  const currentIds = new Set(rates.map(opaqueRateId));
  const snapshots = await getDocs(collectionGroup(db, 'rates'));
  const stale = snapshots.docs.filter((item) => {
    const path = item.ref.path.split('/');
    return (path[0] === 'organization_agent_rates' || path[0] === 'agent_rate_overrides')
      && path.length === 4
      && !currentIds.has(item.id);
  });
  for (let offset = 0; offset < stale.length; offset += 400) {
    const batch = writeBatch(db);
    stale.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  return stale.length;
}

export interface RateProjectionOptions {
  sheetVisibility?: Record<string, Record<string, boolean>>;
  previousRate?: CommissionRate;
  updateType?: 'rates' | 'guidance' | 'intake' | 'routing';
  publishUpdate?: boolean;
  agentTargets?: AgentRateTarget[];
  operationId?: string;
}

export function shouldClearAgentOverride(rate: CommissionRate, overrideIds: string[], preserveOverrides: boolean): boolean {
  return !preserveOverrides && overrideIds.includes(opaqueRateId(rate));
}

export async function syncRateReadModels(rate: CommissionRate, options: RateProjectionOptions = {}): Promise<void> {
  assertFirestoreWritesAllowed('Rate projections');
  await ensureSheetVisibilityRecord(rate);
  const key = opaqueRateId(rate);
  const staffRef = doc(db, 'staff_rates', key);
  const agentRef = doc(db, 'agent_rates', key);
  const visibility = options.sheetVisibility || await loadVisibilitySettings();
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  if (options.previousRate && opaqueRateId(options.previousRate) !== key) {
    operations.push((batch) => batch.delete(doc(db, 'staff_rates', opaqueRateId(options.previousRate!))));
    operations.push((batch) => batch.delete(doc(db, 'agent_rates', opaqueRateId(options.previousRate!))));
  }
  const staffVisible = visibleForRole(rate, 'STAFF', visibility);
  const agentVisible = visibleForRole(rate, 'AGENT', visibility);
  if (staffVisible) operations.push((batch) => batch.set(staffRef, buildStaffProjection(rate)));
  else operations.push((batch) => batch.delete(staffRef));
  if (agentVisible) operations.push((batch) => batch.set(agentRef, buildAgentProjection(rate)));
  else operations.push((batch) => batch.delete(agentRef));
  const batch = writeBatch(db);
  operations.forEach((operation) => operation(batch));
  await batch.commit();
  const operationId = options.operationId || `projection-${crypto.randomUUID()}`;
  const previousKey = options.previousRate ? opaqueRateId(options.previousRate) : undefined;
  if (previousKey && previousKey !== key) {
    await appendRateDelta('staff', { operationId: `${operationId}-staff-old`, kind: 'delete', id: previousKey, target: 'rates' });
    await appendRateDelta('agent', { operationId: `${operationId}-agent-old`, kind: 'delete', id: previousKey, target: 'rates' });
  }
  await appendRateDelta('staff', staffVisible
    ? { operationId: `${operationId}-staff`, kind: 'upsert', id: key, target: 'rates', record: buildStaffProjection(rate) }
    : { operationId: `${operationId}-staff`, kind: 'delete', id: key, target: 'rates' });
  await appendRateDelta('agent', agentVisible
    ? { operationId: `${operationId}-agent`, kind: 'upsert', id: key, target: 'rates', record: buildAgentProjection(rate) }
    : { operationId: `${operationId}-agent`, kind: 'delete', id: key, target: 'rates' });
  if (options.previousRate && opaqueRateId(options.previousRate) !== key) {
    const targets = options.agentTargets || await resolveAgentTargets();
    for (let offset = 0; offset < targets.length; offset += 200) {
      const layerBatch = writeBatch(db);
      for (const target of targets.slice(offset, offset + 200)) {
        layerBatch.delete(doc(db, 'organization_agent_rates', target.organizationId, 'rates', opaqueRateId(options.previousRate)));
        layerBatch.delete(doc(db, 'agent_rate_overrides', target.uid, 'rates', opaqueRateId(options.previousRate)));
      }
      await layerBatch.commit();
      for (const target of targets.slice(offset, offset + 200)) {
        await appendRateDelta(`org_${target.organizationId}`, { operationId: `${operationId}-org-old-${target.uid}`, kind: 'delete', id: previousKey!, target: 'organizationOverrides' });
        await appendRateDelta(`user_${target.uid}`, { operationId: `${operationId}-user-old`, kind: 'delete', id: previousKey!, target: 'personalOverrides' });
      }
    }
  }
  const type = options.updateType || (options.previousRate && options.previousRate.guidance !== rate.guidance ? 'guidance' : options.previousRate && options.previousRate.aggregator !== rate.aggregator ? 'routing' : 'rates');
  if (options.publishUpdate === false) return;
  await publishRelevantUpdates({ type, title: `${rate.universityName} ${type === 'guidance' ? 'guidance' : type === 'routing' ? 'routing' : 'rate'} updated`, summary: type === 'guidance' ? `School guidance was changed to ${rate.guidance || 'ALLOWED'}.` : type === 'routing' ? 'The application routing portal was updated.' : type === 'intake' ? `A new ${rate.intake} route is available.` : 'Commission rate information was updated.', rates: [rate], ...(type === 'routing' ? { includeStaff: true, roles: ['STAFF'] as Array<'STAFF' | 'AGENT'> } : {}) });
}

export async function removeRateReadModels(rate: CommissionRate, agentTargets?: AgentRateTarget[], operationId = `remove-${crypto.randomUUID()}`): Promise<void> {
  assertFirestoreWritesAllowed('Rate projections');
  const key = opaqueRateId(rate);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'staff_rates', key));
  batch.delete(doc(db, 'agent_rates', key));
  await batch.commit();
  await appendRateDelta('staff', { operationId: `${operationId}-staff`, kind: 'delete', id: key, target: 'rates' });
  await appendRateDelta('agent', { operationId: `${operationId}-agent`, kind: 'delete', id: key, target: 'rates' });
  const targets = agentTargets || await resolveAgentTargets();
  for (let offset = 0; offset < targets.length; offset += 200) {
    const layerBatch = writeBatch(db);
    for (const target of targets.slice(offset, offset + 200)) {
      layerBatch.delete(doc(db, 'organization_agent_rates', target.organizationId, 'rates', key));
      layerBatch.delete(doc(db, 'agent_rate_overrides', target.uid, 'rates', key));
    }
    await layerBatch.commit();
    for (const target of targets.slice(offset, offset + 200)) {
      await appendRateDelta(`org_${target.organizationId}`, { operationId: `${operationId}-org-${target.uid}`, kind: 'delete', id: key, target: 'organizationOverrides' });
      await appendRateDelta(`user_${target.uid}`, { operationId: `${operationId}-user-${target.uid}`, kind: 'delete', id: key, target: 'personalOverrides' });
    }
  }
}

export async function syncAllRateReadModels(rates: CommissionRate[], settings: Record<string, Record<string, boolean>> = {}, publishUpdates = true, removeStale = false): Promise<number> {
  assertFirestoreWritesAllowed('Rate projections');
  await ensureSheetVisibilityRecords(rates);
  const visibility = Object.keys(settings).length ? settings : await loadVisibilitySettings();
  const BATCH_SIZE = 200;
  const [existingStaff, existingAgents] = removeStale
    ? await Promise.all([getDocs(collection(db, 'staff_rates')), getDocs(collection(db, 'agent_rates'))])
    : [undefined, undefined] as const;
  for (let offset = 0; offset < rates.length; offset += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const rate of rates.slice(offset, offset + BATCH_SIZE)) {
      const key = opaqueRateId(rate);
      if (visibleForRole(rate, 'STAFF', visibility)) batch.set(doc(db, 'staff_rates', key), buildStaffProjection(rate));
      else batch.delete(doc(db, 'staff_rates', key));
      if (visibleForRole(rate, 'AGENT', visibility)) batch.set(doc(db, 'agent_rates', key), buildAgentProjection(rate));
      else batch.delete(doc(db, 'agent_rates', key));
    }
    await batch.commit();
  }
  const rateKeys = new Set(rates.map(opaqueRateId));
  const modelSnapshots: Array<{ collectionName: string; docs: NonNullable<typeof existingStaff>['docs']; visible: (rate: CommissionRate) => boolean }> = removeStale && existingStaff && existingAgents ? [
    { collectionName: 'staff_rates', docs: existingStaff.docs, visible: (rate) => visibleForRole(rate, 'STAFF', visibility) },
    { collectionName: 'agent_rates', docs: existingAgents.docs, visible: (rate) => visibleForRole(rate, 'AGENT', visibility) },
  ] : [];
  for (const { collectionName, docs, visible } of modelSnapshots) {
    const stale = docs.filter((item) => !rateKeys.has(item.id) || !rates.some((rate) => opaqueRateId(rate) === item.id && visible(rate)));
    for (let offset = 0; offset < stale.length; offset += BATCH_SIZE) {
      const cleanup = writeBatch(db);
      stale.slice(offset, offset + BATCH_SIZE).forEach((item) => cleanup.delete(doc(db, collectionName, item.id)));
      await cleanup.commit();
    }
  }
  await migrateLegacyAgentOverrideIds(rates);
  await pruneStaleAgentOverrides(rates);
  const prunedOrganizationDefaults = await pruneRedundantOrganizationDefaults(rates);
  await syncAllAgentRatesFromMaster(rates, visibility, removeStale);
  if (publishUpdates && rates.length) {
    await publishRelevantUpdates({ type: 'rates', title: 'Commission rates updated', summary: 'Commission rate information was updated.', rates });
  }
  return prunedOrganizationDefaults;
}

export async function ensureRoleRateModelMigration(rates: CommissionRate[], adminEmail: string, force = false): Promise<{ migrated: boolean; prunedOrganizationDefaults: number }> {
  assertFirestoreWritesAllowed('Rate model migration');
  const migrationRef = doc(db, 'admin_migrations', 'role-rate-models-v2');
  const current = await getDoc(migrationRef);
  if (!force && current.exists() && current.get('status') === 'complete') return { migrated: false, prunedOrganizationDefaults: 0 };
  await setDoc(migrationRef, { status: 'running', adminEmail, updatedAt: new Date().toISOString() }, { merge: true });
  try {
    const prunedOrganizationDefaults = await syncAllRateReadModels(rates, {}, false, true);
    const sanitizedFeedSnapshotCount = await removeLegacyRateFeedSnapshots();
    await setDoc(migrationRef, { status: 'complete', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rateCount: rates.length, sanitizedFeedSnapshotCount, adminEmail }, { merge: true });
    return { migrated: true, prunedOrganizationDefaults };
  } catch (error) {
    await setDoc(migrationRef, { status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown migration error', updatedAt: new Date().toISOString(), adminEmail }, { merge: true });
    throw error;
  }
}

export async function loadVisibilitySettings(): Promise<Record<string, Record<string, boolean>>> {
  const settings = await getDocs(collection(db, 'sheet_settings'));
  const visibility: Record<string, Record<string, boolean>> = {};
  for (const item of settings.docs) {
    const data = item.data();
    visibility[String(data.sheetName || item.id)] = {
      STAFF: data.disabledForStaff !== true,
      AGENT: data.disabledForAgents !== true,
    };
  }
  return visibility;
}

export interface AgentRateTarget {
  uid: string;
  organizationId: string;
}

export async function resolveAgentTargets(): Promise<AgentRateTarget[]> {
  const [requests, organizations] = await Promise.all([
    getDocs(query(collection(db, 'agent_access_requests'))),
    getDocs(query(collection(db, 'organizations'))),
  ]);
  const orgByName = new Map(organizations.docs.map((item) => [item.data().normalizedName as string, item.id]));
  const targets: AgentRateTarget[] = [];
  for (const request of requests.docs) {
    const data = request.data();
    if (data.status !== 'approved') continue;
    let organizationId = data.organizationId as string | undefined;
    if (!organizationId && data.requestedOrganizationName) {
      organizationId = orgByName.get(normalizeOrganizationName(data.requestedOrganizationName as string).normalizedName);
    }
    if (organizationId) targets.push({ uid: request.id, organizationId });
  }
  return targets;
}

export async function applyRateToAgentTargets(
  rate: CommissionRate,
  targets: AgentRateTarget[],
  options: { applyOrganization: boolean; applyIndividual: boolean; replaceOverrides: boolean; notify?: boolean; organizationIds?: string[] },
): Promise<void> {
  assertFirestoreWritesAllowed('Agent rate assignments');
  await ensureSheetVisibilityRecord(rate);
  const operationId = `agent-assignment-${crypto.randomUUID()}`;
  const key = opaqueRateId(rate);
  const organizationIds = Array.from(new Set(options.organizationIds || targets.map((target) => target.organizationId)));
  if (options.applyOrganization) {
    for (let offset = 0; offset < organizationIds.length; offset += 400) {
      const batch = writeBatch(db);
      organizationIds.slice(offset, offset + 400).forEach((organizationId) => {
        batch.set(doc(db, 'organization_agent_rates', organizationId, 'rates', key), buildAgentProjection(rate));
      });
      if (organizationIds.length) await batch.commit();
      for (const organizationId of organizationIds.slice(offset, offset + 400)) {
        await appendRateDelta(`org_${organizationId}`, { operationId: `${operationId}-${organizationId}`, kind: 'upsert', id: key, target: 'organizationOverrides', record: buildAgentProjection(rate) });
      }
    }
  }
  if (options.applyOrganization && options.replaceOverrides) {
    for (let offset = 0; offset < targets.length; offset += 400) {
      const selectedTargets = targets.slice(offset, offset + 400);
      const existingOverrides = await Promise.all(selectedTargets.map((target) => getDoc(doc(db, 'agent_rate_overrides', target.uid, 'rates', key))));
      const batch = writeBatch(db);
      let deletes = 0;
      existingOverrides.forEach((snapshot) => {
        if (!snapshot.exists()) return;
        batch.delete(snapshot.ref);
        deletes++;
      });
      if (deletes) await batch.commit();
      for (let index = 0; index < existingOverrides.length; index++) {
        const snapshot = existingOverrides[index];
        if (snapshot.exists()) await appendRateDelta(`user_${selectedTargets[index].uid}`, { operationId: `${operationId}-clear-${snapshot.id}`, kind: 'delete', id: snapshot.id, target: 'personalOverrides' });
      }
    }
  } else if (options.applyIndividual) {
    for (let offset = 0; offset < targets.length; offset += 400) {
      const batch = writeBatch(db);
      targets.slice(offset, offset + 400).forEach((target) => {
        batch.set(doc(db, 'agent_rate_overrides', target.uid, 'rates', key), buildAgentProjection(rate));
      });
      if (targets.length) await batch.commit();
      for (const target of targets.slice(offset, offset + 400)) {
        await appendRateDelta(`user_${target.uid}`, { operationId: `${operationId}-${target.uid}`, kind: 'upsert', id: key, target: 'personalOverrides', record: buildAgentProjection(rate) });
      }
    }
  }
  if (options.notify) {
    await publishRelevantUpdates({
      type: 'rates',
      title: 'Agent commission assignment updated',
      summary: 'Your commission rate assignment was updated by an Admin.',
      rates: [rate],
      includeStaff: false,
      roles: ['AGENT'],
      ...(options.applyOrganization ? { organizationIds } : { agentUids: targets.map((target) => target.uid) }),
    });
  }
}

export async function applyRatesToAgentTargets(
  rates: CommissionRate[],
  targets: AgentRateTarget[],
  options: { applyOrganization: boolean; applyIndividual: boolean; replaceOverrides: boolean; notify?: boolean; organizationIds?: string[] },
): Promise<void> {
  for (const rate of rates) await applyRateToAgentTargets(rate, targets, { ...options, notify: false });
  if (options.notify && rates.length) {
    await publishRelevantUpdates({
      type: 'rates',
      title: 'Agent commission assignments updated',
      summary: 'Your commission rate assignments were updated by an Admin.',
      rates,
      includeStaff: false,
      roles: ['AGENT'],
      ...(options.applyOrganization ? { organizationIds: Array.from(new Set(options.organizationIds || targets.map((target) => target.organizationId))) } : { agentUids: targets.map((target) => target.uid) }),
    });
  }
}

export async function clearIndividualOverride(uid: string, rate: CommissionRate): Promise<void> {
  assertFirestoreWritesAllowed('Agent rate assignments');
  const key = opaqueRateId(rate);
  await deleteDoc(doc(db, 'agent_rate_overrides', uid, 'rates', key));
  await appendRateDelta(`user_${uid}`, { operationId: `clear-override-${crypto.randomUUID()}`, kind: 'delete', id: key, target: 'personalOverrides' });
}

export async function clearAgentRateOverrides(targets: AgentRateTarget[], rates: CommissionRate[], adminEmail: string): Promise<number> {
  assertFirestoreWritesAllowed('Agent rate assignments');
  const operationId = `clear-${crypto.randomUUID()}`;
  const rateById = new Map(rates.map((rate) => [opaqueRateId(rate), rate]));
  const deletions: Array<{ ref: ReturnType<typeof doc>; target: AgentRateTarget; rate: CommissionRate; oldValue: unknown; fallback: string }> = [];
  for (const target of targets) {
    const personal = await getDocs(collection(db, 'agent_rate_overrides', target.uid, 'rates'));
    for (const item of personal.docs) {
      const rate = rateById.get(item.id);
      if (!rate) continue;
      const organizationDefault = await getDoc(doc(db, 'organization_agent_rates', target.organizationId, 'rates', item.id));
      deletions.push({
        ref: item.ref,
        target,
        rate,
        oldValue: item.get('agentRate'),
        fallback: organizationDefault.exists() ? 'organization rate' : 'shared default rate',
      });
    }
  }
  for (let offset = 0; offset < deletions.length; offset += 400) {
    const batch = writeBatch(db);
    deletions.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  for (const item of deletions) {
    await appendRateDelta(`user_${item.target.uid}`, { operationId: `${operationId}-${item.target.uid}-${opaqueRateId(item.rate)}`, kind: 'delete', id: opaqueRateId(item.rate), target: 'personalOverrides' });
  }
  const ratesByAgent = new Map<string, Map<string, CommissionRate>>();
  for (const item of deletions) {
    const agentRates = ratesByAgent.get(item.target.uid) || new Map<string, CommissionRate>();
    agentRates.set(opaqueRateId(item.rate), item.rate);
    ratesByAgent.set(item.target.uid, agentRates);
    const auditId = `${operationId}-${item.target.uid}-${opaqueRateId(item.rate)}`.slice(0, 120);
    await logRateChange(adminEmail, 'EDIT', item.rate.id, item.rate.universityName, {
      agentRate: { oldVal: item.oldValue, newVal: `Inherited ${item.fallback}` },
    }, auditId);
  }
  const noticeGroups = new Map<string, { rates: CommissionRate[]; uids: string[] }>();
  for (const [uid, agentRates] of ratesByAgent) {
    const rateList = Array.from(agentRates.entries()).sort(([left], [right]) => left.localeCompare(right));
    const signature = rateList.map(([id]) => id).join('|');
    const group = noticeGroups.get(signature) || { rates: rateList.map(([, rate]) => rate), uids: [] };
    group.uids.push(uid);
    noticeGroups.set(signature, group);
  }
  let noticeIndex = 0;
  for (const group of noticeGroups.values()) {
    await publishRelevantUpdates({
      type: 'rates',
      title: 'Individual rate override cleared',
      summary: 'Your individual rate was cleared; the organization rate or shared default now applies.',
      rates: group.rates,
      agentUids: group.uids,
      roles: ['AGENT'],
      includeStaff: false,
      operationId: `${operationId}-${noticeIndex++}`,
    });
  }
  return deletions.length;
}

export async function restoreAgentOrganizationDefault(uid: string, rate: CommissionRate, organizationId: string): Promise<void> {
  assertFirestoreWritesAllowed('Agent rate assignments');
  const key = opaqueRateId(rate);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'agent_rate_overrides', uid, 'rates', key));
  batch.delete(doc(db, 'organization_agent_rates', organizationId, 'rates', key));
  await batch.commit();
  const operationId = `restore-default-${crypto.randomUUID()}`;
  await appendRateDelta(`user_${uid}`, { operationId: `${operationId}-user`, kind: 'delete', id: key, target: 'personalOverrides' });
  await appendRateDelta(`org_${organizationId}`, { operationId: `${operationId}-org`, kind: 'delete', id: key, target: 'organizationOverrides' });
}

export async function clearAllOverridesForAgent(uid: string): Promise<void> {
  assertFirestoreWritesAllowed('Agent rate assignments');
  const overrides = await getDocs(collection(db, 'agent_rate_overrides', uid, 'rates'));
  for (let offset = 0; offset < overrides.docs.length; offset += 400) {
    const batch = writeBatch(db);
    overrides.docs.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  for (const item of overrides.docs) await appendRateDelta(`user_${uid}`, { operationId: `clear-all-${crypto.randomUUID()}-${item.id}`, kind: 'delete', id: item.id, target: 'personalOverrides' });
}

export async function resolveOrganizationRate(orgName: string): Promise<string | undefined> {
  const normalized = normalizeOrganizationName(orgName).normalizedName;
  const organizations = await getDocs(collection(db, 'organizations'));
  return organizations.docs.find((item) => item.data().normalizedName === normalized)?.id;
}

export async function syncAllAgentRatesFromMaster(rates: CommissionRate[], settings: Record<string, Record<string, boolean>> = {}, removeStale = false): Promise<void> {
  assertFirestoreWritesAllowed('Agent rate projections');
  const BATCH_SIZE = 400;
  const rateKeys = new Set(rates.map(opaqueRateId));
  if (removeStale) {
    const existing = await getDocs(collection(db, 'agent_rates'));
    const stale = existing.docs.filter((item) => !rateKeys.has(item.id) || !rates.some((rate) => opaqueRateId(rate) === item.id && visibleForRole(rate, 'AGENT', settings)));
    for (let offset = 0; offset < stale.length; offset += BATCH_SIZE) {
      const cleanup = writeBatch(db);
      stale.slice(offset, offset + BATCH_SIZE).forEach((item) => cleanup.delete(item.ref));
      await cleanup.commit();
    }
  }
  for (let offset = 0; offset < rates.length; offset += BATCH_SIZE) {
    const chunk = rates.slice(offset, offset + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const rate of chunk) {
      const key = opaqueRateId(rate);
      if (visibleForRole(rate, 'AGENT', settings)) {
        batch.set(doc(db, 'agent_rates', key), buildAgentProjection(rate));
      } else {
        batch.delete(doc(db, 'agent_rates', key));
      }
    }
    await batch.commit();
  }
}
