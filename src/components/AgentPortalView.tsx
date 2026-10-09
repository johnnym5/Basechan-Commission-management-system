import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CommissionRate, SchoolGuidance } from '../types';
import type {
  GroupByMode,
  GroupSortMode,
} from '../utils/groupingUtils';
import {
  groupRatesByUniversity,
  sortGroupedUniversities,
} from '../utils/groupingUtils';
import { getWatchlist, toggleWatchlist, isStarred } from '../utils/watchlistUtils';
import { useSheetVisibility } from '../hooks/useSheetVisibility';
import type { CurrencyCode } from '../utils/currencyUtils';
import { formatCurrencyValue } from '../utils/currencyUtils';
import { exportToExcel, printSchedule } from '../utils/exportUtils';
import { ShareRateCardModal } from './ShareRateCardModal';
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
  Star,
  Layers3,
  Share2,
  SlidersHorizontal,
} from 'lucide-react';

interface AgentPortalViewProps {
  rates: CommissionRate[];
  loading: boolean;
  chatMode?: boolean;
  onStartChatSearch?: (prompt: string) => void;
}

// Dead-Centered Agent Rate Detail Pop-Up Modal using React Portal (No Emojis)
const AgentRateDetailModal: React.FC<{
  rate: CommissionRate | null;
  currentIndex: number | null;
  totalCount: number;
  currency: CurrencyCode;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShare: (rate: CommissionRate) => void;
}> = ({ rate, currentIndex, totalCount, currency, onClose, onPrev, onNext, onShare }) => {
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
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
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
              {formatCurrencyValue(rate.agentRate, currency, rate.isFlatFee)}
            </span>
          </div>

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

          {rate.notes && (
            <div className="p-3 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43] space-y-1">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Partner Notes:</span>
              <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed">{rate.notes}</p>
            </div>
          )}

          <div className="pt-1">
            <button
              onClick={() => onShare(rate)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Quote Card</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-[#18181B]/90 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="px-3.5 py-2 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 text-slate-800 dark:text-slate-200"
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
            className="px-3.5 py-2 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 text-slate-800 dark:text-slate-200"
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

export const AgentPortalView: React.FC<AgentPortalViewProps> = ({ rates, chatMode = false, onStartChatSearch }) => {
  const { isSheetDisabled } = useSheetVisibility();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGuidance, setSelectedGuidance] = useState<SchoolGuidance | 'ALL'>('ALL');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');

  // QOL STATES & CARD PAGINATION
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('UNIVERSITY');
  const [groupSortMode] = useState<GroupSortMode>('MOST_ROUTES');
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>('GBP');
  const [watchlist, setWatchlist] = useState<string[]>(() => getWatchlist());
  const [onlyShowStarred, setOnlyShowStarred] = useState<boolean>(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);
  const [sharingRate, setSharingRate] = useState<CommissionRate | null>(null);
  const [cardPage, setCardPage] = useState<number>(1);
  const CARDS_PER_PAGE = 24;

  const handleToggleStar = (schoolName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWatchlist(toggleWatchlist(schoolName));
  };

  // Reset card page when filters change
  useEffect(() => {
    setCardPage(1);
  }, [searchQuery, selectedGuidance, selectedCountry, groupByMode, onlyShowStarred]);

  // Filter rates based on sheet settings for AGENT
  const visibleRates = useMemo(() => {
    return rates.filter((row) => !isSheetDisabled(row.sourceSheet || row.intake, 'AGENT'));
  }, [rates, isSheetDisabled]);

  const totalUniversities = useMemo(() => new Set(visibleRates.map((r) => r.universityName)).size, [visibleRates]);
  const focusCount = useMemo(() => new Set(visibleRates.filter((r) => r.guidance === 'FOCUS').map((r) => r.universityId)).size, [visibleRates]);
  const restrictedCount = useMemo(() => new Set(visibleRates.filter((r) => r.guidance === 'DO_NOT_USE').map((r) => r.universityId)).size, [visibleRates]);

  const countries = useMemo(() => {
    const set = new Set(visibleRates.map((r) => r.country || 'UK').filter(Boolean));
    return Array.from(set).sort();
  }, [visibleRates]);

  const filteredRates = useMemo(() => {
    return visibleRates.filter((row) => {
      if (onlyShowStarred && !isStarred(watchlist, row.universityName)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const corpus = `${row.universityName} ${row.country || ''} ${row.intake} ${row.studyLevel} ${row.guidance || 'ALLOWED'}`.toLowerCase();
        if (!corpus.includes(q)) return false;
      }

      if (selectedCountry !== 'ALL' && (row.country || 'UK') !== selectedCountry) {
        return false;
      }

      if (selectedGuidance !== 'ALL') {
        const rowGuidance = row.guidance || 'ALLOWED';
        if (rowGuidance !== selectedGuidance) return false;
      }

      return true;
    });
  }, [visibleRates, searchQuery, selectedGuidance, selectedCountry, watchlist, onlyShowStarred]);

  const groupedUniversities = useMemo(() => {
    if (groupByMode !== 'UNIVERSITY') return [];
    return sortGroupedUniversities(groupRatesByUniversity(filteredRates), groupSortMode);
  }, [filteredRates, groupByMode, groupSortMode]);

  // CARD GRID PAGINATION SLICES
  const totalGroupPages = Math.ceil(groupedUniversities.length / CARDS_PER_PAGE) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (cardPage - 1) * CARDS_PER_PAGE;
    return groupedUniversities.slice(start, start + CARDS_PER_PAGE);
  }, [groupedUniversities, cardPage]);

  const totalFlatPages = Math.ceil(filteredRates.length / CARDS_PER_PAGE) || 1;
  const paginatedFlatData = useMemo(() => {
    const start = (cardPage - 1) * CARDS_PER_PAGE;
    return filteredRates.slice(start, start + CARDS_PER_PAGE);
  }, [filteredRates, cardPage]);

  const activeDetailRate = activeDetailIndex !== null && filteredRates[activeDetailIndex]
    ? filteredRates[activeDetailIndex]
    : null;

  const handlePrevDetail = () => setActiveDetailIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
  const handleNextDetail = () => setActiveDetailIndex((prev) => (prev !== null ? Math.min(filteredRates.length - 1, prev + 1) : null));

  return (
    <div className={`space-y-3 sm:space-y-8 ${chatMode ? 'sm:space-y-6' : ''}`}>
      {/* Header Banner */}
      <div className={`bg-gradient-to-r from-emerald-900 via-teal-900 to-[#0E1526] border border-[#222F43] rounded-3xl p-6 text-white shadow-xl ${chatMode ? 'hidden sm:block' : ''}`}>
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-400/30">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Agent Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">Agent Commission Rates</h1>
          <p className="text-emerald-100/80 text-xs sm:text-sm leading-relaxed">
            Find universities, study levels, and your guaranteed commission rates set by Basechan International.
          </p>
        </div>
      </div>

      {/* CLICKABLE METRICS ROW */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
        <div
          onClick={() => chatMode ? onStartChatSearch?.('Show me all available schools') : setSelectedGuidance('ALL')}
          title="Click to view all partner institutions"
          className={`min-w-0 p-2 sm:p-5 rounded-xl sm:rounded-2xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between gap-1 select-none shadow-xs hover:shadow-xl hover:-translate-y-1 group sm:gap-3 ${
            selectedGuidance === 'ALL'
              ? 'bg-emerald-50 dark:bg-[#0E1526] border-emerald-500 dark:border-amber-400 shadow-md ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div>
            <p className="text-[8px] leading-tight sm:text-xs font-semibold uppercase tracking-normal sm:tracking-wider text-slate-500 dark:text-slate-400">
              Listed Partner Institutions
            </p>
            <p className="text-base sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono tracking-tight">
              {totalUniversities}
            </p>
          </div>
          <div className="hidden sm:block p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => chatMode ? onStartChatSearch?.('Show me FOCUS schools') : setSelectedGuidance(selectedGuidance === 'FOCUS' ? 'ALL' : 'FOCUS')}
          title="Click to filter for Focus Schools (Preferred)"
          className={`min-w-0 p-2 sm:p-5 rounded-xl sm:rounded-2xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between gap-1 select-none shadow-xs hover:shadow-xl hover:-translate-y-1 group sm:gap-3 ${
            selectedGuidance === 'FOCUS'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div>
            <p className="text-[8px] leading-tight sm:text-xs font-semibold uppercase tracking-normal sm:tracking-wider text-slate-500 dark:text-slate-400">
              Focus Schools (In the Green)
            </p>
            <p className="text-base sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono tracking-tight">
              {focusCount}
            </p>
          </div>
          <div className="hidden sm:block p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => chatMode ? onStartChatSearch?.('Show me restricted schools') : setSelectedGuidance(selectedGuidance === 'DO_NOT_USE' ? 'ALL' : 'DO_NOT_USE')}
          title="Click to filter for Do Not Use Schools"
          className={`min-w-0 p-2 sm:p-5 rounded-xl sm:rounded-2xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between gap-1 select-none shadow-xs hover:shadow-xl hover:-translate-y-1 group sm:gap-3 ${
            selectedGuidance === 'DO_NOT_USE'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-500 dark:border-rose-500 shadow-md ring-2 ring-rose-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div>
            <p className="text-[8px] leading-tight sm:text-xs font-semibold uppercase tracking-normal sm:tracking-wider text-slate-500 dark:text-slate-400">
              Restricted / Avoid
            </p>
            <p className="text-base sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 font-mono tracking-tight">
              {restrictedCount}
            </p>
          </div>
          <div className="hidden sm:block p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {!chatMode && <>
      {/* Control Bar */}
      <div className="bg-white dark:bg-[#0E1526] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs flex flex-wrap items-center justify-between gap-3 relative">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search school name (e.g. Aberdeen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-12 py-2 text-xs sm:text-sm border border-slate-200 dark:border-[#222F43] rounded-xl bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-amber-400"
          />

          <button
            type="button"
            onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
            className="absolute right-2 top-2 p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] bg-white dark:bg-[#0E1526] text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Country Selector Dropdown */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43]">
            <Globe className="w-3.5 h-3.5 text-indigo-500 dark:text-amber-400 ml-1 hidden sm:inline" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="ALL">All Countries ({countries.length})</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setOnlyShowStarred(!onlyShowStarred)}
            className={`px-2.5 py-1.5 rounded-xl border font-extrabold flex items-center gap-1 transition cursor-pointer ${
              onlyShowStarred
                ? 'bg-amber-400 text-slate-950 border-amber-400'
                : 'bg-white dark:bg-[#0E1526] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#222F43]'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyShowStarred ? 'fill-slate-950' : 'text-amber-400'}`} />
            <span>Watchlist</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43]">
            <Layers3 className="w-3.5 h-3.5 text-slate-400 ml-1 hidden sm:inline" />
            <select
              value={groupByMode}
              onChange={(e) => setGroupByMode(e.target.value as GroupByMode)}
              className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="UNIVERSITY">Group: University</option>
              <option value="NONE">Group: None (Flat)</option>
            </select>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-[#18181B] p-0.5 rounded-xl border border-slate-200 dark:border-[#222F43] text-[10px] font-extrabold">
            {(['GBP', 'USD', 'EUR', 'NGN'] as CurrencyCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  activeCurrency === code
                    ? 'bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-amber-400 shadow-2xs font-black'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-[#222F43]">
            <button
              type="button"
              onClick={() => exportToExcel(filteredRates, 'Basechan_Agent_Commission_Schedule.xlsx')}
              className="p-2 rounded-xl border border-slate-200 dark:border-[#222F43] text-emerald-600 dark:text-emerald-400"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => printSchedule(filteredRates, 'Basechan Partner Agent Commission Schedule')}
              className="p-2 rounded-xl border border-slate-200 dark:border-[#222F43] text-slate-500"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Popover */}
      {isFilterPopoverOpen && (
        <div className="p-4 bg-slate-100 dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3 text-xs">
          <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
            <span>Detailed Filters</span>
            <button onClick={() => setIsFilterPopoverOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
              <select
                value={selectedGuidance}
                onChange={(e) => setSelectedGuidance(e.target.value as SchoolGuidance | 'ALL')}
                className="w-full p-2 rounded-xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43]"
              >
                <option value="ALL">All Guidance</option>
                <option value="FOCUS">Focus Schools</option>
                <option value="ALLOWED">Allowed</option>
                <option value="DO_NOT_USE">Do Not Use</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Country</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full p-2 rounded-xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43]"
              >
                <option value="ALL">All Countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE GRID VIEW WITH PAGINATION */}
      <div className="space-y-4">
        {groupByMode === 'UNIVERSITY' ? (
          groupedUniversities.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs">
              No matching universities found.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
                {paginatedGroups.map((group) => {
                  const starred = isStarred(watchlist, group.displayName);
                  return (
                    <div
                      key={group.groupKey}
                      onClick={() => {
                        const idx = filteredRates.findIndex((r) => r.universityName === group.displayName);
                        setActiveDetailIndex(idx !== -1 ? idx : 0);
                      }}
                      className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs hover:-translate-y-0.5 transition cursor-pointer flex flex-col justify-between gap-2.5 select-none"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                          {group.totalRoutes} Rates
                        </span>
                        <button onClick={(e) => handleToggleStar(group.displayName, e)} className="p-1 cursor-pointer">
                          <Star className={`w-4 h-4 ${starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug break-words">
                          {group.displayName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{group.country}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between text-xs">
                        <span className="font-mono font-black text-emerald-600 dark:text-amber-400">
                          {formatCurrencyValue(group.bestRoute?.agentRate || 0, activeCurrency, group.bestRoute?.isFlatFee)}
                        </span>
                        <span className="text-slate-400">View Rates →</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Pagination Bar */}
              <div className="px-5 py-3.5 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  Showing <strong className="text-slate-800 dark:text-slate-200">{(cardPage - 1) * CARDS_PER_PAGE + 1}</strong> -{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{Math.min(cardPage * CARDS_PER_PAGE, groupedUniversities.length)}</strong> of{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{groupedUniversities.length}</strong> university groups
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCardPage((p) => Math.max(p - 1, 1))}
                    disabled={cardPage === 1}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>
                    Page <strong className="text-slate-700 dark:text-slate-300">{cardPage}</strong> of{' '}
                    <strong className="text-slate-700 dark:text-slate-300">{totalGroupPages}</strong>
                  </span>
                  <button
                    onClick={() => setCardPage((p) => Math.min(p + 1, totalGroupPages))}
                    disabled={cardPage === totalGroupPages}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
              {paginatedFlatData.map((rate, idx) => (
                <div
                  key={rate.id}
                  onClick={() => setActiveDetailIndex((cardPage - 1) * CARDS_PER_PAGE + idx)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] cursor-pointer flex flex-col justify-between gap-2"
                >
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug">{rate.universityName}</h3>
                  <span className="font-mono font-black text-emerald-600 dark:text-amber-400 text-xs">
                    {formatCurrencyValue(rate.agentRate, activeCurrency, rate.isFlatFee)}
                  </span>
                </div>
              ))}
            </div>

            {/* Flat Card Pagination Bar */}
            <div className="px-5 py-3.5 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing <strong className="text-slate-800 dark:text-slate-200">{(cardPage - 1) * CARDS_PER_PAGE + 1}</strong> -{' '}
                <strong className="text-slate-800 dark:text-slate-200">{Math.min(cardPage * CARDS_PER_PAGE, filteredRates.length)}</strong> of{' '}
                <strong className="text-slate-800 dark:text-slate-200">{filteredRates.length}</strong> rates
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCardPage((p) => Math.max(p - 1, 1))}
                  disabled={cardPage === 1}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Page <strong className="text-slate-700 dark:text-slate-300">{cardPage}</strong> of{' '}
                  <strong className="text-slate-700 dark:text-slate-300">{totalFlatPages}</strong>
                </span>
                <button
                  onClick={() => setCardPage((p) => Math.min(p + 1, totalFlatPages))}
                  disabled={cardPage === totalFlatPages}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Agent Rate Detail Pop-Up Modal */}
      <AgentRateDetailModal
        rate={activeDetailRate}
        currentIndex={activeDetailIndex}
        totalCount={filteredRates.length}
        currency={activeCurrency}
        onClose={() => setActiveDetailIndex(null)}
        onPrev={handlePrevDetail}
        onNext={handleNextDetail}
        onShare={setSharingRate}
      />

      {/* Share Rate Card Modal */}
      <ShareRateCardModal
        rate={sharingRate}
        currency={activeCurrency}
        isOpen={!!sharingRate}
        onClose={() => setSharingRate(null)}
      />
      </>}
    </div>
  );
};
