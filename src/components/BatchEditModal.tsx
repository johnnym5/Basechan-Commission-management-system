import React, { useState } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate, StudyLevel, SchoolGuidance } from '../types';
import { X, Save, AlertCircle, Info } from 'lucide-react';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRates: CommissionRate[];
  onBatchUpdated: (count: number) => void;
}

export const BatchEditModal: React.FC<BatchEditModalProps> = ({
  isOpen,
  onClose,
  selectedRates,
  onBatchUpdated,
}) => {
  const [masterRateStr, setMasterRateStr] = useState('');
  const [agentRateStr, setAgentRateStr] = useState('');
  const [studyLevel, setStudyLevel] = useState<StudyLevel | ''>('');
  const [aggregator, setAggregator] = useState('');
  const [intake, setIntake] = useState('');
  const [isFlatFee, setIsFlatFee] = useState<'' | 'true' | 'false'>('');
  const [guidance, setGuidance] = useState<SchoolGuidance | ''>('');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalSelected = selectedRates.length;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress(0);

    const updates: Partial<CommissionRate> = {};
    if (masterRateStr.trim() !== '') updates.masterRate = parseFloat(masterRateStr);
    if (agentRateStr.trim() !== '') updates.agentRate = parseFloat(agentRateStr);
    if (studyLevel !== '') updates.studyLevel = studyLevel as StudyLevel;
    if (aggregator.trim() !== '') updates.aggregator = aggregator.trim();
    if (intake.trim() !== '') updates.intake = intake.trim();
    if (isFlatFee !== '') updates.isFlatFee = isFlatFee === 'true';
    if (guidance !== '') updates.guidance = guidance as SchoolGuidance;

    if (Object.keys(updates).length === 0) {
      setError('No fields changed.');
      setLoading(false);
      return;
    }

    try {
      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(totalSelected / BATCH_SIZE);
      let completed = 0;

      for (let b = 0; b < totalBatches; b++) {
        const start = b * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalSelected);
        const chunk = selectedRates.slice(start, end);

        const batch = writeBatch(db);

        for (const rate of chunk) {
          const rateRef = doc(db, 'rates', rate.id);
          
          const newMasterRate = updates.masterRate !== undefined ? updates.masterRate : rate.masterRate;
          const newAgentRate = updates.agentRate !== undefined ? updates.agentRate : rate.agentRate;
          
          const rateUpdates: Record<string, any> = {
            ...updates,
            diffMargin: parseFloat((newMasterRate - newAgentRate).toFixed(2)),
            updatedAt: new Date().toISOString(),
          };

          // Sanitize undefined
          const cleanUpdates: Record<string, any> = {};
          for (const [key, val] of Object.entries(rateUpdates)) {
            if (val !== undefined) cleanUpdates[key] = val;
          }

          batch.update(rateRef, cleanUpdates);
        }

        await batch.commit();
        completed += chunk.length;
        setProgress(Math.round((completed / totalSelected) * 100));
      }

      onBatchUpdated(completed);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch update failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    masterRateStr !== '' ||
    agentRateStr !== '' ||
    studyLevel !== '' ||
    aggregator !== '' ||
    intake !== '' ||
    isFlatFee !== '' ||
    guidance !== '';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Batch Edit</h2>
            <p className="text-sm text-slate-400 mt-1">
              Updating {totalSelected} selected items
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">
              Only fields that you fill out below will be updated. Blank fields will keep their original values for each rate.
            </p>
          </div>

          <form id="batch-edit-form" onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* School Guidance Batch Selector */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-emerald-400 mb-2">
                  School Guidance & Usage (Visible to Staff & Agents)
                </label>
                <select
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value as SchoolGuidance | '')}
                  className="w-full bg-slate-800 border border-emerald-500/40 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- No Change --</option>
                  <option value="FOCUS">🟢 Focus / Preferred (In the Green)</option>
                  <option value="ALLOWED">🔵 Allowed (Standard)</option>
                  <option value="DO_NOT_USE">🔴 Do Not Use / Avoid (Not to be used)</option>
                </select>
              </div>

              {/* Master Rate */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Master Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={masterRateStr}
                  onChange={(e) => setMasterRateStr(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Leave blank to keep original"
                />
              </div>

              {/* Agent Rate */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Agent Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={agentRateStr}
                  onChange={(e) => setAgentRateStr(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Leave blank to keep original"
                />
              </div>

              {/* Study Level */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Study Level
                </label>
                <select
                  value={studyLevel}
                  onChange={(e) => setStudyLevel(e.target.value as StudyLevel | '')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- No Change --</option>
                  <option value="FD">FD (Foundation)</option>
                  <option value="UG">UG (Undergraduate)</option>
                  <option value="PG">PG (Postgraduate)</option>
                  <option value="ALL">ALL (All Levels)</option>
                </select>
              </div>

              {/* Aggregator */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Aggregator
                </label>
                <input
                  type="text"
                  value={aggregator}
                  onChange={(e) => setAggregator(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Leave blank to keep original"
                />
              </div>

              {/* Intake */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Intake
                </label>
                <input
                  type="text"
                  value={intake}
                  onChange={(e) => setIntake(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Leave blank to keep original"
                />
              </div>

              {/* Fee Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Fee Type
                </label>
                <select
                  value={isFlatFee}
                  onChange={(e) => setIsFlatFee(e.target.value as '' | 'true' | 'false')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- No Change --</option>
                  <option value="false">Percentage (%)</option>
                  <option value="true">Flat Fee (£)</option>
                </select>
              </div>
            </div>

            {/* Live Preview section */}
            {hasChanges && (
              <div className="mt-8 pt-6 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">
                  Update Summary
                </h3>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <ul className="space-y-2 text-sm">
                    {guidance && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">School Guidance:</span>
                        <span className="text-emerald-400 font-bold">Set to "{guidance}"</span>
                      </li>
                    )}
                    {masterRateStr && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">Master Rate:</span>
                        <span className="text-emerald-400 font-medium">Set to {masterRateStr}</span>
                      </li>
                    )}
                    {agentRateStr && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">Agent Rate:</span>
                        <span className="text-emerald-400 font-medium">Set to {agentRateStr}</span>
                      </li>
                    )}
                    {(masterRateStr || agentRateStr) && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">Diff Margin:</span>
                        <span className="text-emerald-400 font-medium">Will be re-calculated automatically</span>
                      </li>
                    )}
                    {studyLevel && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">Study Level:</span>
                        <span className="text-emerald-400 font-medium">Set to {studyLevel}</span>
                      </li>
                    )}
                    {aggregator && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">Aggregator:</span>
                        <span className="text-emerald-400 font-medium">Set to "{aggregator}"</span>
                      </li>
                    )}
                    {intake && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">Intake:</span>
                        <span className="text-emerald-400 font-medium">Set to "{intake}"</span>
                      </li>
                    )}
                    {isFlatFee !== '' && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 w-32">Fee Type:</span>
                        <span className="text-emerald-400 font-medium">
                          Set to {isFlatFee === 'true' ? 'Flat Fee (£)' : 'Percentage (%)'}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {loading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Updating...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            form="batch-edit-form"
            type="submit"
            disabled={loading || !hasChanges}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Updating...' : `Apply to ${totalSelected} Items`}
          </button>
        </div>
      </div>
    </div>
  );
};
