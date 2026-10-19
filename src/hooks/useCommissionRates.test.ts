import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionRate } from '../types';
import { useCommissionRates } from './useCommissionRates';
import { scopeForUser, syncLocalRateData, syncRateSheetsCacheFirst } from '../services/rateSyncService';
import { getAllLocalSheetBuckets, getLocalAgentOverrides, getLocalRateMetadata, getLocalRates } from '../services/localRateDatabase';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/rateSyncService', () => ({
  syncRateSheetsCacheFirst: vi.fn(),
  syncLocalRateData: vi.fn(),
  scopeForUser: vi.fn((uid, role, organizationId) => ({ uid, role, organizationId })),
  selectRatesForScope: vi.fn((rates) => rates),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn((_col, callback) => {
    callback({ docs: [] });
    return vi.fn();
  }),
}));

vi.mock('../services/firestoreOfflineMode', () => ({
  isQuotaOffline: vi.fn().mockReturnValue(false),
  subscribeToFirestoreMode: vi.fn().mockReturnValue(vi.fn()),
  getQuotaRetryAt: vi.fn().mockReturnValue(0),
  lockFirestoreNetworkForQuota: vi.fn(),
  beginQuotaProbe: vi.fn(),
  completeQuotaProbe: vi.fn(),
  enterQuotaOfflineMode: vi.fn(),
  isQuotaError: vi.fn().mockReturnValue(false),
  isConnectivityError: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/localRateDatabase', () => ({
  getAllLocalSheetBuckets: vi.fn().mockResolvedValue([]),
  getLocalRateMetadata: vi.fn().mockResolvedValue(null),
  getLocalRates: vi.fn().mockResolvedValue([]),
  getLocalAgentOverrides: vi.fn().mockResolvedValue({ organization: [], personal: [] }),
  subscribeToLocalRateChanges: vi.fn().mockReturnValue(vi.fn()),
}));

const mockUser = { uid: 'user_123', email: 'test@example.com' };
const mockAccess = { accessState: 'approved', organizationId: 'org_1' };

const sampleRate: CommissionRate = {
  id: 'rate_1',
  universityId: 'uni_1',
  universityName: 'Oxford University',
  country: 'UK',
  intake: 'Sep 2026',
  aggregator: 'SI-UK',
  studyLevel: 'PG',
  masterRate: 15,
  agentRate: 10,
  diffMargin: 5,
  isFlatFee: false,
  netOrGross: 'GROSS',
  guidance: 'FOCUS',
  sourceSheet: '2026 AGENT MASTER',
};

describe('useCommissionRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(syncLocalRateData).mockReset();
    vi.mocked(getAllLocalSheetBuckets).mockResolvedValue([]);
    vi.mocked(getLocalRates).mockResolvedValue([]);
    vi.mocked(getLocalAgentOverrides).mockResolvedValue({ organization: [], personal: [] });
    vi.mocked(getLocalRateMetadata).mockResolvedValue(null);
  });

  it('returns empty rates and loading false when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      role: 'AGENT',
      access: { accessState: 'none' },
    } as any);

    const { result } = renderHook(() => useCommissionRates());

    expect(result.current.loading).toBe(false);
    expect(result.current.rates).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('invokes syncRateSheetsCacheFirst and indexes rates when user is authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      role: 'ADMIN',
      access: mockAccess,
    } as any);

    vi.mocked(syncRateSheetsCacheFirst).mockResolvedValue([sampleRate]);

    const { result } = renderHook(() => useCommissionRates());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(syncRateSheetsCacheFirst).toHaveBeenCalledWith({
      uid: 'user_123',
      role: 'ADMIN',
      organizationId: 'org_1',
    });

    expect(result.current.rates.length).toBe(1);
    expect(result.current.rates[0].universityName).toBe('Oxford University');
    expect(result.current.rates[0]._searchToken).toContain('oxford university');
    expect(result.current.hasLocalCopy).toBe(true);
    expect(result.current.stats.totalRates).toBe(1);
    expect(result.current.stats.totalUniversities).toBe(1);
    expect(result.current.stats.focusCount).toBe(1);
    expect(syncLocalRateData).not.toHaveBeenCalled();
  });

  it.each(['STAFF', 'AGENT'] as const)('%s uses only its UID-scoped rate snapshot', async (role) => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      role,
      access: mockAccess,
    } as any);
    vi.mocked(getAllLocalSheetBuckets).mockImplementation(async (uid) => uid === 'global' ? [{
      sheetKey: 'legacy', sheetName: 'Legacy', rateCount: 1, updatedAt: '', updatedBy: '', rates: [sampleRate],
    }] : []);
    vi.mocked(getLocalRates).mockImplementation(async (uid) => uid === mockUser.uid ? [] : [sampleRate]);
    vi.mocked(syncLocalRateData).mockResolvedValue({
      rates: [], organizationOverrides: [], personalOverrides: [], lastSyncedAt: new Date().toISOString(), changed: false,
    });

    const { result } = renderHook(() => useCommissionRates());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(scopeForUser).toHaveBeenCalledWith(mockUser.uid, role, 'org_1');
    expect(syncLocalRateData).toHaveBeenCalledWith({ uid: mockUser.uid, role, organizationId: 'org_1' });
    expect(syncRateSheetsCacheFirst).not.toHaveBeenCalled();
    expect(getAllLocalSheetBuckets).not.toHaveBeenCalled();
    expect(getLocalRates).toHaveBeenCalledWith(mockUser.uid);
    expect(result.current.rates).toEqual([]);
  });

  it('does not hydrate a Staff view from a UID cache marked as Admin', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, role: 'STAFF', access: { accessState: 'staff' } } as any);
    vi.mocked(getLocalRateMetadata).mockResolvedValue({
      id: 'scope', uid: mockUser.uid, role: 'ADMIN', complete: true, cursors: {},
      lastSyncedAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(),
    });
    vi.mocked(getLocalRates).mockResolvedValue([sampleRate]);
    vi.mocked(syncLocalRateData).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCommissionRates());
    await waitFor(() => expect(syncLocalRateData).toHaveBeenCalled());
    expect(result.current.rates).toEqual([]);
  });

  it('handles sync errors gracefully', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      role: 'ADMIN',
      access: mockAccess,
    } as any);

    vi.mocked(syncRateSheetsCacheFirst).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCommissionRates());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('School data needs an online connection for its first download.');
  });
});
