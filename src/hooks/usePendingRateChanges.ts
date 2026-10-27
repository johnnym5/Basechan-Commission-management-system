import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import { discardPendingRateOperation, getPendingRateOperations, updatePendingRateOperation } from '../services/rateWriteQueue';
import { resolveRateOperationConflict, syncRateOperation } from '../services/rateWriteSyncService';
import { subscribeToLocalRateChanges } from '../services/localRateDatabase';
import { getQuotaRetryAt, isQuotaOffline } from '../services/firestoreOfflineMode';

type SyncState = 'idle' | 'syncing' | 'offline' | 'quota-paused';
export type RateSyncOutcome = { operationId: string; status: 'saved' | 'failed' | 'partial'; error?: string };

export function usePendingRateChanges(uid: string | undefined, enabled: boolean, onSyncOutcome?: (outcome: RateSyncOutcome) => void) {
  const [operations, setOperations] = useState<PendingRateOperation[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outcomeCallback = useRef(onSyncOutcome);
  outcomeCallback.current = onSyncOutcome;

  const refresh = useCallback(async () => {
    if (!uid || !enabled) { setOperations([]); return []; }
    const next = await getPendingRateOperations(uid).catch(() => []);
    // Auto-heal zombie operations stuck in 'syncing' from previously crashed/interrupted sessions
    const now = Date.now();
    for (const op of next) {
      if (op.status === 'syncing') {
        const age = op.updatedAt ? now - new Date(op.updatedAt).getTime() : 10000;
        if (age > 5000) {
          await updatePendingRateOperation(uid, op.operationId, {
            status: 'failed',
            lastError: op.lastError || 'Synchronization was interrupted. Click Retry Sync Now or Discard.',
          });
          op.status = 'failed';
          op.lastError = op.lastError || 'Synchronization was interrupted. Click Retry Sync Now or Discard.';
        }
      }
    }
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
        try {
          const result = await syncRateOperation(operation);
          outcomeCallback.current?.({
            operationId: operation.operationId,
            status: result === 'synced' ? 'saved' : result === 'partial' ? 'partial' : 'failed',
            ...(result === 'conflict' ? { error: 'This change needs attention before it can be saved.' } : {}),
          });
        } catch (error) {
          const savedToCloud = Boolean((error as { canonicalCommitted?: boolean } | null)?.canonicalCommitted);
          outcomeCallback.current?.({
            operationId: operation.operationId,
            status: savedToCloud ? 'partial' : 'failed',
            error: error instanceof Error ? error.message : 'The change could not be synced.',
          });
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

  const retry = useCallback(async (operationId?: string) => {
    if (!uid) return;
    const ops = await refresh();
    const selected = ops.filter((op) => !operationId || op.operationId === operationId);
    for (const op of selected) {
      if (op.status === 'conflict') {
        // Rebase the saved field patch against the latest cloud record before retrying.
        // This preserves unrelated cloud edits and makes normal edits self-healing.
        await resolveRateOperationConflict(uid, op.operationId, 'apply-local');
      } else {
        await updatePendingRateOperation(uid, op.operationId, { status: 'pending', lastError: undefined, nextRetryAt: undefined });
      }
    }
    await flush(operationId);
  }, [uid, refresh, flush]);
  const discard = useCallback(async (operationId?: string) => {
    if (!uid) return;
    if (operationId) {
      await discardPendingRateOperation(uid, operationId);
    } else {
      const ops = await getPendingRateOperations(uid).catch(() => []);
      for (const op of ops) {
        await discardPendingRateOperation(uid, op.operationId);
      }
    }
    await refresh();
    setSyncState('idle');
  }, [uid, refresh]);
  const resolveConflict = useCallback(async (operationId: string, resolution: 'keep-cloud' | 'apply-local') => {
    await resolveRateOperationConflict(uid!, operationId, resolution);
    await refresh();
    if (resolution === 'apply-local') void flush(operationId);
  }, [uid, refresh, flush]);
  const pendingCount = operations.length;
  return { operations, pendingCount, syncState, retry, discard, resolveConflict };
}
