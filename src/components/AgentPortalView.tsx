import React, { useMemo, useState } from 'react';
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
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Award,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Check,
  Download,
  Printer,
} from 'lucide-react';

interface AgentPortalViewProps {
  rates: CommissionRate[];
  loading: boolean;
}

export const AgentPortalView: React.FC<AgentPortalViewProps> = ({ rates, loading }) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'universityName', desc: false },
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIntake, setSelectedIntake] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<StudyLevel | 'ALL'>('ALL');
  const [selectedGuidance, setSelectedGuidance] = useState<SchoolGuidance | 'ALL'>('ALL');

  // Total partner universities
  const totalUniversities = useMemo(() => {
    return new Set(rates.map((r) => r.universityName)).size;
  }, [rates]);

  const focusCount = useMemo(() => {
    return rates.filter((r) => r.guidance === 'FOCUS').length;
  }, [rates]);

  const restrictedCount = useMemo(() => {
    return rates.filter((r) => r.guidance === 'DO_NOT_USE').length;
  }, [rates]);

  // Unique options for filter dropdowns
  const intakes = useMemo(() => {
    const set = new Set(rates.map((r) => r.intake).filter(Boolean));
    return Array.from(set).sort();
  }, [rates]);

  // Fuzzy match search
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
                <span>Focus / Preferred (In the Green)</span>
              </span>
            );
          }
          if (g === 'DO_NOT_USE') {
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Do Not Use / Avoid</span>
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
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-400/30">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Agent Portal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Commission Rates</h1>
          <p className="text-emerald-100/80 text-xs sm:text-sm leading-relaxed">
            Find universities, study levels, and your guaranteed commission rates set by Basechan International.
          </p>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Listed Partner Institutions
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {totalUniversities}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Focus Schools (In the Green)
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {focusCount}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Restricted / Avoid
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">
              {restrictedCount}
            </p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search school name (e.g. Aberdeen, Leicester)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={selectedGuidance}
            onChange={(e) => setSelectedGuidance(e.target.value as SchoolGuidance | 'ALL')}
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Guidance Statuses</option>
            <option value="FOCUS">🟢 Focus Schools Only (In the Green)</option>
            <option value="ALLOWED">🔵 Allowed (Standard)</option>
            <option value="DO_NOT_USE">🔴 Do Not Use / Avoid</option>
          </select>

          <select
            value={selectedIntake}
            onChange={(e) => setSelectedIntake(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Levels</option>
            <option value="UG">Undergraduate (UG)</option>
            <option value="PG">Postgraduate (PG)</option>
            <option value="FD">Foundation (FD)</option>
          </select>

          {/* Export & Print Buttons */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => exportToExcel(filteredRates, 'Basechan_Agent_Commission_Schedule.xlsx')}
              title="Export Agent Schedule to Excel"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => printSchedule(filteredRates, 'Basechan Partner Agent Commission Schedule')}
              title="Print Agent Schedule"
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 bg-slate-50/60 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredRates.length}</span> out of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{rates.length}</span> rates
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
              Page <span className="font-semibold text-slate-700 dark:text-slate-300">{table.getState().pagination.pageIndex + 1}</span> of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{table.getPageCount() || 1}</span>
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
    </div>
  );
};
