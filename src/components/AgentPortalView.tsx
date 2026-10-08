import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { CommissionRate, StudyLevel, SchoolGuidance } from '../types';
import { exportToExcel, printSchedule } from '../utils/exportUtils';
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Award,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Check,
  Download,
  Printer,
  X,
  LayoutGrid,
  TableProperties,
} from 'lucide-react';

interface AgentPortalViewProps {
  rates: CommissionRate[];
  loading: boolean;
}

// Dead-Centered, Viewport-Bound Agent Rate Detail Pop-Up Modal using React Portal
const AgentRateDetailModal: React.FC<{
  rate: CommissionRate | null;
  currentIndex: number | null;
  totalCount: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({ rate, currentIndex, totalCount, onClose, onPrev, onNext }) => {
  useEffect(() => {
    if (!rate || currentIndex === null) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [rate, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext, onClose]);

  if (!rate || currentIndex === null) return null;

  const g = rate.guidance || 'ALLOWED';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-auto max-w-md sm:max-w-lg w-full max-h-[85vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-start justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div className="space-y-1 pr-3 min-w-0">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug break-words">
              {rate.universityName}
            </h3>
            {rate.country && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>{rate.country}</span>
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close rate details"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Compact Body */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
          {/* School Guidance Status */}
          <div className="p-3 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43] flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs">School Status:</span>
            {g === 'FOCUS' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Focus / Preferred</span>
              </span>
            ) : g === 'DO_NOT_USE' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Do Not Use</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Allowed</span>
              </span>
            )}
          </div>

          {/* Guaranteed Commission Rate Callout Card */}
          <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                Guaranteed Partner Commission Rate
              </span>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 font-medium">
                Guaranteed payout for verified student enrollments
              </p>
            </div>
            <span className="text-lg sm:text-2xl font-black font-mono text-emerald-600 dark:text-amber-400 shrink-0">
              {rate.isFlatFee ? `£${rate.agentRate.toLocaleString()}` : `${rate.agentRate}%`}
            </span>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Intake Term</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs truncate block mt-0.5">{rate.intake}</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Study Level</span>
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs block mt-0.5">{rate.studyLevel}</span>
            </div>
          </div>

          {/* Notes */}
          {rate.notes && (
            <div className="p-3 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43] space-y-1">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Partner Notes:</span>
              <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed">{rate.notes}</p>
            </div>
          )}
        </div>

        {/* Sticky Footer Navigation Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-[#18181B]/90 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="px-3.5 py-2 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 active:scale-95 text-xs text-slate-800 dark:text-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="font-mono font-extrabold text-slate-700 dark:text-slate-200 text-xs">
            {currentIndex + 1} of {totalCount}
          </span>

          <button
            onClick={onNext}
            disabled={currentIndex === totalCount - 1}
            className="px-3.5 py-2 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 active:scale-95 text-xs text-slate-800 dark:text-slate-200"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const AgentPortalView: React.FC<AgentPortalViewProps> = ({ rates, loading }) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'universityName', desc: false },
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIntake, setSelectedIntake] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<StudyLevel | 'ALL'>('ALL');
  const [selectedGuidance, setSelectedGuidance] = useState<SchoolGuidance | 'ALL'>('ALL');

  // View Mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Active detail modal index
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);

  // Total partner universities & counts
  const totalUniversities = useMemo(() => new Set(rates.map((r) => r.universityName)).size, [rates]);
  const focusCount = useMemo(() => rates.filter((r) => r.guidance === 'FOCUS').length, [rates]);
  const restrictedCount = useMemo(() => rates.filter((r) => r.guidance === 'DO_NOT_USE').length, [rates]);

  // Featured Highest Agent Rate for Hero Highlight Pill
  const topAgentRate = useMemo(() => {
    if (rates.length === 0) return null;
    return rates.reduce((prev, curr) => (curr.agentRate > prev.agentRate ? curr : prev), rates[0]);
  }, [rates]);

  // Unique options for filter dropdowns
  const intakes = useMemo(() => {
    const set = new Set(rates.map((r) => r.intake).filter(Boolean));
    return Array.from(set).sort();
  }, [rates]);

  // Fuzzy match search & filter
  const filteredRates = useMemo(() => {
    return rates.filter((row) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const corpus = `${row.universityName} ${row.country || ''} ${row.intake} ${row.studyLevel} ${row.guidance || 'ALLOWED'}`.toLowerCase();
        if (!corpus.includes(q)) return false;
      }

      if (selectedIntake !== 'ALL' && row.intake !== selectedIntake) {
        return false;
      }

      if (selectedLevel !== 'ALL' && row.studyLevel !== selectedLevel) {
        return false;
      }

      if (selectedGuidance !== 'ALL') {
        const rowGuidance = row.guidance || 'ALLOWED';
        if (rowGuidance !== selectedGuidance) return false;
      }

      return true;
    });
  }, [rates, searchQuery, selectedIntake, selectedLevel, selectedGuidance]);

  // Detail Pop-up Navigation Helpers
  const activeDetailRate = activeDetailIndex !== null && filteredRates[activeDetailIndex]
    ? filteredRates[activeDetailIndex]
    : null;

  const handlePrevDetail = () => {
    setActiveDetailIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
  };

  const handleNextDetail = () => {
    setActiveDetailIndex((prev) => (prev !== null ? Math.min(filteredRates.length - 1, prev + 1) : null));
  };

  const columns = useMemo<ColumnDef<CommissionRate, any>[]>(
    () => [
      {
        accessorKey: 'universityName',
        header: 'Institution Name',
        cell: (info) => (
          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            {info.getValue() as string}
          </div>
        ),
      },
      {
        accessorKey: 'guidance',
        header: 'School Status Guidance',
        cell: (info) => {
          const g = (info.getValue() as SchoolGuidance) || 'ALLOWED';
          if (g === 'FOCUS') {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Focus / Preferred</span>
              </span>
            );
          }
          if (g === 'DO_NOT_USE') {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Do Not Use</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Check className="w-3.5 h-3.5 text-slate-500" />
              <span>Allowed</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'country',
        header: 'Country',
        cell: (info) => {
          const val = (info.getValue() as string) || 'UK';
          return (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{val}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'intake',
        header: 'Intake Term',
        cell: (info) => (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'studyLevel',
        header: 'Study Level',
        cell: (info) => {
          const lvl = info.getValue() as string;
          const badgeClass =
            lvl === 'PG'
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
              : lvl === 'UG'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${badgeClass}`}>
              {lvl}
            </span>
          );
        },
      },
      {
        accessorKey: 'agentRate',
        header: 'Your Commission Rate',
        cell: (info) => {
          const row = info.row.original;
          const val = info.getValue() as number;
          return (
            <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{row.isFlatFee ? `£${val.toLocaleString()}` : `${val}%`}</span>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredRates,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* EXECUTIVE HERO BANNER - Matching Dashboard Design System */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-[#0E1526] text-white p-5 sm:p-8 shadow-2xl border border-slate-800 dark:border-[#222F43]">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Agent Partner Portal</span>
            </div>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Agent Commission Rates
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
              Find universities, study levels, and your guaranteed commission rates set by Basechan International. Look for green focus institutions!
            </p>
          </div>

          {/* Quick Best Agent Rate Highlight Pill */}
          {topAgentRate && (
            <div
              onClick={() => setSearchQuery(topAgentRate.universityName)}
              title={`Click to filter for ${topAgentRate.universityName}`}
              className="text-left bg-[#18181B]/80 hover:bg-[#18181B] backdrop-blur-md border border-[#222F43] hover:border-emerald-400/50 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between gap-2 shrink-0 max-w-xs shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Award className="w-3.5 h-3.5" /> Highest Payout Route
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {topAgentRate.isFlatFee ? `£${topAgentRate.agentRate.toLocaleString()}` : `${topAgentRate.agentRate}%`}
                </span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                  {topAgentRate.universityName}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="bg-[#0E1526] px-1.5 py-0.5 rounded text-[10px] text-slate-200 border border-[#222F43]">{topAgentRate.studyLevel}</span>
                  <span>{topAgentRate.intake} • {topAgentRate.country || 'UK'}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BENTO GRID KPI METRICS ROW - Matching Dashboard Design System */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div
          onClick={() => setSelectedGuidance('ALL')}
          title="Click to view all partner institutions"
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between select-none shadow-xs hover:shadow-xl hover:-translate-y-1 group ${
            selectedGuidance === 'ALL'
              ? 'bg-emerald-50 dark:bg-[#0E1526] border-emerald-500 dark:border-amber-400 shadow-md ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Partner Universities
            </p>
            <p className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono tracking-tight">
              {totalUniversities}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium truncate">
              Listed partner institutions
            </p>
          </div>
          <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div
          onClick={() => setSelectedGuidance(selectedGuidance === 'FOCUS' ? 'ALL' : 'FOCUS')}
          title="Click to filter for Focus Schools (Preferred)"
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between select-none shadow-xs hover:shadow-xl hover:-translate-y-1 group ${
            selectedGuidance === 'FOCUS'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Focus Schools (In the Green)
            </p>
            <p className="text-xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono tracking-tight">
              {focusCount}
            </p>
            <p className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 sm:mt-1 font-bold truncate">
              Preferred partner institutions
            </p>
          </div>
          <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div
          onClick={() => setSelectedGuidance(selectedGuidance === 'DO_NOT_USE' ? 'ALL' : 'DO_NOT_USE')}
          title="Click to filter for Do Not Use Schools"
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between select-none shadow-xs hover:shadow-xl hover:-translate-y-1 group ${
            selectedGuidance === 'DO_NOT_USE'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-500 dark:border-rose-500 shadow-md ring-2 ring-rose-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Restricted / Avoid
            </p>
            <p className="text-xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 font-mono tracking-tight">
              {restrictedCount}
            </p>
            <p className="text-[10px] sm:text-[11px] text-rose-700 dark:text-rose-400 mt-0.5 sm:mt-1 font-bold truncate">
              Avoid application submission
            </p>
          </div>
          <div className="p-2.5 sm:p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-[#0E1526] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search school name (e.g. Aberdeen, Leicester)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 dark:border-[#222F43] rounded-xl bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:focus:ring-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <select
            value={selectedGuidance}
            onChange={(e) => setSelectedGuidance(e.target.value as SchoolGuidance | 'ALL')}
            className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Guidance Statuses</option>
            <option value="FOCUS">🟢 Focus Schools Only</option>
            <option value="ALLOWED">🔵 Allowed (Standard)</option>
            <option value="DO_NOT_USE">🔴 Do Not Use / Avoid</option>
          </select>

          <select
            value={selectedIntake}
            onChange={(e) => setSelectedIntake(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Intakes</option>
            {intakes.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as StudyLevel | 'ALL')}
            className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Levels</option>
            <option value="UG">Undergraduate (UG)</option>
            <option value="PG">Postgraduate (PG)</option>
            <option value="FD">Foundation (FD)</option>
          </select>

          {/* Desktop View Switcher & Export Icons */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-[#222F43]">
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid Cards View"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-amber-400 shadow-2xs font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="List Table View"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-amber-400 shadow-2xs font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => exportToExcel(filteredRates, 'Basechan_Agent_Commission_Schedule.xlsx')}
              title="Export Agent Schedule to Excel"
              className="p-2 rounded-xl border border-slate-200 dark:border-[#222F43] bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => printSchedule(filteredRates, 'Basechan Partner Agent Commission Schedule')}
              title="Print Agent Schedule"
              className="p-2 rounded-xl border border-slate-200 dark:border-[#222F43] bg-white dark:bg-[#0E1526] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* GRID CARDS VIEW */}
      {(viewMode === 'grid' || window.innerWidth < 768) && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs">
              <div className="w-6 h-6 border-2 border-emerald-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Loading partner rates...</span>
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs">
              No matching partner rates found.
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-1.5 sm:gap-2.5">
              {filteredRates.map((rate, idx) => {
                const g = rate.guidance || 'ALLOWED';
                return (
                  <div
                    key={rate.id}
                    onClick={() => setActiveDetailIndex(idx)}
                    className="p-2 sm:p-3 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] hover:border-emerald-400 dark:hover:border-emerald-500/60 hover:-translate-y-1 hover:shadow-lg transition duration-200 cursor-pointer relative flex flex-col justify-between gap-1.5 select-none shadow-2xs group"
                  >
                    {/* Top Guidance Pill */}
                    <div className="flex items-center justify-between gap-1">
                      {g === 'FOCUS' ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Focus School" />
                      ) : g === 'DO_NOT_USE' ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Do Not Use" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" title="Allowed" />
                      )}
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        {rate.studyLevel}
                      </span>
                    </div>

                    {/* School Name */}
                    <div className="space-y-0.5">
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-[10px] sm:text-xs leading-snug line-clamp-2 break-words group-hover:text-emerald-600 dark:group-hover:text-amber-400 transition-colors">
                        {rate.universityName}
                      </h3>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                        {rate.country || 'UK'} • {rate.intake}
                      </p>
                    </div>

                    {/* Guaranteed Rate Badge */}
                    <div className="pt-1 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-amber-400 font-mono truncate">
                        {rate.isFlatFee ? `£${rate.agentRate.toLocaleString()}` : `${rate.agentRate}%`}
                      </span>
                      <span className="text-[9px] text-slate-400 group-hover:text-emerald-500 transition-colors">View →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DESKTOP TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="hidden md:block bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#F7F4EF] dark:bg-[#18181B] border-b border-slate-200 dark:border-[#222F43] text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-5 py-3.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#222F43]">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-emerald-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading partner rates...</span>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                      <p className="font-medium text-slate-600 dark:text-slate-300">No partner schools found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filters.</p>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition duration-100 ${row.original.guidance === 'FOCUS' ? 'bg-emerald-50/20 dark:bg-emerald-950/20' : row.original.guidance === 'DO_NOT_USE' ? 'bg-rose-50/20 dark:bg-rose-950/20' : ''}`}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-3.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="px-5 py-3.5 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredRates.length}</span> out of{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{rates.length}</span> rates
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page <span className="font-semibold text-slate-700 dark:text-slate-300">{table.getState().pagination.pageIndex + 1}</span> of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{table.getPageCount() || 1}</span>
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Agent Rate Detail Pop-Up Modal */}
      <AgentRateDetailModal
        rate={activeDetailRate}
        currentIndex={activeDetailIndex}
        totalCount={filteredRates.length}
        onClose={() => setActiveDetailIndex(null)}
        onPrev={handlePrevDetail}
        onNext={handleNextDetail}
      />
    </div>
  );
};
