import type { CommissionRate, StudyLevel, SchoolGuidance } from '../types';
import { resolveUniversityCountry as baseResolveCountry } from './countryResolver';
import { findBestComparableRate } from './commissionFormatter';

export type GroupByMode = 'NONE' | 'UNIVERSITY' | 'COUNTRY' | 'AGGREGATOR';
export type GroupSortMode = 'MOST_ROUTES' | 'HIGHEST_MARGIN' | 'ALPHABETICAL';

export interface GroupedUniversity {
  groupKey: string;
  displayName: string;
  country: string;
  rates: CommissionRate[];
  totalRoutes: number;
  bestRoute: CommissionRate | null;
  maxMargin: number;
  studyLevels: StudyLevel[];
  aggregators: string[];
  guidance: SchoolGuidance;
}

export interface GenericGroup {
  groupName: string;
  count: number;
  rates: CommissionRate[];
}

export const resolveUniversityCountry = (
  universityName: string,
  explicitCountry?: string,
  allRates: CommissionRate[] = []
): string => {
  return baseResolveCountry(universityName, explicitCountry, allRates);
};

// Collision-resistant normalization for grouping key (keeps country / stable ID if available)
export const buildUniversityGroupKey = (rate: CommissionRate, allRates: CommissionRate[] = []): string => {
  const normName = normalizeUniversityName(rate.universityName || '');
  const country = resolveUniversityCountry(rate.universityName || '', rate.country, allRates).toLowerCase();

  if (allRates && allRates.length > 0) {
    const match = allRates.find((r) =>
      Boolean(r.universityName) &&
      normalizeUniversityName(r.universityName) === normName &&
      resolveUniversityCountry(r.universityName, r.country, allRates).toLowerCase() === country &&
      Boolean(r.universityId && r.universityId.trim())
    );
    if (match && match.universityId) {
      return match.universityId.trim().toLowerCase();
    }
  }

  if (rate.universityId && rate.universityId.trim()) {
    return rate.universityId.trim().toLowerCase();
  }

  return `${normName}__${country}`;
};

// Normalize school names so "University of Leicester" & "Leicester University" group together without collapsing different schools
export const normalizeUniversityName = (name: string): string => {
  if (!name) return 'unknown_institution';
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/^university of\s+/i, '')
    .replace(/\s+university$/i, '')
    .replace(/\s+scholarship.*$/i, '')
    .trim();
  return clean || name.toLowerCase().trim();
};

// Group commission rates by University
export const groupRatesByUniversity = (rates: CommissionRate[]): GroupedUniversity[] => {
  const map = new Map<string, CommissionRate[]>();

  (rates || []).forEach((rate) => {
    if (!rate || typeof rate !== 'object') return;
    const groupKey = buildUniversityGroupKey(rate, rates);
    if (!map.has(groupKey)) {
      map.set(groupKey, []);
    }
    map.get(groupKey)!.push(rate);
  });

  const groupedList: GroupedUniversity[] = [];

  map.forEach((items, groupKey) => {
    if (!items || items.length === 0) return;
    const validItems = items.filter((item) => {
      if (!item || typeof item.universityName !== 'string') return false;
      const master = typeof item.masterRate === 'number' ? item.masterRate : 0;
      const agent = typeof item.agentRate === 'number' ? item.agentRate : 0;
      return master > 0 || agent > 0;
    });
    if (validItems.length === 0) return;

    // Pick cleanest display name (prefer longer official title)
    const displayName = validItems.reduce((prev, curr) => {
      const prevLen = prev?.universityName?.length || 0;
      const currLen = curr?.universityName?.length || 0;
      return currLen > prevLen ? curr : prev;
    }, validItems[0])?.universityName || 'Unknown Institution';

    const country = validItems.find((i) => i.country)?.country || resolveUniversityCountry(displayName, undefined, validItems);

    // Find best yielding route strictly among comparable rates
    const { bestRate } = findBestComparableRate(validItems);
    const maxMargin = bestRate && typeof bestRate.diffMargin === 'number' && isFinite(bestRate.diffMargin) ? bestRate.diffMargin : 0;

    // Collect unique study levels & aggregators
    const studyLevels = Array.from(new Set(validItems.map((i) => i.studyLevel).filter(Boolean))).sort() as StudyLevel[];
    const aggregators = Array.from(new Set(validItems.map((i) => i.aggregator).filter(Boolean))).sort();

    // Determine aggregate guidance status (FOCUS > ALLOWED > DO_NOT_USE)
    let guidance: SchoolGuidance = 'ALLOWED';
    if (validItems.some((i) => i.guidance === 'FOCUS')) {
      guidance = 'FOCUS';
    } else if (validItems.every((i) => i.guidance === 'DO_NOT_USE')) {
      guidance = 'DO_NOT_USE';
    }

    groupedList.push({
      groupKey,
      displayName,
      country,
      rates: validItems,
      totalRoutes: validItems.length,
      bestRoute: bestRate,
      maxMargin,
      studyLevels,
      aggregators,
      guidance,
    });
  });

  return groupedList;
};



// Group commission rates by Country
export const groupRatesByCountry = (rates: CommissionRate[]): GenericGroup[] => {
  const map = new Map<string, CommissionRate[]>();

  rates.forEach((rate) => {
    const country = resolveUniversityCountry(rate.universityName, rate.country, rates);
    if (!map.has(country)) {
      map.set(country, []);
    }
    map.get(country)!.push(rate);
  });

  const groups: GenericGroup[] = [];
  map.forEach((items, countryName) => {
    groups.push({
      groupName: countryName,
      count: items.length,
      rates: items,
    });
  });

  return groups.sort((a, b) => b.count - a.count);
};

// Group commission rates by Aggregator
export const groupRatesByAggregator = (rates: CommissionRate[]): GenericGroup[] => {
  const map = new Map<string, CommissionRate[]>();

  rates.forEach((rate) => {
    const agg = rate.aggregator || 'Direct';
    if (!map.has(agg)) {
      map.set(agg, []);
    }
    map.get(agg)!.push(rate);
  });

  const groups: GenericGroup[] = [];
  map.forEach((items, aggName) => {
    groups.push({
      groupName: aggName,
      count: items.length,
      rates: items,
    });
  });

  return groups.sort((a, b) => b.count - a.count);
};

// Sort Grouped Universities
export const sortGroupedUniversities = (
  groups: GroupedUniversity[],
  sortMode: GroupSortMode
): GroupedUniversity[] => {
  return [...groups].sort((a, b) => {
    if (!a || !b) return 0;
    if (sortMode === 'MOST_ROUTES') {
      if ((b.totalRoutes || 0) !== (a.totalRoutes || 0)) {
        return (b.totalRoutes || 0) - (a.totalRoutes || 0);
      }
      return (b.maxMargin || 0) - (a.maxMargin || 0);
    }
    if (sortMode === 'HIGHEST_MARGIN') {
      if ((b.maxMargin || 0) !== (a.maxMargin || 0)) {
        return (b.maxMargin || 0) - (a.maxMargin || 0);
      }
      return (b.totalRoutes || 0) - (a.totalRoutes || 0);
    }
    // ALPHABETICAL
    return String(a.displayName || '').localeCompare(String(b.displayName || ''));
  });
};

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Determines if an intake belongs to a past/historical cycle.
 * Detects 4-digit years and optional month name (e.g. "Sept 2026", "Jan 2026", "2025")
 * and compares against referenceYear and referenceMonth (1-12, defaults to current calendar date).
 */
export const isHistoricalIntake = (
  intake?: string,
  referenceYear: number = new Date().getFullYear(),
  referenceMonth?: number
): boolean => {
  if (!intake) return false;
  const yearMatch = intake.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return false;
  const year = parseInt(yearMatch[0], 10);

  if (year < referenceYear) return true;
  if (year > referenceYear) return false;

  if (referenceMonth !== undefined) {
    const lower = intake.toLowerCase();
    for (const [mName, mNum] of Object.entries(MONTH_MAP)) {
      const regex = new RegExp(`\\b${mName}\\b`, 'i');
      if (regex.test(lower)) {
        return mNum < referenceMonth;
      }
    }
  }

  return false;
};


