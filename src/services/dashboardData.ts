import type { UserRole, CommissionRate } from '../types';
import type { DashboardKpis, DashboardRate } from '../types/dashboard';

export function buildDashboardRates(role: UserRole, rates: CommissionRate[]): DashboardRate[] {
  if (role === 'ADMIN') return rates.map(rate => ({ ...rate, role: 'ADMIN' }));
  if (role === 'STAFF') return rates.map(rate => ({ role: 'STAFF', id: rate.id, universityId: rate.universityId, universityName: rate.universityName, country: rate.country, intake: rate.intake, aggregator: rate.aggregator, studyLevel: rate.studyLevel, guidance: rate.guidance, notes: rate.notes, updatedAt: rate.updatedAt, sourceSheet: rate.sourceSheet }));
  return rates.map(rate => ({ role: 'AGENT', id: rate.id, universityId: rate.universityId, universityName: rate.universityName, country: rate.country, intake: rate.intake, studyLevel: rate.studyLevel, guidance: rate.guidance, notes: rate.notes, updatedAt: rate.updatedAt, sourceSheet: rate.sourceSheet, agentRate: rate.agentRate, isFlatFee: rate.isFlatFee, netOrGross: rate.netOrGross }));
}
export function getDashboardKpis(rates: DashboardRate[]): DashboardKpis {
  return { routes: rates.length, schools: new Set(rates.map(rate => rate.universityId)).size, countries: new Set(rates.map(rate => rate.country?.trim()).filter(Boolean)).size, focusRoutes: rates.filter(rate => rate.guidance === 'FOCUS').length };
}
export function getDashboardFilterOptions(rates: DashboardRate[]) {
  const sorted = (values: Array<string | undefined>) => [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
  return { countries: sorted(rates.map(rate => rate.country)), levels: sorted(rates.map(rate => rate.studyLevel)), intakes: sorted(rates.map(rate => rate.intake)), guidances: sorted(rates.map(rate => rate.guidance)), aggregators: sorted(rates.flatMap(rate => 'aggregator' in rate ? [rate.aggregator] : [])) };
}
