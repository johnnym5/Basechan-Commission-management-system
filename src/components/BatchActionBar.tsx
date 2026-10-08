import React, { useState } from 'react';
import type { SchoolGuidance } from '../types';
import {
  X,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Check,
} from 'lucide-react';

export interface BatchActionBarProps {
  selectedCount: number;
  onBatchEdit: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onBatchSetGuidance: (guidance: SchoolGuidance) => void;
  loading?: boolean;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  onBatchEdit,
  onDeselectAll,
  onDeleteSelected,
  onBatchSetGuidance,
  loading = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (selectedCount === 0) return null;

  const handleDelete = () => {
    if (isDeleting) {
      onDeleteSelected();
      setIsDeleting(false);
    } else {
      setIsDeleting(true);
      setTimeout(() => setIsDeleting(false), 4000);
    }
  };

  const isSingle = selectedCount === 1;

  return (
    <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up w-[95%] sm:w-auto max-w-4xl">
      <div className="bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl shadow-slate-950/80 rounded-2xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Selected Counter */}
        <div className="flex items-center gap-2 sm:gap-3 pr-3 sm:pr-4 border-r border-slate-700 shrink-0">
          <span className="flex items-center justify-center bg-emerald-500 text-white font-bold h-6 w-6 rounded-full text-xs font-mono shadow-xs">
            {selectedCount}
          </span>
          <span className="text-white font-semibold whitespace-nowrap">
            {isSingle ? 'Selected' : 'Selected'}
          </span>
        </div>

        {/* Guidance Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onBatchSetGuidance('FOCUS')}
            disabled={loading}
            title="Mark selected school(s) as Focus / Preferred (In the Green)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-semibold shadow-xs cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>Set Focus (Green)</span>
          </button>

          <button
            onClick={() => onBatchSetGuidance('DO_NOT_USE')}
            disabled={loading}
            title="Mark selected school(s) as Do Not Use / Avoid"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all font-semibold shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Ban className="w-4 h-4 text-rose-200" />
            <span>Set Do Not Use</span>
          </button>

          <button
            onClick={() => onBatchSetGuidance('ALLOWED')}
            disabled={loading}
            title="Mark selected school(s) as Allowed (Standard)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all font-medium cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5 text-slate-400" />
            <span>Set Allowed</span>
          </button>
        </div>

        {/* Edit & Delete Actions */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-700 shrink-0">
          <button
            onClick={onBatchEdit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-semibold shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>{isSingle ? 'Edit Record' : 'Batch Edit'}</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all font-semibold cursor-pointer ${
              isDeleting
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'text-slate-300 hover:text-rose-400 hover:bg-slate-800'
            }`}
          >
            {isDeleting ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Confirm Delete?</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{isSingle ? 'Delete' : 'Delete Selected'}</span>
              </>
            )}
          </button>

          <button
            onClick={onDeselectAll}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Deselect"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
