import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Building2,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { CommissionRate, SchoolGuidance, StudyLevel } from '../types';
import { generateCompositeId, normalizeUniversitySlug } from '../utils/idGenerator';

export interface AddUniversityModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRates: CommissionRate[];
  defaultIntake?: string;
  onUniversityAdded: (rates: CommissionRate[]) => Promise<void> | void;
}

export const AddUniversityModal: React.FC<AddUniversityModalProps> = ({
  isOpen,
  onClose,
  existingRates,
  defaultIntake = 'Sept 2026',
  onUniversityAdded,
}) => {
  const [universityName, setUniversityName] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [intake, setIntake] = useState(defaultIntake);
  const [commissionType, setCommissionType] = useState<'Percentage' | 'Fixed Fee'>('Percentage');
  const [guidance, setGuidance] = useState<SchoolGuidance>('ALLOWED');
  const [defaultRoute, setDefaultRoute] = useState('BASECHAN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rate inputs state
  const [agentFD, setAgentFD] = useState('');
  const [agentUG, setAgentUG] = useState('');
  const [agentPG, setAgentPG] = useState('');
  const [masterUG, setMasterUG] = useState('');
  const [masterPG, setMasterPG] = useState('');

  // Third party aggregators
  const [edvoyUG, setEdvoyUG] = useState('');
  const [edvoyPG, setEdvoyPG] = useState('');
  const [siUkUG, setSiUkUG] = useState('');
  const [siUkPG, setSiUkPG] = useState('');
  const [uapUG, setUapUG] = useState('');
  const [uapPG, setUapPG] = useState('');
  const [crizacUG, setCrizacUG] = useState('');
  const [crizacPG, setCrizacPG] = useState('');
  const [kcOverseasUG, setKcOverseasUG] = useState('');
  const [kcOverseasPG, setKcOverseasPG] = useState('');
  const [aimsEducationUG, setAimsEducationUG] = useState('');
  const [aimsEducationPG, setAimsEducationPG] = useState('');

  // Duplicate detection
  const isDuplicateName = useMemo(() => {
    if (!universityName.trim()) return false;
    const clean = universityName.trim().toLowerCase();
    const cleanIntake = intake.trim().toLowerCase();
    return existingRates.some(
      (r) =>
        r.universityName.trim().toLowerCase() === clean &&
        r.intake.trim().toLowerCase() === cleanIntake
    );
  }, [universityName, intake, existingRates]);

  if (!isOpen) return null;

  const parseNumber = (val: string): number => {
    const clean = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return Number.isNaN(num) ? 0 : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = universityName.trim();
    if (!trimmedName) {
      setError('University Name is required.');
      return;
    }
    const trimmedIntake = intake.trim() || 'Sept 2026';
    const isFlat = commissionType === 'Fixed Fee';
    const uniId = normalizeUniversitySlug(trimmedName);
    const now = new Date().toISOString();

    const createdRates: CommissionRate[] = [];

    // Helper to add rate if filled
    const maybeAddRate = (
      aggregator: string,
      studyLevel: StudyLevel,
      agentRateVal: string,
      masterRateVal: string
    ) => {
      const agentNum = parseNumber(agentRateVal);
      const masterNum = parseNumber(masterRateVal);
      if (agentNum === 0 && masterNum === 0) return;

      const isDefault = defaultRoute.toUpperCase() === aggregator.toUpperCase();
      const id = generateCompositeId(trimmedName, trimmedIntake, aggregator, studyLevel);

      createdRates.push({
        id,
        universityId: uniId,
        universityName: trimmedName,
        country: country.trim() || 'United Kingdom',
        intake: trimmedIntake,
        aggregator,
        studyLevel,
        agentRate: agentNum,
        masterRate: masterNum,
        diffMargin: Number((masterNum - agentNum).toFixed(2)),
        isFlatFee: isFlat,
        netOrGross: 'GROSS',
        guidance,
        isDefaultRoute: isDefault,
        updatedAt: now,
      });
    };

    // Basechan / Direct
    maybeAddRate('BASECHAN', 'FD', agentFD, '0');
    maybeAddRate('BASECHAN', 'UG', agentUG, masterUG);
    maybeAddRate('BASECHAN', 'PG', agentPG, masterPG);

    // Aggregators (master rate set to aggregator rate if master unspecified)
    maybeAddRate('EDVOY', 'UG', edvoyUG, edvoyUG);
    maybeAddRate('EDVOY', 'PG', edvoyPG, edvoyPG);
    maybeAddRate('SI-UK', 'UG', siUkUG, siUkUG);
    maybeAddRate('SI-UK', 'PG', siUkPG, siUkPG);
    maybeAddRate('UAP', 'UG', uapUG, uapUG);
    maybeAddRate('UAP', 'PG', uapPG, uapPG);
    maybeAddRate('CRIZAC', 'UG', crizacUG, crizacUG);
    maybeAddRate('CRIZAC', 'PG', crizacPG, crizacPG);
    maybeAddRate('KC OVERSEAS', 'UG', kcOverseasUG, kcOverseasUG);
    maybeAddRate('KC OVERSEAS', 'PG', kcOverseasPG, kcOverseasPG);
    maybeAddRate('AIMS EDUCATION', 'UG', aimsEducationUG, aimsEducationUG);
    maybeAddRate('AIMS EDUCATION', 'PG', aimsEducationPG, aimsEducationPG);

    if (createdRates.length === 0) {
      setError('Please enter at least one commission rate (Agent or Aggregator).');
      return;
    }

    try {
      setSaving(true);
      await onUniversityAdded(createdRates);
      onClose();
    } catch (err: unknown) {
      console.error('Error saving new university:', err);
      setError(err instanceof Error ? err.message : 'Failed to save university');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-[#090D16] border border-[#1F293D] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1F293D] bg-[#0E1526]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Add New University</h2>
              <p className="text-xs text-slate-400 font-medium">Create a university and specify its application routes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isDuplicateName && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>A university with this name already exists in this intake. Adding will create additional routes.</span>
            </div>
          )}

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="uni-name-input" className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                University Name *
              </label>
              <input
                id="uni-name-input"
                aria-label="University Name"
                type="text"
                required
                value={universityName}
                onChange={(e) => setUniversityName(e.target.value)}
                placeholder="e.g. Oxford Brookes University"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131B2E] border border-[#222F43] text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="country-input" className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Country *
              </label>
              <input
                id="country-input"
                aria-label="Country"
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. United Kingdom, Canada, USA"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131B2E] border border-[#222F43] text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="intake-input" className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Baseline Intake *
              </label>
              <input
                id="intake-input"
                aria-label="Baseline Intake"
                type="text"
                required
                value={intake}
                onChange={(e) => setIntake(e.target.value)}
                placeholder="e.g. Sept 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131B2E] border border-[#222F43] text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="comm-type-select" className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Commission Type
              </label>
              <select
                id="comm-type-select"
                aria-label="Commission Type"
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value as 'Percentage' | 'Fixed Fee')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131B2E] border border-[#222F43] text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Percentage">Percentage (%)</option>
                <option value="Fixed Fee">Fixed Fee (£)</option>
              </select>
            </div>

            <div>
              <label htmlFor="guidance-select" className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                School Guidance
              </label>
              <select
                id="guidance-select"
                aria-label="School Guidance"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value as SchoolGuidance)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131B2E] border border-[#222F43] text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALLOWED">🔵 Allowed (Standard)</option>
                <option value="FOCUS">🟢 Focus (Preferred)</option>
                <option value="DO_NOT_USE">🔴 Do Not Use</option>
              </select>
            </div>

            <div>
              <label htmlFor="default-route-select" className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Default Route for Staff
              </label>
              <select
                id="default-route-select"
                aria-label="Default Route for Staff"
                value={defaultRoute}
                onChange={(e) => setDefaultRoute(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131B2E] border border-[#222F43] text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="BASECHAN">BASECHAN / Direct</option>
                <option value="EDVOY">EDVOY</option>
                <option value="SI-UK">SI-UK</option>
                <option value="UAP">UAP</option>
                <option value="CRIZAC">CRIZAC</option>
                <option value="KC OVERSEAS">KC OVERSEAS</option>
                <option value="AIMS EDUCATION">AIMS EDUCATION</option>
              </select>
            </div>
          </div>

          {/* Section: Basechan Direct Rates */}
          <div className="p-4 rounded-2xl bg-[#0E1526] border border-[#1F293D] space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Basechan Direct Institutional Contract (Payouts)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div>
                <label htmlFor="agent-fd-input" className="block text-[11px] text-slate-400 mb-1">Agent Rate (FD)</label>
                <input
                  id="agent-fd-input"
                  aria-label="Agent Rate (FD)"
                  type="text"
                  value={agentFD}
                  onChange={(e) => setAgentFD(e.target.value)}
                  placeholder="e.g. 8%"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="agent-ug-input" className="block text-[11px] text-slate-400 mb-1">Agent Rate (UG)</label>
                <input
                  id="agent-ug-input"
                  aria-label="Agent Rate (UG)"
                  type="text"
                  value={agentUG}
                  onChange={(e) => setAgentUG(e.target.value)}
                  placeholder="e.g. 10%"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="agent-pg-input" className="block text-[11px] text-slate-400 mb-1">Agent Rate (PG)</label>
                <input
                  id="agent-pg-input"
                  aria-label="Agent Rate (PG)"
                  type="text"
                  value={agentPG}
                  onChange={(e) => setAgentPG(e.target.value)}
                  placeholder="e.g. 12%"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="master-ug-input" className="block text-[11px] text-slate-400 mb-1">Master Direct (UG)</label>
                <input
                  id="master-ug-input"
                  aria-label="Master Direct (UG)"
                  type="text"
                  value={masterUG}
                  onChange={(e) => setMasterUG(e.target.value)}
                  placeholder="e.g. 15%"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-indigo-400 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="master-pg-input" className="block text-[11px] text-slate-400 mb-1">Master Direct (PG)</label>
                <input
                  id="master-pg-input"
                  aria-label="Master Direct (PG)"
                  type="text"
                  value={masterPG}
                  onChange={(e) => setMasterPG(e.target.value)}
                  placeholder="e.g. 18%"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-indigo-400 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Third-Party Aggregators */}
          <div className="p-4 rounded-2xl bg-[#0E1526] border border-[#1F293D] space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
              Third-Party Aggregator Benchmark Matrix
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">EDVOY (UG)</label>
                <input
                  type="text"
                  value={edvoyUG}
                  onChange={(e) => setEdvoyUG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">EDVOY (PG)</label>
                <input
                  type="text"
                  value={edvoyPG}
                  onChange={(e) => setEdvoyPG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">SI-UK (UG)</label>
                <input
                  type="text"
                  value={siUkUG}
                  onChange={(e) => setSiUkUG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">SI-UK (PG)</label>
                <input
                  type="text"
                  value={siUkPG}
                  onChange={(e) => setSiUkPG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">UAP (UG)</label>
                <input
                  type="text"
                  value={uapUG}
                  onChange={(e) => setUapUG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">UAP (PG)</label>
                <input
                  type="text"
                  value={uapPG}
                  onChange={(e) => setUapPG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">CRIZAC (UG)</label>
                <input
                  type="text"
                  value={crizacUG}
                  onChange={(e) => setCrizacUG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">CRIZAC (PG)</label>
                <input
                  type="text"
                  value={crizacPG}
                  onChange={(e) => setCrizacPG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">KC OVERSEAS (UG)</label>
                <input
                  type="text"
                  value={kcOverseasUG}
                  onChange={(e) => setKcOverseasUG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">KC OVERSEAS (PG)</label>
                <input
                  type="text"
                  value={kcOverseasPG}
                  onChange={(e) => setKcOverseasPG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">AIMS EDUCATION (UG)</label>
                <input
                  type="text"
                  value={aimsEducationUG}
                  onChange={(e) => setAimsEducationUG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">AIMS EDUCATION (PG)</label>
                <input
                  type="text"
                  value={aimsEducationPG}
                  onChange={(e) => setAimsEducationPG(e.target.value)}
                  placeholder="-"
                  className="w-full px-3 py-2 rounded-xl bg-[#131B2E] border border-[#222F43] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save University'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
