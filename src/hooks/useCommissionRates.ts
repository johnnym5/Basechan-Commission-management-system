import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { CommissionRate, RateSheetBucket } from '../types';
import { mergeAgentRateLayers } from '../services/rateReadModels';
import {
  beginQuotaProbe, completeQuotaProbe, enterQuotaOfflineMode, getQuotaRetryAt, lockFirestoreNetworkForQuota,
  isQuotaError, isQuotaOffline, isConnectivityError, subscribeToFirestoreMode,
} from '../services/firestoreOfflineMode';
import { getAllLocalSheetBuckets, getLocalAgentOverrides, getLocalRateMetadata, getLocalRates, subscribeToLocalRateChanges } from '../services/localRateDatabase';
import { scopeForUser, syncLocalRateData, syncRateSheetsCacheFirst, verifyServerRateAccess } from '../services/rateSyncService';
import { selectRatesForScope } from '../services/rateSnapshot';

export interface IndexedCommissionRate extends CommissionRate { _searchToken: string }

function indexRate(data: CommissionRate): IndexedCommissionRate {
  return {
    ...data,
    _searchToken: [data.universityName, data.aggregator || 'BASECHAN', data.intake, data.studyLevel, data.country || '', data.guidance || 'ALLOWED'].join(' ').toLowerCase(),
  };
}

export function useCommissionRates() {
  const { user, role, access } = useAuth();
  const [rates, setRates] = useState<IndexedCommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [hasLocalCopy, setHasLocalCopy] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [quotaMode, setQuotaMode] = useState(false);
  const [ratesScope, setRatesScope] = useState<string | null>(null);
  const [sheetVisibility, setSheetVisibility] = useState<Record<string, { STAFF: boolean; AGENT: boolean }>>({});
  const activeRatesScope = user
    ? `${user.uid}:${role}:${access.accessState}:${access.organizationId || ''}`
    : null;
  const scopeRates = selectRatesForScope(rates, ratesScope, activeRatesScope);
  const visibleRates = useMemo(() => role === 'ADMIN' ? scopeRates : scopeRates.filter((rate) => {
    const sheet = String(rate.sourceSheet || rate.intake).trim().toLowerCase();
    return !sheetVisibility[sheet]?.[role];
  }), [role, scopeRates, sheetVisibility]);

  useEffect(() => {
    if (!user) {
      setSheetVisibility({});
      return;
    }
    if (!navigator.onLine || isQuotaOffline(user.uid)) return;
    return onSnapshot(collection(db, 'sheet_settings'), (snapshot) => {
      const settings: Record<string, { STAFF: boolean; AGENT: boolean }> = {};
      snapshot.docs.forEach((item) => {
        const data = item.data();
        const value = { STAFF: data.disabledForStaff === true, AGENT: data.disabledForAgents === true };
        settings[String(data.sheetName || item.id).trim().toLowerCase()] = value;
        settings[item.id.trim().toLowerCase()] = value;
      });
      setSheetVisibility(settings);
    }, (syncError) => {
      if (isQuotaError(syncError)) void enterQuotaOfflineMode(user.uid);
    });
  }, [user?.uid, quotaMode]);

  useEffect(() => subscribeToFirestoreMode((uid) => {
    if (!uid || uid === user?.uid) setQuotaMode(isQuotaOffline(user?.uid));
  }), [user?.uid]);

  useEffect(() => {
    if (!user) {
      setRates([]); setRatesScope(null); setLoading(false); setError(null); setHasLocalCopy(false); setLastSyncedAt(null);
      return;
    }
    if (role === 'AGENT' && access.accessState !== 'approved') {
      setRates([]); setRatesScope(null); setLoading(false); setError(null); setHasLocalCopy(false);
      return;
    }

    let active = true;
    const scope = scopeForUser(user.uid, role, access.organizationId);
    const currentQuotaMode = isQuotaOffline(user.uid);
    setQuotaMode(currentQuotaMode);
    setError(null);
    setLoading(true);
    setRates([]);
    setRatesScope(null);
    setLastSyncedAt(null);
    setHasLocalCopy(false);

    const showLocal = async () => {
      try {
        const [metadata, userRates, overrides] = await Promise.all([
          getLocalRateMetadata(user.uid).catch(() => null),
          getLocalRates(user.uid).catch(() => []),
          role === 'AGENT'
            ? getLocalAgentOverrides(user.uid).catch(() => ({ organization: [], personal: [] }))
            : Promise.resolve({ organization: [], personal: [] }),
        ]);
        if (!active) return false;

        const scopedCacheIsValid = role === 'ADMIN' || (
          metadata?.complete === true
          && metadata.uid === user.uid
          && metadata.role === role
          && (metadata.organizationId || '') === (scope.organizationId || '')
        );
        const scopedUserRates = scopedCacheIsValid ? userRates : [];
        const scopedOverrides = scopedCacheIsValid ? overrides : { organization: [], personal: [] };
        let combinedRates = scopedUserRates;
        if (role === 'ADMIN') {
          const [globalBuckets, userBuckets, globalRates] = await Promise.all([
            getAllLocalSheetBuckets('global').catch(() => []),
            getAllLocalSheetBuckets(user.uid).catch(() => []),
            getLocalRates('global').catch(() => []),
          ]);
          const cachedBucketRates = [...globalBuckets, ...userBuckets].flatMap((b: RateSheetBucket) => b.rates || []);
          combinedRates = Array.from(new Map([...cachedBucketRates, ...globalRates, ...userRates].map((r) => [r.id, r])).values());
        }

        if (combinedRates.length > 0) {
          const values = role === 'AGENT'
            ? mergeAgentRateLayers(
                combinedRates.map((r) => ({
                  ...r,
                  aggregator: r.aggregator || 'BASECHAN',
                })),
                scopedOverrides.organization,
                scopedOverrides.personal
              ).map((rate) => ({ ...rate, aggregator: 'BASECHAN' }))
            : combinedRates;

          setRates(values.map((r) => indexRate(r as CommissionRate)));
          setRatesScope(`${user.uid}:${role}:${access.accessState}:${access.organizationId || ''}`);
          setLastSyncedAt(metadata?.lastSyncedAt || new Date().toISOString());
          setHasLocalCopy(true);
          setLoading(false);
          setError(null);
          return true;
        }

        if (metadata?.complete) {
          const values = role === 'AGENT'
            ? mergeAgentRateLayers(scopedUserRates, scopedOverrides.organization, scopedOverrides.personal).map((rate) => ({ ...rate, aggregator: 'BASECHAN' }))
            : scopedUserRates;
          if (values.length > 0) {
            setRates(values.map((r) => indexRate(r as CommissionRate)));
            setRatesScope(`${user.uid}:${role}:${access.accessState}:${access.organizationId || ''}`);
            setLastSyncedAt(metadata.lastSyncedAt);
            setHasLocalCopy(true);
            setLoading(false);
            setError(null);
            return true;
          }
        }
      } catch (err) {
        console.error('Error loading local offline rates:', err);
      }
      return false;
    };

    const unsubscribeLocalRates = role === 'ADMIN'
      ? subscribeToLocalRateChanges(user.uid, () => { void showLocal(); })
      : () => {};

    let syncInProgress = false;
    const refresh = async (probe = false) => {
      if (!active || !navigator.onLine || syncInProgress) return;
      syncInProgress = true;
      try {
        if (probe) {
          await beginQuotaProbe(user.uid);
          await verifyServerRateAccess(scope);
        }
        let combined: CommissionRate[];
        if (role === 'ADMIN') {
          const freshRates = await syncRateSheetsCacheFirst(scope);
          const localRates = await getLocalRates(user.uid);
          combined = Array.from(new Map([...freshRates, ...localRates].map((r) => [r.id, r])).values());
        } else {
          await syncLocalRateData(scope);
          const localRates = await getLocalRates(user.uid);
          const overrides = role === 'AGENT'
            ? await getLocalAgentOverrides(user.uid)
            : { organization: [], personal: [] };
          const roleRates = role === 'AGENT'
            ? mergeAgentRateLayers(localRates, overrides.organization, overrides.personal)
            : localRates;
          combined = Array.from(new Map(roleRates.map((r) => [
            r.id,
            role === 'AGENT'
              ? { ...r, aggregator: 'BASECHAN', masterRate: 0, diffMargin: 0 } as CommissionRate
              : r as CommissionRate,
          ])).values());
        }
        if (!active) return;
        setRates(combined.map(indexRate));
        setRatesScope(`${user.uid}:${role}:${access.accessState}:${access.organizationId || ''}`);
        setLastSyncedAt(new Date().toISOString());
        setHasLocalCopy(true);
        setLoading(false);
        if (probe) await completeQuotaProbe(user.uid);
        setQuotaMode(false);
        setError(null);
      } catch (syncError) {
        if (!active) return;

        const foundLocal = await showLocal().catch(() => false);
        if (isQuotaError(syncError)) {
          await enterQuotaOfflineMode(user.uid);
          setQuotaMode(true);
          setError(null);
          setLoading(false);
          return;
        }

        if (foundLocal) {
          // Fall back gracefully to local cached data without locking network
          setError(null);
          setLoading(false);
          return;
        }

        if ((syncError as { code?: string })?.code === 'permission-denied' || isConnectivityError(syncError) || !navigator.onLine) {
          setError('School data needs an online connection for its initial download.');
          setLoading(false);
          return;
        }

        setError('School data needs an online connection for its first download.');
        setLoading(false);
      } finally {
        syncInProgress = false;
      }
    };

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let quotaOnlineListenerAttached = false;
    const scheduleQuotaProbe = () => {
      if (!isQuotaOffline(user.uid)) return;
      if (retryTimer) clearTimeout(retryTimer);
      const delay = Math.max(0, getQuotaRetryAt(user.uid) - Date.now());
      retryTimer = window.setTimeout(() => {
        if (navigator.onLine) void refresh(true);
        else {
          quotaOnlineListenerAttached = true;
          window.addEventListener('online', onQuotaOnline, { once: true });
          retryTimer = window.setTimeout(() => {
            if (navigator.onLine) void refresh(true);
            else scheduleQuotaProbe();
          }, 60_000);
        }
      }, delay);
    };
    const onQuotaOnline = () => {
      quotaOnlineListenerAttached = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (isQuotaOffline(user.uid) && Date.now() >= getQuotaRetryAt(user.uid)) void refresh(true);
      else if (isQuotaOffline(user.uid)) scheduleQuotaProbe();
      else void refresh();
    };
    const onOnline = () => {
      if (!isQuotaOffline(user.uid)) void refresh();
      else scheduleQuotaProbe();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible' && !isQuotaOffline(user.uid)) void refresh(); };
    const unsubscribeMode = subscribeToFirestoreMode((uid) => {
      if (uid && uid !== user.uid) return;
      const activeQuotaMode = isQuotaOffline(user.uid);
      setQuotaMode(activeQuotaMode);
      if (activeQuotaMode) {
        void lockFirestoreNetworkForQuota();
        scheduleQuotaProbe();
      }
      else if (active) void showLocal();
    });

    void showLocal().then((found) => {
      if (!active) return;
      if (currentQuotaMode) {
        void enterQuotaOfflineMode(user.uid);
        setLoading(false);
        if (!found) setError('No saved school data is available on this device. Connect when access is restored to download it.');
        scheduleQuotaProbe();
      } else if (navigator.onLine) {
        void refresh();
      } else {
        setLoading(!found);
        if (!found) setError('Connect to the internet once to download your authorized school data.');
      }
    }).catch(() => {
      if (active && !isQuotaOffline(user.uid) && navigator.onLine) void refresh();
    });
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    scheduleQuotaProbe();

    return () => {
      active = false;
      unsubscribeLocalRates();
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribeMode();
      window.removeEventListener('online', onOnline);
      if (quotaOnlineListenerAttached) window.removeEventListener('online', onQuotaOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.uid, role, access.accessState, access.organizationId, syncVersion]);

  const stats = useMemo(() => {
    let focusCount = 0; let restrictedCount = 0; let allowedCount = 0; let totalPercentMargin = 0; let percentRateCount = 0;
    let bestRate: IndexedCommissionRate | null = null;
    const uniSet = new Set<string>(); const countrySet = new Set<string>();
    for (const rate of visibleRates) {
      uniSet.add(rate.universityId); countrySet.add(rate.country || 'UK');
      const guidance = rate.guidance || 'ALLOWED';
      if (guidance === 'FOCUS') focusCount++; else if (guidance === 'DO_NOT_USE') restrictedCount++; else allowedCount++;
      if (!rate.isFlatFee) { totalPercentMargin += rate.diffMargin; percentRateCount++; }
      if (!bestRate || rate.diffMargin > bestRate.diffMargin) bestRate = rate;
    }
    return {
      totalRates: rates.length, totalUniversities: uniSet.size, totalCountries: countrySet.size,
      averageMargin: percentRateCount ? (totalPercentMargin / percentRateCount).toFixed(1) : '0.0',
      bestRate, focusCount, restrictedCount, allowedCount,
    };
  }, [visibleRates]);

  return { rates: visibleRates, loading, error, stats, offlinePendingCount: 0, hasLocalCopy, lastSyncedAt, quotaMode, refresh: () => setSyncVersion((v) => v + 1) };
}
