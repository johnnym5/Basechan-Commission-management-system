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

// Geographic keyword maps for fallback country resolution
const COUNTRY_KEYWORD_PATTERNS: Array<{ country: string; keywords: string[] }> = [
  { country: 'Canada', keywords: ['canada', 'toronto', 'mcgill', 'vancouver', 'alberta', 'waterloo', 'mcmaster', 'calgary', 'ottawa', 'montreal', 'quebec', 'yorku', 'ryerson', 'tmu', 'simon fraser', 'sfu', 'manitoba', 'saskatchewan', 'dalhousie', 'victoria'] },
  { country: 'USA', keywords: ['usa', 'united states', 'harvard', 'mit', 'stanford', 'nyu', 'california', 'ucla', 'berkeley', 'texas', 'florida', 'chicago', 'columbia', 'yale', 'princeton', 'penn', 'michigan', 'cornell', 'duke', 'johns hopkins', 'northwestern', 'illinois', 'boston', 'purdue'] },
  { country: 'Australia', keywords: ['australia', 'melbourne', 'sydney', 'monash', 'queensland', 'unsw', 'rmit', 'deakin', 'curtin', 'adelaide', 'western australia', 'macquarie', 'uts', 'griffith', 'utas', 'canberra', 'flinders', 'la trobe', 'wollongong', 'swinburne'] },
  { country: 'UK', keywords: ['uk', 'united kingdom', 'england', 'scotland', 'wales', 'london', 'oxford', 'cambridge', 'manchester', 'edinburgh', 'glasgow', 'birmingham', 'leeds', 'sheffield', 'bristol', 'nottingham', 'southampton', 'newcastle', 'liverpool', 'cardiff', 'belfast', 'coventry', 'greenwich', 'leicester', 'aberdeen', 'dundee', 'stirling', 'strathclyde', 'exeter', 'york', 'bath', 'surrey', 'sussex', 'essex', 'reading', 'kent', 'swansea', 'aston', 'brunel', 'city', 'goldsmiths', 'kingston', 'lincoln', 'plymouth', 'portsmouth', 'salford', 'ulster', 'westminster', 'huddersfield', 'roehampton'] },
];

export const resolveUniversityCountry = (
  universityName: string,
  explicitCountry?: string,
  allRates: CommissionRate[] = []
): string => {
  if (explicitCountry && explicitCountry.trim() && explicitCountry.trim().toUpperCase() !== 'UNKNOWN') {
    return explicitCountry.trim();
  }

  const normUni = (universityName || '').toLowerCase().trim();
  if (!normUni) return 'UK';

  if (allRates && allRates.length > 0) {
    const knownMatch = allRates.find(
      (r) => r.universityName.toLowerCase().trim() === normUni && r.country && r.country.trim()
    );
    if (knownMatch && knownMatch.country) {
      return knownMatch.country.trim();
    }
  }

  for (const pattern of COUNTRY_KEYWORD_PATTERNS) {
    if (pattern.keywords.some((kw) => normUni.includes(kw))) {
      return pattern.country;
    }
  }

  return 'UK';
};

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

    const country = items.find((i) => i.country)?.country || resolveUniversityCountry(displayName, undefined, items);

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

/**
 * Determines if an intake belongs to a past/historical cycle.
 * Detects 4-digit years in the intake string (e.g. "Sept 2018", "Jan 2024", "2025")
 * and compares against referenceYear (defaults to current calendar year).
 */
export const isHistoricalIntake = (
  intake?: string,
  referenceYear: number = new Date().getFullYear()
): boolean => {
  if (!intake) return false;
  const match = intake.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return false;
  const year = parseInt(match[0], 10);
  return year < referenceYear;
};

