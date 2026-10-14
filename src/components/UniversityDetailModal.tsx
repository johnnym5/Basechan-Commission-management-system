import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Globe,
  Award,
  Building2,
  Banknote,
  Calendar,
  Layers,
} from 'lucide-react';
import type { CommissionRate } from '../types';

export interface UniversityDetailData {
  country: string; // Col A
  university: string; // Col B
  agentRateFD: string; // Col C
  agentRateUG: string; // Col D
  agentRatePG: string; // Col E
  commissionType: string; // Col F
  baselineIntake: string; // Col G
  masterRateUG: string; // Col H
  masterRatePG: string; // Col I
  edvoyUG: string; // Col J
  edvoyPG: string; // Col K
  siUkUG: string; // Col L
  siUkPG: string; // Col M
  uapUG: string; // Col N
  uapPG: string; // Col O
  crizacUG: string; // Col P
  crizacPG: string; // Col Q
  kcOverseasUG: string; // Col R
  kcOverseasPG: string; // Col S
  aimsEducationUG: string; // Col T
  aimsEducationPG: string; // Col U
  // Analytics
  grossSpreadUG?: string;
  grossSpreadPG?: string;
  bestRoute?: string;
  guidance?: string;
}

interface UniversityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: UniversityDetailData | null;
  // Fallback construction from CommissionRate[] if raw master row isn't available
  ratesForUniversity?: CommissionRate[];
  universityName?: string;
}

export const UniversityDetailModal: React.FC<UniversityDetailModalProps> = ({
  isOpen,
  onClose,
  data: rawData,
  ratesForUniversity = [],
  universityName,
}) => {
  if (!isOpen) return null;

  // Build resolved data record from rawData or ratesForUniversity
  const resolvedData: UniversityDetailData = React.useMemo(() => {
    if (rawData) return rawData;

    const name = universityName || ratesForUniversity[0]?.universityName || 'University';
    const country = ratesForUniversity[0]?.country || 'United Kingdom';
    const intake = ratesForUniversity[0]?.intake || 'Sept 2026';

    const getRate = (agg: string, level: string, isMaster = false): string => {
      const match = ratesForUniversity.find(
        (r) =>
          (r.aggregator || '').toUpperCase() === agg.toUpperCase() &&
          r.studyLevel === level
      );
      if (!match) return '-';
      const val = isMaster ? match.masterRate : match.agentRate;
      if (!val) return '-';
      return match.isFlatFee ? `£${val}` : `${val}%`;
    };

    const directUgMaster = getRate('BASECHAN', 'UG', true) !== '-' ? getRate('BASECHAN', 'UG', true) : getRate('Direct', 'UG', true);
    const directPgMaster = getRate('BASECHAN', 'PG', true) !== '-' ? getRate('BASECHAN', 'PG', true) : getRate('Direct', 'PG', true);

    const directUgAgent = getRate('BASECHAN', 'UG') !== '-' ? getRate('BASECHAN', 'UG') : getRate('Direct', 'UG');
    const directPgAgent = getRate('BASECHAN', 'PG') !== '-' ? getRate('BASECHAN', 'PG') : getRate('Direct', 'PG');
    const directFdAgent = getRate('BASECHAN', 'FD') !== '-' ? getRate('BASECHAN', 'FD') : getRate('Direct', 'FD');

    const isFlat = ratesForUniversity.some((r) => r.isFlatFee);

    return {
      country,
      university: name,
      agentRateFD: directFdAgent,
      agentRateUG: directUgAgent,
      agentRatePG: directPgAgent,
      commissionType: isFlat ? 'Fixed Fee' : 'Percentage',
      baselineIntake: intake,
      masterRateUG: directUgMaster,
      masterRatePG: directPgMaster,
      edvoyUG: getRate('EDVOY', 'UG'),
      edvoyPG: getRate('EDVOY', 'PG'),
      siUkUG: getRate('SI-UK', 'UG'),
      siUkPG: getRate('SI-UK', 'PG'),
      uapUG: getRate('UAP', 'UG'),
      uapPG: getRate('UAP', 'PG'),
      crizacUG: getRate('CRIZAC', 'UG'),
      crizacPG: getRate('CRIZAC', 'PG'),
      kcOverseasUG: getRate('KC OVERSEAS', 'UG'),
      kcOverseasPG: getRate('KC OVERSEAS', 'PG'),
      aimsEducationUG: getRate('AIMS EDUCATION', 'UG'),
      aimsEducationPG: getRate('AIMS EDUCATION', 'PG'),
      guidance: ratesForUniversity[0]?.guidance || 'ALLOWED',
    };
  }, [rawData, ratesForUniversity, universityName]);

  const aggregatorsList = [
    { name: 'EDVOY', ug: resolvedData.edvoyUG, pg: resolvedData.edvoyPG },
    { name: 'SI-UK', ug: resolvedData.siUkUG, pg: resolvedData.siUkPG },
    { name: 'UAP', ug: resolvedData.uapUG, pg: resolvedData.uapPG },
    { name: 'CRIZAC', ug: resolvedData.crizacUG, pg: resolvedData.crizacPG },
    { name: 'KC OVERSEAS', ug: resolvedData.kcOverseasUG, pg: resolvedData.kcOverseasPG },
    { name: 'AIMS EDUCATION', ug: resolvedData.aimsEducationUG, pg: resolvedData.aimsEducationPG },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto max-w-4xl w-full bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-[#222F43] bg-slate-50/90 dark:bg-[#18181B]/90 flex items-start justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {resolvedData.country}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {resolvedData.baselineIntake}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {resolvedData.commissionType}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {resolvedData.university}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete 21-Column Master Record & Competitor Aggregator Benchmark Matrix
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* SECTION 1: Basechan Payouts & Master Contract Rates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sub-Agent Rates (Columns C, D, E) */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <h3 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Basechan Sub-Agent Rates (Payouts)
                </h3>
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Cols C - E</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-emerald-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Agent FD</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {resolvedData.agentRateFD}
                  </span>
                </div>
                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-emerald-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Agent UG</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {resolvedData.agentRateUG}
                  </span>
                </div>
                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-emerald-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Agent PG</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {resolvedData.agentRatePG}
                  </span>
                </div>
              </div>
            </div>

            {/* Master Original Contract Rates (Columns H, I) */}
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <h3 className="font-extrabold text-sm text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Master Direct Institutional Contract
                </h3>
                <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Cols H - I</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-indigo-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Master UG</span>
                  <span className="font-mono font-extrabold text-sm text-indigo-700 dark:text-indigo-300 mt-1 block">
                    {resolvedData.masterRateUG}
                  </span>
                </div>
                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-indigo-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Master PG</span>
                  <span className="font-mono font-extrabold text-sm text-indigo-700 dark:text-indigo-300 mt-1 block">
                    {resolvedData.masterRatePG}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Competitor Aggregator Benchmark Matrix (Columns J - U) */}
          <div className="p-4 bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222F43] pb-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Third-Party Aggregator Rates Comparison
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Columns J - U</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {aggregatorsList.map((agg) => (
                <div
                  key={agg.name}
                  className="p-3 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl text-center space-y-1.5"
                >
                  <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block truncate">
                    {agg.name}
                  </span>
                  <div className="pt-1 border-t border-slate-100 dark:border-[#1E293B] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">UG:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{agg.ug}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">PG:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{agg.pg}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: Detailed 21-Column Data Inventory */}
          <div className="p-4 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3">
            <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              Full 21-Header Raw Record Specs
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">A. Country:</span>
                <span className="font-bold">{resolvedData.country}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">B. University:</span>
                <span className="font-bold truncate max-w-[150px]">{resolvedData.university}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">C. Agent Rate (FD):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{resolvedData.agentRateFD}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">D. Agent Rate (UG):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{resolvedData.agentRateUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">E. Agent Rate (PG):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{resolvedData.agentRatePG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">F. Commission Type:</span>
                <span className="font-bold">{resolvedData.commissionType}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">G. Baseline Intake:</span>
                <span className="font-bold">{resolvedData.baselineIntake}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">H. Master Original (UG):</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{resolvedData.masterRateUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">I. Master Original (PG):</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{resolvedData.masterRatePG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">J. EDVOY (UG):</span>
                <span>{resolvedData.edvoyUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">K. EDVOY (PG):</span>
                <span>{resolvedData.edvoyPG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">L. SI-UK (UG):</span>
                <span>{resolvedData.siUkUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">M. SI-UK (PG):</span>
                <span>{resolvedData.siUkPG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">N. UAP (UG):</span>
                <span>{resolvedData.uapUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">O. UAP (PG):</span>
                <span>{resolvedData.uapPG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">P. CRIZAC (UG):</span>
                <span>{resolvedData.crizacUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">Q. CRIZAC (PG):</span>
                <span>{resolvedData.crizacPG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">R. KC OVERSEAS (UG):</span>
                <span>{resolvedData.kcOverseasUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">S. KC OVERSEAS (PG):</span>
                <span>{resolvedData.kcOverseasPG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">T. AIMS EDUCATION (UG):</span>
                <span>{resolvedData.aimsEducationUG}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-lg flex justify-between">
                <span className="text-slate-400">U. AIMS EDUCATION (PG):</span>
                <span>{resolvedData.aimsEducationPG}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
