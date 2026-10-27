import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scopeForUser, verifyServerRateAccess, syncRateSheetsCacheFirst, syncLocalRateData } from './rateSyncService';
import type { RateSheetBucket, CommissionRate } from '../types';
import type { RateScope } from './localRateDatabase';
import * as localDb from './localRateDatabase';
import * as firestoreModule from 'firebase/firestore';

vi.mock('./localRateDatabase', () => ({
  getAllLocalSheetBuckets: vi.fn(),
  getLocalRateMetadata: vi.fn(),
  saveLocalSheetBucket: vi.fn(),
  saveLocalRateMetadata: vi.fn(),
  getLocalSheetBucket: vi.fn(),
  replaceLocalRateSnapshot: vi.fn(),
  applyLocalRateDeltas: vi.fn(),
}));

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    doc: vi.fn(),
    collection: vi.fn(),
    getDocFromServer: vi.fn(),
    getDocsFromServer: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
  };
});

describe('rateSyncService', () => {
  const sampleBucket: RateSheetBucket = {
    sheetKey: '2026_agent_master',
    sheetName: '2026 AGENT MASTER',
    rateCount: 2,
    updatedAt: '2026-10-12T10:00:00.000Z',
    updatedBy: 'admin@test.com',
    rates: [
      {
        id: 'aberdeen__sept_2026__si_uk__ug',
        universityId: 'aberdeen',
        universityName: 'University of Aberdeen',
        country: 'UK',
        intake: 'Sept 2026',
        studyLevel: 'UG',
        aggregator: 'SI-UK',
        masterRate: 15,
        agentRate: 12,
        diffMargin: 3,
        isFlatFee: false,
        netOrGross: 'NET',
        guidance: 'FOCUS',
      } as CommissionRate,
      {
        id: 'dundee__sept_2026__edvoy__pg',
        universityId: 'dundee',
        universityName: 'University of Dundee',
        country: 'UK',
        intake: 'Sept 2026',
        studyLevel: 'PG',
        aggregator: 'EDVOY',
        masterRate: 18,
        agentRate: 14,
        diffMargin: 4,
        isFlatFee: false,
        netOrGross: 'NET',
        guidance: 'ALLOWED',
      } as CommissionRate,
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scopeForUser', () => {
    it('creates clean RateScope object for ADMIN and STAFF', () => {
      const adminScope = scopeForUser('admin-1', 'ADMIN');
      expect(adminScope).toEqual({ uid: 'admin-1', role: 'ADMIN' });

      const staffScope = scopeForUser('staff-1', 'STAFF');
      expect(staffScope).toEqual({ uid: 'staff-1', role: 'STAFF' });
    });

    it('includes organizationId for AGENT role', () => {
      const agentScope = scopeForUser('agent-1', 'AGENT', 'si-uk-ghana');
      expect(agentScope).toEqual({
        uid: 'agent-1',
        role: 'AGENT',
        organizationId: 'si-uk-ghana',
      });
    });
  });

  describe('verifyServerRateAccess', () => {
    it('allows active ADMIN and STAFF access without agent request checks', async () => {
      vi.mocked(firestoreModule.getDocFromServer).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ isDisabled: false }),
      } as any);

      const scope: RateScope = { uid: 'staff-1', role: 'STAFF' };
      await expect(verifyServerRateAccess(scope)).resolves.not.toThrow();
    });

    it('throws error when user profile is marked as disabled', async () => {
      vi.mocked(firestoreModule.getDocFromServer).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ isDisabled: true }),
      } as any);

      const scope: RateScope = { uid: 'staff-1', role: 'STAFF' };
      await expect(verifyServerRateAccess(scope)).rejects.toThrow('Account access has been disabled.');
    });

    it('verifies approved organization request for AGENT role', async () => {
      vi.mocked(firestoreModule.getDocFromServer)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ isDisabled: false }),
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ status: 'approved', organizationId: 'si-uk-ghana' }),
        } as any);

      const scope: RateScope = { uid: 'agent-1', role: 'AGENT', organizationId: 'si-uk-ghana' };
      await expect(verifyServerRateAccess(scope)).resolves.not.toThrow();
    });

    it('rejects AGENT access when organization approval is missing or mismatched', async () => {
      vi.mocked(firestoreModule.getDocFromServer)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ isDisabled: false }),
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ status: 'pending', organizationId: 'si-uk-ghana' }),
        } as any);

      const scope: RateScope = { uid: 'agent-1', role: 'AGENT', organizationId: 'si-uk-ghana' };
      await expect(verifyServerRateAccess(scope)).rejects.toThrow('Agent access is no longer approved');
    });
  });

  describe('syncRateSheetsCacheFirst', () => {
    it('returns cached rates immediately when server timestamp matches local metadata (1 read total)', async () => {
      const mockMetadata = { ratesLastUpdatedAt: '2026-10-12T10:00:00.000Z' } as any;
      vi.mocked(localDb.getAllLocalSheetBuckets).mockResolvedValue([sampleBucket]);
      vi.mocked(localDb.getLocalRateMetadata).mockResolvedValue(mockMetadata);

      vi.mocked(firestoreModule.getDocFromServer).mockResolvedValue({
        exists: () => true,
        data: () => ({ ratesLastUpdatedAt: '2026-10-12T10:00:00.000Z' }),
      } as any);

      const rates = await syncRateSheetsCacheFirst({ uid: 'admin-1', role: 'ADMIN' });
      expect(rates).toHaveLength(2);
      expect(rates[0].universityName).toBe('University of Aberdeen');
      expect(rates[1].universityName).toBe('University of Dundee');
      expect(firestoreModule.getDocsFromServer).not.toHaveBeenCalled();
    });

    it('fetches updated rate sheets from server when timestamp changes and updates IndexedDB', async () => {
      const mockMetadata = { ratesLastUpdatedAt: '2026-10-11T10:00:00.000Z' } as any;
      vi.mocked(localDb.getAllLocalSheetBuckets).mockResolvedValue([sampleBucket]);
      vi.mocked(localDb.getLocalRateMetadata).mockResolvedValue(mockMetadata);

      vi.mocked(firestoreModule.getDocFromServer).mockResolvedValue({
        exists: () => true,
        data: () => ({ ratesLastUpdatedAt: '2026-10-12T12:00:00.000Z' }),
      } as any);

      vi.mocked(firestoreModule.getDocsFromServer).mockResolvedValue({
        docs: [
          {
            id: '2026_agent_master',
            data: () => sampleBucket,
          },
        ],
      } as any);

      const rates = await syncRateSheetsCacheFirst({ uid: 'admin-1', role: 'ADMIN' });
      expect(rates).toHaveLength(2);
      expect(firestoreModule.getDocsFromServer).toHaveBeenCalledTimes(1);
      expect(localDb.saveLocalSheetBucket).toHaveBeenCalledWith('2026_agent_master', sampleBucket, 'admin-1');
    });

    it('gracefully falls back to cached rates if network or Firestore throws error', async () => {
      vi.mocked(localDb.getAllLocalSheetBuckets).mockResolvedValue([sampleBucket]);
      vi.mocked(localDb.getLocalRateMetadata).mockResolvedValue(null);

      vi.mocked(firestoreModule.getDocFromServer).mockRejectedValue(new Error('Network offline'));

      const rates = await syncRateSheetsCacheFirst({ uid: 'admin-1', role: 'ADMIN' });
      expect(rates).toHaveLength(2);
      expect(rates[0].id).toBe('aberdeen__sept_2026__si_uk__ug');
    });
  });

  describe('Admin delta sync', () => {
    it('uses only the feed cursor when a complete Admin cache is initialized', async () => {
      vi.mocked(localDb.getLocalRateMetadata).mockResolvedValue({
        id: 'scope', uid: 'admin-1', role: 'ADMIN', complete: true, cursors: { admin: 8 },
        adminFeedInitialized: true, lastSyncedAt: '', lastVerifiedAt: '',
      });
      vi.mocked(firestoreModule.getDocFromServer).mockResolvedValue({ data: () => ({ sequence: 8 }) } as any);
      vi.mocked(localDb.applyLocalRateDeltas).mockResolvedValue();

      const result = await syncLocalRateData({ uid: 'admin-1', role: 'ADMIN' });

      expect(result.changed).toBe(false);
      expect(firestoreModule.getDocFromServer).toHaveBeenCalledTimes(1);
      expect(firestoreModule.getDocs).not.toHaveBeenCalled();
      expect(firestoreModule.getDocsFromServer).not.toHaveBeenCalled();
      expect(localDb.applyLocalRateDeltas).toHaveBeenCalledWith({ uid: 'admin-1', role: 'ADMIN' }, [], { admin: 8 });
    });

    it('bootstraps a legacy cache from a cursor taken before the canonical snapshot', async () => {
      vi.mocked(localDb.getLocalRateMetadata).mockResolvedValue({
        id: 'scope', uid: 'admin-1', role: 'ADMIN', complete: true, cursors: {},
        lastSyncedAt: '', lastVerifiedAt: '',
      });
      vi.mocked(firestoreModule.getDocFromServer).mockResolvedValue({ data: () => ({ sequence: 8 }) } as any);
      vi.mocked(firestoreModule.collection).mockReturnValue({ path: 'rates' } as any);
      vi.mocked(firestoreModule.getDocs).mockResolvedValue({ docs: [{ id: 'rate-1', data: () => sampleBucket.rates[0] }] } as any);
      vi.mocked(firestoreModule.getDocsFromServer).mockResolvedValue({ docs: [] } as any);
      vi.mocked(localDb.replaceLocalRateSnapshot).mockResolvedValue();
      vi.mocked(localDb.applyLocalRateDeltas).mockResolvedValue();

      const result = await syncLocalRateData({ uid: 'admin-1', role: 'ADMIN' });

      expect(result.changed).toBe(true);
      expect(firestoreModule.getDocFromServer).toHaveBeenCalledTimes(1);
      expect(firestoreModule.getDocs).toHaveBeenCalledTimes(1);
      expect(localDb.replaceLocalRateSnapshot).toHaveBeenCalledWith(
        { uid: 'admin-1', role: 'ADMIN' },
        [{ ...sampleBucket.rates[0], id: 'rate-1' }], [], [], { admin: 8 },
      );
    });
  });
});
