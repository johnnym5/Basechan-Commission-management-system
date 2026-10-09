import type { UserRole } from '../types';
import type { ChatSearchIntent } from '../types/chat';
import type { DashboardFilters, DashboardRate } from '../types/dashboard';

export function createEmptyDashboardFilters(): DashboardFilters { return { query: '', schoolIds: [], countries: [], levels: [], intakes: [], guidances: [], aggregators: [] }; }
function includesNormalized(values: string[], value: string | undefined) { return values.length === 0 || values.some(item => item.trim().toLocaleLowerCase() === value?.trim().toLocaleLowerCase()); }
export function sanitizeDashboardFilters(role: UserRole, filters: DashboardFilters): DashboardFilters {
  const allowed = createEmptyDashboardFilters();
  allowed.query = filters.query ?? ''; allowed.schoolIds = filters.schoolIds ?? []; allowed.countries = filters.countries ?? []; allowed.levels = filters.levels ?? []; allowed.intakes = filters.intakes ?? []; allowed.guidances = filters.guidances ?? [];
  if (role !== 'AGENT') allowed.aggregators = filters.aggregators ?? [];
  if (role !== 'STAFF') { allowed.agentPayoutKind = filters.agentPayoutKind; allowed.payoutMinimum = filters.payoutMinimum; allowed.payoutMaximum = filters.payoutMaximum; }
  return allowed;
}
export function applyDashboardFilters(role: UserRole, rates: DashboardRate[], rawFilters: DashboardFilters): DashboardRate[] {
  const filters = sanitizeDashboardFilters(role, rawFilters); const query = filters.query.trim().toLocaleLowerCase();
  const payoutFilter = role !== 'STAFF' && (filters.payoutMinimum !== undefined || filters.payoutMaximum !== undefined);
  return rates.filter(rate => {
    if (query && !`${rate.universityName} ${rate.country ?? ''} ${rate.intake} ${rate.studyLevel} ${'aggregator' in rate ? rate.aggregator : ''}`.toLocaleLowerCase().includes(query)) return false;
    if (filters.schoolIds.length && !filters.schoolIds.includes(rate.universityId)) return false;
    if (!includesNormalized(filters.countries, rate.country) || !includesNormalized(filters.levels, rate.studyLevel) || !includesNormalized(filters.intakes, rate.intake) || !includesNormalized(filters.guidances, rate.guidance)) return false;
    if (filters.aggregators.length && (!('aggregator' in rate) || !includesNormalized(filters.aggregators, rate.aggregator))) return false;
    if (payoutFilter) {
      if (!('agentRate' in rate) || !filters.agentPayoutKind) return false;
      if (rate.isFlatFee !== (filters.agentPayoutKind === 'FLAT_FEE')) return false;
      if (filters.payoutMinimum !== undefined && rate.agentRate < filters.payoutMinimum) return false;
      if (filters.payoutMaximum !== undefined && rate.agentRate > filters.payoutMaximum) return false;
    }
    return true;
  });
}
export function filtersFromChatIntent(role: UserRole, intent: ChatSearchIntent, current: DashboardFilters): DashboardFilters {
  const next: DashboardFilters = { ...sanitizeDashboardFilters(role, current), query: '', schoolIds: intent.schoolIds.length ? [...intent.schoolIds] : current.schoolIds, countries: intent.country ? [intent.country] : current.countries, levels: intent.level ? [intent.level] : current.levels, intakes: intent.intake ? [intent.intake] : current.intakes, guidances: intent.guidances?.length ? [...intent.guidances] : intent.guidance ? [intent.guidance] : current.guidances };
  if (role !== 'AGENT' && intent.aggregatorTerms.length) next.aggregators = [...intent.aggregatorTerms];
  if (role !== 'STAFF' && (intent.rateMinimum !== undefined || intent.rateMaximum !== undefined)) { next.agentPayoutKind = intent.feeType === 'FLAT' ? 'FLAT_FEE' : 'PERCENTAGE'; next.payoutMinimum = intent.rateMinimum; next.payoutMaximum = intent.rateMaximum; }
  return sanitizeDashboardFilters(role, next);
}
