import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveLocalOfflineImport,
  getPendingOfflineImports,
  clearPendingOfflineImports,
  stageRatesToLocalDatabase,
  getLocalRates,
  deleteLocalRateDatabase,
  type PendingOfflineImport,
} from './localRateDatabase';
import type { CommissionRate } from '../types';

describe('localRateDatabase - Pending Offline Imports and Local Rate Staging', () => {
  const testUid = 'user-test-offline-123';
  const otherUid = 'user-test-offline-456';

  const mockRate1: CommissionRate = {
    id: 'oxford__sept_2026__si_uk__ug',
    universityId: 'oxford',
    universityName: 'University of Oxford',
    country: 'UK',
    intake: 'Sept 2026',
    studyLevel: 'UG',
    aggregator: 'SI-UK',
    masterRate: 20,
    agentRate: 15,
    diffMargin: 5,
    isFlatFee: false,
    netOrGross: 'NET',
    guidance: 'FOCUS',
  };

  const mockRate2: CommissionRate = {
    id: 'cambridge__sept_2026__edvoy__pg',
    universityId: 'cambridge',
    universityName: 'University of Cambridge',
    country: 'UK',
    intake: 'Sept 2026',
    studyLevel: 'PG',
    aggregator: 'EDVOY',
    masterRate: 18,
    agentRate: 14,
    diffMargin: 4,
    isFlatFee: false,
    netOrGross: 'GROSS',
    guidance: 'ALLOWED',
  };

  const mockImportItem: PendingOfflineImport = {
    id: 'import-batch-001',
    rates: [mockRate1, mockRate2],
    sheetNames: ['UK Master 2026', 'Agent Rates'],
    importedAt: '2026-03-31T12:00:00.000Z',
    importedBy: 'admin@basechan.com',
  };

  beforeEach(async () => {
    await deleteLocalRateDatabase(testUid);
    await deleteLocalRateDatabase(otherUid);
  });

  afterEach(async () => {
    await deleteLocalRateDatabase(testUid);
    await deleteLocalRateDatabase(otherUid);
  });

  describe('Pending Offline Imports Store', () => {
    it('saves and retrieves pending offline imports', async () => {
      const initial = await getPendingOfflineImports(testUid);
      expect(initial).toEqual([]);

      await saveLocalOfflineImport(testUid, mockImportItem);

      const items = await getPendingOfflineImports(testUid);
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual(mockImportItem);
    });

    it('handles multiple pending offline imports for a user', async () => {
      const secondItem: PendingOfflineImport = {
        id: 'import-batch-002',
        rates: [mockRate1],
        sheetNames: ['Batch 2'],
        importedAt: '2026-03-31T14:00:00.000Z',
        importedBy: 'staff@basechan.com',
      };

      await saveLocalOfflineImport(testUid, mockImportItem);
      await saveLocalOfflineImport(testUid, secondItem);

      const items = await getPendingOfflineImports(testUid);
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.id)).toContain('import-batch-001');
      expect(items.map((i) => i.id)).toContain('import-batch-002');
    });

    it('clears pending offline imports', async () => {
      await saveLocalOfflineImport(testUid, mockImportItem);
      let items = await getPendingOfflineImports(testUid);
      expect(items).toHaveLength(1);

      await clearPendingOfflineImports(testUid);
      items = await getPendingOfflineImports(testUid);
      expect(items).toEqual([]);
    });

    it('isolates pending offline imports by user UID', async () => {
      await saveLocalOfflineImport(testUid, mockImportItem);

      const testUserItems = await getPendingOfflineImports(testUid);
      const otherUserItems = await getPendingOfflineImports(otherUid);

      expect(testUserItems).toHaveLength(1);
      expect(otherUserItems).toEqual([]);
    });
  });

  describe('stageRatesToLocalDatabase', () => {
    it('does nothing when newRates is empty', async () => {
      await stageRatesToLocalDatabase(testUid, []);
      const rates = await getLocalRates(testUid);
      expect(rates).toEqual([]);
    });

    it('stages new rates into the local IndexedDB rates store', async () => {
      await stageRatesToLocalDatabase(testUid, [mockRate1, mockRate2]);

      const rates = await getLocalRates(testUid);
      expect(rates).toHaveLength(2);
      expect(rates).toEqual(expect.arrayContaining([mockRate1, mockRate2]));
    });

    it('merges new rates into existing local rates without deleting un-updated rates', async () => {
      // Stage initial rate
      await stageRatesToLocalDatabase(testUid, [mockRate1]);

      // Stage updated rate1 and new rate2
      const updatedRate1: CommissionRate = {
        ...mockRate1,
        agentRate: 18,
        diffMargin: 2,
      };

      await stageRatesToLocalDatabase(testUid, [updatedRate1, mockRate2]);

      const rates = await getLocalRates(testUid);
      expect(rates).toHaveLength(2);

      const rate1InDb = rates.find((r) => r.id === mockRate1.id);
      expect(rate1InDb?.agentRate).toBe(18);
      expect(rate1InDb?.diffMargin).toBe(2);

      const rate2InDb = rates.find((r) => r.id === mockRate2.id);
      expect(rate2InDb).toEqual(mockRate2);
    });
  });
});
