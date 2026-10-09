import React, { useMemo } from 'react';
import { Building2, CheckCircle2, Globe2, Route, X } from 'lucide-react';
import type { DashboardFilters, DashboardRate } from '../types/dashboard';
import { applyDashboardFilters, createEmptyDashboardFilters } from '../services/dashboardFilters';
import { getDashboardFilterOptions, getDashboardKpis } from '../services/dashboardData';
import { DashboardShell } from './DashboardShell';

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
  const kpis = getDashboardKpis(visibleRates);
  const isAgent = role === 'AGENT';
  const metricData = [
    [isAgent ? 'Approved routes' : 'Visible routes', kpis.routes],
    ['Universities', kpis.schools],
    ['Countries', kpis.countries],
    [isAgent ? 'Payout routes' : 'Focus routes', isAgent ? visibleRates.filter(rate => rate.role === 'AGENT').length : kpis.focusRoutes],
  ] as const;
  const change = (field: keyof DashboardFilters, value: string) => onFiltersChange({ ...filters, [field]: value ? [value] : [] });
  const active = [
    ...filters.query ? [`Search: ${filters.query}`] : [], ...filters.countries.map(value => `Country: ${value}`), ...filters.levels.map(value => `Level: ${value}`),
    ...filters.intakes.map(value => `Intake: ${value}`), ...filters.guidances.map(value => `Guidance: ${value}`),
    ...filters.aggregators.map(value => `Portal: ${value}`),
    ...(filters.agentPayoutKind ? [`Payout: ${filters.agentPayoutKind === 'FLAT_FEE' ? 'Flat fee' : 'Percentage'}`] : []),
    ...(filters.payoutMinimum !== undefined ? [`Minimum payout: ${filters.payoutMinimum}`] : []),
    ...(filters.payoutMaximum !== undefined ? [`Maximum payout: ${filters.payoutMaximum}`] : []),
  ];
  const analytics = ['FOCUS', 'ALLOWED', 'DO_NOT_USE'] as const;
  return <DashboardShell role={role} title={isAgent ? 'Your commission dashboard' : 'Staff application dashboard'} description={isAgent ? 'Explore approved routes and your effective payout across available schools.' : 'Find authorized application routes and guidance for your school searches.'}>
    <div className="dashboard-summary grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {metricData.map(([label, value], index) => { const Icon = KPI_ICONS[index]; return <article key={label} className="rounded-2xl border border-[#26334b] bg-[#0e1526] p-3.5 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">{label}</p><Icon aria-hidden="true" className="h-4 w-4 text-blue-400" /></div>
        <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
      </article>; })}
    </div>
    <section className="dashboard-summary rounded-2xl border border-[#26334b] bg-[#0e1526] p-4 sm:p-5">
      <h2 className="text-sm font-extrabold text-slate-100">Route guidance</h2>
      <div className="mt-3 flex flex-wrap gap-2">{analytics.map(guidance => <button key={guidance} type="button" onClick={() => onFiltersChange({ ...filters, guidances: filters.guidances.includes(guidance) ? [] : [guidance] })} className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs font-bold text-slate-200 hover:border-blue-400 hover:bg-blue-950/40">{guidance.replace('_', ' ')} <span className="ml-2 text-blue-300">{visibleRates.filter(rate => (rate.guidance || 'ALLOWED') === guidance).length}</span></button>)}</div>
      {!isAgent && <div className="mt-3 flex flex-wrap gap-2" aria-label="Portal route counts">{options.aggregators.map(portal => <button key={portal} type="button" onClick={() => onFiltersChange({ ...filters, aggregators: filters.aggregators.includes(portal) ? [] : [portal] })} className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs text-slate-300 hover:border-blue-400">{portal} <span className="ml-1 text-blue-300">{visibleRates.filter(rate => rate.role === 'STAFF' && rate.aggregator === portal).length}</span></button>)}</div>}
      {isAgent && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onFiltersChange({ ...filters, agentPayoutKind: filters.agentPayoutKind === 'PERCENTAGE' ? undefined : 'PERCENTAGE', payoutMinimum: undefined, payoutMaximum: undefined })} className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs text-slate-300 hover:border-blue-400">Percentage payouts <span className="ml-1 text-blue-300">{visibleRates.filter(rate => rate.role === 'AGENT' && !rate.isFlatFee).length}</span></button><button type="button" onClick={() => onFiltersChange({ ...filters, agentPayoutKind: filters.agentPayoutKind === 'FLAT_FEE' ? undefined : 'FLAT_FEE', payoutMinimum: undefined, payoutMaximum: undefined })} className="rounded-xl border border-[#2d3b56] px-3 py-2 text-xs text-slate-300 hover:border-blue-400">Flat fee payouts <span className="ml-1 text-blue-300">{visibleRates.filter(rate => rate.role === 'AGENT' && rate.isFlatFee).length}</span></button></div>}
    </section>
    <section className="rounded-2xl border border-[#26334b] bg-[#0e1526] p-4 sm:p-5" aria-label="Dashboard filters">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-300">Search schools<input value={filters.query} onChange={event => onFiltersChange({ ...filters, query: event.target.value })} placeholder="School name" className="mt-1 min-h-11 w-full rounded-xl border border-[#33415d] bg-[#090d16] px-3 text-sm text-white" /></label>
        <FilterSelect label="Country" value={filters.countries[0] || ''} options={options.countries} onChange={value => change('countries', value)} />
        <FilterSelect label="Study level" value={filters.levels[0] || ''} options={options.levels} onChange={value => change('levels', value)} />
        <FilterSelect label="Intake" value={filters.intakes[0] || ''} options={options.intakes} onChange={value => change('intakes', value)} />
        <FilterSelect label="Guidance" value={filters.guidances[0] || ''} options={options.guidances} onChange={value => change('guidances', value)} />
        {!isAgent && <FilterSelect label="Application portal" value={filters.aggregators[0] || ''} options={options.aggregators} onChange={value => change('aggregators', value)} />}
        {isAgent && <>
          <FilterSelect label="Payout type" value={filters.agentPayoutKind || ''} options={['PERCENTAGE', 'FLAT_FEE']} display={value => value === 'FLAT_FEE' ? 'Flat fee' : 'Percentage'} onChange={value => onFiltersChange({ ...filters, agentPayoutKind: (value || undefined) as DashboardFilters['agentPayoutKind'], payoutMinimum: undefined, payoutMaximum: undefined })} />
          <label className="text-xs font-semibold text-slate-300">Minimum payout<input type="number" value={filters.payoutMinimum ?? ''} onChange={event => onFiltersChange({ ...filters, payoutMinimum: event.target.value === '' ? undefined : Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-[#33415d] bg-[#090d16] px-3 text-sm text-white" /></label>
          <label className="text-xs font-semibold text-slate-300">Maximum payout<input type="number" value={filters.payoutMaximum ?? ''} onChange={event => onFiltersChange({ ...filters, payoutMaximum: event.target.value === '' ? undefined : Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-[#33415d] bg-[#090d16] px-3 text-sm text-white" /></label>
        </>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">{active.map(item => <span key={item} className="rounded-full bg-blue-950/60 px-3 py-1.5 text-[11px] text-blue-100">{item}</span>)}{active.length > 0 && <button type="button" onClick={() => onFiltersChange(createEmptyDashboardFilters())} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-300 hover:bg-slate-800"><X className="h-3.5 w-3.5" />Clear all filters</button>}</div>
    </section>
    <section id="dashboard-results" className="rounded-2xl border border-[#26334b] bg-[#0e1526] p-4 sm:p-5" aria-live="polite">
      <div className="flex items-center justify-between"><h2 className="text-sm font-extrabold text-white">Available routes</h2><span className="text-xs text-slate-400">{visibleRates.length} routes</span></div>
      {loading ? <p role="status" className="py-12 text-center text-sm text-slate-400">Loading your authorized school data…</p> : visibleRates.length === 0 ? <div className="py-10 text-center"><p className="text-sm text-slate-300">{active.length ? `No routes match ${active.join(', ')}.` : 'No authorized routes are available yet.'}</p>{active.length > 0 && <button type="button" onClick={() => onFiltersChange(createEmptyDashboardFilters())} className="mt-3 min-h-10 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white">Clear all filters</button>}</div> : <div className="mt-3 divide-y divide-[#202a3c]">{visibleRates.slice(0, 50).map(rate => <article key={rate.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-100">{rate.universityName}</h3><p className="mt-1 text-xs text-slate-400">{rate.country || 'Country not listed'} · {rate.studyLevel} · {rate.intake}{rate.role === 'STAFF' ? ` · ${rate.aggregator}` : ''}</p></div>
        <div className="flex items-center gap-2">{rate.guidance && <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-200">{rate.guidance.replace('_', ' ')}</span>}{rate.role === 'AGENT' && <strong className="text-sm text-blue-300">{rate.isFlatFee ? `${rate.agentRate} ${rate.netOrGross}` : `${rate.agentRate}%`}</strong>}</div>
      </article>)}</div>}
    </section>
  </DashboardShell>;
};

const FilterSelect: React.FC<{ label: string; value: string; options: string[]; display?: (value: string) => string; onChange: (value: string) => void }> = ({ label, value, options, display = value => value, onChange }) => <label className="text-xs font-semibold text-slate-300">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#33415d] bg-[#090d16] px-3 text-sm text-white"><option value="">All</option>{options.map(option => <option value={option} key={option}>{display(option)}</option>)}</select></label>;

