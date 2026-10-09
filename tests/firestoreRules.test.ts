import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-basechan',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'rates/rate-1'), { universityName: 'Example University', agentRate: 12 });
    await setDoc(doc(firestore, 'admin_rate_operations/operation-1'), { operationId: 'operation-1', stage: 'started' });
    await setDoc(doc(firestore, 'admin_rate_operations/operation-1/mutations/00000000'), { next: { id: 'rate-1' } });
    const safeRoute = { id: 'rate-1', universityId: 'u-1', universityName: 'Example University', intake: 'Sept 2027', studyLevel: 'PG', aggregator: 'Route A', sourceSheet: 'Visible Sheet' };
    const safePayout = { id: 'rate-1', universityId: 'u-1', universityName: 'Example University', intake: 'Sept 2027', studyLevel: 'PG', agentRate: 12, isFlatFee: false, netOrGross: 'GROSS', sourceSheet: 'Visible Sheet' };
    const hiddenPayout = { ...safePayout, sourceSheet: 'Hidden Sheet' };
    await setDoc(doc(firestore, 'staff_rates/rate-1'), safeRoute);
    await setDoc(doc(firestore, 'agent_rates/rate-1'), safePayout);
    await setDoc(doc(firestore, 'organization_agent_rates/org-a/rates/rate-1'), { ...safePayout, agentRate: 13 });
    await setDoc(doc(firestore, 'organization_agent_rates/org-b/rates/rate-1'), { ...safePayout, agentRate: 14 });
    await setDoc(doc(firestore, 'agent_rate_overrides/agent-a/rates/rate-1'), { ...safePayout, agentRate: 15 });
    await setDoc(doc(firestore, 'agent_rate_overrides/agent-b/rates/rate-1'), { ...safePayout, agentRate: 16 });
    await setDoc(doc(firestore, 'agent_rate_overrides/agent-a/rates/hidden-rate'), hiddenPayout);
    await setDoc(doc(firestore, 'sheet_settings/Hidden Sheet'), { sheetName: 'Hidden Sheet', disabledForAgents: true });
    await setDoc(doc(firestore, 'sheet_settings/Visible Sheet'), { sheetName: 'Visible Sheet', disabledForAgents: false, disabledForStaff: false });
    await setDoc(doc(firestore, 'users/staff'), {
      uid: 'staff', email: 'sarah.basechaninternational@gmail.com', isDisabled: false,
      chatPreferences: { favouriteLevel: 'PG' },
    });
    await setDoc(doc(firestore, 'users/legacy-staff'), { isDisabled: false, adminNote: 'legacy profile' });
    await setDoc(doc(firestore, 'agent_access_requests/agent-a'), {
      uid: 'agent-a', status: 'approved', organizationId: 'org-a',
    });
    await setDoc(doc(firestore, 'agent_access_requests/agent-b'), {
      uid: 'agent-b', status: 'approved', organizationId: 'org-b',
    });
    await setDoc(doc(firestore, 'agent_access_requests/pending-agent'), {
      uid: 'pending-agent', status: 'pending', organizationId: 'org-a',
    });
    await setDoc(doc(firestore, 'users/agent-a/updates/update-1'), { title: 'Rate information updated', isRead: false });
    await setDoc(doc(firestore, 'rate_change_feeds/agent'), { sequence: 1 });
    await setDoc(doc(firestore, 'rate_change_feeds/agent/changes/0000000000000001'), { scope: 'agent', sequence: 1, operationId: 'op-1', kind: 'upsert', id: 'rate-1', target: 'rates' });
    await setDoc(doc(firestore, 'rate_change_feeds/org_org-a'), { sequence: 1 });
    await setDoc(doc(firestore, 'rate_change_feeds/org_org-a/changes/0000000000000001'), { scope: 'org_org-a', sequence: 1, operationId: 'op-1', kind: 'upsert', id: 'rate-1', target: 'organizationOverrides' });
    await setDoc(doc(firestore, 'rate_change_feeds/org_org-b'), { sequence: 1 });
    await setDoc(doc(firestore, 'rate_change_feeds/org_org-b/changes/0000000000000001'), { scope: 'org_org-b', sequence: 1, operationId: 'op-1', kind: 'upsert', id: 'rate-1', target: 'organizationOverrides' });
    await setDoc(doc(firestore, 'rate_change_feeds/user_agent-a'), { sequence: 1 });
    await setDoc(doc(firestore, 'rate_change_feeds/user_agent-a/changes/0000000000000001'), { scope: 'user_agent-a', sequence: 1, operationId: 'op-1', kind: 'upsert', id: 'rate-1', target: 'personalOverrides' });
    await setDoc(doc(firestore, 'rate_change_feeds/staff'), { sequence: 1 });
    await setDoc(doc(firestore, 'rate_change_feeds/staff/changes/0000000000000001'), { scope: 'staff', sequence: 1, operationId: 'op-1', kind: 'upsert', id: 'rate-1', target: 'rates' });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore role and organization boundaries', () => {
  it('allows the Admin domain to read canonical rates', async () => {
    const firestore = testEnv.authenticatedContext('admin', {
      email: 'admin@basechaninternational.com',
      email_verified: true,
    }).firestore();

    await assertSucceeds(getDoc(doc(firestore, 'rates/rate-1')));
    await assertSucceeds(getDoc(doc(firestore, 'admin_rate_operations/operation-1')));
    await assertSucceeds(getDoc(doc(firestore, 'admin_rate_operations/operation-1/mutations/00000000')));
    await assertSucceeds(setDoc(doc(firestore, 'admin_migrations/role-rate-models-v1'), { status: 'complete' }));
    await assertSucceeds(getDoc(doc(firestore, 'users/admin/chat_conversations/chat-1')));
    await assertSucceeds(setDoc(doc(firestore, 'users/admin/favorite_schools/school-1'), { universityId: 'school-1' }));
    await assertSucceeds(getDoc(doc(firestore, 'users/admin/chat_private/profile')));
    await assertSucceeds(getDoc(doc(firestore, 'users/admin/updates/update-1')));
  });

  it('does not allow Agents to inspect pending Admin write operations', async () => {
    const firestore = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    await assertFails(getDoc(doc(firestore, 'admin_rate_operations/operation-1')));
    await assertFails(getDoc(doc(firestore, 'admin_rate_operations/operation-1/mutations/00000000')));
    await assertFails(getDoc(doc(firestore, 'admin_migrations/role-rate-models-v1')));
  });

  it('lets Staff read routing projections but not canonical or Agent payout data', async () => {
    const firestore = testEnv.authenticatedContext('staff', {
      email: 'sarah.basechaninternational@gmail.com',
      email_verified: true,
    }).firestore();

    await assertSucceeds(getDoc(doc(firestore, 'staff_rates/rate-1')));
    await assertFails(getDoc(doc(firestore, 'rates/rate-1')));
    await assertFails(getDoc(doc(firestore, 'agent_rates/rate-1')));
    await assertSucceeds(getDoc(doc(firestore, 'users/staff/chat_conversations/chat-1')));
    await assertSucceeds(getDoc(doc(firestore, 'users/staff/favorite_schools/school-1')));
    await assertSucceeds(getDoc(doc(firestore, 'users/staff/chat_private/profile')));
    await assertSucceeds(setDoc(doc(firestore, 'users/staff/chat_private/profile'), { uid: 'staff', suggestionTerms: [] }));
    await assertSucceeds(getDoc(doc(firestore, 'users/staff')));
    await assertSucceeds(setDoc(doc(firestore, 'users/staff'), { isOnline: false }, { merge: true }));
    await assertFails(setDoc(doc(firestore, 'users/staff'), { isDisabled: true }, { merge: true }));
    await assertFails(setDoc(doc(firestore, 'users/staff'), { role: 'ADMIN' }, { merge: true }));
    const legacyFirestore = testEnv.authenticatedContext('legacy-staff', {
      email: 'legacy.basechaninternational@gmail.com', email_verified: true,
    }).firestore();
    await assertSucceeds(setDoc(doc(legacyFirestore, 'users/legacy-staff'), {
      uid: 'legacy-staff', email: 'legacy.basechaninternational@gmail.com', displayName: 'Legacy',
      photoURL: '', lastLoginAt: new Date().toISOString(), isOnline: true,
    }, { merge: true }));
    await assertSucceeds(getDocs(collection(firestore, 'sheet_settings')));
  });

  it('allows safe self-created profiles while rejecting self-assigned access fields', async () => {
    const firestore = testEnv.authenticatedContext('new-agent', { email: 'new@example.com' }).firestore();
    const profile = {
      uid: 'new-agent', email: 'new@example.com', displayName: 'New Agent', photoURL: '',
      createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(), isOnline: true,
    };
    await assertSucceeds(setDoc(doc(firestore, 'users/new-agent'), profile));
    await assertFails(setDoc(doc(firestore, 'users/forged-agent'), { ...profile, uid: 'forged-agent', role: 'ADMIN' }));
  });

  it('lets an approved Agent read their own profile and shared sheet settings', async () => {
    const firestore = testEnv.authenticatedContext('agent-a', {
      email: 'agent@example.com',
      email_verified: true,
    }).firestore();

    await assertSucceeds(getDoc(doc(firestore, 'users/agent-a')));
    await assertSucceeds(getDocs(collection(firestore, 'sheet_settings')));
  });

  it('lets an approved Agent read shared and own-organization payout data only', async () => {
    const firestore = testEnv.authenticatedContext('agent-a', {
      email: 'agent@example.com',
      email_verified: true,
    }).firestore();

    await assertSucceeds(getDoc(doc(firestore, 'agent_rates/rate-1')));
    await assertSucceeds(getDoc(doc(firestore, 'organization_agent_rates/org-a/rates/rate-1')));
    await assertSucceeds(getDoc(doc(firestore, 'agent_rate_overrides/agent-a/rates/rate-1')));
    await assertFails(getDoc(doc(firestore, 'organization_agent_rates/org-b/rates/rate-1')));
    await assertFails(getDoc(doc(firestore, 'agent_rate_overrides/agent-b/rates/rate-1')));
    await assertFails(getDoc(doc(firestore, 'rates/rate-1')));
    await assertFails(getDoc(doc(firestore, 'staff_rates/rate-1')));
  });

  it('scopes incremental rate change feeds to the current role, organization, and account', async () => {
    const agent = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    const staff = testEnv.authenticatedContext('staff', { email: 'sarah.basechaninternational@gmail.com' }).firestore();
    const pending = testEnv.authenticatedContext('pending-agent', { email: 'pending@example.com' }).firestore();

    await assertSucceeds(getDocs(collection(agent, 'rate_change_feeds/agent/changes')));
    await assertSucceeds(getDocs(collection(agent, 'rate_change_feeds/org_org-a/changes')));
    await assertSucceeds(getDocs(collection(agent, 'rate_change_feeds/user_agent-a/changes')));
    await assertFails(getDocs(collection(agent, 'rate_change_feeds/org_org-b/changes')));
    await assertFails(getDocs(collection(agent, 'rate_change_feeds/staff/changes')));
    await assertSucceeds(getDocs(collection(staff, 'rate_change_feeds/staff/changes')));
    await assertFails(getDocs(collection(staff, 'rate_change_feeds/agent/changes')));
    await assertFails(getDocs(collection(pending, 'rate_change_feeds/agent/changes')));
  });

  it('hides legacy rate snapshots from non-Admin feed readers', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'rate_change_feeds/agent/changes/legacy-snapshot'), {
        operationId: 'legacy', kind: 'upsert', id: 'rate-1', target: 'rates',
        record: { universityName: 'Example University', agentRate: 12 },
      });
    });
    const agent = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    const admin = testEnv.authenticatedContext('admin', { email: 'admin@basechaninternational.com' }).firestore();
    await assertFails(getDoc(doc(agent, 'rate_change_feeds/agent/changes/legacy-snapshot')));
    await assertSucceeds(getDoc(doc(admin, 'rate_change_feeds/agent/changes/legacy-snapshot')));
  });

  it('blocks an Agent from reading an individual override from a hidden sheet', async () => {
    const firestore = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    await assertFails(getDoc(doc(firestore, 'agent_rate_overrides/agent-a/rates/hidden-rate')));
  });

  it('allows role-read-model queries only when filtered to visible sheet names', async () => {
    const firestore = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    await assertSucceeds(getDocs(query(collection(firestore, 'agent_rates'), where('sourceSheet', 'in', ['Visible Sheet']))));
    await assertFails(getDocs(query(collection(firestore, 'agent_rates'), where('sourceSheet', 'in', ['Hidden Sheet']))));
  });

  it('denies rate reads to a pending Agent and blocks self-assigned Admin role fields', async () => {
    const firestore = testEnv.authenticatedContext('pending-agent', {
      email: 'pending@example.com',
      email_verified: true,
    }).firestore();

    await assertFails(getDoc(doc(firestore, 'agent_rates/rate-1')));
    await assertFails(getDoc(doc(firestore, 'organization_agent_rates/org-a/rates/rate-1')));
    await assertFails(setDoc(doc(firestore, 'users/pending-agent'), {
      uid: 'pending-agent', email: 'pending@example.com', role: 'ADMIN', isDisabled: false,
    }));
  });

  it('lets only an approved Agent read their own chat, favorites, private profile, and updates', async () => {
    const own = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    const other = testEnv.authenticatedContext('agent-b', { email: 'other@example.com' }).firestore();
    await assertSucceeds(getDoc(doc(own, 'users/agent-a/chat_conversations/chat-1')));
    await assertFails(getDoc(doc(other, 'users/agent-a/chat_conversations/chat-1')));
    await assertSucceeds(getDoc(doc(own, 'users/agent-a/favorite_schools/school-1')));
    await assertSucceeds(getDoc(doc(own, 'users/agent-a/chat_private/profile')));
    await assertSucceeds(getDoc(doc(own, 'users/agent-a/updates/update-1')));
    await assertSucceeds(setDoc(doc(own, 'users/agent-a/updates/update-1'), { isRead: true }, { merge: true }));
    await assertFails(setDoc(doc(other, 'users/agent-a/updates/update-1'), { isRead: true }, { merge: true }));
    await assertFails(setDoc(doc(own, 'users/agent-a/updates/update-1'), { title: 'Forged update' }));
  });

  it('allows ten rapid questions and blocks an eleventh using Firestore server time', async () => {
    const own = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    const usageRef = doc(own, 'users/agent-a/chat_private/usage');
    await assertSucceeds(setDoc(usageRef, {
      currentConversationId: 'chat-1', queriesThisSession: 1, queryTimestamps: [Date.now()],
      updatedAt: new Date().toISOString(), querySlot1At: serverTimestamp(),
    }));
    await assertFails(setDoc(usageRef, {
      currentConversationId: 'chat-1', queriesThisSession: 2, queryTimestamps: [Date.now(), Date.now()],
      updatedAt: new Date().toISOString(), querySlot2At: new Date(),
    }, { merge: true }));
    for (let queryNumber = 2; queryNumber <= 10; queryNumber++) {
      await assertSucceeds(setDoc(usageRef, {
        currentConversationId: 'chat-1',
        queriesThisSession: queryNumber,
        queryTimestamps: Array.from({ length: Math.min(queryNumber, 10) }, () => Date.now()),
        updatedAt: new Date().toISOString(),
        [`querySlot${queryNumber}At`]: serverTimestamp(),
      }, { merge: true }));
    }
    await assertFails(setDoc(usageRef, {
      currentConversationId: 'chat-1', queriesThisSession: 11,
      queryTimestamps: Array.from({ length: 10 }, () => Date.now()),
      updatedAt: new Date().toISOString(), querySlot1At: serverTimestamp(),
    }, { merge: true }));
  });

  it('prevents Staff and Agent clients from writing protected read projections', async () => {
    const staff = testEnv.authenticatedContext('staff', { email: 'sarah.basechaninternational@gmail.com' }).firestore();
    const agent = testEnv.authenticatedContext('agent-a', { email: 'agent@example.com' }).firestore();
    await assertFails(setDoc(doc(staff, 'staff_rates/fake'), { masterRate: 99 }));
    await assertFails(setDoc(doc(agent, 'agent_rates/fake'), { agentRate: 999 }));
    await assertFails(setDoc(doc(agent, 'organization_agent_rates/org-b/rates/fake'), { agentRate: 999 }));
  });
});
