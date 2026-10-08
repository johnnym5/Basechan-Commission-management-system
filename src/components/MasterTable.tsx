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
import { BatchEditModal } from './BatchEditModal';
import { doc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { exportToExcel, printSchedule } from '../utils/exportUtils';
import {
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  Pencil,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Check,
  ChevronDown,
  Trash2,
  X,
  Download,
  Printer,
  Globe,
  LayoutGrid,
  TableProperties,
} from 'lucide-react';

interface MasterTableProps {
  data: CommissionRate[];
  loading: boolean;
  onEditRate: (rate: CommissionRate) => void;
  onBatchActionComplete?: (msg: string) => void;
  externalSearchQuery?: string;
  onExternalSearchChange?: (q: string) => void;
  externalGuidanceFilter?: SchoolGuidance | 'ALL';
  onExternalGuidanceChange?: (g: SchoolGuidance | 'ALL') => void;
  externalAggregatorFilter?: string;
  onExternalAggregatorChange?: (agg: string) => void;
}

// Interactive School Status Cell for Admin Users
const SchoolStatusCell: React.FC<{ rate: CommissionRate }> = ({ rate }) => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const [isOpen, setIsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const g = rate.guidance || 'ALLOWED';

  const handleUpdateStatus = async (newGuidance: SchoolGuidance) => {
    setIsOpen(false);
    if (newGuidance === g) return;
    try {
      setUpdating(true);
      const rateRef = doc(db, 'rates', rate.id);
      await updateDoc(rateRef, { guidance: newGuidance, updatedAt: new Date().toISOString() });
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
            className={`w-full text-left px-2 py-1 rounded-lg flex items-center justify-between font-semibold transition cursor-pointer text-[11px] ${
              g === 'FOCUS'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Focus (Green)
            </span>
            {g === 'FOCUS' && <span>✓</span>}
          </button>

          <button
            onClick={() => handleUpdateStatus('ALLOWED')}
            className={`w-full text-left px-2 py-1 rounded-lg flex items-center justify-between font-medium transition cursor-pointer text-[11px] ${
              g === 'ALLOWED'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              Allowed
            </span>
            {g === 'ALLOWED' && <span>✓</span>}
          </button>

          <button
            onClick={() => handleUpdateStatus('DO_NOT_USE')}
            className={`w-full text-left px-2 py-1 rounded-lg flex items-center justify-between font-semibold transition cursor-pointer text-[11px] ${
              g === 'DO_NOT_USE'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              Do Not Use
            </span>
            {g === 'DO_NOT_USE' && <span>✓</span>}
          </button>
        </div>
      )}
    </div>
  );
};

// Adaptive, Redesigned Viewport-Bound Pop-Up Modal using React Portal with Smooth Ease In/Out Animation
const RateDetailModal: React.FC<{
  rate: CommissionRate | null;
  currentIndex: number | null;
  totalCount: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEdit: (rate: CommissionRate) => void;
}> = ({ rate, currentIndex, totalCount, onClose, onPrev, onNext, onEdit }) => {
  // Lock body scroll ONLY when modal is active with a valid rate
  useEffect(() => {
    if (!rate || currentIndex === null) return;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [rate, currentIndex]);

  // Keyboard Navigation: ArrowLeft (Prev), ArrowRight (Next), Escape (Close)
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
          {/* Status Row */}
          <div className="p-3 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43] flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs">School Guidance Status:</span>
            <SchoolStatusCell rate={rate} />
          </div>

          {/* Profit Margin Highlight Card */}
          <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                Profit Margin Yield (DIFF)
              </span>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 font-medium">
                Calculated net yield after agent payout
              </p>
            </div>
            <span className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-amber-400 shrink-0">
              +{rate.diffMargin}{rate.isFlatFee ? '£' : '%'}
            </span>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Intake</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs truncate block mt-0.5">{rate.intake}</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Level</span>
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs block mt-0.5">{rate.studyLevel}</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Route</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs truncate block mt-0.5">{rate.aggregator}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Master Rate (Incoming)</span>
              <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm block mt-0.5">
                {rate.isFlatFee ? `£${rate.masterRate.toLocaleString()}` : `${rate.masterRate}%`}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Agent Rate (Outgoing)</span>
              <span className="font-mono font-extrabold text-slate-600 dark:text-slate-300 text-xs sm:text-sm block mt-0.5">
                {rate.isFlatFee ? `£${rate.agentRate.toLocaleString()}` : `${rate.agentRate}%`}
              </span>
            </div>
          </div>

          {/* Notes & Sheet Source */}
          {rate.notes && (
            <div className="p-3 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43] space-y-1">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Notes:</span>
              <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed">{rate.notes}</p>
            </div>
          )}

          {rate.sourceSheet && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              Source Sheet: {rate.sourceSheet} {rate.sourceRow ? `(Row ${rate.sourceRow})` : ''}
            </div>
          )}

          {/* Edit Action Button */}
          <div className="pt-1">
            <button
              onClick={() => {
                onClose();
                onEdit(rate);
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 dark:bg-amber-400 dark:hover:bg-amber-500 text-white dark:text-slate-950 font-extrabold text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Full Rate Details</span>
            </button>
          </div>
        </div>

        {/* Sticky Footer Navigation Bar with Previous & Next Buttons */}
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

export const MasterTable: React.FC<MasterTableProps> = ({
  data,
  loading,
  onEditRate,
  onBatchActionComplete,
  externalSearchQuery,
  onExternalSearchChange,
  externalGuidanceFilter,
  onExternalGuidanceChange,
  externalAggregatorFilter,
  onExternalAggregatorChange,
}) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'diffMargin', desc: true }, // Default: sort highest margin first
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);

  // View Mode State: 'grid' or 'table' (Default to 'grid', Mobile is locked on 'grid')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter Popover Drawer State
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  // Active detail modal index for mobile cards view
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);

  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const [selectedIntake, setSelectedIntake] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<StudyLevel | 'ALL'>('ALL');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [internalGuidanceFilter, setInternalGuidanceFilter] = useState<SchoolGuidance | 'ALL'>('ALL');
  const [internalAggregatorFilter, setInternalAggregatorFilter] = useState<string>('ALL');
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

  // Active Filter Count Calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGuidance !== 'ALL') count++;
    if (selectedIntake !== 'ALL') count++;
    if (selectedLevel !== 'ALL') count++;
    if (selectedCountry !== 'ALL') count++;
    if (selectedAggregator !== 'ALL') count++;
    return count;
  }, [selectedGuidance, selectedIntake, selectedLevel, selectedCountry, selectedAggregator]);

  // Sync state if external props change
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setInternalSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  useEffect(() => {
    if (externalGuidanceFilter !== undefined) {
      setInternalGuidanceFilter(externalGuidanceFilter);
    }
  }, [externalGuidanceFilter]);

  useEffect(() => {
    if (externalAggregatorFilter !== undefined) {
      setInternalAggregatorFilter(externalAggregatorFilter);
    }
  }, [externalAggregatorFilter]);

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

  // Multi-attribute fuzzy search helper
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

  // Client-side filtering logic with fuzzy search
  const filteredData = useMemo(() => {
    return data.filter((row) => {
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
  }, [data, searchQuery, selectedIntake, selectedLevel, selectedCountry, selectedAggregator, selectedGuidance]);

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
      // Deselect all filtered rows
      const newSelection = { ...rowSelection };
      filteredData.forEach((row) => {
        delete newSelection[row.id];
      });
      setRowSelection(newSelection);
    } else {
      // Select ALL filtered rows
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
          <div className="flex items-center justify-center" title={`Select all ${filteredData.length} filtered rows`}>
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
          const hasColor = row.rowColor && row.rowColor !== '-' && row.rowColor !== '#FFFFFF';
          return (
            <div className="flex items-center gap-2">
              {hasColor && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-300 dark:border-slate-700 shadow-2xs"
                  style={{ backgroundColor: row.rowColor }}
                  title={`Row Color: ${row.rowColor}`}
                />
              )}
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
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
        cell: (info) => {
          const lvl = info.getValue() as string;
          const badgeClass =
            lvl === 'PG'
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
              : lvl === 'UG'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${badgeClass}`}
            >
              {lvl}
            </span>
          );
        },
      },
      {
        accessorKey: 'aggregator',
        header: 'Aggregator',
        cell: (info) => (
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs tracking-wide">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'masterRate',
        header: 'Master Rate',
        cell: (info) => {
          const row = info.row.original;
          const val = info.getValue() as number;
          return (
            <span className="font-mono text-slate-800 dark:text-slate-200 text-sm font-semibold">
              {row.isFlatFee ? `£${val.toLocaleString()}` : `${val}%`}
            </span>
          );
        },
      },
      {
        accessorKey: 'agentRate',
        header: 'Agent Rate',
        cell: (info) => {
          const row = info.row.original;
          const val = info.getValue() as number;
          return (
            <span className="font-mono text-slate-600 dark:text-slate-400 text-sm">
              {row.isFlatFee ? `£${val.toLocaleString()}` : `${val}%`}
            </span>
          );
        },
      },
      {
        accessorKey: 'diffMargin',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Profit Margin
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500" />
          </button>
        ),
        cell: (info) => {
          const row = info.row.original;
          const diff = info.getValue() as number;
          const isPositive = diff > 0;
          const isNegative = diff < 0;

          return (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                isPositive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : isNegative
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isPositive ? '+' : ''}
              {row.isFlatFee ? `£${diff.toLocaleString()}` : `${diff}%`}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <button
            onClick={() => onEditRate(info.row.original)}
            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition cursor-pointer"
            title="Edit Rate & Guidance"
          >
            <Pencil className="w-4 h-4" />
          </button>
        ),
      },
    ],
    [onEditRate, isAllFilteredSelected, isSomeFilteredSelected, handleToggleAllFiltered]
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

  // Selected rates across all selections
  const selectedRates = useMemo(() => {
    return data.filter((rate) => rowSelection[rate.id]);
  }, [rowSelection, data]);

  // Detail Pop-up Navigation Helpers
  const activeDetailRate = activeDetailIndex !== null && filteredData[activeDetailIndex]
    ? filteredData[activeDetailIndex]
    : null;

  const handlePrevDetail = () => {
    setActiveDetailIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
  };

  const handleNextDetail = () => {
    setActiveDetailIndex((prev) => (prev !== null ? Math.min(filteredData.length - 1, prev + 1) : null));
  };

  // Batch delete handler
  const handleDeleteSelected = async () => {
    if (selectedRates.length === 0) return;
    try {
      setBatchActionLoading(true);
      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(selectedRates.length / BATCH_SIZE);
      for (let b = 0; b < totalBatches; b++) {
        const chunk = selectedRates.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((rate) => {
          batch.delete(doc(db, 'rates', rate.id));
        });
        await batch.commit();
      }
      const count = selectedRates.length;
      setRowSelection({});
      if (onBatchActionComplete) {
        onBatchActionComplete(`Successfully deleted ${count} selected rates.`);
      }
    } catch (err) {
      console.error('Batch delete error:', err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Batch status guidance update handler (Focus, Do Not Use, Allowed)
  const handleBatchSetGuidance = async (guidance: SchoolGuidance) => {
    if (selectedRates.length === 0) return;
    try {
      setBatchActionLoading(true);
      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(selectedRates.length / BATCH_SIZE);
      for (let b = 0; b < totalBatches; b++) {
        const chunk = selectedRates.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((rate) => {
          const rateRef = doc(db, 'rates', rate.id);
          batch.update(rateRef, { guidance, updatedAt: new Date().toISOString() });
        });
        await batch.commit();
      }
      const count = selectedRates.length;
      setRowSelection({});
      if (onBatchActionComplete) {
        const statusLabel =
          guidance === 'FOCUS'
            ? 'Focus / Preferred (In the Green)'
            : guidance === 'DO_NOT_USE'
            ? 'Do Not Use / Avoid (Reject)'
            : 'Allowed (Standard)';
        onBatchActionComplete(`Successfully set guidance status to "${statusLabel}" for ${count} selected items.`);
      }
    } catch (err) {
      console.error('Batch guidance update error:', err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchUpdated = (count: number) => {
    setRowSelection({});
    if (onBatchActionComplete) {
      onBatchActionComplete(`Successfully updated ${count} commission rates.`);
    }
  };

  return (
    <div id="master-intelligence-table-container" className="space-y-4">
      {/* Ultra-Slim Search & Filter Control Bar (44px height) */}
      <div className="bg-white dark:bg-[#0E1526] p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs flex items-center gap-2 transition-colors relative">
        {/* Unified Search Box with Embedded Filter Trigger */}
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search universities (e.g. Aberdeen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm border border-slate-200 dark:border-[#222F43] rounded-xl bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-amber-400 focus:bg-white dark:focus:bg-[#18181B] transition"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}

            {/* Embedded Filter Icon Button */}
            <button
              type="button"
              onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
              title="Toggle Detailed Filters"
              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 relative ${
                activeFilterCount > 0 || isFilterPopoverOpen
                  ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 border-blue-600 dark:border-amber-400 font-bold shadow-2xs'
                  : 'bg-white dark:bg-[#0E1526] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800'
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

        {/* Icon-Only Quick Action Buttons (Export, Print, View Switcher) */}
        <div className="flex items-center gap-1 shrink-0 border-l border-slate-100 dark:border-[#222F43] pl-1.5 sm:pl-2">
          {/* Desktop View Switcher Icons */}
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

          {/* Export Excel Icon */}
          <button
            type="button"
            onClick={() => exportToExcel(filteredData, 'Basechan_Master_Rates.xlsx')}
            title="Export Filtered Rates to Excel"
            className="p-2 rounded-xl border border-slate-200 dark:border-[#222F43] bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Print Icon */}
          <button
            type="button"
            onClick={() => printSchedule(filteredData, 'Basechan Master Commission Schedule')}
            title="Print Filtered Schedule"
            className="p-2 rounded-xl border border-slate-200 dark:border-[#222F43] bg-white dark:bg-[#0E1526] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        {/* Detailed Filters Popover Dropdown (Opens when clicking Filter button inside Search) */}
        {isFilterPopoverOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#F7F4EF] dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#222F43]">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-amber-400" />
                <span>Detailed Search Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-blue-100 dark:bg-amber-950/80 text-blue-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full text-[10px]">
                    {activeFilterCount} Active
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={() => setIsFilterPopoverOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Quick Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGuidance(selectedGuidance === 'FOCUS' ? 'ALL' : 'FOCUS')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 font-semibold ${
                    selectedGuidance === 'FOCUS'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-2xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Focus Schools</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLevel(selectedLevel === 'PG' ? 'ALL' : 'PG')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 font-semibold ${
                    selectedLevel === 'PG'
                      ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-2xs'
                      : 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                  }`}
                >
                  <span>PG Routes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLevel(selectedLevel === 'UG' ? 'ALL' : 'UG')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 font-semibold ${
                    selectedLevel === 'UG'
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                  }`}
                >
                  <span>UG Routes</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
              {/* Guidance Status */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Guidance Status</label>
                <select
                  value={selectedGuidance}
                  onChange={(e) => setSelectedGuidance(e.target.value as SchoolGuidance | 'ALL')}
                  className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-amber-400"
                >
                  <option value="ALL">All Guidance Statuses</option>
                  <option value="FOCUS">🟢 Focus / Preferred</option>
                  <option value="ALLOWED">🔵 Allowed (Standard)</option>
                  <option value="DO_NOT_USE">🔴 Do Not Use / Avoid</option>
                </select>
              </div>

              {/* Intake */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Intake</label>
                <select
                  value={selectedIntake}
                  onChange={(e) => setSelectedIntake(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ALL">All Intakes</option>
                  {intakes.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>

              {/* Level */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Study Level</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value as StudyLevel | 'ALL')}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ALL">All Levels</option>
                  <option value="UG">Undergraduate (UG)</option>
                  <option value="PG">Postgraduate (PG)</option>
                  <option value="FD">Foundation (FD)</option>
                </select>
              </div>

              {/* Country */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Country</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ALL">All Countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aggregator */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Aggregator</label>
                <select
                  value={selectedAggregator}
                  onChange={(e) => setSelectedAggregator(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ALL">All Aggregators</option>
                  {aggregators.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset & Done Footer Bar */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#222F43] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedIntake('ALL');
                  setSelectedLevel('ALL');
                  setSelectedCountry('ALL');
                  setSelectedAggregator('ALL');
                  setSelectedGuidance('ALL');
                }}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>

              <button
                type="button"
                onClick={() => setIsFilterPopoverOpen(false)}
                className="px-4 py-1.5 bg-blue-600 dark:bg-amber-400 hover:bg-blue-700 dark:hover:bg-amber-500 text-white dark:text-slate-950 font-bold rounded-xl transition shadow-2xs cursor-pointer"
              >
                Apply & Close
              </button>
            </div>
          </div>
        )}
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

        {/* Right: Inline Batch Action Controls (Appears when items are selected) */}
        {selectedRates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Set Focus (Green) */}
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

            {/* Set Do Not Use */}
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

            {/* Set Allowed */}
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

            {/* Batch Edit */}
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
              title="Batch Edit Selected Records"
              className="px-2.5 py-1.5 bg-blue-600 dark:bg-amber-400 hover:bg-blue-700 dark:hover:bg-amber-500 text-white dark:text-slate-950 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Batch Edit</span>
            </button>

            {/* Delete Selected */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={batchActionLoading}
              title="Delete Selected Records"
              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Clear Selection */}
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
            Check any school card to trigger batch actions
          </span>
        )}
      </div>

      {/* GRID CARDS VIEW (3 Cards per row on ALL screens including mobile) */}
      {(viewMode === 'grid' || window.innerWidth < 768) && (
        <div className="space-y-3">
          {/* Grid Cards Container - EXACTLY 3 Cards Per Row on Mobile/Tablet (`grid-cols-3`) */}
          {table.getRowModel().rows.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E1526] rounded-xl border border-slate-200 dark:border-[#222F43] text-xs">
              No matching schools found.
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-1.5 sm:gap-2.5">
              {table.getRowModel().rows.map((row) => {
                const rate = row.original;
                const isSelected = row.getIsSelected();
                const globalIndex = filteredData.findIndex((r) => r.id === rate.id);

                return (
                  <div
                    key={rate.id}
                    onClick={() => setActiveDetailIndex(globalIndex !== -1 ? globalIndex : 0)}
                    className={`p-2 sm:p-3 rounded-xl border transition-all duration-150 cursor-pointer relative flex flex-col justify-between gap-1.5 select-none ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-amber-950/60 border-blue-500 dark:border-amber-400 shadow-sm ring-1 ring-blue-500/30'
                        : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Checkbox & Color Dot */}
                    <div className="flex items-center justify-between gap-1">
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      >
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-slate-300 dark:border-[#222F43] text-blue-600 dark:text-amber-400 focus:ring-blue-500 cursor-pointer"
                          checked={isSelected}
                          onChange={row.getToggleSelectedHandler()}
                          aria-label={`Select ${rate.universityName}`}
                        />
                      </div>

                      {rate.rowColor && rate.rowColor !== '-' && rate.rowColor !== '#FFFFFF' && (
                        <span
                          className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 border border-slate-300 shadow-2xs"
                          style={{ backgroundColor: rate.rowColor }}
                        />
                      )}
                    </div>

                    {/* Main School Content (Ultra-Compact for 3-card mobile layout) */}
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-[10px] sm:text-xs leading-snug line-clamp-2 break-words">
                        {rate.universityName}
                      </h3>

                      {rate.country && (
                        <p className="text-[9px] sm:text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5 truncate">
                          <Globe className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{rate.country}</span>
                        </p>
                      )}
                    </div>

                    {/* Bottom Row: Status Badge & Details Indicator */}
                    <div className="pt-1 border-t border-slate-100 dark:border-[#222F43] flex flex-col gap-1">
                      <div onClick={(e) => e.stopPropagation()}>
                        <SchoolStatusCell rate={rate} />
                      </div>

                      <span className="text-[9px] text-slate-400 dark:text-slate-400 font-medium text-right block">
                        Details →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DESKTOP/TABLET TABLE VIEW (Visible when viewMode === 'table' on desktop/tablet) */}
      {viewMode === 'table' && (
        <div className="hidden md:block bg-white dark:bg-[#0E1526] rounded-xl border border-slate-200 dark:border-[#222F43] shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#F7F4EF] dark:bg-[#18181B] border-b border-slate-200 dark:border-[#222F43] text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3.5">
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
                        <div className="w-6 h-6 border-2 border-blue-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading commission data from Firestore...</span>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                      <p className="font-medium text-slate-600 dark:text-slate-300">No matching commission rates</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Try clearing filters or search query.
                      </p>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition duration-100 ${
                        row.getIsSelected() ? 'bg-blue-50/40 dark:bg-amber-950/40' : ''
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3.5">
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

      {/* Pagination & Status Footer */}
      <div className="px-5 py-3.5 bg-white dark:bg-[#0E1526] rounded-xl border border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Showing{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {filteredData.length}
          </span>{' '}
          out of{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{data.length}</span>{' '}
          {searchQuery || selectedIntake !== 'ALL' || selectedLevel !== 'ALL' || selectedCountry !== 'ALL' || selectedAggregator !== 'ALL' || selectedGuidance !== 'ALL'
            ? `(filtered from ${data.length} total rows)`
            : 'total rows'}
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
            Page{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {table.getState().pagination.pageIndex + 1}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {table.getPageCount() || 1}
            </span>
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

      {/* Full Rate Details Pop-Up Modal - Fixed & Non-Scrolling using React Portal */}
      <RateDetailModal
        rate={activeDetailRate}
        currentIndex={activeDetailIndex}
        totalCount={filteredData.length}
        onClose={() => setActiveDetailIndex(null)}
        onPrev={handlePrevDetail}
        onNext={handleNextDetail}
        onEdit={onEditRate}
      />

      {/* Batch Edit Modal */}
      <BatchEditModal
        isOpen={isBatchEditOpen}
        onClose={() => setIsBatchEditOpen(false)}
        selectedRates={selectedRates}
        onBatchUpdated={handleBatchUpdated}
      />
    </div>
  );
};
