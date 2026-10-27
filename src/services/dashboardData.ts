import type { UserRole, CommissionRate } from '../types';
import type { DashboardKpis, DashboardRate } from '../types/dashboard';
import { isEligibleAgentPayout } from './rateReadModels';

export function selectAgentPayoutRates(rates: CommissionRate[]): CommissionRate[] {
  const selected = new Map<string, CommissionRate>();
  rates.forEach((rate) => {
    if (!isEligibleAgentPayout(rate.aggregator)) return;
    const key = `${rate.universityId || rate.universityName}__${rate.studyLevel}__${rate.intake}`;
    if (!selected.has(key)) selected.set(key, rate);
  });
  return Array.from(selected.values());
}

export function buildDashboardRates(role: UserRole, rates: CommissionRate[]): DashboardRate[] {
  if (role === 'ADMIN') {
    return rates.map((rate) => ({ ...rate, role: 'ADMIN' }));
  }
  if (role === 'AGENT') rates = selectAgentPayoutRates(rates);

  // Keep routes grouped by university, level, and intake. Staff can have
  // multiple Admin-designated defaults; Agents remain restricted to one
  // eligible payout route per group.
  const groupMap = new Map<string, CommissionRate[]>();
  rates.forEach((rate) => {
    const key = `${rate.universityId || rate.universityName}__${rate.studyLevel}__${rate.intake}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(rate);
  });

  const visibleRoutes: CommissionRate[] = [];
  groupMap.forEach((ratesForKey) => {
    if (role === 'AGENT') {
      visibleRoutes.push(ratesForKey[0]);
      return;
    }
    const adminDefaults = ratesForKey.filter((rate) => rate.isDefaultRoute === true);
    if (adminDefaults.length > 0) {
      visibleRoutes.push(...adminDefaults);
    } else {
      const focusRoute = ratesForKey.find((rate) => rate.guidance === 'FOCUS');
      if (focusRoute) {
        visibleRoutes.push(focusRoute);
        return;
      }
      const topYield = ratesForKey.reduce((best, curr) => (curr.diffMargin > best.diffMargin ? curr : best), ratesForKey[0]);
      visibleRoutes.push(topYield);
    }
  });

  if (role === 'STAFF') {
    return visibleRoutes.map((rate) => ({
      role: 'STAFF',
      id: rate.id,
      universityId: rate.universityId,
      universityName: rate.universityName,
      country: rate.country,
      intake: rate.intake,
      aggregator: rate.aggregator,
      studyLevel: rate.studyLevel,
      guidance: rate.guidance,
      isDefaultRoute: rate.isDefaultRoute,
      notes: rate.notes,
      updatedAt: rate.updatedAt,
      sourceSheet: rate.sourceSheet,
    }));
  }

  // AGENT role
  return visibleRoutes.map((rate) => ({
    role: 'AGENT',
    id: rate.id,
    universityId: rate.universityId,
    universityName: rate.universityName,
    country: rate.country,
    intake: rate.intake,
    studyLevel: rate.studyLevel,
    guidance: rate.guidance,
    notes: rate.notes,
    updatedAt: rate.updatedAt,
    sourceSheet: rate.sourceSheet,
    agentRate: rate.agentRate,
    isFlatFee: rate.isFlatFee,
    netOrGross: rate.netOrGross,
  }));
}

export function getDashboardKpis(rates: DashboardRate[]): DashboardKpis {
  return {
    routes: rates.length,
    schools: new Set(rates.map((rate) => rate.universityId || rate.universityName)).size,
    countries: new Set(rates.map((rate) => rate.country?.trim()).filter(Boolean)).size,
    focusRoutes: rates.filter((rate) => rate.guidance === 'FOCUS').length,
  };
}

export function getDashboardFilterOptions(rates: DashboardRate[]) {
  const sorted = (values: Array<string | undefined>) =>
    [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) =>
      a.localeCompare(b)
    );
  return {
    countries: sorted(rates.map((rate) => rate.country)),
    levels: sorted(rates.map((rate) => rate.studyLevel)),
    intakes: sorted(rates.map((rate) => rate.intake)),
    guidances: sorted(rates.map((rate) => rate.guidance)),
    aggregators: sorted(rates.flatMap((rate) => ('aggregator' in rate ? [rate.aggregator] : []))),
  };
}
