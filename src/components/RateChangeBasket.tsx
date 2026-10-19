import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, CloudOff, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import type { PendingRateOperation } from '../types/rateWriteQueue';

type Props = {
  operations: PendingRateOperation[];
  syncState: 'idle' | 'syncing' | 'offline' | 'quota-paused';
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onResolveConflict: (id: string, resolution: 'keep-cloud' | 'apply-local') => void;
};
const statusLabel: Record<PendingRateOperation['status'], string> = {
  pending: 'Waiting to sync', syncing: 'Syncing', 'quota-paused': 'Quota paused', conflict: 'Needs review', failed: 'Sync failed', cancelled: 'Cancelled',
};
const statusIcon = (status: PendingRateOperation['status']) => status === 'syncing'
  ? <LoaderCircle className="h-4 w-4 animate-spin" />
  : status === 'quota-paused' ? <CloudOff className="h-4 w-4" />
  : status === 'conflict' || status === 'failed' ? <AlertCircle className="h-4 w-4" />
  : <Clock3 className="h-4 w-4" />;

export const RateChangeBasket: React.FC<Props> = ({ operations, syncState, onRetry, onDiscard, onResolveConflict }) => {
  if (!operations.length) return null;
  const counts = operations.reduce<Record<string, number>>((result, item) => { result[item.status] = (result[item.status] || 0) + 1; return result; }, {});
  return <section aria-label="Pending rate changes" className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-bold text-slate-900 dark:text-slate-100">Pending rate changes <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs dark:bg-amber-900">{operations.length}</span></h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{syncState === 'offline' ? 'Saved on this device. Waiting for a connection.' : syncState === 'quota-paused' ? 'Saved on this device. Sync will retry after database access is restored.' : syncState === 'syncing' ? 'Saved locally. Sending changes to Firestore.' : 'Saved locally. Changes will appear to other users after Firestore confirms them.'}</p></div>
      <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Local copy is safe</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">{Object.entries(counts).map(([status, count]) => <span key={status} className="rounded-full bg-white px-2.5 py-1 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">{statusLabel[status as PendingRateOperation['status']]}: {count}</span>)}</div>
    <ul className="mt-3 divide-y divide-amber-200 dark:divide-amber-900">{operations.map((operation) => {
      const affected = new Set(operation.mutations.flatMap((mutation) => mutation.kind === 'create' ? [mutation.next.universityName] : mutation.kind === 'update' ? [mutation.baseSnapshot?.universityName || mutation.id] : [mutation.baseRate?.universityName || mutation.id]));
      return <li key={operation.operationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{statusIcon(operation.status)}<span>{operation.category === 'guidance' ? 'Guidance update' : operation.category === 'routing' ? 'Route update' : operation.category === 'intake' ? 'Intake or rate update' : 'Rate edit'}</span><span className="text-xs font-normal text-slate-500">{operation.mutations.length} change{operation.mutations.length === 1 ? '' : 's'}</span></div>
          <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{Array.from(affected).slice(0, 3).join(', ')}{affected.size > 3 ? ` and ${affected.size - 3} more` : ''}</p>
          {operation.lastError && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{operation.lastError}</p>}
          {operation.conflicts?.map((conflict) => <p key={`${conflict.mutationIndex}-${conflict.id}`} className="mt-1 text-xs text-rose-700 dark:text-rose-300">{conflict.reason}</p>)}
        </div>
        <div className="flex items-center gap-2">{operation.status === 'conflict' ? <><button className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700" onClick={() => onResolveConflict(operation.operationId, 'keep-cloud')}>Keep cloud</button>{!operation.conflicts?.some((conflict) => conflict.reason.toLowerCase().includes('already exists')) && <button className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white" onClick={() => onResolveConflict(operation.operationId, 'apply-local')}>Apply my change</button>}</> : <>
          {(operation.status === 'pending' || operation.status === 'failed' || operation.status === 'quota-paused') && <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700" onClick={() => onRetry(operation.operationId)}><RefreshCw className="h-3 w-3" />Retry</button>}
          {operation.status === 'pending' && <button aria-label="Discard pending change" className="rounded-lg border border-slate-300 p-1.5 dark:border-slate-700" onClick={() => onDiscard(operation.operationId)}><Trash2 className="h-3.5 w-3.5" /></button>}
        </>}</div>
      </li>;
    })}</ul>
  </section>;
};
