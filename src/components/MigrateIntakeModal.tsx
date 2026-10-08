import React, { useState, useMemo } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { generateCompositeId } from '../utils/idGenerator';
import { logRateChange } from '../utils/auditLogger';
import { PredictiveInput } from './PredictiveInput';
import type { CommissionRate } from '../types';
import {
  X,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
  TrendingUp,
} from 'lucide-react';

interface MigrateIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRates: CommissionRate[];
  onMigratedComplete: (count: number, targetIntake: string) => void;
}

export const MigrateIntakeModal: React.FC<MigrateIntakeModalProps> = ({
  isOpen,
  onClose,
  existingRates,
  onMigratedComplete,
}) => {
  const { user } = useAuth();
  const [sourceType, setSourceType] = useState<'intake' | 'sheet'>('intake');
  const [sourceValue, setSourceValue] = useState('');
  const [targetIntake, setTargetIntake] = useState('');
  const [targetSheet, setTargetSheet] = useState('');

  // Rate adjustment percentage (optional e.g. +0.5%)
  const [adjustMasterPct, setAdjustMasterPct] = useState<number | ''>('');
  const [adjustAgentPct, setAdjustAgentPct] = useState<number | ''>('');

  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; percentage: number } | null>(null);
  const [error, setError] = useState('');

  // Extract available source intakes and sheets
  const { sourceIntakes, sourceSheets, uniqueIntakes } = useMemo(() => {
    const intakes = new Set<string>();
    const sheets = new Set<string>();

    existingRates.forEach((r) => {
      if (r.intake) intakes.add(r.intake);
      if (r.sourceSheet) sheets.add(r.sourceSheet);
    });

    return {
      sourceIntakes: Array.from(intakes).sort(),
      sourceSheets: Array.from(sheets).sort(),
      uniqueIntakes: Array.from(intakes).sort(),
    };
  }, [existingRates]);

  // Rates matching the chosen source intake/sheet
  const sourceRates = useMemo(() => {
    if (!sourceValue) return [];
    if (sourceType === 'intake') {
      return existingRates.filter((r) => r.intake === sourceValue);
    } else {
      return existingRates.filter((r) => r.sourceSheet === sourceValue);
    }
  }, [existingRates, sourceType, sourceValue]);

  if (!isOpen) return null;

  const handleStartMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceValue || !targetIntake.trim()) {
      setError('Please select a source and specify the target intake name.');
      return;
    }

    if (sourceRates.length === 0) {
      setError('No matching rates found in the selected source.');
      return;
    }

    setIsMigrating(true);
    setError('');
    const total = sourceRates.length;
    setProgress({ completed: 0, total, percentage: 0 });

    try {
      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(total / BATCH_SIZE);
      const newTargetIntake = targetIntake.trim();

      for (let b = 0; b < totalBatches; b++) {
        const chunk = sourceRates.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((srcRate) => {
          const newId = generateCompositeId(
            srcRate.universityName,
            newTargetIntake,
            srcRate.aggregator,
            srcRate.studyLevel
          );

          let newMaster = srcRate.masterRate;
          let newAgent = srcRate.agentRate;

          if (typeof adjustMasterPct === 'number' && adjustMasterPct !== 0 && !srcRate.isFlatFee) {
            newMaster = parseFloat((newMaster * (1 + adjustMasterPct / 100)).toFixed(2));
          }

          if (typeof adjustAgentPct === 'number' && adjustAgentPct !== 0 && !srcRate.isFlatFee) {
            newAgent = parseFloat((newAgent * (1 + adjustAgentPct / 100)).toFixed(2));
          }

          const newDiff = parseFloat((newMaster - newAgent).toFixed(2));

          const clonedRate: CommissionRate = {
            ...srcRate,
            id: newId,
            intake: newTargetIntake,
            masterRate: newMaster,
            agentRate: newAgent,
            diffMargin: newDiff,
            sourceSheet: targetSheet.trim() || srcRate.sourceSheet || '',
            updatedAt: new Date().toISOString(),
          };

          const docRef = doc(db, 'rates', newId);
          batch.set(docRef, clonedRate, { merge: true });
        });

        await batch.commit();

        const completed = Math.min((b + 1) * BATCH_SIZE, total);
        const percentage = Math.round((completed / total) * 100);
        setProgress({ completed, total, percentage });
      }

      // Record Audit Log for bulk migration
      await logRateChange(
        user?.email || 'Admin',
        'BATCH_EDIT',
        `MIGRATE_${sourceValue}_TO_${newTargetIntake}`,
        `Migrated ${total} rates to ${newTargetIntake}`
      );

      onMigratedComplete(total, newTargetIntake);
      onClose();
    } catch (err: any) {
      console.error('Migration error:', err);
      setError(err.message || 'Failed to migrate intake sheet.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-indigo-900 dark:text-indigo-200">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/60 rounded-xl">
              <Copy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Migrate / Clone Intake Sheet</h3>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">Bulk Copy Rates to New Intake</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isMigrating}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleStartMigration} className="p-6 space-y-5">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Source Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              1. Choose Source to Copy From
            </label>

            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="sourceType"
                  value="intake"
                  checked={sourceType === 'intake'}
                  onChange={() => {
                    setSourceType('intake');
                    setSourceValue('');
                  }}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span>By Existing Intake Term</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="sourceType"
                  value="sheet"
                  checked={sourceType === 'sheet'}
                  onChange={() => {
                    setSourceType('sheet');
                    setSourceValue('');
                  }}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span>By Excel Sheet Name</span>
              </label>
            </div>

            <select
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              className="w-full px-3 py-2.5 text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">-- Select Source {sourceType === 'intake' ? 'Intake' : 'Sheet'} --</option>
              {(sourceType === 'intake' ? sourceIntakes : sourceSheets).map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>

            {sourceValue && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Found {sourceRates.length} commission rates ready to clone.</span>
              </p>
            )}
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* 2. Target Intake Name */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              2. Specify Target Intake Details
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PredictiveInput
                label="Target Intake Name *"
                required
                value={targetIntake}
                onChange={setTargetIntake}
                options={uniqueIntakes}
                placeholder="e.g. Jan 2027, Sept 2027..."
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Sheet Name (Optional)
                </label>
                <input
                  type="text"
                  value={targetSheet}
                  onChange={(e) => setTargetSheet(e.target.value)}
                  placeholder="e.g. 2027 Jan BIL-AGENT COMMS"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Optional Rate Percentage Adjustments */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              <span>Optional Bulk Rate Adjustments (Leave empty to keep same rates)</span>
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Adjust Master Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={adjustMasterPct}
                  onChange={(e) => setAdjustMasterPct(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. +1 or -0.5"
                  className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Adjust Agent Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={adjustAgentPct}
                  onChange={(e) => setAdjustAgentPct(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. +0.5"
                  className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Progress Bar during Migration */}
          {isMigrating && progress && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-mono font-semibold">
                <span>Cloning rates...</span>
                <span>{progress.completed} / {progress.total} ({progress.percentage}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-200"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isMigrating}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMigrating || !sourceValue || !targetIntake.trim() || sourceRates.length === 0}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cloning to Firestore...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Migrate {sourceRates.length > 0 ? `(${sourceRates.length} Rates)` : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
