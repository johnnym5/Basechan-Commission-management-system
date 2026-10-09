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
import type { ColumnDef, SortingState, RowSelectionState } from '@tanstack/react-table';
import type { CommissionRate, StudyLevel, SchoolGuidance } from '../types';
import type {
  GroupByMode,
  GroupSortMode,
  GroupedUniversity,
} from '../utils/groupingUtils';
import {
  groupRatesByUniversity,
  sortGroupedUniversities,
} from '../utils/groupingUtils';
import { getWatchlist, toggleWatchlist, isStarred } from '../utils/watchlistUtils';
import type { CurrencyCode } from '../utils/currencyUtils';
import { formatCurrencyValue } from '../utils/currencyUtils';
import { BatchEditModal } from './BatchEditModal';
import { ShareRateCardModal } from './ShareRateCardModal';
import { updateRate, updateRates, deleteRates } from '../services/adminRateWriteService';
import { isQuotaOffline } from '../services/firestoreOfflineMode';
import { useAuth } from '../context/AuthContext';
import {
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Check,
  ChevronDown,
  Trash2,
  X,
  Globe,
  Star,
  Layers3,
  LayoutGrid,
  TableProperties,
  Share2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface MasterTableProps {
  data: CommissionRate[];
  loading: boolean;
  readOnly?: boolean;
  onEditRate: (rate: CommissionRate) => void;
  onBatchActionComplete?: (msg: string) => void;
  externalSearchQuery?: string;
  onExternalSearchChange?: (q: string) => void;
  externalGuidanceFilter?: SchoolGuidance | 'ALL';
  onExternalGuidanceChange?: (g: SchoolGuidance | 'ALL') => void;
  externalAggregatorFilter?: string;
  onExternalAggregatorChange?: (agg: string) => void;
  externalCountryFilter?: string;
  onExternalCountryChange?: (country: string) => void;
  externalLevelFilter?: StudyLevel | 'ALL';
  onExternalLevelChange?: (level: StudyLevel | 'ALL') => void;
  externalIntakeFilter?: string;
  onExternalIntakeChange?: (intake: string) => void;
  externalSchoolIdsFilter?: string[];
}

const COMMON_AGGREGATORS = ['SI-UK', 'EDVOY', 'UAP', 'CRIZAC', 'BASECHAN', 'Direct'];

// Interactive School Status Cell for Admin Users
const SchoolStatusCell: React.FC<{ rate: CommissionRate; readOnly?: boolean }> = ({ rate, readOnly = false }) => {
  const { role, user } = useAuth();
  const isAdmin = role === 'ADMIN';
  const [isOpen, setIsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const g = rate.guidance || 'ALLOWED';

  const handleUpdateStatus = async (newGuidance: SchoolGuidance) => {
    setIsOpen(false);
    if (newGuidance === g) return;
    try {
      setUpdating(true);
      await updateRate(rate, { ...rate, guidance: newGuidance, updatedAt: new Date().toISOString() }, user?.email || 'Admin');
    } catch (err) {
      console.error('Failed to update guidance status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const renderBadge = () => {
    if (g === 'FOCUS') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">Focus</span>
        </span>
      );
    }
    if (g === 'DO_NOT_USE') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
          <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="truncate">Do Not Use</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <Check className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400 shrink-0" />
        <span className="truncate">Allowed</span>
      </span>
    );
  };

  if (!isAdmin || readOnly) {
    return renderBadge();
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={updating}
        title="Admin: Click to change school guidance status"
        className="group hover:opacity-80 transition cursor-pointer flex items-center gap-0.5 focus:outline-hidden"
      >
        {renderBadge()}
        <ChevronDown className="w-2.5 h-2.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 text-xs"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Change Status:
          </div>

          <button
            onClick={() => handleUpdateStatus('FOCUS')}
            className={`w-full text-left px-2 py-1 rounded-lg flex items-center justify-between font-semibold transition cursor-pointer text-xs ${
              g === 'FOCUS'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Focus (Green)
            </span>
            {g === 'FOCUS' && <span>✓</span>}
          </button>

          <button
            onClick={() => handleUpdateStatus('ALLOWED')}
            className={`w-full text-left px-2 py-1 rounded-lg flex items-center justify-between font-medium transition cursor-pointer text-xs ${
              g === 'ALLOWED'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              Allowed
            </span>
            {g === 'ALLOWED' && <span>✓</span>}
          </button>

          <button
            onClick={() => handleUpdateStatus('DO_NOT_USE')}
            className={`w-full text-left px-2 py-1 rounded-lg flex items-center justify-between font-semibold transition cursor-pointer text-xs ${
              g === 'DO_NOT_USE'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Do Not Use
            </span>
            {g === 'DO_NOT_USE' && <span>✓</span>}
          </button>
        </div>
      )}
    </div>
  );
};

// Interactive Aggregator Selector Dropdown for Admin
const AggregatorRouteCell: React.FC<{ rate: CommissionRate }> = ({ rate }) => {
  const { role, user } = useAuth();
  const isAdmin = role === 'ADMIN';
  const [updating, setUpdating] = useState(false);

  const handleUpdateAggregator = async (newAggregator: string) => {
    if (!navigator.onLine || isQuotaOffline(user?.uid)) return;
    if (newAggregator === rate.aggregator) return;
    try {
      setUpdating(true);
      await updateRate(rate, { ...rate, aggregator: newAggregator, updatedAt: new Date().toISOString() }, user?.email || 'Admin');
    } catch (err) {
      console.error('Failed to update aggregator route:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (!isAdmin || !navigator.onLine || isQuotaOffline(user?.uid)) {
    return (
      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
        Use {rate.aggregator}
      </span>
    );
  }

  return (
    <select
      value={rate.aggregator}
      disabled={updating}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleUpdateAggregator(e.target.value)}
      title="Admin: Click to change aggregator route"
      className="px-2.5 py-1 rounded-xl border border-slate-300 dark:border-[#222F43] bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      {COMMON_AGGREGATORS.map((agg) => (
        <option key={agg} value={agg}>
          Use {agg}
        </option>
      ))}
      {!COMMON_AGGREGATORS.includes(rate.aggregator) && (
        <option value={rate.aggregator}>Use {rate.aggregator}</option>
      )}
    </select>
  );
};

// Side-by-Side Grouped University Routes Comparison Modal
const GroupRoutesModal: React.FC<{
  group: GroupedUniversity | null;
  currency: CurrencyCode;
  onClose: () => void;
  onEdit: (rate: CommissionRate) => void;
  onShare: (rate: CommissionRate) => void;
}> = ({ group, currency, onClose, onEdit, onShare }) => {
  useEffect(() => {
    if (!group) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [group]);

  if (!group) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-auto max-w-lg sm:max-w-2xl w-full max-h-[85vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-start justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
              {group.displayName}
            </h3>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 mt-0.5">
              <Globe className="w-3.5 h-3.5" />
              <span>{group.country} • {group.totalRoutes} Available Routes</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Routes List */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 text-xs">
          {/* Best Route Banner */}
          {group.bestRoute && (
            <div className="p-3 bg-amber-500/15 border border-amber-400/40 rounded-2xl flex items-center justify-between text-amber-800 dark:text-amber-300">
              <span className="font-extrabold text-xs">
                Recommended Top Yield Route:
              </span>
              <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                +{formatCurrencyValue(group.bestRoute.diffMargin, currency, group.bestRoute.isFlatFee)} via {group.bestRoute.aggregator}
              </span>
            </div>
          )}

          {/* List of side-by-side routes */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              All Submissions Routes ({group.rates.length}):
            </span>

            {group.rates.map((rate) => {
              const isBest = group.bestRoute?.id === rate.id;
              return (
                <div
                  key={rate.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
                    isBest
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-xs'
                      : 'bg-slate-50 dark:bg-[#18181B]/80 border-slate-200 dark:border-[#222F43]'
                  }`}
                >
                  <div className="space-y-1.5 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <AggregatorRouteCell rate={rate} />
                      {isBest && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950">
                          BEST ROUTE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Intake: {rate.intake} • Level: <strong className="text-indigo-600 dark:text-indigo-400">{rate.studyLevel}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">Profit Yield</span>
                      <span className="font-mono font-black text-emerald-600 dark:text-amber-400 text-sm">
                        +{formatCurrencyValue(rate.diffMargin, currency, rate.isFlatFee)}
                      </span>
                    </div>

                    <button
                      onClick={() => onShare(rate)}
                      className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-400/30 rounded-xl transition cursor-pointer"
                      title="Share Rate Card"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        onEdit(rate);
                      }}
                      className="p-2 bg-white dark:bg-[#0E1526] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#222F43] rounded-xl text-slate-600 dark:text-slate-200 transition cursor-pointer"
                      title="Edit Rate"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const MasterTable: React.FC<MasterTableProps> = ({
  data,
  readOnly = false,
  onEditRate,
  onBatchActionComplete,
  externalSearchQuery,
  onExternalSearchChange,
  externalGuidanceFilter,
  onExternalGuidanceChange,
  externalAggregatorFilter,
  onExternalAggregatorChange,
  externalCountryFilter,
  onExternalCountryChange,
  externalLevelFilter,
  onExternalLevelChange,
  externalIntakeFilter,
  onExternalIntakeChange,
  externalSchoolIdsFilter,
}) => {
  const { user } = useAuth();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'diffMargin', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);

  // View Mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // QOL STATES & CARD PAGINATION
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('NONE');
  const [groupSortMode, setGroupSortMode] = useState<GroupSortMode>('MOST_ROUTES');
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>('GBP');
  const [watchlist, setWatchlist] = useState<string[]>(() => getWatchlist());
  const [onlyShowStarred, setOnlyShowStarred] = useState<boolean>(false);
  const [cardPage, setCardPage] = useState<number>(1);
  const CARDS_PER_PAGE = 24;

  // Filter Popover Drawer State
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  // Modals
  const [activeGroupRate, setActiveGroupRate] = useState<GroupedUniversity | null>(null);
  const [sharingRate, setSharingRate] = useState<CommissionRate | null>(null);

  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const [internalIntake, setInternalIntake] = useState<string>('ALL');
  const [internalLevel, setInternalLevel] = useState<StudyLevel | 'ALL'>('ALL');
  const [internalCountry, setInternalCountry] = useState<string>('ALL');
  const [internalGuidanceFilter, setInternalGuidanceFilter] = useState<SchoolGuidance | 'ALL'>('ALL');
  const [internalAggregatorFilter, setInternalAggregatorFilter] = useState<string>('ALL');
  const selectedIntake = externalIntakeFilter ?? internalIntake;
  const selectedLevel = externalLevelFilter ?? internalLevel;
  const selectedCountry = externalCountryFilter ?? internalCountry;
  const setSelectedIntake = (value: string) => { setInternalIntake(value); onExternalIntakeChange?.(value); };
  const setSelectedLevel = (value: StudyLevel | 'ALL') => { setInternalLevel(value); onExternalLevelChange?.(value); };
  const setSelectedCountry = (value: string) => { setInternalCountry(value); onExternalCountryChange?.(value); };
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Sync external search query when passed
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = (q: string) => {
    setInternalSearchQuery(q);
    if (onExternalSearchChange) onExternalSearchChange(q);
  };

  // Sync external guidance filter when passed
  const selectedGuidance = externalGuidanceFilter !== undefined ? externalGuidanceFilter : internalGuidanceFilter;
  const setSelectedGuidance = (g: SchoolGuidance | 'ALL') => {
    setInternalGuidanceFilter(g);
    if (onExternalGuidanceChange) onExternalGuidanceChange(g);
  };

  // Sync external aggregator filter when passed
  const selectedAggregator = externalAggregatorFilter !== undefined ? externalAggregatorFilter : internalAggregatorFilter;
  const setSelectedAggregator = (agg: string) => {
    setInternalAggregatorFilter(agg);
    if (onExternalAggregatorChange) onExternalAggregatorChange(agg);
  };

  // Reset card page when filters change
  useEffect(() => {
    setCardPage(1);
  }, [
    internalSearchQuery,
    externalSearchQuery,
    selectedIntake,
    selectedLevel,
    selectedCountry,
    selectedGuidance,
    selectedAggregator,
    groupByMode,
    groupSortMode,
    onlyShowStarred,
  ]);

  // Toggle Watchlist Star Handler
  const handleToggleStar = (schoolName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = toggleWatchlist(schoolName);
    setWatchlist(updated);
  };

  // Active Filter Count Calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGuidance !== 'ALL') count++;
    if (selectedIntake !== 'ALL') count++;
    if (selectedLevel !== 'ALL') count++;
    if (selectedCountry !== 'ALL') count++;
    if (selectedAggregator !== 'ALL') count++;
    if (onlyShowStarred) count++;
    return count;
  }, [selectedGuidance, selectedIntake, selectedLevel, selectedCountry, selectedAggregator, onlyShowStarred]);

  // Extract unique options for filter dropdowns
  const intakes = useMemo(() => {
    const set = new Set(data.map((r) => r.intake).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const countries = useMemo(() => {
    const set = new Set(data.map((r) => r.country || 'UK').filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const aggregators = useMemo(() => {
    const set = new Set(data.map((r) => r.aggregator || 'Direct').filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  // Fuzzy match search helper
  const fuzzyMatch = (row: CommissionRate, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase().trim();

    const corpus = [
      row.universityName,
      row.aggregator,
      row.intake,
      row.studyLevel,
      row.country || '',
      row.guidance || 'ALLOWED',
    ]
      .join(' ')
      .toLowerCase();

    if (corpus.includes(q)) return true;

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every((token) => corpus.includes(token))) {
      return true;
    }

    return false;
  };

  // Client-side filtering logic with fuzzy search & watchlist filter
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (externalSchoolIdsFilter?.length && !externalSchoolIdsFilter.includes(row.universityId)) return false;
      if (onlyShowStarred && !isStarred(watchlist, row.universityName)) {
        return false;
      }

      if (searchQuery && !fuzzyMatch(row, searchQuery)) {
        return false;
      }

      if (selectedIntake !== 'ALL' && row.intake !== selectedIntake) {
        return false;
      }

      if (selectedLevel !== 'ALL' && row.studyLevel !== selectedLevel) {
        return false;
      }

      if (selectedCountry !== 'ALL' && (row.country || 'UK') !== selectedCountry) {
        return false;
      }

      if (selectedAggregator !== 'ALL' && row.aggregator !== selectedAggregator) {
        return false;
      }

      if (selectedGuidance !== 'ALL') {
        const rowGuidance = row.guidance || 'ALLOWED';
        if (rowGuidance !== selectedGuidance) return false;
      }

      return true;
    });
  }, [data, searchQuery, selectedIntake, selectedLevel, selectedCountry, selectedAggregator, selectedGuidance, watchlist, onlyShowStarred, externalSchoolIdsFilter]);

  // Grouped Data Calculations
  const groupedUniversities = useMemo(() => {
    if (groupByMode !== 'UNIVERSITY') return [];
    const grouped = groupRatesByUniversity(filteredData);
    return sortGroupedUniversities(grouped, groupSortMode);
  }, [filteredData, groupByMode, groupSortMode]);

  // CARD GRID PAGINATION SLICES
  const totalGroupPages = Math.ceil(groupedUniversities.length / CARDS_PER_PAGE) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (cardPage - 1) * CARDS_PER_PAGE;
    return groupedUniversities.slice(start, start + CARDS_PER_PAGE);
  }, [groupedUniversities, cardPage]);

  const totalFlatPages = Math.ceil(filteredData.length / CARDS_PER_PAGE) || 1;
  const paginatedFlatData = useMemo(() => {
    const start = (cardPage - 1) * CARDS_PER_PAGE;
    return filteredData.slice(start, start + CARDS_PER_PAGE);
  }, [filteredData, cardPage]);

  // Selection states across ALL filtered rows
  const isAllFilteredSelected = useMemo(() => {
    if (filteredData.length === 0) return false;
    return filteredData.every((row) => rowSelection[row.id]);
  }, [filteredData, rowSelection]);

  const isSomeFilteredSelected = useMemo(() => {
    if (filteredData.length === 0) return false;
    const count = filteredData.filter((row) => rowSelection[row.id]).length;
    return count > 0 && count < filteredData.length;
  }, [filteredData, rowSelection]);

  const handleToggleAllFiltered = () => {
    if (isAllFilteredSelected) {
      const newSelection = { ...rowSelection };
      filteredData.forEach((row) => {
        delete newSelection[row.id];
      });
      setRowSelection(newSelection);
    } else {
      const newSelection = { ...rowSelection };
      filteredData.forEach((row) => {
        newSelection[row.id] = true;
      });
      setRowSelection(newSelection);
    }
  };

  const columns = useMemo<ColumnDef<CommissionRate, any>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              checked={isAllFilteredSelected}
              ref={(el) => {
                if (el) el.indeterminate = !isAllFilteredSelected && isSomeFilteredSelected;
              }}
              onChange={handleToggleAllFiltered}
              aria-label="Select all filtered rows"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
              aria-label={`Select row ${row.original.universityName}`}
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'universityName',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer text-left"
          >
            University
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        ),
        cell: (info) => {
          const row = info.row.original;
          const starred = isStarred(watchlist, row.universityName);
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleToggleStar(row.universityName, e)}
                title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                className="p-1 cursor-pointer"
              >
                <Star className={`w-4 h-4 ${starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400 hover:text-amber-400'}`} />
              </button>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {info.getValue() as string}
                </div>
                {row.country && row.country !== 'UK' && (
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" />
                    <span>{row.country}</span>
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'guidance',
        header: 'School Status',
        cell: (info) => <SchoolStatusCell rate={info.row.original} readOnly={readOnly} />,
      },
      {
        accessorKey: 'intake',
        header: 'Intake',
        cell: (info) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'studyLevel',
        header: 'Level',
        cell: (info) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'aggregator',
        header: 'Application Portal',
        cell: (info) => <AggregatorRouteCell rate={info.row.original} />,
      },
      {
        accessorKey: 'masterRate',
        header: 'University Commission',
        cell: (info) => {
          const row = info.row.original;
          const val = info.getValue() as number;
          return (
            <span className="font-mono text-slate-800 dark:text-slate-200 text-sm font-semibold">
              {formatCurrencyValue(val, activeCurrency, row.isFlatFee)}
            </span>
          );
        },
      },
      {
        accessorKey: 'agentRate',
        header: 'Your Commission Payout',
        cell: (info) => {
          const row = info.row.original;
          const val = info.getValue() as number;
          return (
            <span className="font-mono text-slate-600 dark:text-slate-400 text-sm">
              {formatCurrencyValue(val, activeCurrency, row.isFlatFee)}
            </span>
          );
        },
      },
      {
        accessorKey: 'diffMargin',
        header: 'Net Profit',
        cell: (info) => {
          const row = info.row.original;
          const diff = info.getValue() as number;
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              +{formatCurrencyValue(diff, activeCurrency, row.isFlatFee)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSharingRate(info.row.original)}
              className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
              title="Share Rate Card"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEditRate(info.row.original)}
              disabled={readOnly}
              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              title="Edit Rate & Guidance"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [onEditRate, isAllFilteredSelected, isSomeFilteredSelected, handleToggleAllFiltered, activeCurrency, watchlist]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  // Selected rates
  const selectedRates = useMemo(() => data.filter((rate) => rowSelection[rate.id]), [rowSelection, data]);

  // Batch action handlers
  const handleDeleteSelected = async () => {
    if (selectedRates.length === 0) return;
    try {
      setBatchActionLoading(true);
      await deleteRates(selectedRates, user?.email || 'Admin');
      setRowSelection({});
      if (onBatchActionComplete) onBatchActionComplete(`Successfully deleted ${selectedRates.length} selected rates.`);
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchSetGuidance = async (guidance: SchoolGuidance) => {
    if (selectedRates.length === 0) return;
    try {
      setBatchActionLoading(true);
      await updateRates(selectedRates, (rate) => ({ ...rate, guidance, updatedAt: new Date().toISOString() }), user?.email || 'Admin', 'guidance');
      setRowSelection({});
      if (onBatchActionComplete) onBatchActionComplete(`Updated guidance status for ${selectedRates.length} selected items.`);
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchSetAggregator = async (targetAggregator: string) => {
    if (selectedRates.length === 0 || !targetAggregator) return;
    try {
      setBatchActionLoading(true);
      await updateRates(selectedRates, (rate) => ({ ...rate, aggregator: targetAggregator, updatedAt: new Date().toISOString() }), user?.email || 'Admin', 'routing');
      setRowSelection({});
      if (onBatchActionComplete) onBatchActionComplete(`Updated route to "${targetAggregator}" for ${selectedRates.length} selected items.`);
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Render Mobile/Responsive Card Component with Multi-Select Checkbox TOP-RIGHT & Star BOTTOM-RIGHT
  const renderRateCard = (rate: CommissionRate) => {
    const isSelected = rowSelection[rate.id] || false;
    const starred = isStarred(watchlist, rate.universityName);

    return (
      <div
        key={rate.id}
        onClick={() => { if (!readOnly) onEditRate(rate); }}
        className={`p-3 sm:p-4 rounded-2xl border transition-all duration-200 ${readOnly ? 'cursor-default' : 'cursor-pointer'} relative flex flex-col justify-between gap-2.5 select-none ${
          isSelected
            ? 'bg-blue-50 dark:bg-amber-950/60 border-blue-500 dark:border-amber-400 shadow-md ring-1 ring-blue-500/30'
            : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs hover:-translate-y-0.5'
        }`}
      >
        {/* Top Row: Level Badge Left, Multi-Select Checkbox TOP-RIGHT */}
        <div className="flex items-center justify-between gap-2">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {rate.studyLevel}
          </span>

          {/* Multi-Select Checkbox TOP-RIGHT */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 ml-auto">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 dark:border-[#222F43] text-blue-600 dark:text-amber-400 focus:ring-blue-500 cursor-pointer"
              checked={isSelected}
              onChange={(e) => {
                const newSelection = { ...rowSelection };
                if (e.target.checked) {
                  newSelection[rate.id] = true;
                } else {
                  delete newSelection[rate.id];
                }
                setRowSelection(newSelection);
              }}
              aria-label={`Select ${rate.universityName}`}
            />
          </div>
        </div>

        {/* Main Title & Details */}
        <div className="space-y-1">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug break-words">
            {rate.universityName}
          </h3>

          <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-1">
            <AggregatorRouteCell rate={rate} />
            <span className="text-slate-400 font-mono text-[11px]">{rate.intake}</span>
          </div>
        </div>

        {/* Bottom Row: Status Badge & Actions (Share & Star) BOTTOM-RIGHT */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between gap-2">
          <SchoolStatusCell rate={rate} readOnly={readOnly} />

          <div className="flex items-center gap-1.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono font-black text-xs text-emerald-600 dark:text-amber-400 mr-1">
              +{formatCurrencyValue(rate.diffMargin, activeCurrency, rate.isFlatFee)}
            </span>

            <button
              type="button"
              onClick={() => setSharingRate(rate)}
              title="Share Rate Card"
              className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={(e) => handleToggleStar(rate.universityName, e)}
              title={starred ? 'Remove Star' : 'Add Star'}
              className="p-1.5 cursor-pointer shrink-0"
            >
              <Star className={`w-4 h-4 ${starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400 hover:text-amber-400'}`} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="master-intelligence-table-container" className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white dark:bg-[#0E1526] p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs flex flex-wrap items-center justify-between gap-2.5 transition-colors relative">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search universities (e.g. Aberdeen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm border border-slate-200 dark:border-[#222F43] rounded-xl bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-amber-400 transition"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                activeFilterCount > 0 || isFilterPopoverOpen
                  ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-bold'
                  : 'bg-white dark:bg-[#0E1526] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-[#222F43]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center -ml-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Grouping, Sorting, Country Selector, Watchlist & Currency Controls */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* View Mode Switcher */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid Cards View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#0E1526] text-blue-600 dark:text-amber-400 shadow-2xs font-bold'
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
                  ? 'bg-white dark:bg-[#0E1526] text-blue-600 dark:text-amber-400 shadow-2xs font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Watchlist Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setOnlyShowStarred(!onlyShowStarred)}
            title={onlyShowStarred ? 'Show All Schools' : 'Show Starred Watchlist Only'}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 transition cursor-pointer ${
              onlyShowStarred
                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-2xs'
                : 'bg-white dark:bg-[#0E1526] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyShowStarred ? 'fill-slate-950' : 'text-amber-400'}`} />
            <span className="hidden sm:inline">Watchlist</span>
            {watchlist.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 ml-0.5">
                {watchlist.length}
              </span>
            )}
          </button>

          {/* Group By Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43] text-xs">
            <Layers3 className="w-3.5 h-3.5 text-slate-400 ml-1 hidden sm:inline" />
            <select
              value={groupByMode}
              onChange={(e) => setGroupByMode(e.target.value as GroupByMode)}
              className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="NONE">Group: None (Flat)</option>
              <option value="UNIVERSITY">Group: University</option>
              <option value="COUNTRY">Group: Country</option>
              <option value="AGGREGATOR">Group: Portal</option>
            </select>
          </div>

          {/* DYNAMIC COUNTRY SEARCH & SELECT DROPDOWN */}
          {groupByMode === 'COUNTRY' && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43] text-xs animate-in fade-in">
              <Globe className="w-3.5 h-3.5 text-indigo-500 dark:text-amber-400 ml-1 hidden sm:inline" />
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">All Countries ({countries.length})</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* DYNAMIC AGGREGATOR PORTAL SELECTOR */}
          {groupByMode === 'AGGREGATOR' && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43] text-xs animate-in fade-in">
              <Layers3 className="w-3.5 h-3.5 text-blue-500 dark:text-amber-400 ml-1 hidden sm:inline" />
              <select
                value={selectedAggregator}
                onChange={(e) => setSelectedAggregator(e.target.value)}
                className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">All Portals ({aggregators.length})</option>
                {aggregators.map((a) => (
                  <option key={a} value={a}>
                    Use {a}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group Sorting Selector */}
          {groupByMode === 'UNIVERSITY' && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43] text-xs">
              <select
                value={groupSortMode}
                onChange={(e) => setGroupSortMode(e.target.value as GroupSortMode)}
                className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="MOST_ROUTES">Sort: Most Routes</option>
                <option value="HIGHEST_MARGIN">Sort: Highest Yield</option>
                <option value="ALPHABETICAL">Sort: A - Z</option>
              </select>
            </div>
          )}

          {/* Live Currency Switcher Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-[#18181B] p-0.5 rounded-xl border border-slate-200 dark:border-[#222F43] text-[10px] font-extrabold">
            {(['GBP', 'USD', 'EUR', 'NGN'] as CurrencyCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  activeCurrency === code
                    ? 'bg-white dark:bg-[#0E1526] text-blue-600 dark:text-amber-400 shadow-2xs font-black'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TOP SELECTION & BATCH ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between p-2.5 bg-[#F7F4EF] dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs font-semibold gap-3 transition-colors">
        {/* Left: Select All Checkbox & Count Indicator */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 dark:border-[#222F43] text-blue-600 dark:text-amber-400 focus:ring-blue-500 cursor-pointer"
              checked={isAllFilteredSelected}
              ref={(el) => {
                if (el) el.indeterminate = !isAllFilteredSelected && isSomeFilteredSelected;
              }}
              onChange={handleToggleAllFiltered}
            />
            <span className="text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm">
              {selectedRates.length > 0
                ? `${selectedRates.length} Selected`
                : 'Select All Filtered'}
            </span>
          </label>

          <span className="text-slate-400 font-mono text-[10px] sm:text-[11px]">
            ({filteredData.length} total)
          </span>
        </div>

        {/* Right: Inline Bulk Update Controls */}
        {selectedRates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <select
              defaultValue=""
              disabled={readOnly}
              onChange={(e) => {
                if (e.target.value) {
                  handleBatchSetAggregator(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition cursor-pointer"
            >
              <option value="" disabled>Bulk Route...</option>
              {COMMON_AGGREGATORS.map((agg) => (
                <option key={agg} value={agg} className="text-slate-900 bg-white">
                  Set to {agg}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleBatchSetGuidance('FOCUS')}
              disabled={readOnly || batchActionLoading}
              title="Set Guidance to Focus (Preferred)"
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Set Focus</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchSetGuidance('DO_NOT_USE')}
              disabled={readOnly || batchActionLoading}
              title="Set Guidance to Do Not Use (Avoid)"
              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Set Do Not Use</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchSetGuidance('ALLOWED')}
              disabled={readOnly || batchActionLoading}
              title="Set Guidance to Allowed"
              className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Set Allowed</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedRates.length === 1) {
                  onEditRate(selectedRates[0]);
                } else {
                  setIsBatchEditOpen(true);
                }
              }}
              disabled={readOnly || batchActionLoading}
              title="Bulk Edit Selected Records"
              className="px-2.5 py-1.5 bg-blue-600 dark:bg-amber-400 hover:bg-blue-700 dark:hover:bg-amber-500 text-white dark:text-slate-950 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bulk Edit</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={readOnly || batchActionLoading}
              title="Delete Selected Records"
              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setRowSelection({})}
              title="Deselect All"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium hidden sm:inline">
            Check any school card to trigger bulk updates
          </span>
        )}
      </div>

      {/* Filter Popover */}
      {isFilterPopoverOpen && (
        <div className="p-4 bg-slate-100 dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3 text-xs">
          <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
            <span>Detailed Filters</span>
            <button onClick={() => setIsFilterPopoverOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Intake</label>
              <select
                value={selectedIntake}
                onChange={(e) => setSelectedIntake(e.target.value)}
                className="w-full p-2 rounded-xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43]"
              >
                <option value="ALL">All Intakes</option>
                {intakes.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Level</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as StudyLevel | 'ALL')}
                className="w-full p-2 rounded-xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43]"
              >
                <option value="ALL">All Levels</option>
                <option value="UG">Undergraduate (UG)</option>
                <option value="PG">Postgraduate (PG)</option>
                <option value="FD">Foundation (FD)</option>
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
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Application Portal</label>
              <select
                value={selectedAggregator}
                onChange={(e) => setSelectedAggregator(e.target.value)}
                className="w-full p-2 rounded-xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43]"
              >
                <option value="ALL">All Portals</option>
                {aggregators.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* GRID CARDS VIEW (WITH PAGINATION) */}
      {(viewMode === 'grid' || window.innerWidth < 768) && (
        <div className="space-y-4">
          {/* GROUP BY UNIVERSITY */}
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
                    const isFocus = group.guidance === 'FOCUS';
                    const isDoNotUse = group.guidance === 'DO_NOT_USE';

                    return (
                      <div
                        key={group.groupKey}
                        onClick={() => setActiveGroupRate(group)}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between gap-2.5 select-none ${
                          isFocus
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : isDoNotUse
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                            : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {group.totalRoutes} {group.totalRoutes === 1 ? 'Route' : 'Routes'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug break-words">
                            {group.displayName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {group.country}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Top Yield:</span>
                            <span className="font-mono font-black text-xs text-emerald-600 dark:text-amber-400">
                              +{formatCurrencyValue(group.maxMargin, activeCurrency, group.bestRoute?.isFlatFee)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(group.displayName, e)}
                            title={starred ? 'Remove Star' : 'Add Star'}
                            className="p-1.5 cursor-pointer shrink-0 ml-auto"
                          >
                            <Star className={`w-4 h-4 ${starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400 hover:text-amber-400'}`} />
                          </button>
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
            /* FLAT LIST GRID VIEW WITH PAGINATION */
            table.getRowModel().rows.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs">
                No matching schools found.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
                  {paginatedFlatData.map((rate) => renderRateCard(rate))}
                </div>

                {/* Flat Card Pagination Bar */}
                <div className="px-5 py-3.5 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    Showing <strong className="text-slate-800 dark:text-slate-200">{(cardPage - 1) * CARDS_PER_PAGE + 1}</strong> -{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{Math.min(cardPage * CARDS_PER_PAGE, filteredData.length)}</strong> of{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{filteredData.length}</strong> routes
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
            )
          )}
        </div>
      )}

      {/* DESKTOP TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="hidden md:block bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#F7F4EF] dark:bg-[#18181B] border-b border-slate-200 dark:border-[#222F43] text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3.5">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#222F43]">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grouped University Routes Pop-Up Modal */}
      <GroupRoutesModal
        group={activeGroupRate}
        currency={activeCurrency}
        onClose={() => setActiveGroupRate(null)}
        onEdit={onEditRate}
        onShare={setSharingRate}
      />

      {/* Share Rate Card & PDF Quote Modal */}
      <ShareRateCardModal
        rate={sharingRate}
        currency={activeCurrency}
        isOpen={!!sharingRate}
        onClose={() => setSharingRate(null)}
      />

      {/* Batch Edit Modal */}
      <BatchEditModal
        isOpen={isBatchEditOpen}
        onClose={() => setIsBatchEditOpen(false)}
        selectedRates={selectedRates}
        onBatchUpdated={() => setRowSelection({})}
      />
    </div>
  );
};
