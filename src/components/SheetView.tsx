import React, { useMemo } from 'react';
import type { CommissionRate } from '../types';
import { MasterTable } from './MasterTable';
import {
  Building2,
  Layers,
  RefreshCw,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';

interface SheetViewProps {
  sheetName: string;
  rates: CommissionRate[];
  loading: boolean;
  onEditRate: (rate: CommissionRate) => void;
}

export const SheetView: React.FC<SheetViewProps> = ({ sheetName, rates, loading, onEditRate }) => {
  const filteredRates = useMemo(() => {
    return rates.filter(rate => rate.sourceSheet === sheetName);
  }, [rates, sheetName]);

  // KPI Calculations
  const totalUniversities = new Set(filteredRates.map((r) => r.universityId)).size;
  const bestMargin = filteredRates.length > 0 ? Math.max(...filteredRates.map((r) => r.diffMargin)) : 0;
  const averageMargin =
    filteredRates.length > 0
      ? (
          filteredRates.reduce((sum, r) => sum + (r.isFlatFee ? 0 : r.diffMargin), 0) /
          (filteredRates.filter((r) => !r.isFlatFee).length || 1)
        ).toFixed(1)
      : '0';

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{sheetName}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Filtered view for this specific sheet data.</p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rates In Sheet
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {filteredRates.length}
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Institutions
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {totalUniversities}
            </p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Top Margin
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              +{bestMargin > 0 ? `${bestMargin}%` : '0%'}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg % Margin
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              +{averageMargin}%
            </p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
            <RefreshCw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Master Intelligence Table */}
      <section>
        <MasterTable
          data={filteredRates}
          loading={loading}
          onEditRate={onEditRate}
        />
      </section>
    </>
  );
};
