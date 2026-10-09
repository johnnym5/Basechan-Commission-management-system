import React, { useState, useMemo } from 'react';
import type { CommissionRate } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import { createRate } from '../../services/adminRateWriteService';
import {
  Copy,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface IntakeMigrationTabProps {
  rates: CommissionRate[];
  onRefreshRates: () => void;
}

export const IntakeMigrationTab: React.FC<IntakeMigrationTabProps> = ({ rates, onRefreshRates }) => {
  const { user } = useAuth();
  const { intakeLifecycles, updateIntakeLifecycle } = useSystemConfig();

  const [sourceIntake, setSourceIntake] = useState<string>('');
  const [targetIntake, setTargetIntake] = useState<string>('');
  const [adjustmentPercent, setAdjustmentPercent] = useState<number>(0);
  const [deadlineDate, setDeadlineDate] = useState<string>('');
  const [selectedDeadlineIntake, setSelectedDeadlineIntake] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showDryRunModal, setShowDryRunModal] = useState(false);

  // Available unique intakes
  const availableIntakes = useMemo(() => {
    const set = new Set<string>();
    rates.forEach((r) => {
      const val = r.sourceSheet || r.intake;
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [rates]);

  // Rates matching source intake
  const matchingSourceRates = useMemo(() => {
    if (!sourceIntake) return [];
    return rates.filter((r) => (r.sourceSheet || r.intake) === sourceIntake);
  }, [rates, sourceIntake]);

  // Dry-run calculation
  const dryRunStats = useMemo(() => {
    const uniSet = new Set<string>();
    const aggSet = new Set<string>();
    matchingSourceRates.forEach((r) => {
      uniSet.add(r.universityId);
      if (r.aggregator) aggSet.add(r.aggregator);
    });
    return {
      rateCount: matchingSourceRates.length,
      universityCount: uniSet.size,
      aggregatorCount: aggSet.size,
    };
  }, [matchingSourceRates]);

  const handleExecuteClone = async () => {
    if (!sourceIntake || !targetIntake.trim() || !matchingSourceRates.length) return;
    setIsProcessing(true);
    setStatusNotice(null);

    try {
      const cleanTarget = targetIntake.trim();
      let successCount = 0;

      for (const sourceRate of matchingSourceRates) {
        let masterRate = sourceRate.masterRate;
        let agentRate = sourceRate.agentRate;

        if (adjustmentPercent !== 0 && !sourceRate.isFlatFee) {
          const factor = 1 + adjustmentPercent / 100;
          masterRate = Math.round(masterRate * factor * 10) / 10;
          agentRate = Math.round(agentRate * factor * 10) / 10;
        }

        const newId = `${sourceRate.universityId}_${cleanTarget.replace(/\s+/g, '-')}_${sourceRate.aggregator}_${sourceRate.studyLevel}`;
        const newRecord: CommissionRate = {
          ...sourceRate,
          id: newId,
          intake: cleanTarget,
          sourceSheet: cleanTarget,
          masterRate,
          agentRate,
          diffMargin: masterRate - agentRate,
          updatedAt: new Date().toISOString(),
        };

        await createRate(newRecord, user?.email || 'Admin');
        successCount++;
      }

      setStatusNotice(`Successfully cloned ${successCount} rates from "${sourceIntake}" to "${cleanTarget}".`);
      setShowDryRunModal(false);
      setSourceIntake('');
      setTargetIntake('');
      setAdjustmentPercent(0);
      onRefreshRates();
    } catch (err) {
      console.error('Error cloning intake rates:', err);
      setStatusNotice('Error executing intake clone. Please check database permissions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveDeadline = async () => {
    if (!selectedDeadlineIntake) return;
    await updateIntakeLifecycle(
      selectedDeadlineIntake,
      { applicationDeadline: deadlineDate || null },
      user?.email || 'Admin'
    );
    setStatusNotice(`Application deadline updated for intake "${selectedDeadlineIntake}".`);
    setDeadlineDate('');
    setSelectedDeadlineIntake('');
  };

  return (
    <div className="space-y-6">
      {statusNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Intake Cloning & Migration Engine */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-blue-600 dark:text-amber-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Intake Rate Cloning Engine
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 dark:bg-amber-400 text-blue-900 dark:text-slate-950">
            BATCH CLONE RATES
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Clone an entire intake sheet's rate structure to a new intake term (e.g. <b>Sept 2025</b> $\rightarrow$ <b>Sept 2026</b>) with optional rate percentage adjustments.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Source Intake */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Source Intake Sheet
            </label>
            <select
              value={sourceIntake}
              onChange={(e) => setSourceIntake(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer"
            >
              <option value="">-- Select Source Intake --</option>
              {availableIntakes.map((intake) => (
                <option key={intake} value={intake}>
                  {intake} ({rates.filter((r) => (r.sourceSheet || r.intake) === intake).length} rates)
                </option>
              ))}
            </select>
          </div>

          {/* Target Intake Name */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              New Target Intake Name
            </label>
            <input
              type="text"
              placeholder="e.g. Sept 2026"
              value={targetIntake}
              onChange={(e) => setTargetIntake(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-bold text-xs"
            />
          </div>

          {/* Optional Rate Adjustment */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Rate Adjustment % (Optional)
            </label>
            <input
              type="number"
              placeholder="0 (e.g. +2 for +2%)"
              value={adjustmentPercent || ''}
              onChange={(e) => setAdjustmentPercent(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-bold text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            disabled={!sourceIntake || !targetIntake.trim() || !matchingSourceRates.length}
            onClick={() => setShowDryRunModal(true)}
            className="px-5 py-2.5 bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs hover:bg-blue-700 dark:hover:bg-amber-500 disabled:opacity-40 transition cursor-pointer flex items-center gap-2"
          >
            <span>Preview Dry-Run & Clone</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Application Deadline Rules */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Intake Application Closing Deadlines
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
            DEADLINE ALERTS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Select Intake Term
            </label>
            <select
              value={selectedDeadlineIntake}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDeadlineIntake(val);
                setDeadlineDate(intakeLifecycles[val]?.applicationDeadline || '');
              }}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer"
            >
              <option value="">-- Select Intake Term --</option>
              {availableIntakes.map((intake) => (
                <option key={intake} value={intake}>
                  {intake} {intakeLifecycles[intake]?.applicationDeadline ? `(Deadline: ${intakeLifecycles[intake].applicationDeadline})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Application Deadline Date
            </label>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-bold text-xs cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            disabled={!selectedDeadlineIntake}
            onClick={handleSaveDeadline}
            className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl disabled:opacity-40 transition cursor-pointer"
          >
            Save Deadline Rule
          </button>
        </div>
      </div>

      {/* Dry-Run Safety Modal */}
      {showDryRunModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade">
          <div className="bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-modal-pop">
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Confirm Intake Rate Clone
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Source Sheet:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{sourceIntake}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Target Sheet:</span>
                <span className="font-bold text-blue-600 dark:text-amber-400">{targetIntake}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rate Count to Clone:</span>
                <span className="font-extrabold text-emerald-600">{dryRunStats.rateCount} Rates</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Universities Affected:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{dryRunStats.universityCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Aggregators Affected:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{dryRunStats.aggregatorCount}</span>
              </div>
              {adjustmentPercent !== 0 && (
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Rate % Adjustment:</span>
                  <span className="font-bold text-indigo-500">{adjustmentPercent > 0 ? `+${adjustmentPercent}%` : `${adjustmentPercent}%`}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDryRunModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleExecuteClone}
                className="px-5 py-2.5 bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs hover:bg-blue-700 dark:hover:bg-amber-500 disabled:opacity-50 transition cursor-pointer"
              >
                {isProcessing ? 'Cloning...' : 'Confirm & Clone Rates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
