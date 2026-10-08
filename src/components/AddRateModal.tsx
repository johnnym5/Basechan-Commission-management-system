import React, { useState, useMemo, useEffect } from 'react';
import { X, Save, AlertCircle, Copy, Sparkles } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { generateCompositeId, normalizeUniversitySlug } from '../utils/idGenerator';
import { logRateChange } from '../utils/auditLogger';
import { PredictiveInput } from './PredictiveInput';
import type { CommissionRate, StudyLevel, NetOrGross } from '../types';

interface AddRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRates: CommissionRate[];
  onRateAdded: (rate: CommissionRate) => void;
}

const SHEET_NAMES = [
  'RAW DATA', 'REAL', 'UK - Agents', '2025 AGENT MASTER', 'Master Comms',
  'Oct - Feb 2026', '2026 Jan BIL-AGENT COMMS', '2026 Sept BIL - AGENT COMMS',
  '2026 AGENT MASTER', 'NOTES', 'UAP Master List', 'MASTER',
  'EDVOY Master List', 'CRIZAC Master List', 'SI-UK Master List'
];

export const AddRateModal: React.FC<AddRateModalProps> = ({
  isOpen,
  onClose,
  existingRates,
  onRateAdded,
}) => {
  const { user } = useAuth();
  const [universityName, setUniversityName] = useState('');
  const [country, setCountry] = useState('');
  const [intake, setIntake] = useState('');
  const [aggregator, setAggregator] = useState('');
  const [studyLevel, setStudyLevel] = useState<StudyLevel>('UG');
  const [masterRate, setMasterRate] = useState<number | ''>('');
  const [agentRate, setAgentRate] = useState<number | ''>('');
  const [isFlatFee, setIsFlatFee] = useState(false);
  const [netOrGross, setNetOrGross] = useState<NetOrGross>('GROSS');
  const [notes, setNotes] = useState('');
  const [sourceSheet, setSourceSheet] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Extract lists of existing values for predictive inputs
  const { uniqueUniversities, uniqueCountries, uniqueIntakes, uniqueAggregators, universityCountryMap } = useMemo(() => {
    const unis = new Set<string>();
    const countries = new Set<string>();
    const intakes = new Set<string>();
    const aggs = new Set<string>();
    const uniCountry = new Map<string, string>();

    existingRates.forEach((r) => {
      if (r.universityName) {
        unis.add(r.universityName);
        if (r.country && !uniCountry.has(r.universityName)) {
          uniCountry.set(r.universityName, r.country);
        }
      }
      if (r.country) countries.add(r.country);
      if (r.intake) intakes.add(r.intake);
      if (r.aggregator) aggs.add(r.aggregator);
    });

    return {
      uniqueUniversities: Array.from(unis).sort(),
      uniqueCountries: Array.from(countries).sort(),
      uniqueIntakes: Array.from(intakes).sort(),
      uniqueAggregators: Array.from(aggs).sort(),
      universityCountryMap: uniCountry,
    };
  }, [existingRates]);

  // Handle auto-filling country when a university is selected
  const handleSelectUniversity = (selectedUni: string) => {
    setUniversityName(selectedUni);
    const predictedCountry = universityCountryMap.get(selectedUni);
    if (predictedCountry && !country) {
      setCountry(predictedCountry);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (rateId: string) => {
    setSelectedTemplateId(rateId);
    if (!rateId) return;

    const tpl = existingRates.find((r) => r.id === rateId);
    if (!tpl) return;

    setUniversityName(tpl.universityName);
    setCountry(tpl.country || '');
    setAggregator(tpl.aggregator);
    setStudyLevel(tpl.studyLevel);
    setMasterRate(tpl.masterRate);
    setAgentRate(tpl.agentRate);
    setIsFlatFee(tpl.isFlatFee);
    setNetOrGross(tpl.netOrGross || 'GROSS');
    setSourceSheet(tpl.sourceSheet || '');
    setNotes(tpl.notes || '');
  };

  const diffMargin = useMemo(() => {
    if (masterRate === '' || agentRate === '') return 0;
    return Number((Number(masterRate) - Number(agentRate)).toFixed(2));
  }, [masterRate, agentRate]);

  const compositeId = useMemo(() => {
    if (!universityName || !intake || !aggregator) return '';
    return generateCompositeId(universityName, intake, aggregator, studyLevel);
  }, [universityName, intake, aggregator, studyLevel]);

  const isDuplicate = useMemo(() => {
    if (!compositeId) return false;
    return existingRates.some((r) => r.id === compositeId);
  }, [compositeId, existingRates]);

  useEffect(() => {
    if (!isOpen) {
      setUniversityName('');
      setCountry('');
      setIntake('');
      setAggregator('');
      setStudyLevel('UG');
      setMasterRate('');
      setAgentRate('');
      setIsFlatFee(false);
      setNetOrGross('GROSS');
      setNotes('');
      setSourceSheet('');
      setSelectedTemplateId('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!universityName || !intake || !aggregator || masterRate === '' || agentRate === '') {
      setError('Please fill all required fields');
      return;
    }
    if (isDuplicate) {
      setError('A rate with this exact combination already exists.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const newRate: CommissionRate = {
      id: compositeId,
      universityId: normalizeUniversitySlug(universityName),
      universityName,
      intake,
      aggregator,
      studyLevel,
      masterRate: Number(masterRate),
      agentRate: Number(agentRate),
      diffMargin,
      isFlatFee,
      netOrGross,
      updatedAt: new Date().toISOString(),
    };

    if (country.trim()) newRate.country = country.trim();
    if (notes.trim()) newRate.notes = notes.trim();
    if (sourceSheet) newRate.sourceSheet = sourceSheet;

    try {
      await setDoc(doc(db, 'rates', compositeId), newRate, { merge: true });

      // Record Audit Log
      await logRateChange(user?.email || 'Admin', 'CREATE', compositeId, universityName);

      onRateAdded(newRate);
      onClose();
    } catch (err: any) {
      console.error('Error adding rate:', err);
      setError(err.message || 'Failed to save rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Add Commission Rate</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Template Copy Section */}
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Copy / Auto-Fill From Existing Rate Template</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium border border-emerald-300 dark:border-emerald-700/80 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Choose past rate to copy fields (optional) --</option>
              {existingRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.universityName} ({r.intake} • {r.studyLevel} • {r.aggregator})
                </option>
              ))}
            </select>
            {selectedTemplateId && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-filled details from past rate! Simply enter your new Intake below.</span>
              </p>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-rose-950/60 text-red-700 dark:text-rose-300 border border-red-200 dark:border-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isDuplicate && !error && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">Warning: A rate with this University, Intake, Aggregator, and Level already exists. Saving will overwrite it.</p>
            </div>
          )}

          <form id="add-rate-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Predictive University Input */}
              <PredictiveInput
                label="University Name"
                required
                value={universityName}
                onChange={setUniversityName}
                options={uniqueUniversities}
                onSelectOption={handleSelectUniversity}
                placeholder="Type or select university..."
              />

              {/* Predictive Country Input */}
              <PredictiveInput
                label="Country"
                value={country}
                onChange={setCountry}
                options={uniqueCountries}
                placeholder="e.g. UK, Canada..."
              />

              {/* Predictive Intake Input */}
              <PredictiveInput
                label="Intake"
                required
                value={intake}
                onChange={setIntake}
                options={uniqueIntakes}
                placeholder="e.g. Jan 2027, Sept 2026..."
              />

              {/* Predictive Aggregator Input */}
              <PredictiveInput
                label="Aggregator / Portal"
                required
                value={aggregator}
                onChange={setAggregator}
                options={uniqueAggregators}
                placeholder="e.g. SI-UK, EDVOY, UAP..."
              />

              {/* Study Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Study Level *
                </label>
                <select
                  value={studyLevel}
                  onChange={(e) => setStudyLevel(e.target.value as StudyLevel)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="FD">Foundation (FD)</option>
                  <option value="UG">Undergraduate (UG)</option>
                  <option value="PG">Postgraduate (PG)</option>
                  <option value="ALL">ALL Levels</option>
                </select>
              </div>

              {/* Predictive Source Sheet Input */}
              <PredictiveInput
                label="Source Sheet Name"
                value={sourceSheet}
                onChange={setSourceSheet}
                options={SHEET_NAMES}
                placeholder="e.g. 2027 Jan BIL-AGENT COMMS..."
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Pricing Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Master Rate */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Master Rate *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={masterRate}
                    onChange={(e) => setMasterRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>

                {/* Agent Rate */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agent Rate *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={agentRate}
                    onChange={(e) => setAgentRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>

                {/* Diff Margin Display */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Calculated Margin
                  </label>
                  <div className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-mono font-bold">
                    {diffMargin} {isFlatFee ? 'Flat' : '%'}
                  </div>
                </div>

                {/* Pricing Type */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Type
                    </label>
                    <select
                      value={isFlatFee ? 'FLAT' : 'PERCENT'}
                      onChange={(e) => setIsFlatFee(e.target.value === 'FLAT')}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="PERCENT">Percentage (%)</option>
                      <option value="FLAT">Flat Fee (£)</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Net / Gross
                    </label>
                    <select
                      value={netOrGross}
                      onChange={(e) => setNetOrGross(e.target.value as NetOrGross)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="GROSS">GROSS</option>
                      <option value="NET">NET</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Any additional information..."
              />
            </div>
            
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-mono">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Generated ID:</span> {compositeId || '...'}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-rate-form"
            disabled={isSubmitting}
            className="px-4 py-2 flex items-center gap-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Rate'}
          </button>
        </div>
      </div>
    </div>
  );
};
