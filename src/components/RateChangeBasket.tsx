import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, LoaderCircle, XCircle, RefreshCw, AlertTriangle, Clock, X, Trash2 } from 'lucide-react';
import type { PendingRateOperation } from '../types/rateWriteQueue';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'quota-paused';

type Props = {
  operations?: PendingRateOperation[];
  syncState: SyncState;
  onRetry: (id?: string) => void;
  onDiscard?: (id?: string) => void;
  lastSyncedAt?: string | null;
  errorMessage?: string | null;
  lastSyncUploadName?: string | null;
};

export const RateChangeBasket: React.FC<Props> = ({
  operations = [],
  syncState,
  onRetry,
  onDiscard,
  lastSyncedAt,
  errorMessage,
  lastSyncUploadName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const hasFailed =
    Boolean(errorMessage) ||
    operations.some((op) => op.status === 'failed' || op.status === 'conflict' || op.status === 'quota-paused') ||
    syncState === 'offline';

  const isSyncing =
    syncState === 'syncing' ||
    operations.some((op) => op.status === 'syncing' || op.status === 'pending');

  const pendingOps = operations.filter((op) => op.status === 'pending' || op.status === 'syncing');
  const failedOps = operations.filter((op) => op.status === 'failed' || op.status === 'conflict' || op.status === 'quota-paused');

  // Elapsed time calculation for pending items
  const earliestPendingTime = pendingOps[0]?.createdAt ? new Date(pendingOps[0].createdAt).getTime() : null;
  const [pendingDurationText, setPendingDurationText] = useState<string>('');

  useEffect(() => {
    if (!earliestPendingTime) {
      setPendingDurationText('');
      return;
    }
    const updateDuration = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - earliestPendingTime) / 1000));
      if (diffSec < 60) setPendingDurationText(`${diffSec}s ago`);
      else if (diffSec < 3600) setPendingDurationText(`${Math.floor(diffSec / 60)}m ${diffSec % 60}s`);
      else setPendingDurationText(`${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`);
    };
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [earliestPendingTime]);

  const formatLastSync = (iso?: string | null) => {
    if (!iso) return 'Never synced this session';
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' (' + date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
    } catch {
      return iso;
    }
  };

  const handleRetryClick = () => {
    const failedOp = failedOps[0];
    if (failedOp) {
      onRetry(failedOp.operationId);
    } else if (operations.length > 0) {
      onRetry(operations[0].operationId);
    } else {
      onRetry();
    }
  };

  const handleDiscardClick = () => {
    if (!onDiscard) return;
    if (operations.length > 1) {
      onDiscard();
    } else {
      const targetOp = failedOps[0] || operations[0];
      if (targetOp) {
        onDiscard(targetOp.operationId);
      } else {
        onDiscard();
      }
    }
  };

  const firstFailedOperation = failedOps[0];
  const conflictReason = firstFailedOperation?.conflicts?.[0]?.reason;
  const hasRateIdCollision = Boolean(conflictReason?.toLowerCase().includes('already uses the new id'));
  // Value conflicts are rebased automatically when the user retries; only a key collision needs editing.
  const failureReason = firstFailedOperation?.status === 'conflict' && !hasRateIdCollision
    ? 'Cloud data changed while this edit was pending. Retry Sync Now will apply your changed fields and preserve unrelated cloud updates.'
    : conflictReason || firstFailedOperation?.lastError || errorMessage ||
      (syncState === 'offline' ? 'Offline - No network connection' : null) ||
      'Rate synchronization could not connect to Firestore (Permission or Quota limitation)';

  return (
    <div className="relative inline-block z-20" ref={popoverRef}>
      {/* Sync Status Button Trigger */}
      {hasFailed ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Sync failed or pending - Click to retry"
          aria-label="Sync failed or pending - Click to retry"
          className="inline-flex items-center justify-center p-2 rounded-2xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/30 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition cursor-pointer shadow-xs shrink-0"
        >
          <XCircle className="h-5 w-5" />
        </button>
      ) : isSyncing ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Syncing changes to Firestore..."
          aria-label="Syncing changes to Firestore"
          className="inline-flex items-center justify-center p-2 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-amber-500 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition cursor-pointer shadow-xs shrink-0"
        >
          <LoaderCircle className="h-5 w-5 animate-spin" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="All data is synced"
          aria-label="All data is synced"
          className="inline-flex items-center justify-center p-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition cursor-pointer shadow-xs shrink-0"
        >
          <CheckCircle2 className="h-5 w-5" />
        </button>
      )}

      {/* Popover State Details */}
      {isOpen && (
        <div
          data-testid="sync-status-popover"
          className="fixed left-4 right-4 top-[4.5rem] mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#222F43] bg-[#0E1526] p-4 text-xs text-slate-200 shadow-2xl z-50 space-y-3 animate-in fade-in zoom-in-95 duration-150 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#222F43]">
            <div className="flex items-center gap-2">
              {hasFailed ? (
                <XCircle className="w-4 h-4 text-rose-400" />
              ) : isSyncing ? (
                <LoaderCircle className="w-4 h-4 text-amber-400 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-extrabold text-sm text-white">
                {hasFailed ? 'Sync Issue' : isSyncing ? 'Syncing...' : 'Sync Up to Date'}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* If Failed: Explain Why */}
          {hasFailed && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-400 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Why did sync fail?</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed break-words font-mono">
                {failureReason}
              </p>
              {failedOps[0]?.nextRetryAt && (
                <p className="text-[11px] text-rose-200">Next automatic retry: {formatLastSync(failedOps[0].nextRetryAt)}</p>
              )}
            </div>
          )}

          {/* If Pending / Syncing: Show how long */}
          {isSyncing && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Pending synchronization</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {pendingOps.length > 0
                  ? `${pendingOps.length} operations queued ${pendingDurationText ? `(${pendingDurationText})` : ''}`
                  : 'Downloading fresh rate models from server...'}
              </p>
            </div>
          )}

          {/* Last Successful Sync info */}
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Last Synced:</span>
              <span className="font-mono text-slate-200">{formatLastSync(lastSyncedAt)}</span>
            </div>
            {lastSyncUploadName && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Last Upload Sheet:</span>
                <span className="font-mono text-emerald-400 truncate max-w-[140px]">{lastSyncUploadName}</span>
              </div>
            )}
          </div>

          {/* Action / Retry & Discard Buttons */}
          <div className="pt-2 border-t border-[#222F43] flex flex-wrap items-center justify-end gap-2">
            {operations.length > 0 && onDiscard && (
              <button
                type="button"
                onClick={handleDiscardClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-extrabold text-[11px] transition shadow-xs active:scale-95 cursor-pointer"
                title="Discard pending changes and restore saved version"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>{operations.length > 1 ? `Discard All (${operations.length})` : 'Discard Change'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRetryClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] transition shadow-xs active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Sync Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
