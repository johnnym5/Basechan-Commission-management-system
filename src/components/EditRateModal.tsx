import React, { useState, useEffect, useMemo } from 'react';
import { updateRate, deleteRates } from '../services/adminRateWriteService';
import { useAuth } from '../context/AuthContext';
import type { CommissionRate, StudyLevel, SchoolGuidance } from '../types';
import { generateCompositeId } from '../utils/idGenerator';
import { X, Save, Trash2, AlertCircle } from 'lucide-react';
import { PredictiveInput } from './PredictiveInput';
import { COMMON_AGGREGATORS } from '../constants/aggregators';

interface EditRateModalProps {
  rate: CommissionRate | null;
  existingRates: CommissionRate[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedRate: CommissionRate) => void;
  onDeleted?: (deletedRateId: string) => void;
}

export const EditRateModal: React.FC<EditRateModalProps> = ({
  rate,
  existingRates,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const { user } = useAuth();
  const [masterRate, setMasterRate] = useState<number>(0);
  const [agentRate, setAgentRate] = useState<number>(0);
  const [studyLevel, setStudyLevel] = useState<StudyLevel>('UG');
  const [aggregator, setAggregator] = useState<string>('');
  const [intake, setIntake] = useState<string>('');
  const [isFlatFee, setIsFlatFee] = useState<boolean>(false);
  const [guidance, setGuidance] = useState<SchoolGuidance>('ALLOWED');
  const [loading, setLoading] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { aggregatorOptions, intakeOptions } = useMemo(() => ({
    aggregatorOptions: Array.from(new Set([...COMMON_AGGREGATORS, ...existingRates.map((item) => item.aggregator), rate?.aggregator || ''].filter(Boolean))).sort(),
    intakeOptions: Array.from(new Set([...existingRates.map((item) => item.intake), rate?.intake || ''].filter(Boolean))).sort(),
  }), [existingRates, rate]);

  useEffect(() => {
    if (rate) {
      setMasterRate(rate.masterRate);
      setAgentRate(rate.agentRate);
      setStudyLevel(rate.studyLevel);
      setAggregator(rate.aggregator);
      setIntake(rate.intake);
      setIsFlatFee(rate.isFlatFee);
      setGuidance(rate.guidance || 'ALLOWED');
      setError(null);
    }
  }, [rate]);

  if (!isOpen || !rate) return null;

  // Auto-calculated DIFF margin
  const diffMargin = parseFloat((masterRate - agentRate).toFixed(2));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updatedFields = {
        id: generateCompositeId(rate.universityName, intake, aggregator, studyLevel),
        masterRate,
        agentRate,
        diffMargin,
        studyLevel,
        aggregator,
        intake,
        isFlatFee,
        guidance,
        updatedAt: new Date().toISOString(),
      };

      await updateRate(rate, { ...rate, ...updatedFields }, user?.email || 'Admin');

      if (onSaved) {
        onSaved({
          ...rate,
          ...updatedFields,
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update rate';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete this rate for ${rate.universityName} (${rate.aggregator} - ${rate.studyLevel})?`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteRates([rate], user?.email || 'Admin');

      if (onDeleted) {
        onDeleted(rate.id);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete rate';
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-md animate-backdrop-fade">
      <div className="bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl max-w-md sm:max-w-lg w-full border border-slate-200 dark:border-[#222F43] overflow-hidden animate-modal-pop">
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#18181B] border-b border-slate-200 dark:border-[#222F43] flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg">Edit Commission Rate</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{rate.universityName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 text-xs">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* School Guidance Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              School Guidance / Status (Visible to Staff & Agents)
            </label>
            <select
              value={guidance}
              onChange={(e) => setGuidance(e.target.value as SchoolGuidance)}
              className={`w-full px-3 py-2 text-xs sm:text-sm font-semibold border rounded-xl focus:outline-hidden focus:ring-2 ${
                guidance === 'FOCUS'
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : guidance === 'DO_NOT_USE'
                  ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  : 'bg-white dark:bg-[#18181B] border-slate-300 dark:border-[#222F43] text-slate-800 dark:text-slate-200'
              }`}
            >
              <option value="FOCUS">🟢 Focus / Preferred (In the Green)</option>
              <option value="ALLOWED">🔵 Allowed (Standard)</option>
              <option value="DO_NOT_USE">🔴 Do Not Use / Avoid (Not to be used)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <PredictiveInput label="Aggregator / Route" required value={aggregator} onChange={setAggregator} options={aggregatorOptions} placeholder="Search or enter an aggregator..." />
            <PredictiveInput label="Intake" required value={intake} onChange={setIntake} options={intakeOptions} placeholder="Search or enter an intake..." />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Study Level
              </label>
              <select
                value={studyLevel}
                onChange={(e) => setStudyLevel(e.target.value as StudyLevel)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                <option value="UG">Undergraduate (UG)</option>
                <option value="PG">Postgraduate (PG)</option>
                <option value="FD">Foundation (FD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Pricing Type
              </label>
              <select
                value={isFlatFee ? 'flat' : 'percent'}
                onChange={(e) => setIsFlatFee(e.target.value === 'flat')}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Fee (£)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-slate-100 dark:border-[#222F43]">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Master Rate (Incoming {isFlatFee ? '£' : '%'})
              </label>
              <input
                type="number"
                step="0.01"
                value={masterRate}
                onChange={(e) => setMasterRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Agent Rate (Outgoing {isFlatFee ? '£' : '%'})
              </label>
              <input
                type="number"
                step="0.01"
                value={agentRate}
                onChange={(e) => setAgentRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Auto-calculated DIFF preview */}
          <div className="bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] rounded-2xl p-3.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Profit Margin (DIFF = Master - Agent)
            </span>
            <span
              className={`text-base sm:text-lg font-black font-mono ${
                diffMargin > 0
                  ? 'text-emerald-600 dark:text-amber-400'
                  : diffMargin < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {diffMargin > 0 ? '+' : ''}
              {isFlatFee ? `£${diffMargin.toLocaleString()}` : `${diffMargin}%`}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#222F43]">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || deleting}
              className="px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 font-bold"
            >
              {deleting ? (
                <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Rate</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || deleting}
                className="px-4 py-2 text-xs bg-emerald-600 dark:bg-amber-400 hover:bg-emerald-700 dark:hover:bg-amber-500 text-white dark:text-slate-950 font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
