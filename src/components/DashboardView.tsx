import React, { useMemo, useState } from 'react';
import type { CommissionRate, SchoolGuidance } from '../types';
import { MasterTable } from './MasterTable';
import {
  Building2,
  Layers,
  RefreshCw,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Globe,
  Filter,
  X,
  Check,
  Layers3,
} from 'lucide-react';

interface DashboardViewProps {
  rates: CommissionRate[];
  loading: boolean;
  onEditRate: (rate: CommissionRate) => void;
}

interface AggregatorStat {
  name: string;
  count: number;
  avgDiff: number;
  topUni: string;
  topUniMargin: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ rates, loading, onEditRate }) => {
  // Active Filter states passed down to MasterTable
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const [activeGuidanceFilter, setActiveGuidanceFilter] = useState<SchoolGuidance | 'ALL'>('ALL');
  const [activeAggregatorFilter, setActiveAggregatorFilter] = useState<string>('ALL');

  // Helper to scroll smoothly to the table
  const scrollToTable = () => {
    const tableEl = document.getElementById('master-intelligence-table-container');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFilterBySchool = (schoolName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveSearchQuery(schoolName);
    scrollToTable();
  };

  const handleFilterByGuidance = (guidance: SchoolGuidance) => {
    if (activeGuidanceFilter === guidance) {
      setActiveGuidanceFilter('ALL');
    } else {
      setActiveGuidanceFilter(guidance);
      scrollToTable();
    }
  };

  const handleFilterByAggregator = (aggName: string) => {
    if (activeAggregatorFilter === aggName) {
      setActiveAggregatorFilter('ALL');
    } else {
      setActiveAggregatorFilter(aggName);
      scrollToTable();
    }
  };

  const handleClearAllFilters = () => {
    setActiveSearchQuery('');
    setActiveGuidanceFilter('ALL');
    setActiveAggregatorFilter('ALL');
  };

  // KPI Calculations
  const totalUniversities = useMemo(() => new Set(rates.map((r) => r.universityId)).size, [rates]);
  const totalCountries = useMemo(() => new Set(rates.map((r) => r.country || 'UK')).size, [rates]);

  const bestRate = useMemo(() => {
    if (rates.length === 0) return null;
    return rates.reduce((prev, curr) => (curr.diffMargin > prev.diffMargin ? curr : prev), rates[0]);
  }, [rates]);

  const averageMargin = useMemo(() => {
    const percentRates = rates.filter((r) => !r.isFlatFee);
    if (percentRates.length === 0) return '0.0';
    const total = percentRates.reduce((acc, r) => acc + r.diffMargin, 0);
    return (total / percentRates.length).toFixed(1);
  }, [rates]);

  // Guidance status counts
  const focusCount = useMemo(() => rates.filter((r) => r.guidance === 'FOCUS').length, [rates]);
  const restrictedCount = useMemo(() => rates.filter((r) => r.guidance === 'DO_NOT_USE').length, [rates]);
  const allowedCount = useMemo(() => rates.filter((r) => !r.guidance || r.guidance === 'ALLOWED').length, [rates]);

  // Aggregator Breakdown Analytics
  const aggregatorStats = useMemo<AggregatorStat[]>(() => {
    const map = new Map<string, CommissionRate[]>();
    rates.forEach((r) => {
      const agg = r.aggregator || 'Direct / Other';
      if (!map.has(agg)) map.set(agg, []);
      map.get(agg)!.push(r);
    });

    const stats: AggregatorStat[] = [];
    map.forEach((items, aggName) => {
      const percentItems = items.filter((i) => !i.isFlatFee);
      const avgDiff =
        percentItems.length > 0
          ? parseFloat((percentItems.reduce((s, i) => s + i.diffMargin, 0) / percentItems.length).toFixed(1))
          : 0;

      const topItem = items.reduce((prev, curr) => (curr.diffMargin > prev.diffMargin ? curr : prev), items[0]);

      stats.push({
        name: aggName,
        count: items.length,
        avgDiff,
        topUni: topItem?.universityName || 'N/A',
        topUniMargin: topItem?.diffMargin || 0,
      });
    });

    return stats.sort((a, b) => b.avgDiff - a.avgDiff).slice(0, 5);
  }, [rates]);

  return (
    <div className="space-y-8">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-slate-900 text-white p-6 sm:p-8 shadow-2xl border border-slate-800">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Basechan Commission Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              University Rates & Profit Margins
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Compare university commission rates against agent payouts to see your profit margins for each school and platform.
            </p>
          </div>

          {/* Quick Best Route Feature Pill - Clickable to filter for that school */}
          {bestRate && (
            <button
              onClick={() => handleFilterBySchool(bestRate.universityName)}
              title={`Click to filter table for ${bestRate.universityName}`}
              className="text-left bg-slate-800/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 hover:border-emerald-500/50 p-4 rounded-2xl flex flex-col justify-between gap-2 shrink-0 max-w-xs shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                <span className="flex items-center gap-1 text-amber-400">
                  <Award className="w-3.5 h-3.5" /> Best Profit Route
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  +{bestRate.diffMargin}{bestRate.isFlatFee ? '£' : '%'}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                  {bestRate.universityName}
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-200">{bestRate.aggregator}</span>
                  <span>{bestRate.intake} • {bestRate.studyLevel}</span>
                </p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Rates Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Rates Listed
            </span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {rates.length}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span className="text-blue-600 dark:text-blue-400 font-bold">Updated</span> from your Excel sheets
            </p>
          </div>
        </div>

        {/* Partner Institutions Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Universities
            </span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {totalUniversities}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <Globe className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              <span>{totalCountries} countries</span>
            </p>
          </div>
        </div>

        {/* Top Margin Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Highest Profit Margin
            </span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              +{bestRate ? `${bestRate.diffMargin}${bestRate.isFlatFee ? '£' : '%'}` : '0%'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 font-medium truncate">
              <ArrowUpRight className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
              <span className="truncate">{bestRate?.universityName || 'Best Route'}</span>
            </p>
          </div>
        </div>

        {/* Average Margin Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Average Profit Margin
            </span>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <RefreshCw className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              +{averageMargin}%
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span>Across percentage-based rates</span>
            </p>
          </div>
        </div>
      </div>

      {/* CONSOLIDATED SINGLE SECTION: Platform Earnings & School Priority Status */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Platform Earnings & School Priority Status
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click an Aggregator card to filter rates by platform, or click a status badge / school.
            </p>
          </div>

          {/* Clickable Guidance Filter Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => handleFilterByGuidance('FOCUS')}
              title="Click to filter for Focus Schools (Preferred)"
              className={`px-3 py-1 rounded-full border flex items-center gap-1 transition cursor-pointer ${
                activeGuidanceFilter === 'FOCUS'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{focusCount} Focus Schools (Preferred)</span>
            </button>

            <button
              onClick={() => handleFilterByGuidance('ALLOWED')}
              title="Click to filter for Allowed Schools"
              className={`px-3 py-1 rounded-full border transition cursor-pointer ${
                activeGuidanceFilter === 'ALLOWED'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{allowedCount} Allowed</span>
            </button>

            <button
              onClick={() => handleFilterByGuidance('DO_NOT_USE')}
              title="Click to filter for Do Not Use Schools"
              className={`px-3 py-1 rounded-full border flex items-center gap-1 transition cursor-pointer ${
                activeGuidanceFilter === 'DO_NOT_USE'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{restrictedCount} Do Not Use</span>
            </button>
          </div>
        </div>

        {/* Consolidated Aggregator Cards - Click Card to Filter Aggregator */}
        {aggregatorStats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
            {aggregatorStats.map((agg) => {
              const isSelected = activeAggregatorFilter === agg.name;
              return (
                <div
                  key={agg.name}
                  onClick={() => handleFilterByAggregator(agg.name)}
                  title={`Click to filter table for ${agg.name}`}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 group select-none ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                      : 'bg-slate-50/90 dark:bg-slate-800/70 border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:-translate-y-1 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                      <Layers3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{agg.name}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-2 py-0.5 rounded-full">
                      {agg.count}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Avg Profit Margin</p>
                    <p className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      +{agg.avgDiff}%
                    </p>
                  </div>

                  {/* Top School Link inside Aggregator Card */}
                  <button
                    type="button"
                    onClick={(e) => handleFilterBySchool(agg.topUni, e)}
                    title={`Click to filter table for ${agg.topUni}`}
                    className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400 truncate text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer flex items-center justify-between gap-1"
                  >
                    <span className="truncate">Top: <strong className="text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{agg.topUni}</strong></span>
                    <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">(+{agg.topUniMargin})</span>
                  </button>

                  {isSelected && (
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md text-center">
                      ✓ Active Aggregator Filter
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Filter Indication Banner if user clicked a school, status badge, or aggregator card */}
      {(activeSearchQuery || activeGuidanceFilter !== 'ALL' || activeAggregatorFilter !== 'ALL') && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <Filter className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Active Filters:</span>
            {activeSearchQuery && (
              <span className="bg-emerald-700 px-2 py-0.5 rounded-md">
                School: <strong>"{activeSearchQuery}"</strong>
              </span>
            )}
            {activeGuidanceFilter !== 'ALL' && (
              <span className="bg-emerald-700 px-2 py-0.5 rounded-md">
                Status: <strong>{activeGuidanceFilter === 'FOCUS' ? 'Focus (Green)' : activeGuidanceFilter === 'DO_NOT_USE' ? 'Do Not Use' : 'Allowed'}</strong>
              </span>
            )}
            {activeAggregatorFilter !== 'ALL' && (
              <span className="bg-emerald-700 px-2 py-0.5 rounded-md">
                Aggregator: <strong>"{activeAggregatorFilter}"</strong>
              </span>
            )}
          </div>
          <button
            onClick={handleClearAllFilters}
            className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer text-xs shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear All Filters</span>
          </button>
        </div>
      )}

      {/* Master Intelligence Table Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              All Commission Rates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Search and compare university rates and agent payouts.
            </p>
          </div>
        </div>

        <MasterTable
          data={rates}
          loading={loading}
          onEditRate={onEditRate}
          externalSearchQuery={activeSearchQuery}
          onExternalSearchChange={setActiveSearchQuery}
          externalGuidanceFilter={activeGuidanceFilter}
          onExternalGuidanceChange={setActiveGuidanceFilter}
          externalAggregatorFilter={activeAggregatorFilter}
          onExternalAggregatorChange={setActiveAggregatorFilter}
        />
      </section>
    </div>
  );
};
