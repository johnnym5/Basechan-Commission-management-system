import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { logRateChange } from '../utils/auditLogger';
import type { CommissionRate, StudyLevel, SchoolGuidance } from '../types';
import { X, Save, Trash2, AlertCircle } from 'lucide-react';

interface EditRateModalProps {
  rate: CommissionRate | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedRate: CommissionRate) => void;
  onDeleted?: (deletedRateId: string) => void;
}

export const EditRateModal: React.FC<EditRateModalProps> = ({
  rate,
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
      const rateRef = doc(db, 'rates', rate.id);
      const updatedFields = {
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

      await updateDoc(rateRef, updatedFields);

      // Record Audit Log
      await logRateChange(
        user?.email || 'Admin',
        'EDIT',
        rate.id,
        rate.universityName,
        {
          masterRate: { oldVal: rate.masterRate, newVal: masterRate },
          agentRate: { oldVal: rate.agentRate, newVal: agentRate },
          guidance: { oldVal: rate.guidance || 'ALLOWED', newVal: guidance },
        }
      );

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
      const rateRef = doc(db, 'rates', rate.id);
      await deleteDoc(rateRef);

      // Record Audit Log
      await logRateChange(
        user?.email || 'Admin',
        'DELETE',
        rate.id,
        rate.universityName
      );

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Edit Commission Rate</h3>
            <p className="text-xs text-slate-500">{rate.universityName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* School Guidance Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              School Guidance / Status (Visible to Staff & Agents)
            </label>
            <select
              value={guidance}
              onChange={(e) => setGuidance(e.target.value as SchoolGuidance)}
              className={`w-full px-3 py-2 text-xs sm:text-sm font-semibold border rounded-lg focus:outline-hidden focus:ring-2 ${
                guidance === 'FOCUS'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : guidance === 'DO_NOT_USE'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <option value="FOCUS">🟢 Focus / Preferred (In the Green)</option>
              <option value="ALLOWED">🔵 Allowed (Standard)</option>
              <option value="DO_NOT_USE">🔴 Do Not Use / Avoid (Not to be used)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Aggregator / Route
              </label>
              <input
                type="text"
                value={aggregator}
                onChange={(e) => setAggregator(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Intake
              </label>
              <input
                type="text"
                value={intake}
                onChange={(e) => setIntake(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Study Level
              </label>
              <select
                value={studyLevel}
                onChange={(e) => setStudyLevel(e.target.value as StudyLevel)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="UG">Undergraduate (UG)</option>
                <option value="PG">Postgraduate (PG)</option>
                <option value="FD">Foundation (FD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Pricing Type
              </label>
              <select
                value={isFlatFee ? 'flat' : 'percent'}
                onChange={(e) => setIsFlatFee(e.target.value === 'flat')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Fee (£)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Master Rate (Incoming {isFlatFee ? '£' : '%'})
              </label>
              <input
                type="number"
                step="0.01"
                value={masterRate}
                onChange={(e) => setMasterRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Agent Rate (Outgoing {isFlatFee ? '£' : '%'})
              </label>
              <input
                type="number"
                step="0.01"
                value={agentRate}
                onChange={(e) => setAgentRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Auto-calculated DIFF preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Profit Margin (DIFF = Master - Agent)
            </span>
            <span
              className={`text-lg font-bold font-mono ${
                diffMargin > 0
                  ? 'text-emerald-600'
                  : diffMargin < 0
                  ? 'text-rose-600'
                  : 'text-slate-600'
              }`}
            >
              {diffMargin > 0 ? '+' : ''}
              {isFlatFee ? `£${diffMargin.toLocaleString()}` : `${diffMargin}%`}
            </span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || deleting}
              className="px-3 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || deleting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || deleting}
                className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
