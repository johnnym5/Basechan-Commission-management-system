import type { UserRole, CommissionRate } from '../types';
import type { DashboardKpis, DashboardRate } from '../types/dashboard';

export function buildDashboardRates(role: UserRole, rates: CommissionRate[]): DashboardRate[] {
  if (role === 'ADMIN') {
    return rates.map((rate) => ({ ...rate, role: 'ADMIN' }));
  }

  // Filter 1 single authorized route per university, studyLevel, and intake for STAFF & AGENT
  const groupMap = new Map<string, CommissionRate[]>();
  rates.forEach((rate) => {
    const key = `${rate.universityId || rate.universityName}__${rate.studyLevel}__${rate.intake}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(rate);
  });

  const singleRoutes: CommissionRate[] = [];
  groupMap.forEach((ratesForKey) => {
    const focusRate = ratesForKey.find((r) => r.guidance === 'FOCUS');
    if (focusRate) {
      singleRoutes.push(focusRate);
    } else if (role === 'AGENT') {
      const directRate = ratesForKey.find(
        (r) => (r.aggregator || '').toUpperCase() === 'BASECHAN' || (r.aggregator || '').toUpperCase() === 'DIRECT'
      );
      singleRoutes.push(directRate || ratesForKey[0]);
    } else {
      const topYield = ratesForKey.reduce((best, curr) => (curr.diffMargin > best.diffMargin ? curr : best), ratesForKey[0]);
      singleRoutes.push(topYield);
    }
  });

  if (role === 'STAFF') {
    return singleRoutes.map((rate) => ({
      role: 'STAFF',
      id: rate.id,
      universityId: rate.universityId,
      universityName: rate.universityName,
      country: rate.country,
      intake: rate.intake,
      aggregator: rate.aggregator,
      studyLevel: rate.studyLevel,
      guidance: rate.guidance,
      notes: rate.notes,
      updatedAt: rate.updatedAt,
      sourceSheet: rate.sourceSheet,
    }));
  }

  // AGENT role
  return singleRoutes.map((rate) => ({
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
