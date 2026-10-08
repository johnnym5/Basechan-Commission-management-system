import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { deleteAllRatesAndUniversities } from '../utils/firestoreBatcher';

interface DeleteAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalRatesCount: number;
  onDeletedAll: (count: number) => void;
}

export const DeleteAllModal: React.FC<DeleteAllModalProps> = ({
  isOpen,
  onClose,
  totalRatesCount,
  onDeletedAll,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; percentage: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE ALL';

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    setError(null);
    setProgress({ completed: 0, total: totalRatesCount, percentage: 0 });

    const result = await deleteAllRatesAndUniversities((p) => {
      setProgress(p);
    });

    setIsDeleting(false);

    if (result.success) {
      onDeletedAll(result.deletedCount);
      setConfirmText('');
      onClose();
    } else {
      setError(result.error || 'Failed to clear database');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-100 dark:border-rose-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/60 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Purge All Database Records</h3>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Irreversible Action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-rose-100/50 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            This will permanently erase all <span className="font-bold text-slate-900 dark:text-slate-100">{totalRatesCount} commission rates</span> and institutions from Firestore. This action is intended for resetting the system before importing a corrected workbook.
          </p>

          <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 space-y-2">
            <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
              To confirm, type <span className="font-mono font-bold bg-amber-100 dark:bg-amber-900/80 px-1 py-0.5 rounded text-amber-900 dark:text-amber-100">DELETE ALL</span> below:
            </p>
            <input
              type="text"
              value={confirmText}
              disabled={isDeleting}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE ALL"
              className="w-full px-3 py-2 text-xs border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-mono"
            />
          </div>

          {/* Progress bar during purge */}
          {isDeleting && progress && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <span>Purging collections...</span>
                <span>{progress.completed} / {progress.total} ({progress.percentage}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-800 font-medium hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs hover:shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Purging...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
