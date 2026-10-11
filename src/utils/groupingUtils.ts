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
export const buildUniversityGroupKey = (rate: CommissionRate, allRates: CommissionRate[]): string => {
  if (rate.universityId && rate.universityId.trim()) {
    return rate.universityId.trim().toLowerCase();
  }
  const normName = normalizeUniversityName(rate.universityName);
  const country = resolveUniversityCountry(rate.universityName, rate.country, allRates);
  return `${normName}__${country.toLowerCase()}`;
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

  rates.forEach((rate) => {
    const groupKey = buildUniversityGroupKey(rate, rates);
    if (!map.has(groupKey)) {
      map.set(groupKey, []);
    }
    map.get(groupKey)!.push(rate);
  });

  const groupedList: GroupedUniversity[] = [];

  map.forEach((items, groupKey) => {
    // Pick cleanest display name (prefer longer official title)
    const displayName = items.reduce((prev, curr) =>
      curr.universityName.length > prev.universityName.length ? curr : prev
    , items[0]).universityName;

    const country = items.find((i) => i.country)?.country || resolveUniversityCountry(displayName, undefined, items);

    // Find best yielding route strictly among comparable rates
    const { bestRate } = findBestComparableRate(items);
    const maxMargin = bestRate && typeof bestRate.diffMargin === 'number' && isFinite(bestRate.diffMargin) ? bestRate.diffMargin : 0;

    // Collect unique study levels & aggregators
    const studyLevels = Array.from(new Set(items.map((i) => i.studyLevel))).sort() as StudyLevel[];
    const aggregators = Array.from(new Set(items.map((i) => i.aggregator))).sort();

    // Determine aggregate guidance status (FOCUS > ALLOWED > DO_NOT_USE)
    let guidance: SchoolGuidance = 'ALLOWED';
    if (items.some((i) => i.guidance === 'FOCUS')) {
      guidance = 'FOCUS';
    } else if (items.every((i) => i.guidance === 'DO_NOT_USE')) {
      guidance = 'DO_NOT_USE';
    }

    groupedList.push({
      groupKey,
      displayName,
      country,
      rates: items,
      totalRoutes: items.length,
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
    if (sortMode === 'MOST_ROUTES') {
      if (b.totalRoutes !== a.totalRoutes) {
        return b.totalRoutes - a.totalRoutes;
      }
      return b.maxMargin - a.maxMargin;
    }
    if (sortMode === 'HIGHEST_MARGIN') {
      if (b.maxMargin !== a.maxMargin) {
        return b.maxMargin - a.maxMargin;
      }
      return b.totalRoutes - a.totalRoutes;
    }
    // ALPHABETICAL
    return a.displayName.localeCompare(b.displayName);
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
  referenceMonth: number = new Date().getMonth() + 1
): boolean => {
  if (!intake) return false;
  const yearMatch = intake.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return false;
  const year = parseInt(yearMatch[0], 10);

  if (year < referenceYear) return true;
  if (year > referenceYear) return false;

  // Same year: inspect if a month prefix or keyword exists
  const lower = intake.toLowerCase();
  for (const [mName, mNum] of Object.entries(MONTH_MAP)) {
    // Check word boundary or start of intake
    const regex = new RegExp(`\\b${mName}\\b`, 'i');
    if (regex.test(lower)) {
      return mNum < referenceMonth;
    }
  }

  // Year-only intake in current year: not classified as historical
  return false;
};


