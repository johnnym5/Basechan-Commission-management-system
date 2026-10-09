import React, { useMemo } from 'react';
import { Building2, CheckCircle2, Globe2, Route, X } from 'lucide-react';
import type { CommissionRate, SchoolGuidance, StudyLevel } from '../types';
import type { DashboardFilters, DashboardRate } from '../types/dashboard';
import { applyDashboardFilters, createEmptyDashboardFilters } from '../services/dashboardFilters';
import { getDashboardFilterOptions, getDashboardKpis } from '../services/dashboardData';
import { DashboardShell } from './DashboardShell';
import { MasterTable } from './MasterTable';

interface RoleDashboardViewProps {
  role: 'STAFF' | 'AGENT';
  rates: DashboardRate[];
  loading: boolean;
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

const KPI_ICONS = [Route, Building2, Globe2, CheckCircle2];

export const RoleDashboardView: React.FC<RoleDashboardViewProps> = ({ role, rates, loading, filters, onFiltersChange }) => {
  const options = useMemo(() => getDashboardFilterOptions(rates), [rates]);
  const visibleRates = useMemo(() => applyDashboardFilters(role, rates, filters), [role, rates, filters]);
  const kpis = useMemo(() => getDashboardKpis(visibleRates), [visibleRates]);
  const isAgent = role === 'AGENT';

  const metricData = [
    [isAgent ? 'Approved routes' : 'Visible routes', kpis.routes],
    ['Universities', kpis.schools],
    ['Countries', kpis.countries],
    [isAgent ? 'Payout routes' : 'Focus routes', isAgent ? visibleRates.filter(rate => rate.role === 'AGENT').length : kpis.focusRoutes],
  ] as const;

  // Convert DashboardRate[] to CommissionRate[] for MasterTable
  const commissionRates: CommissionRate[] = useMemo(() => {
    return visibleRates.map(r => {
      const anyRate = r as any;
      return {
        id: r.id,
        universityId: r.universityId,
        universityName: r.universityName,
        country: r.country,
        intake: r.intake,
        studyLevel: r.studyLevel,
        aggregator: anyRate.aggregator || '',
        agentRate: anyRate.agentRate || 0,
        masterRate: anyRate.masterRate || 0,
        diffMargin: anyRate.agentRate ?? anyRate.diffMargin ?? 0,
        isFlatFee: anyRate.isFlatFee || false,
        netOrGross: anyRate.netOrGross || 'GROSS',
        guidance: r.guidance || 'ALLOWED',
        notes: r.notes || '',
      };
    });
  }, [visibleRates]);

  const changeFilters = (patch: Partial<DashboardFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const activeChips = [
    ...filters.query ? [`Search: ${filters.query}`] : [],
    ...filters.countries.map(value => `Country: ${value}`),
    ...filters.levels.map(value => `Level: ${value}`),
    ...filters.intakes.map(value => `Intake: ${value}`),
    ...filters.guidances.map(value => `Guidance: ${value}`),
    ...filters.aggregators.map(value => `Portal: ${value}`),
    ...(filters.agentPayoutKind ? [`Payout: ${filters.agentPayoutKind === 'FLAT_FEE' ? 'Flat fee' : 'Percentage'}`] : []),
    ...(filters.payoutMinimum !== undefined ? [`Minimum payout: ${filters.payoutMinimum}`] : []),
    ...(filters.payoutMaximum !== undefined ? [`Maximum payout: ${filters.payoutMaximum}`] : []),
  ];

  const analytics = ['FOCUS', 'ALLOWED', 'DO_NOT_USE'] as const;

  return (
    <DashboardShell
      role={role}
      title={isAgent ? 'Your commission dashboard' : 'Staff application dashboard'}
      description={isAgent ? 'Explore approved routes and your effective payout across available schools.' : 'Find authorized application routes and guidance for your school searches.'}
    >
      {/* 4 KPI Cards side-by-side in 1 Horizontal Row (2x2 on mobile, 4x1 on tablet & desktop) */}
      <div className="dashboard-summary grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        {metricData.map(([label, value], index) => {
          const Icon = KPI_ICONS[index];
          return (
            <article key={label} className="rounded-2xl border border-slate-200/80 dark:border-[#26334b] bg-white dark:bg-[#0e1526] p-3.5 sm:p-4 shadow-2xs hover:border-blue-400/60 transition-all">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{label}</p>
                <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">{value}</p>
            </article>
          );
        })}
      </div>

      {/* Collapsible Route Guidance Analytics */}
      <section className="dashboard-summary rounded-2xl border border-[#26334b] bg-[#0e1526] p-4 sm:p-5">
        <h2 className="text-sm font-extrabold text-slate-100">Route guidance</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {analytics.map((guidance) => (
            <button
              key={guidance}
              type="button"
              onClick={() => onFiltersChange({ ...filters, guidances: filters.guidances.includes(guidance) ? [] : [guidance] })}
              className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs font-bold text-slate-200 hover:border-blue-400 hover:bg-blue-950/40 cursor-pointer"
            >
              {guidance.replace('_', ' ')} <span className="ml-2 text-blue-300">{visibleRates.filter((rate) => (rate.guidance || 'ALLOWED') === guidance).length}</span>
            </button>
          ))}
        </div>
        {!isAgent && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Portal route counts">
            {options.aggregators.map((portal) => (
              <button
                key={portal}
                type="button"
                onClick={() => onFiltersChange({ ...filters, aggregators: filters.aggregators.includes(portal) ? [] : [portal] })}
                className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs text-slate-300 hover:border-blue-400 cursor-pointer"
              >
                {portal} <span className="ml-1 text-blue-300">{visibleRates.filter((rate) => rate.role === 'STAFF' && rate.aggregator === portal).length}</span>
              </button>
            ))}
          </div>
        )}
        {isAgent && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, agentPayoutKind: filters.agentPayoutKind === 'PERCENTAGE' ? undefined : 'PERCENTAGE', payoutMinimum: undefined, payoutMaximum: undefined })}
              className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs text-slate-300 hover:border-blue-400 cursor-pointer"
            >
              Percentage payouts <span className="ml-1 text-blue-300">{visibleRates.filter((rate) => rate.role === 'AGENT' && !rate.isFlatFee).length}</span>
            </button>
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, agentPayoutKind: filters.agentPayoutKind === 'FLAT_FEE' ? undefined : 'FLAT_FEE', payoutMinimum: undefined, payoutMaximum: undefined })}
              className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs text-slate-300 hover:border-blue-400 cursor-pointer"
            >
              Flat fee payouts <span className="ml-1 text-blue-300">{visibleRates.filter((rate) => rate.role === 'AGENT' && rate.isFlatFee).length}</span>
            </button>
          </div>
        )}
      </section>

      {/* Active Filter Chips Bar */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#26334b] bg-[#0e1526] p-3.5">
          {activeChips.map((chip) => (
            <span
              key={chip}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-950/80 text-blue-200 border border-blue-800"
            >
              {chip}
            </span>
          ))}
          <button
            type="button"
            onClick={() => onFiltersChange(createEmptyDashboardFilters())}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-extrabold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            Clear all filters
          </button>
        </div>
      )}

      {/* Main Table / Grid View with Identical Advanced Search, Grouping, Currency & Filters */}
      <section id="dashboard-results" className="rounded-2xl border border-[#26334b] bg-[#0e1526] p-4 sm:p-5" aria-live="polite">
        {visibleRates.length === 0 && activeChips.length > 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-slate-300">No routes match {activeChips.join(', ')}.</p>
            <button
              type="button"
              onClick={() => onFiltersChange(createEmptyDashboardFilters())}
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white cursor-pointer hover:bg-blue-500 transition"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <MasterTable
            data={commissionRates}
            loading={loading}
            readOnly={true}
            onEditRate={() => {}}
            externalSearchQuery={filters.query}
            onExternalSearchChange={(q) => changeFilters({ query: q })}
            externalGuidanceFilter={(filters.guidances[0] as SchoolGuidance) || 'ALL'}
            onExternalGuidanceChange={(g: SchoolGuidance | 'ALL') => changeFilters({ guidances: g === 'ALL' ? [] : [g] })}
            externalAggregatorFilter={filters.aggregators[0] || 'ALL'}
            onExternalAggregatorChange={(agg: string) => changeFilters({ aggregators: agg === 'ALL' ? [] : [agg] })}
            externalIntakeFilter={filters.intakes[0] || 'ALL'}
            onExternalIntakeChange={(intake: string) => changeFilters({ intakes: intake === 'ALL' ? [] : [intake] })}
            externalLevelFilter={(filters.levels[0] as StudyLevel) || 'ALL'}
            onExternalLevelChange={(lvl: StudyLevel | 'ALL') => changeFilters({ levels: lvl === 'ALL' ? [] : [lvl] })}
            externalCountryFilter={filters.countries[0] || 'ALL'}
            onExternalCountryChange={(country: string) => changeFilters({ countries: country === 'ALL' ? [] : [country] })}
            externalSchoolIdsFilter={filters.schoolIds}
          />
        )}
      </section>
    </DashboardShell>
  );
};
