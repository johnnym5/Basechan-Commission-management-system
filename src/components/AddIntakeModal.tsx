import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Calendar, AlertCircle } from 'lucide-react';

interface AddIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddIntake: (newIntake: string) => Promise<void> | void;
  existingIntakes?: string[];
}

export const AddIntakeModal: React.FC<AddIntakeModalProps> = ({
  isOpen,
  onClose,
  onAddIntake,
  existingIntakes = [],
}) => {
  const [intakeName, setIntakeName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = intakeName.trim();
    if (!trimmed) {
      setError('Intake name is required (e.g. "Sept 2027", "Jan 2028").');
      return;
    }

    const alreadyExists = existingIntakes.some(
      (item) => item.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setError(`Intake "${trimmed}" already exists in the system.`);
      return;
    }

    try {
      setLoading(true);
      await onAddIntake(trimmed);
      setIntakeName('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add intake';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[11000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl overflow-hidden p-6 animate-modal-pop"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#222F43]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">Add New Intake</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Register a new intake period across routes and filters.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Intake Period / Name
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Sept 2027, Jan 2028, Summer 2027"
              value={intakeName}
              onChange={(e) => setIntakeName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Adding...' : 'Add Intake'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
