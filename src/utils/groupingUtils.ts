import type { CommissionRate, StudyLevel, SchoolGuidance } from '../types';

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

// Normalize school names so "University of Leicester" & "Leicester University" group together
export const normalizeUniversityName = (name: string): string => {
  if (!name) return 'Unknown University';
  return name
    .toLowerCase()
    .replace(/^university of\s+/i, '')
    .replace(/\s+university$/i, '')
    .replace(/\s+scholarship.*$/i, '')
    .replace(/\s+campus.*$/i, '')
    .trim();
};

// Group commission rates by University
export const groupRatesByUniversity = (rates: CommissionRate[]): GroupedUniversity[] => {
  const map = new Map<string, CommissionRate[]>();

  rates.forEach((rate) => {
    const norm = normalizeUniversityName(rate.universityName);
    if (!map.has(norm)) {
      map.set(norm, []);
    }
    map.get(norm)!.push(rate);
  });

  const groupedList: GroupedUniversity[] = [];

  map.forEach((items, normKey) => {
    // Pick cleanest display name (prefer longer official title)
    const displayName = items.reduce((prev, curr) =>
      curr.universityName.length > prev.universityName.length ? curr : prev
    , items[0]).universityName;

    const country = items.find((i) => i.country)?.country || 'UK';

    // Find best yielding route
    const bestRoute = items.reduce((prev, curr) =>
      curr.diffMargin > prev.diffMargin ? curr : prev
    , items[0]);

    const maxMargin = bestRoute ? bestRoute.diffMargin : 0;

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
      groupKey: normKey,
      displayName,
      country,
      rates: items,
      totalRoutes: items.length,
      bestRoute,
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
    const country = rate.country || 'United Kingdom';
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
