import React, { useMemo, useState, useEffect } from 'react';
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
import { BatchActionBar } from './BatchActionBar';
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
  Layers,
  Download,
  Printer,
  Globe,
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Focus (Green)</span>
        </span>
      );
    }
    if (g === 'DO_NOT_USE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>Do Not Use</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <Check className="w-3 h-3 text-slate-500 dark:text-slate-400" />
        <span>Allowed</span>
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
        className="group hover:opacity-80 transition cursor-pointer flex items-center gap-1 focus:outline-hidden"
      >
        {renderBadge()}
        <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 text-xs"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Change Status:
          </div>

          <button
            onClick={() => handleUpdateStatus('FOCUS')}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-semibold transition cursor-pointer ${
              g === 'FOCUS'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Focus (Green)
            </span>
            {g === 'FOCUS' && <span>✓</span>}
          </button>

          <button
            onClick={() => handleUpdateStatus('ALLOWED')}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition cursor-pointer ${
              g === 'ALLOWED'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              Allowed
            </span>
            {g === 'ALLOWED' && <span>✓</span>}
          </button>

          <button
            onClick={() => handleUpdateStatus('DO_NOT_USE')}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-semibold transition cursor-pointer ${
              g === 'DO_NOT_USE'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
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
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);

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

  const columns = useMemo<ColumnDef<CommissionRate, any>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => {
          // Check selection state across ALL filtered rows (not just the current paginated page)
          const isAllSelected = table.getIsAllRowsSelected();
          const isSomeSelected = table.getIsSomeRowsSelected();

          return (
            <div className="flex items-center justify-center" title="Select all filtered rows">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !isAllSelected && isSomeSelected;
                }}
                onChange={table.getToggleAllRowsSelectedHandler()}
                aria-label="Select all filtered rows"
              />
            </div>
          );
        },
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
    [onEditRate]
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

  // Helper to select ALL filtered rows with one click
  const handleSelectAllFiltered = () => {
    const newSelection: RowSelectionState = {};
    filteredData.forEach((row) => {
      newSelection[row.id] = true;
    });
    setRowSelection(newSelection);
  };

  const isAllFilteredSelected = selectedRates.length === filteredData.length && filteredData.length > 0;

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
      {/* Search & Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        {/* Quick Filter Presets Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold pb-1 border-b border-slate-100 dark:border-slate-800">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1">Quick Presets:</span>

          <button
            type="button"
            onClick={() => setSelectedGuidance(selectedGuidance === 'FOCUS' ? 'ALL' : 'FOCUS')}
            className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
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
            className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
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
            className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
              selectedLevel === 'UG'
                ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
            }`}
          >
            <span>UG Routes</span>
          </button>

          {(searchQuery || selectedIntake !== 'ALL' || selectedLevel !== 'ALL' || selectedCountry !== 'ALL' || selectedAggregator !== 'ALL' || selectedGuidance !== 'ALL') && (
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
              className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ml-auto text-[11px]"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search universities (e.g. Aberdeen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Controls & Batch Actions Trigger */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* Prominent Header Action / Batch Action Dropdown Trigger when items are selected */}
          {selectedRates.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsBatchMenuOpen(!isBatchMenuOpen)}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-lg shadow-sm transition cursor-pointer animate-in fade-in"
              >
                <Layers className="w-4 h-4" />
                <span>
                  {selectedRates.length === filteredData.length
                    ? `All ${selectedRates.length} Filtered Selected`
                    : `Batch Actions (${selectedRates.length} Selected)`}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {isBatchMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setIsBatchMenuOpen(false)}
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {selectedRates.length === filteredData.length
                      ? `All ${selectedRates.length} Filtered Items Selected`
                      : `Batch Actions (${selectedRates.length} Selected)`}
                  </div>

                  {!isAllFilteredSelected && (
                    <button
                      onClick={() => {
                        handleSelectAllFiltered();
                        setIsBatchMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-xl flex items-center gap-2 transition cursor-pointer border border-emerald-200 dark:border-emerald-800"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Select All {filteredData.length} Filtered Rates</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      handleBatchSetGuidance('FOCUS');
                      setIsBatchMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl flex items-center gap-2 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Set Focus (In the Green)</span>
                  </button>

                  <button
                    onClick={() => {
                      handleBatchSetGuidance('DO_NOT_USE');
                      setIsBatchMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl flex items-center gap-2 transition cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Set Do Not Use (Reject)</span>
                  </button>

                  <button
                    onClick={() => {
                      handleBatchSetGuidance('ALLOWED');
                      setIsBatchMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 transition cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Set Allowed (Standard)</span>
                  </button>

                  <hr className="my-1 border-slate-100 dark:border-slate-800" />

                  <button
                    onClick={() => {
                      if (selectedRates.length === 1) {
                        onEditRate(selectedRates[0]);
                      } else {
                        setIsBatchEditOpen(true);
                      }
                      setIsBatchMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl flex items-center gap-2 transition cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>
                      {selectedRates.length === 1 ? 'Edit Rate & Guidance' : 'Batch Edit Fields'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      handleDeleteSelected();
                      setIsBatchMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl flex items-center gap-2 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>
                      {selectedRates.length === 1 ? 'Delete Record' : 'Delete Selected Records'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setRowSelection({});
                      setIsBatchMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 transition cursor-pointer"
                  >
                    <X className="w-4 h-4 shrink-0" />
                    <span>Deselect ({selectedRates.length})</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* School Guidance Filter */}
          <select
            value={selectedGuidance}
            onChange={(e) => setSelectedGuidance(e.target.value as SchoolGuidance | 'ALL')}
            className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Guidance Statuses</option>
            <option value="FOCUS">🟢 Focus / Preferred (In the Green)</option>
            <option value="ALLOWED">🔵 Allowed (Standard)</option>
            <option value="DO_NOT_USE">🔴 Do Not Use / Avoid</option>
          </select>

          {/* Intake Filter */}
          <select
            value={selectedIntake}
            onChange={(e) => setSelectedIntake(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Intakes</option>
            {intakes.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>

          {/* Study Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as StudyLevel | 'ALL')}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Levels</option>
            <option value="UG">Undergraduate (UG)</option>
            <option value="PG">Postgraduate (PG)</option>
            <option value="FD">Foundation (FD)</option>
          </select>

          {/* Aggregator Filter */}
          <select
            value={selectedAggregator}
            onChange={(e) => setSelectedAggregator(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
          >
            <option value="ALL">All Aggregators</option>
            {aggregators.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {/* Export & Print Buttons */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => exportToExcel(filteredData, 'Basechan_Master_Rates.xlsx')}
              title="Export Filtered Rates to Excel"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => printSchedule(filteredData, 'Basechan Master Commission Schedule')}
              title="Print Filtered Schedule"
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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
                      row.getIsSelected() ? 'bg-emerald-50/40 dark:bg-emerald-950/40' : ''
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

        {/* Pagination & Status Footer */}
        <div className="px-5 py-3.5 bg-slate-50/60 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
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
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
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
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Batch Actions Bar */}
      <BatchActionBar
        selectedCount={selectedRates.length}
        onBatchEdit={() => setIsBatchEditOpen(true)}
        onDeselectAll={() => setRowSelection({})}
        onDeleteSelected={handleDeleteSelected}
        onBatchSetGuidance={handleBatchSetGuidance}
        loading={batchActionLoading}
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
