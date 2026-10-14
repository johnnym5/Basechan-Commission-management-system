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
import type { SearchToken } from '../types/search';
import type {
  GroupByMode,
  GroupSortMode,
  GroupedUniversity,
} from '../utils/groupingUtils';
import {
  groupRatesByUniversity,
  sortGroupedUniversities,
  resolveUniversityCountry,
  isHistoricalIntake,
} from '../utils/groupingUtils';
import { getWatchlist, toggleWatchlist, isStarred } from '../utils/watchlistUtils';
import type { CurrencyCode } from '../utils/currencyUtils';
import { formatCurrencyValue } from '../utils/currencyUtils';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { BatchEditModal } from './BatchEditModal';
import { ShareRateCardModal } from './ShareRateCardModal';
import { UniversityDetailModal, type UniversityDetailData } from './UniversityDetailModal';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { writeRateOperation } from '../services/adminRateWriteService';
import {
  ArrowUpDown,
  Search,
  History as HistoryIcon,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Check,
  ChevronDown,
  Trash2,
  X,
  Globe,
  Star,
  Share2,
  ChevronLeft,
  ChevronRight,
  Target,
  GraduationCap,
  Building2,
} from 'lucide-react';

interface MasterTableProps {
  data: CommissionRate[];
  loading: boolean;
  onEditRate: (rate: CommissionRate) => void;
  onBatchActionComplete?: (msg: string) => void;
  readOnly?: boolean;
  externalSearchQuery?: string;
  onExternalSearchChange?: (q: string) => void;
  externalGuidanceFilter?: SchoolGuidance | 'ALL';
  onExternalGuidanceChange?: (g: SchoolGuidance | 'ALL') => void;
  externalAggregatorFilter?: string;
  onExternalAggregatorChange?: (agg: string) => void;
  externalIntakeFilter?: string;
  onExternalIntakeChange?: (intake: string) => void;
  externalLevelFilter?: StudyLevel | 'ALL';
  onExternalLevelChange?: (level: StudyLevel | 'ALL') => void;
  externalCountryFilter?: string;
  onExternalCountryChange?: (country: string) => void;
  externalUniversityFilter?: string;
  onExternalUniversityChange?: (university: string) => void;
  externalSortBy?: string;
  onExternalSortByChange?: (sortBy: string) => void;
  activeTokens?: SearchToken[];
  onTokensChange?: (tokens: SearchToken[]) => void;
  externalSchoolIdsFilter?: string[];
  externalViewMode?: 'grid' | 'table' | 'cards';
  onExternalViewModeChange?: (mode: 'cards' | 'table') => void;
  externalOnlyShowStarred?: boolean;
  onExternalToggleStarred?: () => void;
  externalGroupByMode?: GroupByMode;
  onExternalGroupByModeChange?: (mode: GroupByMode) => void;
  externalActiveCurrency?: CurrencyCode;
  onExternalCurrencyChange?: (code: CurrencyCode) => void;
}

const COMMON_AGGREGATORS = ['SI-UK', 'EDVOY', 'UAP', 'CRIZAC', 'BASECHAN', 'Direct'];

// Interactive School Status Cell for Admin Users
const SchoolStatusCell: React.FC<{ rate: CommissionRate }> = ({ rate }) => {
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
      const nextRate: CommissionRate = {
        ...rate,
        guidance: newGuidance,
        updatedAt: new Date().toISOString(),
      };
      await writeRateOperation({
        adminEmail: user?.email || 'admin@basechan.com',
        category: 'guidance',
        mutations: [{ previous: rate, next: nextRate }],
      });
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

  if (!isAdmin) {
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

// Aggregator Route Cell Badge
const AggregatorRouteCell: React.FC<{ rate: CommissionRate }> = ({ rate }) => {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
      {rate.aggregator || 'Direct'}
    </span>
  );
};

// Side-by-Side Grouped University Routes Comparison Modal
const GroupRoutesModal: React.FC<{
  group: GroupedUniversity | null;
  currency: CurrencyCode;
  onClose: () => void;
  onEdit: (rate: CommissionRate) => void;
  onShare: (rate: CommissionRate) => void;
  onOpenDetail?: (universityName: string) => void;
}> = ({ group, currency, onClose, onEdit, onShare, onOpenDetail }) => {
  const [showPreviousIntakes, setShowPreviousIntakes] = useState(false);

  useEffect(() => {
    if (!group) return;
    setShowPreviousIntakes(false);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [group]);

  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const isAgent = role === 'AGENT';

  const displayableRates = useMemo(() => {
    if (!group) return [];
    if (isAdmin) return group.rates;

    // For STAFF & AGENT: Show EXPLICITLY 1 single route per study level & intake
    const levelMap = new Map<string, CommissionRate[]>();
    group.rates.forEach((r) => {
      const key = `${r.studyLevel}__${r.intake}`;
      if (!levelMap.has(key)) levelMap.set(key, []);
      levelMap.get(key)!.push(r);
    });

    const singleRoutePerLevel: CommissionRate[] = [];
    levelMap.forEach((ratesForLevel) => {
      if (isAgent) {
        // AGENT ROLE: Strictly use BASECHAN / Direct Sub-Agent Payout Rate (Cols C, D, E)!
        const basechanRate = ratesForLevel.find(
          (r) => (r.aggregator || '').toUpperCase() === 'BASECHAN' || (r.aggregator || '').toUpperCase() === 'DIRECT'
        );
        singleRoutePerLevel.push(basechanRate || ratesForLevel[0]);
      } else {
        // STAFF ROLE: Admin Default Route if set (guidance === 'FOCUS'); otherwise System Recommended Route (Top Yield)
        const adminDefault = ratesForLevel.find((r) => r.guidance === 'FOCUS');
        if (adminDefault) {
          singleRoutePerLevel.push(adminDefault);
        } else {
          const topYield = ratesForLevel.reduce(
            (best, curr) => (curr.diffMargin > best.diffMargin ? curr : best),
            ratesForLevel[0]
          );
          singleRoutePerLevel.push(topYield);
        }
      }
    });

    return singleRoutePerLevel;
  }, [group, isAdmin, isAgent]);

  const { activeRoutes, previousRoutes } = useMemo(() => {
    if (!group) return { activeRoutes: [], previousRoutes: [] };
    const active: CommissionRate[] = [];
    const previous: CommissionRate[] = [];

    displayableRates.forEach((rate) => {
      if (isHistoricalIntake(rate.intake)) {
        previous.push(rate);
      } else {
        active.push(rate);
      }
    });

    return { activeRoutes: active, previousRoutes: previous };
  }, [group, displayableRates]);

  const handleSetAsDefaultRoute = async (targetRate: CommissionRate) => {
    if (!group) return;
    try {
      const batch = writeBatch(db);
      group.rates.forEach((r) => {
        const isTarget = r.id === targetRate.id;
        batch.update(doc(db, 'rates', r.id), {
          guidance: isTarget ? 'FOCUS' : 'ALLOWED',
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to set default route:', err);
    }
  };

  if (!group) return null;

  const renderRouteCard = (rate: CommissionRate) => {
    const isDefaultRoute = rate.guidance === 'FOCUS';
    const isBest = !isAgent && group.bestRoute?.id === rate.id;

    return (
      <div
        key={rate.id}
        className={`p-3.5 rounded-2xl border transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
          isDefaultRoute
            ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400/50 dark:border-amber-500/50 shadow-xs ring-1 ring-amber-400/20'
            : isBest
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-xs'
            : 'bg-slate-50 dark:bg-[#18181B]/80 border-slate-200 dark:border-[#222F43]'
        }`}
      >
        <div className="space-y-1.5 min-w-[160px]">
          <div className="flex items-center gap-2">
            {isAgent ? (
              <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Authorized Route
              </span>
            ) : (
              <AggregatorRouteCell rate={rate} />
            )}

            {/* Default Route Status Badge or Set Default Button */}
            {isDefaultRoute ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 flex items-center gap-1 shrink-0" title="Active Default Route for Staff & Agents">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                Default Route
              </span>
            ) : (
              isAdmin && (
                <button
                  type="button"
                  onClick={() => handleSetAsDefaultRoute(rate)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-200 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 hover:text-amber-300 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1 shrink-0"
                  title="Set this route as default for this university"
                >
                  <Star className="w-3 h-3 text-amber-400" />
                  Set as Default
                </button>
              )
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            Intake: <strong className="text-slate-800 dark:text-slate-200">{rate.intake}</strong> • Level: <strong className="text-indigo-600 dark:text-indigo-400">{rate.studyLevel}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[9px] font-bold uppercase text-slate-400 block">
              {isAgent ? 'Your Commission' : 'Profit Yield'}
            </span>
            <span className="font-mono font-black text-emerald-600 dark:text-amber-400 text-sm">
              {formatCurrencyValue(isAgent ? rate.agentRate : rate.diffMargin, currency, rate.isFlatFee)}
            </span>
          </div>

          <button
            onClick={() => onShare(rate)}
            className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-400/30 rounded-xl transition cursor-pointer"
            title="Share Rate Card"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {isAdmin && (
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
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-0 sm:m-auto max-w-lg sm:max-w-2xl w-full max-h-[92vh] sm:max-h-[85vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Mobile Drag / Sheet Handle Indicator */}
        <div className="sm:hidden flex items-center justify-center pt-2.5 pb-1 shrink-0 bg-slate-50/90 dark:bg-[#18181B]/90">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-start justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
              {group.displayName}
            </h3>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 mt-0.5">
              <Globe className="w-3.5 h-3.5" />
              <span>{group.country} • {isAgent ? 'Authorized Application Route' : `${group.totalRoutes} Available Routes`}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => {
                  const uniName = group.displayName;
                  onClose();
                  if (onOpenDetail) onOpenDetail(uniName);
                }}
                className="px-2.5 py-1.5 bg-indigo-100 dark:bg-indigo-950/80 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
                title="View full 21-column master record & aggregator benchmarks"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Show Full Details</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Routes List */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Best Route Banner - Only for Admin */}
          {isAdmin && group.bestRoute && (
            <div className="p-3 bg-amber-500/15 border border-amber-400/40 rounded-2xl flex items-center justify-between text-amber-800 dark:text-amber-300">
              <span className="font-extrabold text-xs">
                Recommended Top Yield Route:
              </span>
              <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                {formatCurrencyValue(group.bestRoute.diffMargin, currency, group.bestRoute.isFlatFee)} via {group.bestRoute.aggregator}
              </span>
            </div>
          )}

          {/* Main Active or Fallback Intakes Section */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {activeRoutes.length > 0
                ? `Active Intakes (${activeRoutes.length}):`
                : `Previous Intakes (${previousRoutes.length}):`}
            </span>
            {(activeRoutes.length > 0 ? activeRoutes : previousRoutes).length > 0 ? (
              (activeRoutes.length > 0 ? activeRoutes : previousRoutes).map((rate) => renderRouteCard(rate))
            ) : (
              <p className="text-slate-400 italic text-xs py-4 text-center">
                No route/rate found for this uni
              </p>
            )}
          </div>

          {/* Previous / Historical Intakes Collapsible Section (Only when activeRoutes exist and previousRoutes exist) */}
          {activeRoutes.length > 0 && previousRoutes.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-[#222F43]">
              <button
                type="button"
                onClick={() => setShowPreviousIntakes(!showPreviousIntakes)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#26334b] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer font-bold text-xs"
              >
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4 text-amber-500" />
                  <span>View Previous Intakes ({previousRoutes.length})</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showPreviousIntakes ? 'rotate-180' : ''}`} />
              </button>

              {showPreviousIntakes && (
                <div className="space-y-2 mt-3 animate-in fade-in duration-150">
                  {previousRoutes.map((rate) => renderRouteCard(rate))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const MasterTable: React.FC<MasterTableProps> = ({
  data,
  onEditRate,
  onBatchActionComplete,
  externalSearchQuery,
  onExternalSearchChange,
  externalGuidanceFilter,
  onExternalGuidanceChange,
  externalAggregatorFilter,
  onExternalAggregatorChange,
  externalIntakeFilter,
  onExternalIntakeChange,
  externalLevelFilter,
  onExternalLevelChange,
  externalCountryFilter,
  onExternalCountryChange,
  externalUniversityFilter,
  onExternalUniversityChange: _onExternalUniversityChange,
  externalSortBy,
  onExternalSortByChange: _onExternalSortByChange,
  activeTokens = [],
  onTokensChange: _onTokensChange,
  externalSchoolIdsFilter,
  externalViewMode,
  externalOnlyShowStarred,
  externalGroupByMode,
  externalActiveCurrency,
}) => {
  const { role, user } = useAuth();
  const isAdmin = role === 'ADMIN';
  const { defaultIntake, activeIntakes, updateDefaultIntake } = useSystemConfig();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'diffMargin', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);

  // View Mode: 'grid' or 'table'
  const [internalViewMode] = useState<'grid' | 'table'>('grid');
  const viewMode = externalViewMode === 'cards' ? 'grid' : (externalViewMode || internalViewMode);

  // QOL STATES & CARD PAGINATION
  const [watchlist, setWatchlist] = useState<string[]>(() => getWatchlist());
  const [internalOnlyShowStarred, setInternalOnlyShowStarred] = useState<boolean>(false);
  const onlyShowStarred = externalOnlyShowStarred !== undefined ? externalOnlyShowStarred : internalOnlyShowStarred;
  void setInternalOnlyShowStarred;
  const [cardPage, setCardPage] = useState<number>(1);
  const CARDS_PER_PAGE = 24;
  const activeCurrency = externalActiveCurrency || 'GBP';

  // Filter Popover Drawer State
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  // Modals
  const [activeGroupRate, setActiveGroupRate] = useState<GroupedUniversity | null>(null);
  const [sharingRate, setSharingRate] = useState<CommissionRate | null>(null);
  const [selectedUniversityDetailName, setSelectedUniversityDetailName] = useState<string | null>(null);

  const [internalGroupByMode] = useState<GroupByMode>('UNIVERSITY');
  const groupByMode = externalGroupByMode || internalGroupByMode;

  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const [internalIntake, setInternalIntake] = useState<string>('ALL');
  const [internalLevel, setInternalLevel] = useState<StudyLevel | 'ALL'>('ALL');
  const [internalCountry, setInternalCountry] = useState<string>('ALL');
  const [internalUniversity, setInternalUniversity] = useState<string>('ALL');
  const [internalGuidanceFilter, setInternalGuidanceFilter] = useState<SchoolGuidance | 'ALL'>('ALL');
  const [internalAggregatorFilter, setInternalAggregatorFilter] = useState<string>('ALL');
  const [internalSortBy, setInternalSortBy] = useState<string>('ALPHABETICAL');

  const selectedIntake = externalIntakeFilter ?? internalIntake;
  const selectedLevel = externalLevelFilter ?? internalLevel;
  const selectedCountry = externalCountryFilter ?? internalCountry;
  const selectedUniversity = externalUniversityFilter ?? internalUniversity;
  const selectedSortBy = externalSortBy ?? internalSortBy;

  const setSelectedIntake = (value: string) => { setInternalIntake(value); onExternalIntakeChange?.(value); };
  const setSelectedLevel = (value: StudyLevel | 'ALL') => { setInternalLevel(value); onExternalLevelChange?.(value); };
  const setSelectedCountry = (value: string) => { setInternalCountry(value); onExternalCountryChange?.(value); };
  const setSelectedUniversity = (value: string) => { setInternalUniversity(value); _onExternalUniversityChange?.(value); };
  const setSelectedSortBy = (value: string) => { setInternalSortBy(value); _onExternalSortByChange?.(value); };
  void setSelectedUniversity;
  void setSelectedSortBy;

  const effectiveGroupByMode: GroupByMode = useMemo(() => {
    if (selectedSortBy === 'UNIVERSITY') return 'UNIVERSITY';
    if (selectedSortBy === 'COUNTRY') return 'COUNTRY';
    return groupByMode;
  }, [selectedSortBy, groupByMode]);

  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Auto-initialize to defaultIntake when loaded
  useEffect(() => {
    if (defaultIntake && defaultIntake !== 'ALL' && externalIntakeFilter === undefined) {
      setInternalIntake(defaultIntake);
    }
  }, [defaultIntake, externalIntakeFilter]);

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
    selectedUniversity,
    selectedSortBy,
    selectedGuidance,
    selectedAggregator,
    activeTokens,
    groupByMode,
    onlyShowStarred,
  ]);

  const hasActiveSearchOrFilter = Boolean(
    (searchQuery && searchQuery.trim().length > 0) ||
    (externalSearchQuery && externalSearchQuery.trim().length > 0) ||
    (activeTokens && activeTokens.length > 0) ||
    (selectedUniversity && selectedUniversity !== 'ALL') ||
    (selectedIntake && selectedIntake !== 'ALL') ||
    (selectedLevel && selectedLevel !== 'ALL') ||
    (selectedCountry && selectedCountry !== 'ALL') ||
    (selectedAggregator && selectedAggregator !== 'ALL') ||
    (selectedGuidance && selectedGuidance !== 'ALL') ||
    (externalSchoolIdsFilter && externalSchoolIdsFilter.length > 0) ||
    onlyShowStarred
  );
  void hasActiveSearchOrFilter;

  // Recent Search History Loader
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('basechan_recent_searches_v1');
      if (stored) setRecentSearches(JSON.parse(stored).slice(0, 5));
    } catch (e) {}
  }, [externalSearchQuery, searchQuery]);

  // Toggle Watchlist Star Handler
  const handleToggleStar = (schoolName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = toggleWatchlist(schoolName);
    setWatchlist(updated);
  };

  // Extract unique options for filter dropdowns
  const intakes = useMemo(() => {
    const set = new Set(data.map((r) => r.intake).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const countries = useMemo(() => {
    const set = new Set<string>(['UK', 'Canada', 'USA', 'Australia']);
    data.forEach((r) => {
      const c = resolveUniversityCountry(r.universityName, r.country, data);
      if (c) set.add(c);
    });
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
      resolveUniversityCountry(row.universityName, row.country, data),
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
      if (onlyShowStarred && !isStarred(watchlist, row.universityName)) {
        return false;
      }

      if (searchQuery && !fuzzyMatch(row, searchQuery)) {
        return false;
      }

      if (activeTokens && activeTokens.length > 0) {
        for (const token of activeTokens) {
          const val = (token.value || token.label).toLowerCase().trim();
          if (token.type === 'school') {
            const val = (token.value || token.label).toLowerCase().trim();
            const nameMatch = row.universityName.toLowerCase().includes(val) || val.includes(row.universityName.toLowerCase());
            const idMatch = row.universityId.toLowerCase() === val || val.includes(row.universityId.toLowerCase());
            if (!nameMatch && !idMatch) return false;
          } else if (token.type === 'country') {
            const rowCountry = resolveUniversityCountry(row.universityName, row.country, data);
            if (rowCountry.toLowerCase() !== val && !(row.country || '').toLowerCase().includes(val)) return false;
          } else if (token.type === 'level') {
            if (row.studyLevel.toLowerCase() !== val && !row.studyLevel.toLowerCase().includes(val)) return false;
          } else if (token.type === 'intake') {
            if (row.intake.toLowerCase() !== val && !row.intake.toLowerCase().includes(val)) return false;
          } else if (token.type === 'status') {
            if ((row.guidance || 'ALLOWED').toLowerCase() !== val) return false;
          } else if (token.type === 'aggregator') {
            if ((row.aggregator || '').toLowerCase() !== val) return false;
          } else {
            const rowCountry = resolveUniversityCountry(row.universityName, row.country, data);
            const corpus = `${row.universityName} ${rowCountry} ${row.intake} ${row.studyLevel} ${row.guidance || 'ALLOWED'} ${row.aggregator || ''}`.toLowerCase();
            if (!corpus.includes(val)) return false;
          }
        }
      }

      if (selectedUniversity !== 'ALL' && row.universityName !== selectedUniversity) {
        return false;
      }

      if (selectedIntake !== 'ALL' && row.intake !== selectedIntake) {
        return false;
      }

      if (selectedLevel !== 'ALL' && row.studyLevel !== selectedLevel) {
        return false;
      }

      if (selectedCountry !== 'ALL') {
        const rowCountry = resolveUniversityCountry(row.universityName, row.country, data);
        if (rowCountry !== selectedCountry && (row.country || 'UK') !== selectedCountry) {
          return false;
        }
      }

      if (selectedAggregator !== 'ALL' && row.aggregator !== selectedAggregator) {
        return false;
      }

      if (selectedGuidance !== 'ALL') {
        const rowGuidance = row.guidance || 'ALLOWED';
        if (rowGuidance !== selectedGuidance) return false;
      }

      if (externalSchoolIdsFilter && externalSchoolIdsFilter.length > 0) {
        if (!externalSchoolIdsFilter.includes(row.universityId)) return false;
      }

      return true;
    });
  }, [data, searchQuery, activeTokens, selectedUniversity, selectedIntake, selectedLevel, selectedCountry, selectedAggregator, selectedGuidance, externalSchoolIdsFilter, watchlist, onlyShowStarred]);

  // Apply Sort By mode
  const sortedFilteredData = useMemo(() => {
    const list = [...filteredData];
    if (selectedSortBy === 'ALPHABETICAL' || selectedSortBy === 'UNIVERSITY') {
      return list.sort((a, b) => a.universityName.localeCompare(b.universityName));
    }
    if (selectedSortBy === 'COUNTRY') {
      return list.sort((a, b) => {
        const c1 = a.country || 'UK';
        const c2 = b.country || 'UK';
        const comp = c1.localeCompare(c2);
        if (comp !== 0) return comp;
        return a.universityName.localeCompare(b.universityName);
      });
    }
    if (selectedSortBy === 'HIGHEST_MARGIN') {
      return list.sort((a, b) => b.diffMargin - a.diffMargin);
    }
    return list;
  }, [filteredData, selectedSortBy]);

  const hasUserSearched = Boolean(
    sortedFilteredData.length > 0 ||
    (searchQuery && searchQuery.trim().length > 0) ||
    (externalSearchQuery && externalSearchQuery.trim().length > 0)
  );

  // Grouped Data Calculations
  const groupedUniversities = useMemo(() => {
    if (effectiveGroupByMode !== 'UNIVERSITY') return [];
    const grouped = groupRatesByUniversity(sortedFilteredData);
    const targetSortMode: GroupSortMode =
      selectedSortBy === 'HIGHEST_MARGIN'
        ? 'HIGHEST_MARGIN'
        : selectedSortBy === 'MOST_ROUTES'
        ? 'MOST_ROUTES'
        : 'ALPHABETICAL';
    return sortGroupedUniversities(grouped, targetSortMode);
  }, [sortedFilteredData, effectiveGroupByMode, selectedSortBy]);

  // CARD GRID PAGINATION SLICES
  const totalGroupPages = Math.ceil(groupedUniversities.length / CARDS_PER_PAGE) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (cardPage - 1) * CARDS_PER_PAGE;
    return groupedUniversities.slice(start, start + CARDS_PER_PAGE);
  }, [groupedUniversities, cardPage]);

  const totalFlatPages = Math.ceil(sortedFilteredData.length / CARDS_PER_PAGE) || 1;
  const paginatedFlatData = useMemo(() => {
    const start = (cardPage - 1) * CARDS_PER_PAGE;
    return sortedFilteredData.slice(start, start + CARDS_PER_PAGE);
  }, [sortedFilteredData, cardPage]);

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

  const columns = useMemo<ColumnDef<CommissionRate, any>[]>(() => {
    const cols: ColumnDef<CommissionRate, any>[] = [];

    if (isAdmin) {
      cols.push({
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
      });
    }

    cols.push(
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
                <button
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      setSelectedUniversityDetailName(row.universityName);
                    } else {
                      const groupMatch = groupedUniversities.find((g) => g.displayName === row.universityName);
                      if (groupMatch) setActiveGroupRate(groupMatch);
                    }
                  }}
                  className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition cursor-pointer"
                  title={isAdmin ? "Click to view full 21-column master record & aggregator benchmarks" : "Click to view university routes"}
                >
                  {info.getValue() as string}
                </button>
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
        cell: (info) => <SchoolStatusCell rate={info.row.original} />,
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
              {formatCurrencyValue(diff, activeCurrency, row.isFlatFee)}
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
            {isAdmin && (
              <button
                onClick={() => onEditRate(info.row.original)}
                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition cursor-pointer"
                title="Edit Rate & Guidance"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        ),
      }
    );

    return cols;
  }, [isAdmin, onEditRate, isAllFilteredSelected, isSomeFilteredSelected, handleToggleAllFiltered, activeCurrency, watchlist, groupedUniversities]);

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

  // Selected rates & unique selected universities
  const selectedRates = useMemo(() => data.filter((rate) => rowSelection[rate.id]), [rowSelection, data]);
  const selectedSchoolNames = useMemo(() => new Set(selectedRates.map((r) => r.universityName)), [selectedRates]);

  // Batch action handlers
  const handleSaveUniversityRecord = async (
    updatedData: UniversityDetailData,
    makeDefaultIntake?: boolean
  ) => {
    const uniRates = data.filter((r) => r.universityName === updatedData.university);
    if (uniRates.length === 0) return;

    if (makeDefaultIntake && updatedData.baselineIntake) {
      await updateDefaultIntake(updatedData.baselineIntake, user?.email || 'admin@basechan.com');
    }

    const parseRateNumber = (strVal: string): number => {
      const clean = (strVal || '').replace(/[^0-9.]/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const isFlat = updatedData.commissionType === 'Fixed Fee';
    const targetDefaultRoute = (updatedData.defaultRoute || 'BASECHAN').toUpperCase();

    try {
      setBatchActionLoading(true);
      const batch = writeBatch(db);
      uniRates.forEach((rate) => {
        let newAgentRate = rate.agentRate;
        let newMasterRate = rate.masterRate;

        if (rate.aggregator === 'BASECHAN' || rate.aggregator === 'Direct') {
          if (rate.studyLevel === 'FD') newAgentRate = parseRateNumber(updatedData.agentRateFD);
          else if (rate.studyLevel === 'UG') {
            newAgentRate = parseRateNumber(updatedData.agentRateUG);
            newMasterRate = parseRateNumber(updatedData.masterRateUG);
          } else if (rate.studyLevel === 'PG') {
            newAgentRate = parseRateNumber(updatedData.agentRatePG);
            newMasterRate = parseRateNumber(updatedData.masterRatePG);
          }
        } else {
          const aggUpper = rate.aggregator.toUpperCase();
          if (aggUpper.includes('EDVOY')) {
            newAgentRate = parseRateNumber(rate.studyLevel === 'UG' ? updatedData.edvoyUG : updatedData.edvoyPG);
          } else if (aggUpper.includes('SI-UK')) {
            newAgentRate = parseRateNumber(rate.studyLevel === 'UG' ? updatedData.siUkUG : updatedData.siUkPG);
          } else if (aggUpper.includes('UAP')) {
            newAgentRate = parseRateNumber(rate.studyLevel === 'UG' ? updatedData.uapUG : updatedData.uapPG);
          } else if (aggUpper.includes('CRIZAC')) {
            newAgentRate = parseRateNumber(rate.studyLevel === 'UG' ? updatedData.crizacUG : updatedData.crizacPG);
          } else if (aggUpper.includes('KC OVERSEAS')) {
            newAgentRate = parseRateNumber(rate.studyLevel === 'UG' ? updatedData.kcOverseasUG : updatedData.kcOverseasPG);
          } else if (aggUpper.includes('AIMS EDUCATION')) {
            newAgentRate = parseRateNumber(rate.studyLevel === 'UG' ? updatedData.aimsEducationUG : updatedData.aimsEducationPG);
          }
        }

        const diffMargin = parseFloat((newMasterRate - newAgentRate).toFixed(2));
        const isSelectedDefaultRoute = rate.aggregator.toUpperCase().includes(targetDefaultRoute) ||
          (targetDefaultRoute === 'BASECHAN' && rate.aggregator === 'Direct');

        batch.set(
          doc(db, 'rates', rate.id),
          {
            ...rate,
            intake: updatedData.baselineIntake || rate.intake,
            agentRate: newAgentRate,
            masterRate: newMasterRate,
            diffMargin,
            isFlatFee: isFlat,
            guidance: isSelectedDefaultRoute ? 'FOCUS' : 'ALLOWED',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      if (onBatchActionComplete) {
        onBatchActionComplete(`Successfully updated rates, default intake, and default route for ${updatedData.university}.`);
      }
    } catch (err) {
      console.error('Error saving university record:', err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleDeleteUniversityRecord = async (uniName: string) => {
    const uniRates = data.filter((r) => r.universityName === uniName);
    if (uniRates.length === 0) return;

    try {
      setBatchActionLoading(true);
      const batch = writeBatch(db);
      uniRates.forEach((r) => batch.delete(doc(db, 'rates', r.id)));
      await batch.commit();

      if (onBatchActionComplete) {
        onBatchActionComplete(`Successfully deleted ${uniRates.length} rate records for ${uniName}.`);
      }
    } catch (err) {
      console.error('Error deleting university records:', err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRates.length === 0) return;
    try {
      setBatchActionLoading(true);
      const batch = writeBatch(db);
      selectedRates.forEach((rate) => batch.delete(doc(db, 'rates', rate.id)));
      await batch.commit();
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
      const batch = writeBatch(db);
      selectedRates.forEach((rate) => {
        batch.update(doc(db, 'rates', rate.id), { guidance, updatedAt: new Date().toISOString() });
      });
      await batch.commit();
      setRowSelection({});
      if (onBatchActionComplete) onBatchActionComplete(`Updated guidance status for ${selectedRates.length} selected items.`);
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleSingleDelete = async (rate: CommissionRate) => {
    if (!window.confirm(`Are you sure you want to delete rate record for ${rate.universityName}?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'rates', rate.id));
      await batch.commit();
      if (onBatchActionComplete) onBatchActionComplete(`Deleted rate record for ${rate.universityName}.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchSetAggregator = async (targetAggregator: string) => {
    if (selectedRates.length === 0 || !targetAggregator) return;
    try {
      setBatchActionLoading(true);
      const batch = writeBatch(db);
      selectedRates.forEach((rate) => {
        batch.update(doc(db, 'rates', rate.id), { aggregator: targetAggregator, updatedAt: new Date().toISOString() });
      });
      await batch.commit();
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
    const isAdmin = role === 'ADMIN';
    const isSelected = rowSelection[rate.id] || false;
    const starred = isStarred(watchlist, rate.universityName);
    const isHistorical = activeIntakes && activeIntakes.length > 0 && !activeIntakes.includes(rate.intake);

    return (
      <div
        key={rate.id}
        onClick={() => onEditRate(rate)}
        className={`p-3 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between gap-2.5 select-none ${
          isHistorical ? 'opacity-85 grayscale-25' : ''
        } ${
          isSelected
            ? 'bg-blue-50 dark:bg-amber-950/60 border-blue-500 dark:border-amber-400 shadow-md ring-1 ring-blue-500/30'
            : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs hover:-translate-y-0.5'
        }`}
      >
        {/* Top Row: Level Badge Left, Multi-Select Checkbox TOP-RIGHT */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {rate.studyLevel}
            </span>
            {isHistorical && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                🕰️ Historical
              </span>
            )}
          </div>

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
          <SchoolStatusCell rate={rate} />

          <div className="flex items-center gap-1.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono font-black text-xs text-emerald-600 dark:text-amber-400 mr-1">
              {formatCurrencyValue(rate.diffMargin, activeCurrency, rate.isFlatFee)}
            </span>

            <button
              type="button"
              onClick={() => setSharingRate(rate)}
              title="Share Rate Card"
              className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditRate(rate);
                }}
                title="Edit Rate Record"
                className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSingleDelete(rate);
                }}
                title="Delete Rate Record"
                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

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
      {!hasUserSearched ? (
        <div className="p-10 sm:p-16 text-center text-slate-400 bg-white dark:bg-[#0E1526] rounded-3xl border border-slate-200 dark:border-[#222F43] space-y-4 shadow-md animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-amber-950/60 text-blue-600 dark:text-amber-400 border border-blue-200 dark:border-amber-400/30 flex items-center justify-center mx-auto shadow-inner">
            <Search className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-extrabold text-base sm:text-xl text-slate-900 dark:text-slate-100 tracking-tight">
              Search results will appear here
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
              Type a school name, intake (e.g. Sept 2026), study level (UG/PG), or country in the search bar above, then press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-blue-700 dark:text-amber-300 font-extrabold border border-slate-300 dark:border-slate-700">Enter</kbd> to view matching rates.
            </p>
          </div>

          {recentSearches.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-[#222F43] max-w-lg mx-auto space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
                <HistoryIcon className="w-3.5 h-3.5 text-amber-400" />
                Recent Searches
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      if (onExternalSearchChange) {
                        onExternalSearchChange(term);
                      } else {
                        setSearchQuery(term);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#26334b] hover:border-amber-400 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer active:scale-95"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : !hasActiveSearchOrFilter ? (
        <div className="p-8 sm:p-12 text-center text-slate-500 bg-white dark:bg-[#0E1526] rounded-3xl border border-dashed border-slate-200 dark:border-[#222F43] space-y-3 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-400/20 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Search or filter to view university commission rates
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Type a school name, country, or intake in the search bar above, or select a filter to display authorized application routes.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mr-1">Quick searches:</span>
            <button
              type="button"
              onClick={() => setSelectedCountry('UK')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#18181B] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#222F43] hover:border-blue-400 hover:text-blue-400 transition cursor-pointer flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500 dark:text-amber-400" />
              <span>United Kingdom</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedGuidance('FOCUS')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1.5"
            >
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              <span>Focus Routes</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedLevel('PG')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1.5"
            >
              <GraduationCap className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Postgraduate (PG)</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TOP SELECTION & BATCH ACTIONS BAR */}
          <div className="flex flex-wrap items-center justify-between p-2.5 bg-[#F7F4EF] dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs font-semibold gap-3 transition-colors">
            {/* Left: Select All Checkbox & Count Indicator */}
            <div className="flex items-center gap-3">
              {isAdmin && (
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
                      ? `${selectedRates.length} Selected (${selectedSchoolNames.size} ${selectedSchoolNames.size === 1 ? 'School' : 'Schools'})`
                      : 'Select All Filtered'}
                  </span>
                </label>
              )}

              <span className="text-slate-400 font-mono text-[10px] sm:text-[11px]">
                ({filteredData.length} total commission rates)
              </span>
            </div>

            {/* Right: Inline Bulk Update Controls */}
            {isAdmin && (
              selectedRates.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <select
                    defaultValue=""
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
                    disabled={batchActionLoading}
                    title="Set Guidance to Focus (Preferred)"
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Set Focus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchSetGuidance('DO_NOT_USE')}
                    disabled={batchActionLoading}
                    title="Set Guidance to Do Not Use (Avoid)"
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Set Do Not Use</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchSetGuidance('ALLOWED')}
                    disabled={batchActionLoading}
                    title="Set Guidance to Allowed"
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Set Allowed</span>
                  </button>

                  {selectedSchoolNames.size === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const uniName = Array.from(selectedSchoolNames)[0];
                        setSelectedUniversityDetailName(uniName);
                      }}
                      disabled={batchActionLoading}
                      title="Single Edit 21-Column Spec for Selected School"
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Single Edit (21 Cols)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRates.length === 1) {
                        onEditRate(selectedRates[0]);
                      } else {
                        setIsBatchEditOpen(true);
                      }
                    }}
                    disabled={batchActionLoading}
                    title="Bulk Edit Selected Records"
                    className="px-2.5 py-1.5 bg-blue-600 dark:bg-amber-400 hover:bg-blue-700 dark:hover:bg-amber-500 text-white dark:text-slate-950 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Bulk Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={batchActionLoading}
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
              )
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
              <label htmlFor="master-guidance-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
              <select
                id="master-guidance-filter"
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
              <label htmlFor="master-intake-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Intake</label>
              <select
                id="master-intake-filter"
                value={selectedIntake}
                onChange={(e) => setSelectedIntake(e.target.value)}
                className="w-full p-2 rounded-xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43]"
              >
                <option value="ALL">All Intakes</option>
                {intakes.map((i) => (
                  <option key={i} value={i}>
                    {i} {i === defaultIntake ? ' (Main Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="master-level-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Level</label>
              <select
                id="master-level-filter"
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
              <label htmlFor="master-country-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Country</label>
              <select
                id="master-country-filter"
                aria-label="Country"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full p-2 rounded-xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43]"
              >
                <option value="ALL">All Countries</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="master-aggregator-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Application Portal</label>
              <select
                id="master-aggregator-filter"
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
          {effectiveGroupByMode === 'UNIVERSITY' ? (
            groupedUniversities.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs font-semibold">
                No route/rate found for this uni
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
                  {paginatedGroups.map((group) => {
                    const starred = isStarred(watchlist, group.displayName);
                    const isFocus = group.guidance === 'FOCUS';
                    const isDoNotUse = group.guidance === 'DO_NOT_USE';
                    const isGroupSelected = group.rates.every((r) => rowSelection[r.id]);
                    const isGroupSomeSelected = group.rates.some((r) => rowSelection[r.id]);

                    return (
                      <div
                        key={group.groupKey}
                        onClick={() => setActiveGroupRate(group)}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between gap-2.5 select-none ${
                          isGroupSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-400 ring-2 ring-blue-500/20 shadow-md'
                            : isFocus
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : isDoNotUse
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                            : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600 shadow-xs hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <input
                                type="checkbox"
                                checked={isGroupSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = !isGroupSelected && isGroupSomeSelected;
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSel = { ...rowSelection };
                                  if (isGroupSelected) {
                                    group.rates.forEach((r) => { delete newSel[r.id]; });
                                  } else {
                                    group.rates.forEach((r) => { newSel[r.id] = true; });
                                  }
                                  setRowSelection(newSel);
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                                aria-label={`Select ${group.displayName}`}
                                title={`Select all ${group.rates.length} routes for ${group.displayName}`}
                              />
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {group.totalRoutes} {group.totalRoutes === 1 ? 'Route' : 'Routes'}
                            </span>
                          </div>
                          {group.guidance === 'FOCUS' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              FOCUS
                            </span>
                          )}
                          {group.guidance === 'DO_NOT_USE' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              DO NOT USE
                            </span>
                          )}
                          {group.guidance === 'ALLOWED' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              ALLOWED
                            </span>
                          )}
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
                              {formatCurrencyValue(group.maxMargin, activeCurrency, group.bestRoute?.isFlatFee)}
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
        </>
      )}

      {/* Grouped University Routes Pop-Up Modal */}
      <GroupRoutesModal
        group={activeGroupRate}
        currency={activeCurrency}
        onClose={() => setActiveGroupRate(null)}
        onEdit={onEditRate}
        onShare={setSharingRate}
        onOpenDetail={(uniName) => setSelectedUniversityDetailName(uniName)}
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

      {/* 21-Field University Detail Modal */}
      <UniversityDetailModal
        isOpen={!!selectedUniversityDetailName}
        onClose={() => setSelectedUniversityDetailName(null)}
        universityName={selectedUniversityDetailName || ''}
        defaultIntake={defaultIntake}
        onSetDefaultIntake={async (intakeName) => {
          await updateDefaultIntake(intakeName, user?.email || 'admin@basechan.com');
        }}
        ratesForUniversity={useMemo(
          () => data.filter((r) => r.universityName === selectedUniversityDetailName),
          [data, selectedUniversityDetailName]
        )}
        onSaveUniversity={handleSaveUniversityRecord}
        onDeleteUniversity={handleDeleteUniversityRecord}
      />
    </div>
  );
};
