import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, FileText, LoaderCircle, Package, PackageCheck, ShoppingBasket, Trash2, UploadCloud, X } from 'lucide-react';
import type { CommissionRate } from '../types';
import type { PendingRateMutation, PendingRateOperation } from '../types/rateWriteQueue';
import type { RatePackageUploadProgress } from '../hooks/usePendingRateChanges';
import './RateChangeBasket.css';

export type SyncState = 'idle' | 'publishing' | 'offline' | 'failed' | 'syncing' | 'quota-paused';

type Props = {
  operations?: PendingRateOperation[];
  pendingCount?: number;
  selectedIds?: string[];
  syncState: SyncState;
  errorMessage?: string | null;
  uploadProgress?: RatePackageUploadProgress;
  onRetry?: (id?: string) => void;
  lastSyncedAt?: string | null;
  lastSyncUploadName?: string | null;
  onToggleSelection?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onUpload?: () => void;
  onDiscard?: (ids: string[]) => void;
};

function describeMutation(mutation: PendingRateMutation) {
  if (mutation.kind === 'create') return { school: mutation.next.universityName, detail: `${mutation.next.intake} · ${mutation.next.studyLevel} · ${mutation.next.aggregator}`, fields: 'New route' };
  if (mutation.kind === 'delete') return { school: mutation.baseRate?.universityName || mutation.id, detail: mutation.baseRate ? `${mutation.baseRate.intake} · ${mutation.baseRate.studyLevel} · ${mutation.baseRate.aggregator}` : mutation.id, fields: 'Delete route' };
  const changed = Object.keys(mutation.patch);
  return {
    school: mutation.baseSnapshot?.universityName || mutation.id,
    detail: `${mutation.baseSnapshot?.intake || ''} · ${mutation.baseSnapshot?.studyLevel || ''} · ${mutation.baseSnapshot?.aggregator || ''}`,
    fields: changed.map((key) => {
      const before = mutation.baseSnapshot?.[key as keyof CommissionRate];
      const after = mutation.patch[key as keyof CommissionRate];
      return `${key}: ${String(before ?? '—')} → ${String(after ?? '—')}`;
    }).join(', '),
  };
}

export const RateChangeBasket: React.FC<Props> = ({
  operations = [], pendingCount = operations.length, selectedIds = [], syncState,
  errorMessage, uploadProgress, onToggleSelection, onSelectAll, onUpload, onDiscard,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'upload' | 'discard' | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedCount = selectedIds.length;
  const isPublishing = syncState === 'publishing';
  const allSelected = operations.length > 0 && selectedIds.length === operations.length;
  const progressStage = uploadProgress?.stage || 'idle';
  const showingProgress = progressStage !== 'idle';
  const stageIndex: Record<string, number> = { verifying: 0, packaging: 1, sending: 2, delivered: 3, failed: -1 };
  const activeStep = stageIndex[progressStage] ?? -1;
  const busy = ['verifying', 'packaging', 'sending'].includes(progressStage);
  const failureStep = errorMessage?.toLowerCase().includes('unable to package') ? 1 : errorMessage?.toLowerCase().includes('verify') ? 0 : 2;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false); setConfirmAction(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const confirm = () => {
    if (!selectedCount) return;
    if (confirmAction === 'upload') onUpload?.();
    if (confirmAction === 'discard') onDiscard?.(selectedIds);
    setConfirmAction(null);
  };

  return (
    <div className="relative inline-block z-20" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        title={pendingCount ? `${pendingCount} local change${pendingCount === 1 ? '' : 's'} waiting` : 'No local changes waiting'}
        aria-label={`Pending rate changes: ${pendingCount}`}
        aria-expanded={isOpen}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition active:scale-95 ${
          isPublishing ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : pendingCount ? 'border-blue-500/40 bg-blue-500/10 text-blue-500' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
        }`}
      >
        {isPublishing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : pendingCount ? <ShoppingBasket className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        {pendingCount > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-blue-600 px-1 text-[10px] font-black leading-5 text-white">{pendingCount > 99 ? '99+' : pendingCount}</span>}
      </button>

      {isOpen && <section data-testid="sync-status-popover" aria-label="Pending rate changes" className="fixed left-3 right-3 top-[4.5rem] z-50 max-h-[min(75vh,620px)] overflow-hidden rounded-2xl border border-[#222F43] bg-[#0E1526] text-xs text-slate-200 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(28rem,calc(100vw-2rem))]">
        <header className="flex items-center justify-between border-b border-[#222F43] px-4 py-3">
          <div className="flex items-center gap-2">
            {isPublishing ? <LoaderCircle className="h-4 w-4 animate-spin text-amber-400" /> : <ShoppingBasket className="h-4 w-4 text-blue-400" />}
            <div><h2 className="text-sm font-extrabold text-white">{isPublishing ? 'Publishing package…' : 'Change basket'}</h2><p className="text-[11px] text-slate-400">{pendingCount} change{pendingCount === 1 ? '' : 's'} saved on this device</p></div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        {showingProgress && <div className={`rate-package-progress rate-package-${progressStage}`} role={progressStage === 'failed' ? 'alert' : 'status'} aria-live={progressStage === 'failed' ? 'assertive' : 'polite'} aria-busy={busy}>
          <div className="rate-package-visual" aria-hidden="true">
            {progressStage === 'failed' ? <AlertTriangle className="rate-package-failure-icon" /> : progressStage === 'delivered' ? <PackageCheck className="rate-package-delivered-icon" /> : <>
              <div className="rate-package-cards"><FileText className="rate-package-card rate-package-card-one" /><FileText className="rate-package-card rate-package-card-two" /><FileText className="rate-package-card rate-package-card-three" /></div>
              <div className="rate-package-box"><Package /></div>
              <div className="rate-package-flight" />
              <Cloud className="rate-package-cloud" />
            </>}
          </div>
          <div className="rate-package-copy">
            <strong>{progressStage === 'failed'
              ? errorMessage?.toLowerCase().includes('unable to package') ? 'Unable to package changes'
                : uploadProgress?.deliveredBatches ? 'Some batches delivered' : 'Unable to save changes'
              : progressStage === 'delivered' ? 'Package delivered'
                : progressStage === 'verifying' ? 'Verifying your changes…'
                  : progressStage === 'packaging' ? 'Packaging your changes…' : 'Sending package…'}</strong>
            {progressStage === 'sending' && uploadProgress?.totalBatches ? <span>Batch {uploadProgress.currentBatch} of {uploadProgress.totalBatches} · {uploadProgress.deliveredBatches} delivered · {uploadProgress.failedBatches} failed</span>
              : progressStage === 'failed' ? <span>{uploadProgress?.deliveredBatches || 0} delivered · {uploadProgress?.failedBatches || 0} failed. Failed changes remain in your basket.</span>
                : progressStage === 'delivered' ? <span>{uploadProgress?.deliveredBatches || 0} batch{uploadProgress?.deliveredBatches === 1 ? '' : 'es'} delivered successfully.</span>
                  : <span>{progressStage === 'verifying' ? 'Checking connection and queued changes.' : 'Compressing selected changes into a safe package.'}</span>}
          </div>
          <ol className="rate-package-steps">
            {['Verify', 'Package', 'Send', 'Delivered'].map((label, index) => {
              const partialSend = progressStage === 'failed' && Boolean(uploadProgress?.deliveredBatches);
              const isComplete = progressStage === 'delivered' || activeStep > index || (partialSend && index < 2);
              const isActive = activeStep === index || (partialSend && index === 2);
              return <li key={label} className={progressStage === 'failed' && index === failureStep ? 'is-failed' : isActive ? 'is-active' : isComplete ? 'is-complete' : ''}>
                <span>{isComplete ? '✓' : index + 1}</span>{label}
              </li>;
            })}
          </ol>
        </div>}

        {errorMessage && <div role="alert" className="mx-3 mt-3 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{errorMessage}</span></div>}

        {operations.length > 0 ? <>
          {/* Sticky Top Action Toolbar */}
          <div className="border-b border-[#222F43] bg-[#0E1526] px-3.5 py-2.5">
            {confirmAction ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-slate-200">
                  {confirmAction === 'upload'
                    ? `Publish ${selectedCount} selected change${selectedCount === 1 ? '' : 's'} to all authorized users?`
                    : `Discard ${selectedCount} selected local change${selectedCount === 1 ? '' : 's'}? This restores original values.`}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 font-bold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={!selectedCount}
                    className={`rounded-lg px-3 py-1.5 font-extrabold text-white disabled:opacity-40 transition cursor-pointer ${
                      confirmAction === 'upload' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-rose-600 hover:bg-rose-500'
                    }`}
                  >
                    Confirm {confirmAction === 'upload' ? 'upload' : 'discard'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectAll?.(!allSelected)}
                    className="font-bold text-blue-300 hover:text-blue-200 transition cursor-pointer"
                  >
                    {allSelected ? 'Clear selection' : 'Select all'}
                  </button>
                  <span className="text-slate-400">({selectedCount} selected)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedCount || isPublishing}
                    onClick={() => setConfirmAction('discard')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 font-bold text-rose-200 disabled:opacity-40 hover:bg-rose-500/20 cursor-pointer transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Discard
                  </button>
                  <button
                    type="button"
                    disabled={!selectedCount || isPublishing}
                    onClick={() => setConfirmAction('upload')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-extrabold text-white disabled:opacity-40 hover:bg-blue-500 cursor-pointer transition"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    Upload
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Rate Items List */}
          <ul className="max-h-[min(38vh,300px)] space-y-2 overflow-y-auto p-3">
            {operations.map((operation) => {
              const mutation = operation.mutations[0];
              if (!mutation) return null;
              const description = describeMutation(mutation);
              return <li key={operation.operationId} className={`rounded-xl border p-3 ${selectedIds.includes(operation.operationId) ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#222F43] bg-[#111a2b]'}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={selectedIds.includes(operation.operationId)} onChange={(event) => onToggleSelection?.(operation.operationId, event.target.checked)} disabled={isPublishing} className="mt-0.5 h-4 w-4 accent-blue-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold text-slate-100">{description.school}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">{description.detail}</span>
                    <span className="mt-1 block break-words text-[10px] text-slate-300">{description.fields}</span>
                  </span>
                  {operation.status === 'publishing' && <LoaderCircle className="h-4 w-4 animate-spin text-amber-400" />}
                </label>
              </li>;
            })}
          </ul>
        </> : <div className="flex items-center gap-2 p-5 text-slate-300"><PackageCheck className="h-5 w-5 text-emerald-400" />All changes are published.</div>}
      </section>}
    </div>
  );
};
