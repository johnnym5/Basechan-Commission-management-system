import React, { useMemo, useState } from 'react';
import type { CommissionRate, SchoolGuidance } from '../types';
import type { DashboardFilters } from '../types/dashboard';
import { createEmptyDashboardFilters } from '../services/dashboardFilters';
import { MasterTable } from './MasterTable';
import { DashboardShell } from './DashboardShell';
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
  ChevronDown,
} from 'lucide-react';

interface DashboardViewProps {
  rates: CommissionRate[];
  loading: boolean;
  readOnly?: boolean;
  onEditRate: (rate: CommissionRate) => void;
  filters?: DashboardFilters;
  onFiltersChange?: (filters: DashboardFilters) => void;
}

interface AggregatorStat {
  name: string;
  count: number;
  avgDiff: number;
  topUni: string;
  topUniMargin: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ rates, loading, onEditRate, readOnly = false, filters, onFiltersChange }) => {
  // Active Filter states passed down to MasterTable
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const [activeGuidanceFilter, setActiveGuidanceFilter] = useState<SchoolGuidance | 'ALL'>('ALL');
  const [activeAggregatorFilter, setActiveAggregatorFilter] = useState<string>('ALL');
  const controlledFilters = filters ?? {
    ...createEmptyDashboardFilters(), query: activeSearchQuery,
    guidances: activeGuidanceFilter === 'ALL' ? [] : [activeGuidanceFilter],
    aggregators: activeAggregatorFilter === 'ALL' ? [] : [activeAggregatorFilter],
  };
  const changeFilters = (patch: Partial<DashboardFilters>) => onFiltersChange?.({ ...controlledFilters, ...patch });
  const changeSearch = (value: string) => { setActiveSearchQuery(value); changeFilters({ query: value }); };
  const changeGuidance = (value: SchoolGuidance | 'ALL') => { setActiveGuidanceFilter(value); changeFilters({ guidances: value === 'ALL' ? [] : [value] }); };
  const changeAggregator = (value: string) => { setActiveAggregatorFilter(value); changeFilters({ aggregators: value === 'ALL' ? [] : [value] }); };

  // Mobile Collapsible Summary Accordion (Closed by default on mobile so user accesses Master Table without scrolling)
  const [isSummaryOpenMobile, setIsSummaryOpenMobile] = useState<boolean>(false);

  // Helper to scroll smoothly to the table
  const scrollToTable = () => {
    const tableEl = document.getElementById('master-intelligence-table-container');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFilterBySchool = (schoolName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    changeSearch(schoolName);
    scrollToTable();
  };

  const handleFilterByGuidance = (guidance: SchoolGuidance) => {
    if (activeGuidanceFilter === guidance) {
      changeGuidance('ALL');
    } else {
      changeGuidance(guidance);
      scrollToTable();
    }
  };

  const handleFilterByAggregator = (aggName: string) => {
    if (activeAggregatorFilter === aggName) {
      changeAggregator('ALL');
    } else {
      changeAggregator(aggName);
      scrollToTable();
    }
  };

  const handleClearAllFilters = () => {
    setActiveSearchQuery('');
    setActiveGuidanceFilter('ALL');
    setActiveAggregatorFilter('ALL');
    onFiltersChange?.(createEmptyDashboardFilters());
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
    <DashboardShell role="ADMIN">
    <div className="space-y-6 sm:space-y-8">
      {/* Mobile Collapsible Header Bar Trigger (Shows on mobile only to toggle top summary) */}
      <div className="block sm:hidden">
        <button
          onClick={() => setIsSummaryOpenMobile(!isSummaryOpenMobile)}
          className="w-full flex items-center justify-between p-3.5 bg-[#0E1526] text-white rounded-2xl border border-[#222F43] shadow-md font-bold text-xs cursor-pointer transition active:scale-98"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Overview & Yield Analytics</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span>{isSummaryOpenMobile ? 'Collapse' : 'Show Summary'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSummaryOpenMobile ? 'rotate-180' : ''}`} />
          </div>
        </button>
      </div>

      {/* Top Executive Summary Container */}
      <div className={`space-y-6 sm:space-y-8 ${isSummaryOpenMobile ? 'block' : 'hidden sm:block'}`}>
        {/* Executive Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-[#0E1526] text-white p-5 sm:p-8 shadow-2xl border border-slate-800 dark:border-[#222F43]">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Basechan Commission Overview</span>
              </div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                University Rates & Profit Margins
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Compare university commission rates against agent payouts to see your profit margins for each school and platform.
              </p>
            </div>

            {/* Quick Best Route Feature Pill */}
            {bestRate && (
              <button
                onClick={() => handleFilterBySchool(bestRate.universityName)}
                title={`Click to filter table for ${bestRate.universityName}`}
                className="text-left bg-[#18181B]/80 hover:bg-[#18181B] backdrop-blur-md border border-[#222F43] hover:border-amber-400/50 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between gap-2 shrink-0 max-w-xs shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  <span className="flex items-center gap-1 text-amber-400">
                    <Award className="w-3.5 h-3.5" /> Best Profit Route
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    +{bestRate.diffMargin}{bestRate.isFlatFee ? '£' : '%'}
                  </span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                    {bestRate.universityName}
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="bg-[#0E1526] px-1.5 py-0.5 rounded text-[10px] text-slate-200 border border-[#222F43]">{bestRate.aggregator}</span>
                    <span>{bestRate.intake} • {bestRate.studyLevel}</span>
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Bento Grid KPI Section - Secondary Dark Blue Cards in Dark Mode */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Total Rates Card */}
          <div className="bg-white dark:bg-[#0E1526] p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#222F43] shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-2 sm:space-y-3 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Rates
              </span>
              <div className="p-1.5 sm:p-2.5 bg-blue-50 dark:bg-amber-950/60 text-blue-600 dark:text-amber-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                {rates.length}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 flex items-center gap-1 font-medium truncate">
                <span className="text-blue-600 dark:text-amber-400 font-bold">Updated</span> from sheets
              </p>
            </div>
          </div>

          {/* Partner Institutions Card */}
          <div className="bg-white dark:bg-[#0E1526] p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#222F43] shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-2 sm:space-y-3 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Universities
              </span>
              <div className="p-1.5 sm:p-2.5 bg-indigo-50 dark:bg-blue-950/60 text-indigo-600 dark:text-blue-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                {totalUniversities}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 flex items-center gap-1 font-medium truncate">
                <Globe className="w-3 h-3 text-indigo-500 dark:text-blue-400 shrink-0" />
                <span>{totalCountries} countries</span>
              </p>
            </div>
          </div>

          {/* Top Margin Card */}
          <div className="bg-white dark:bg-[#0E1526] p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#222F43] shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-2 sm:space-y-3 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Top Margin
              </span>
              <div className="p-1.5 sm:p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                +{bestRate ? `${bestRate.diffMargin}${bestRate.isFlatFee ? '£' : '%'}` : '0%'}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 flex items-center gap-1 font-medium truncate">
                <ArrowUpRight className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{bestRate?.universityName || 'Best Route'}</span>
              </p>
            </div>
          </div>

          {/* Average Margin Card */}
          <div className="bg-white dark:bg-[#0E1526] p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#222F43] shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col justify-between space-y-2 sm:space-y-3 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Avg Margin
              </span>
              <div className="p-1.5 sm:p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform duration-300">
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                +{averageMargin}%
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 flex items-center gap-1 font-medium truncate">
                <span>Percent rates</span>
              </p>
            </div>
          </div>
        </div>

        {/* CONSOLIDATED SINGLE SECTION: Platform Earnings & School Priority Status */}
        <div className="bg-white dark:bg-[#0E1526] p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-[#222F43] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-amber-400" />
                Platform Earnings & School Priority Status
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click an Aggregator card to filter rates by platform, or click a status badge / school.
              </p>
            </div>

            {/* Clickable Guidance Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <button
                onClick={() => handleFilterByGuidance('FOCUS')}
                title="Click to filter for Focus Schools (Preferred)"
                className={`px-2.5 sm:px-3 py-1 rounded-full border flex items-center gap-1 transition cursor-pointer text-[11px] sm:text-xs ${
                  activeGuidanceFilter === 'FOCUS'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{focusCount} Focus Schools</span>
              </button>

              <button
                onClick={() => handleFilterByGuidance('ALLOWED')}
                title="Click to filter for Allowed Schools"
                className={`px-2.5 sm:px-3 py-1 rounded-full border transition cursor-pointer text-[11px] sm:text-xs ${
                  activeGuidanceFilter === 'ALLOWED'
                    ? 'bg-slate-800 dark:bg-amber-400 text-white dark:text-slate-950 border-slate-800 dark:border-amber-400 shadow-xs font-bold'
                    : 'bg-slate-100 dark:bg-[#18181B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#222F43] hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{allowedCount} Allowed</span>
              </button>

              <button
                onClick={() => handleFilterByGuidance('DO_NOT_USE')}
                title="Click to filter for Do Not Use Schools"
                className={`px-2.5 sm:px-3 py-1 rounded-full border flex items-center gap-1 transition cursor-pointer text-[11px] sm:text-xs ${
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

          {/* Consolidated Aggregator Cards */}
          {aggregatorStats.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5 pt-1">
              {aggregatorStats.map((agg) => {
                const isSelected = activeAggregatorFilter === agg.name;
                return (
                  <div
                    key={agg.name}
                    onClick={() => handleFilterByAggregator(agg.name)}
                    title={`Click to filter table for ${agg.name}`}
                    className={`p-3 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2 sm:space-y-3 group select-none ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-amber-950/80 border-blue-500 dark:border-amber-400 shadow-md ring-2 ring-blue-500/30'
                        : 'bg-slate-50/90 dark:bg-[#18181B]/80 border-slate-200/90 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-400 dark:hover:border-amber-400/60 hover:-translate-y-0.5 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                        <Layers3 className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">{agg.name}</span>
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono bg-slate-200 dark:bg-[#0E1526] text-slate-700 dark:text-slate-200 font-bold px-1.5 py-0.5 rounded-full border border-slate-300 dark:border-[#222F43]">
                        {agg.count}
                      </span>
                    </div>

                    <div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Avg Margin</p>
                      <p className="text-lg sm:text-xl font-extrabold font-mono text-emerald-600 dark:text-amber-400 mt-0.5">
                        +{agg.avgDiff}%
                      </p>
                    </div>

                    {/* Top School Link inside Aggregator Card */}
                    <button
                      type="button"
                      onClick={(e) => handleFilterBySchool(agg.topUni, e)}
                      title={`Click to filter table for ${agg.topUni}`}
                      className="pt-1.5 sm:pt-2 border-t border-slate-200/80 dark:border-[#222F43] text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 truncate text-left hover:text-blue-600 dark:hover:text-amber-400 transition cursor-pointer flex items-center justify-between gap-1"
                    >
                      <span className="truncate">Top: <strong className="text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-amber-400">{agg.topUni}</strong></span>
                      <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">(+{agg.topUniMargin})</span>
                    </button>

                    {isSelected && (
                      <div className="text-[9px] sm:text-[10px] text-blue-700 dark:text-amber-300 font-bold bg-blue-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-md text-center">
                        ✓ Filtered
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Indication Banner if user clicked a school, status badge, or aggregator card */}
      {(activeSearchQuery || activeGuidanceFilter !== 'ALL' || activeAggregatorFilter !== 'ALL') && (
        <div className="bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in font-bold">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-blue-200 dark:text-slate-900 shrink-0" />
            <span>Active Filters:</span>
            {activeSearchQuery && (
              <span className="bg-blue-700 dark:bg-amber-500 px-2 py-0.5 rounded-md">
                School: <strong>"{activeSearchQuery}"</strong>
              </span>
            )}
            {activeGuidanceFilter !== 'ALL' && (
              <span className="bg-blue-700 dark:bg-amber-500 px-2 py-0.5 rounded-md">
                Status: <strong>{activeGuidanceFilter === 'FOCUS' ? 'Focus (Green)' : activeGuidanceFilter === 'DO_NOT_USE' ? 'Do Not Use' : 'Allowed'}</strong>
              </span>
            )}
            {activeAggregatorFilter !== 'ALL' && (
              <span className="bg-blue-700 dark:bg-amber-500 px-2 py-0.5 rounded-md">
                Aggregator: <strong>"{activeAggregatorFilter}"</strong>
              </span>
            )}
          </div>
          <button
            onClick={handleClearAllFilters}
            className="bg-white/20 hover:bg-white/30 text-white dark:text-slate-950 px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer text-xs shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear All Filters</span>
          </button>
        </div>
      )}

      {/* Master Intelligence Table Section - Directly accessible on mobile without scrolling */}
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
          readOnly={readOnly}
          onEditRate={onEditRate}
          externalSearchQuery={controlledFilters.query}
          onExternalSearchChange={changeSearch}
          externalGuidanceFilter={controlledFilters.guidances[0] as SchoolGuidance | undefined || 'ALL'}
          onExternalGuidanceChange={changeGuidance}
          externalAggregatorFilter={controlledFilters.aggregators[0] || 'ALL'}
          onExternalAggregatorChange={changeAggregator}
          externalCountryFilter={controlledFilters.countries[0] || 'ALL'}
          onExternalCountryChange={value => changeFilters({ countries: value === 'ALL' ? [] : [value] })}
          externalLevelFilter={controlledFilters.levels[0] as CommissionRate['studyLevel'] | undefined || 'ALL'}
          onExternalLevelChange={value => changeFilters({ levels: value === 'ALL' ? [] : [value] })}
          externalIntakeFilter={controlledFilters.intakes[0] || 'ALL'}
          onExternalIntakeChange={value => changeFilters({ intakes: value === 'ALL' ? [] : [value] })}
        />
      </section>
    </div>
    </DashboardShell>
  );
};


