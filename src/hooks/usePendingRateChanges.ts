import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import { discardPendingRateOperation, getPendingRateOperations, updatePendingRateOperation } from '../services/rateWriteQueue';
import { resolveRateOperationConflict, syncRateOperation } from '../services/rateWriteSyncService';
import { subscribeToLocalRateChanges } from '../services/localRateDatabase';
import { getQuotaRetryAt, isQuotaOffline } from '../services/firestoreOfflineMode';

type SyncState = 'idle' | 'syncing' | 'offline' | 'quota-paused';

export function usePendingRateChanges(uid: string | undefined, enabled: boolean) {
  const [operations, setOperations] = useState<PendingRateOperation[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!uid || !enabled) { setOperations([]); return []; }
    const next = await getPendingRateOperations(uid).catch(() => []);
    setOperations(next);
    return next;
  }, [uid, enabled]);

  const flush = useCallback(async (operationId?: string) => {
    if (!uid || !enabled || busy.current) return;
    if (!navigator.onLine) { setSyncState('offline'); return; }
    if (isQuotaOffline(uid)) {
      setSyncState('quota-paused');
      const queued = await refresh();
      await Promise.all(queued.filter((item) => item.status === 'pending' || item.status === 'failed')
        .map((item) => updatePendingRateOperation(uid, item.operationId, { status: 'quota-paused' })));
      await refresh();
      const delay = Math.max(1_000, getQuotaRetryAt(uid) - Date.now());
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (navigator.onLine) void flush(); }, delay);
      return;
    }
    busy.current = true;
    setSyncState('syncing');
    try {
      const pending = await refresh();
      const selected = pending.filter((item) => operationId ? item.operationId === operationId : item.status === 'pending' || item.status === 'failed' || item.status === 'quota-paused');
      for (const operation of selected) {
        try { await syncRateOperation(operation); }
        catch {
          const attempt = operation.attemptCount + 1;
          const delay = Math.min(5 * 60_000, 5_000 * (2 ** Math.min(attempt - 1, 6)));
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => { if (navigator.onLine) void flush(operation.operationId); }, delay);
        }
      }
      await refresh();
      setSyncState(isQuotaOffline(uid) ? 'quota-paused' : 'idle');
    } finally { busy.current = false; }
  }, [uid, enabled, refresh]);

  useEffect(() => {
    if (!uid || !enabled) { setOperations([]); setSyncState('idle'); return; }
    let active = true;
    const loadAndFlush = async () => { await refresh(); if (active) void flush(); };
    void loadAndFlush();
    const unsubscribe = subscribeToLocalRateChanges(uid, () => { void refresh().then(() => flush()); });
    const onOnline = () => { setSyncState('idle'); void flush(); };
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('online', onOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [uid, enabled, refresh, flush]);

  const retry = useCallback(async (operationId: string) => {
    await updatePendingRateOperation(uid!, operationId, { status: 'pending', lastError: undefined });
    await flush(operationId);
  }, [uid, flush]);
  const discard = useCallback(async (operationId: string) => {
    await discardPendingRateOperation(uid!, operationId);
    await refresh();
  }, [uid, refresh]);
  const resolveConflict = useCallback(async (operationId: string, resolution: 'keep-cloud' | 'apply-local') => {
    await resolveRateOperationConflict(uid!, operationId, resolution);
    await refresh();
    if (resolution === 'apply-local') void flush(operationId);
  }, [uid, refresh, flush]);
  const pendingCount = operations.length;
  return { operations, pendingCount, syncState, retry, discard, resolveConflict };
}
