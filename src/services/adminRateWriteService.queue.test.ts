import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionRate } from '../types';
const { stageRateOperation, getAuth, writeBatch } = vi.hoisted(() => ({ stageRateOperation: vi.fn(), getAuth: vi.fn(() => ({ currentUser: { uid: 'admin-uid' } })), writeBatch: vi.fn() }));
vi.mock('firebase/auth', () => ({ getAuth }));
vi.mock('../lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'admin-uid' } } }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), deleteDoc: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), setDoc: vi.fn(), writeBatch, updateDoc: vi.fn() }));
vi.mock('./rateWriteQueue', () => ({ stageRateOperation }));
vi.mock('./rateReadModels', () => ({ removeRateReadModels: vi.fn(), resolveAgentTargets: vi.fn(), syncRateReadModels: vi.fn() }));
vi.mock('../utils/auditLogger', () => ({ logRateChange: vi.fn() }));
vi.mock('./userUpdates', () => ({ publishRelevantUpdates: vi.fn() }));
vi.mock('./firestoreOfflineMode', () => ({ enterQuotaOfflineMode: vi.fn(), isQuotaError: vi.fn(() => false) }));
vi.mock('./firestoreWriteGuard', () => ({ assertFirestoreWritesAllowed: vi.fn() }));
vi.mock('./rateChangeFeed', () => ({ appendRateDeltas: vi.fn() }));
import { createRate, deleteRates, updateRate } from './adminRateWriteService';

const rate: CommissionRate = { id: 'rate', universityId: 'uni', universityName: 'University', intake: 'Sept 2027', aggregator: 'BASECHAN', studyLevel: 'UG', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' };
describe('interactive rate writes stage locally', () => {
  beforeEach(() => { vi.clearAllMocks(); stageRateOperation.mockResolvedValue({ operationId: 'op', status: 'pending' }); });
  it('stages a compact field patch and its original base values', async () => {
    await updateRate(rate, { ...rate, guidance: 'ALLOWED' }, 'admin@example.com');
    expect(stageRateOperation).toHaveBeenCalledWith('admin-uid', expect.objectContaining({ mutations: [{ kind: 'update', id: 'rate', nextId: 'rate', patch: { guidance: 'ALLOWED' }, baseFields: { guidance: 'FOCUS' }, baseSnapshot: rate }] }));
    expect(writeBatch).not.toHaveBeenCalled();
  });
  it('stages create and delete actions without touching Firestore', async () => {
    await createRate(rate, 'admin@example.com');
    await deleteRates([rate], 'admin@example.com');
    expect(stageRateOperation).toHaveBeenCalledTimes(2);
    expect(writeBatch).not.toHaveBeenCalled();
  });
});
