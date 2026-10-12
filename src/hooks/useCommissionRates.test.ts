import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionRate } from '../types';
import { useCommissionRates } from './useCommissionRates';
import { syncRateSheetsCacheFirst } from '../services/rateSyncService';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/rateSyncService', () => ({
  syncRateSheetsCacheFirst: vi.fn(),
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
