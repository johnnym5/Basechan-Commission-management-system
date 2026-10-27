import { useCallback, useEffect, useState } from 'react';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import { discardPendingRateOperation, finishPendingRateOperation, getPendingRateOperations, updatePendingRateOperation } from '../services/rateWriteQueue';
import { subscribeToLocalRateChanges } from '../services/localRateDatabase';
import { isRatePackagePublished, partitionRatePackageOperations, publishRateChangePackage } from '../services/ratePackageService';

type SyncState = 'idle' | 'publishing' | 'offline' | 'failed';
export type RatePackageUploadStage = 'idle' | 'verifying' | 'packaging' | 'sending' | 'delivered' | 'failed';
export interface RatePackageUploadProgress {
  stage: RatePackageUploadStage;
  currentBatch: number;
  totalBatches: number;
  deliveredBatches: number;
  failedBatches: number;
}
export type RateSyncOutcome = { operationId: string; status: 'saved' | 'failed' | 'partial'; error?: string };

function describeUploadFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown upload failure.');
  const code = String((error as { code?: unknown })?.code || '').toLowerCase();
  if (!navigator.onLine) return 'Unable to send changes: this device is offline. Reconnect and retry.';
  if (code.includes('resource-exhausted') || /quota/i.test(message)) return 'Unable to save changes because the Firestore quota limit was reached. The batch is still in your basket.';
  if (/too large|too many|safe package/i.test(message)) return 'Unable to package these changes: the batch is too large. Select fewer changes and retry.';
  if (/corrupt|invalid package|invalid data|malformed|encoding/i.test(message) || code.includes('invalid-argument')) return 'Unable to package changes because one or more changes appear corrupted or invalid. Keep this batch and review its entries.';
  if (/unavailable|deadline|network|offline|internet|timed out|fetch failed/i.test(message) || code.includes('unavailable') || code.includes('deadline-exceeded')) return 'Unable to send changes because the connection is unstable. The batch is still in your basket.';
  return `Unable to save this batch: ${message}`;
}

export function usePendingRateChanges(uid: string | undefined, enabled: boolean, onSyncOutcome?: (outcome: RateSyncOutcome) => void) {
  const [operations, setOperations] = useState<PendingRateOperation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<RatePackageUploadProgress>({ stage: 'idle', currentBatch: 0, totalBatches: 0, deliveredBatches: 0, failedBatches: 0 });

  const refresh = useCallback(async () => {
    if (!uid || !enabled) { setOperations([]); setSelectedIds([]); return []; }
    const next = await getPendingRateOperations(uid).catch(() => []);
    setOperations(next);
    setSelectedIds((current) => current.filter((id) => next.some((operation) => operation.operationId === id)));
    return next;
  }, [uid, enabled]);

  useEffect(() => {
    if (!uid || !enabled) { setOperations([]); setSelectedIds([]); setSyncState('idle'); return; }
    void refresh();
    return subscribeToLocalRateChanges(uid, () => { void refresh(); });
  }, [uid, enabled, refresh]);

  const selectChanges = useCallback((ids: string[]) => setSelectedIds(ids), []);
  const uploadSelected = useCallback(async () => {
    if (!uid || !enabled || syncState === 'publishing') return;
    if (!navigator.onLine) {
      const message = 'Unable to send changes: this device is offline. Reconnect and retry.';
      setSyncState('offline'); setErrorMessage(message); setUploadProgress((current) => ({ ...current, stage: 'failed' })); return;
    }
    const queue = await refresh();
    const selected = queue.filter((operation) => selectedIds.includes(operation.operationId));
    if (!selected.length) return;
    const selectedSet = new Set(selected.map((operation) => operation.operationId));
    const incompleteRetry = selected.find((operation) => operation.packageId
      && (operation.packageChangeIds || [operation.operationId]).some((id) => !selectedSet.has(id)));
    if (incompleteRetry) {
      const message = 'Select every change from the failed batch together so it can be safely retried.';
      setSyncState('failed'); setErrorMessage(message); setUploadProgress((current) => ({ ...current, stage: 'failed' })); return;
    }

    setSyncState('publishing'); setErrorMessage(null);
    setUploadProgress({ stage: 'verifying', currentBatch: 0, totalBatches: 0, deliveredBatches: 0, failedBatches: 0 });
    await Promise.resolve();
    setUploadProgress((current) => ({ ...current, stage: 'packaging' }));

    let batches: PendingRateOperation[][];
    let oversized: PendingRateOperation[][];
    try {
      ({ batches, oversized } = partitionRatePackageOperations(selected));
    } catch (error) {
      const message = describeUploadFailure(error);
      setSyncState('failed'); setErrorMessage(message); setUploadProgress((current) => ({ ...current, stage: 'failed' })); return;
    }

    const totalBatches = batches.length + oversized.length;
    setUploadProgress({ stage: batches.length ? 'packaging' : 'failed', currentBatch: 0, totalBatches, deliveredBatches: 0, failedBatches: oversized.length });
    const messages: string[] = [];
    for (const oversizedBatch of oversized) {
      const message = 'Unable to package these changes: the batch is too large or incomplete. Select a smaller group and retry.';
      messages.push(message);
      await Promise.all(oversizedBatch.map((operation) => updatePendingRateOperation(uid, operation.operationId, { status: 'failed', lastError: message })));
      oversizedBatch.forEach((operation) => onSyncOutcome?.({ operationId: operation.operationId, status: 'failed', error: message }));
    }

    let deliveredBatches = 0;
    let failedBatches = oversized.length;
    for (const [batchIndex, packageOperations] of batches.entries()) {
      const packageId = packageOperations[0]?.packageId || crypto.randomUUID();
      const memberIds = packageOperations[0]?.packageChangeIds || packageOperations.map((operation) => operation.operationId);
      const batchNumber = oversized.length + batchIndex + 1;
      setUploadProgress({ stage: 'sending', currentBatch: batchNumber, totalBatches, deliveredBatches, failedBatches });
      await Promise.all(packageOperations.map((operation) => updatePendingRateOperation(uid, operation.operationId, {
        status: 'publishing', packageId, packageChangeIds: memberIds, lastError: undefined,
      })));
      try {
        await publishRateChangePackage({ uid, operations: packageOperations, packageId });
        for (const operation of packageOperations) {
          await finishPendingRateOperation(uid, operation.operationId, []);
          onSyncOutcome?.({ operationId: operation.operationId, status: 'saved' });
        }
        deliveredBatches += 1;
        setSelectedIds((current) => current.filter((id) => !memberIds.includes(id)));
        setUploadProgress({ stage: 'sending', currentBatch: batchNumber, totalBatches, deliveredBatches, failedBatches });
        await refresh();
      } catch (error) {
        const message = describeUploadFailure(error);
        messages.push(message);
        let publicationKnownAbsent = false;
        try { publicationKnownAbsent = !(await isRatePackagePublished(packageId)); } catch { /* Keep stable IDs while the response is ambiguous. */ }
        await Promise.all(packageOperations.map((operation) => updatePendingRateOperation(uid, operation.operationId, {
          status: 'failed',
          packageId: publicationKnownAbsent ? undefined : packageId,
          packageChangeIds: publicationKnownAbsent ? undefined : memberIds,
          lastError: message,
        })));
        failedBatches += 1;
        packageOperations.forEach((operation) => onSyncOutcome?.({ operationId: operation.operationId, status: 'failed', error: message }));
        setUploadProgress({ stage: 'sending', currentBatch: batchNumber, totalBatches, deliveredBatches, failedBatches });
        await refresh();
      }
    }

    if (failedBatches > 0) {
      setSyncState('failed'); setErrorMessage(messages[0] || 'Some batches could not be saved. Failed batches remain in the basket.');
      setUploadProgress({ stage: 'failed', currentBatch: totalBatches, totalBatches, deliveredBatches, failedBatches });
    } else {
      setSyncState('idle'); setErrorMessage(null);
      setUploadProgress({ stage: 'delivered', currentBatch: totalBatches, totalBatches, deliveredBatches, failedBatches: 0 });
    }
    await refresh();
  }, [uid, enabled, syncState, refresh, selectedIds, onSyncOutcome]);

  const discard = useCallback(async (ids?: string[]) => {
    if (!uid) return;
    const targets = ids || selectedIds;
    const protectedIds = new Set<string>();
    for (const operationId of targets) {
      const operation = operations.find((item) => item.operationId === operationId);
      if (operation?.status === 'publishing') continue;
      let published = false;
      try {
        published = Boolean(operation?.packageId && await isRatePackagePublished(operation.packageId));
      } catch {
        setErrorMessage('Could not check whether this package was already uploaded. Keep the changes and retry when connected.');
        setSyncState('failed');
        return;
      }
      if (published && operation?.packageId) {
        const memberIds = operation.packageChangeIds || [operation.operationId];
        for (const memberId of memberIds) {
          protectedIds.add(memberId);
          const member = operations.find((item) => item.operationId === memberId);
          if (member) await finishPendingRateOperation(uid, memberId, []);
        }
        setErrorMessage('That package was already published. Published changes cannot be discarded; make a new change to reverse them.');
        setSyncState('failed');
        continue;
      }
      await discardPendingRateOperation(uid, operationId);
      if (operation?.packageId) {
        for (const memberId of operation.packageChangeIds || []) {
          const member = operations.find((item) => item.operationId === memberId);
          if (member && memberId !== operationId) await updatePendingRateOperation(uid, memberId, {
            status: 'pending', packageId: undefined, packageChangeIds: undefined,
          });
        }
      }
    }
    setSelectedIds((current) => current.filter((id) => !targets.includes(id) && !protectedIds.has(id)));
    if (!protectedIds.size) { setSyncState('idle'); setErrorMessage(null); }
    await refresh();
  }, [uid, operations, selectedIds, refresh]);

  const toggleSelection = useCallback((operationId: string, selected: boolean) => {
    setSelectedIds((current) => selected
      ? current.includes(operationId) ? current : [...current, operationId]
      : current.filter((id) => id !== operationId));
  }, []);
  const pendingCount = operations.reduce((count, operation) => count + operation.mutations.length, 0);
  return { operations, pendingCount, selectedIds, syncState, errorMessage, uploadProgress, selectChanges, toggleSelection, uploadSelected, retry: (_operationId?: string) => uploadSelected(), discard };
}
