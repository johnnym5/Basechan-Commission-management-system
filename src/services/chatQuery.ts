import type { CommissionRate, StudyLevel, UserRole } from '../types';
import type { IntakeYearRange } from '../types/chat';
import { GRAMMAR_LEXICON, normalizeChatEntityName, normalizeChatVocabulary } from './chatVocabulary';

export const MAX_CHAT_INPUT_LENGTH = 500;
export const MAX_COMPARISON_SCHOOLS = 4;

export interface ChatIntent {
  schoolTerms: string[];
  intakeTerms: string[];
  level?: Exclude<StudyLevel, 'ALL'>;
  compare: boolean;
  guidance?: 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE';
  guidances?: Array<'FOCUS' | 'ALLOWED' | 'DO_NOT_USE'>;
  intakeOrder?: 'latest' | 'earliest';
  intakeYearRange?: IntakeYearRange;
  invalidIntakeYearRange?: boolean;
  scopeSelection?: 'all' | 'intake' | 'level';
  needsLevel: boolean;
  needsSchool: boolean;
  ambiguousSchools: string[];
  unmatchedSchoolLikeTerms: string[];
  suggestedSchools: string[];
  outOfScope: boolean;
  countryTerms: string[];
  aggregatorTerms: string[];
  suggestedAggregators: string[];
  intakeSuggestions: string[];
  rateMinimum?: number;
  rateMaximum?: number;
  feeType?: 'FLAT' | 'PERCENTAGE';
  feeTypeUnclear: boolean;
  sortBy?: 'rate_desc' | 'rate_asc';
  broadSearch: boolean;
  rankingUnclear: boolean;
  unsupportedMetric?: string;
  quantity?: 'schools' | 'routes';
}

export function sanitizeChatInput(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_INPUT_LENGTH);
}

function findLevel(text: string): ChatIntent['level'] {
  if (/\b(post\s*grad|postgraduate|master'?s|msc|phd|doctoral)\b/i.test(text)) return 'PG';
  if (/\b(under\s*grad|undergraduate|bachelor'?s|bsc)\b/i.test(text)) return 'UG';
  if (/\b(foundation|fd)\b/i.test(text)) return 'FD';
  return undefined;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function includesPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  return new RegExp(`(^|[^a-z0-9])${escaped.replace(/\s+/g, '\\s+')}(?=$|[^a-z0-9])`, 'i').test(text);
}

const entitySearchStopWords = new Set([
  'show', 'find', 'list', 'search', 'me', 'please', 'could', 'can', 'would', 'will', 'i', 'want', 'need', 'know',
  'all', 'any', 'every', 'available', 'active', 'listed', 'partner', 'school', 'schools', 'university', 'universities',
  'institution', 'institutions', 'route', 'routes', 'record', 'records', 'in', 'on', 'of', 'for', 'with', 'and', 'or',
  'the', 'a', 'an', 'from', 'between', 'to', 'through', 'intake', 'intakes', 'aggregator', 'aggregators', 'filter',
  ...Array.from(GRAMMAR_LEXICON.RELATIONAL_ADJECTIVES),
  ...Array.from(GRAMMAR_LEXICON.ACTION_VERBS),
  ...Array.from(GRAMMAR_LEXICON.DOMAIN_NOUNS),
  ...Array.from(GRAMMAR_LEXICON.GUIDANCE_ADJECTIVES),
]);

function matchLocalNames(text: string, knownNames: string[]): { exact: string[]; suggested: string[] } {
  const names = Array.from(new Set(knownNames.filter(Boolean)));
  const allWords = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  const candidateWords = allWords.map((word, index) => ({ word, index }))
    .filter(({ word }) => !entitySearchStopWords.has(word));
  const windows = (count: number, source = candidateWords) => Array.from({ length: Math.max(0, source.length - count + 1) }, (_, start) => ({
    value: source.slice(start, start + count).map(({ word }) => word).join(''),
    indexes: source.slice(start, start + count).map(({ index }) => index),
  }));
  const exactNames: string[] = [];
  const exactIndexes = new Set<number>();
  for (const name of names) {
    const normalized = normalizeChatEntityName(name);
    const parts = name.toLowerCase().match(/[a-z0-9]+/g) || [];
    const match = windows(parts.length).find((window) => window.value === normalized);
    if (match || includesPhrase(text, name) || text.trim().toLowerCase() === name.toLowerCase()) {
      exactNames.push(name);
      if (match) match.indexes.forEach((index) => exactIndexes.add(index));
    }
  }

  const remainingWords = candidateWords.filter(({ index }) => !exactIndexes.has(index));
  const fuzzyWindows = Array.from({ length: Math.min(4, remainingWords.length) }, (_, index) => index + 1)
    .flatMap((count) => windows(count, remainingWords));
  const bestCandidates = new Map<string, number>();
  for (const name of names.filter((candidate) => !exactNames.includes(candidate))) {
    const normalized = normalizeChatEntityName(name);
    const maxDistance = normalized.length >= 7 ? 2 : 1;
    for (const window of fuzzyWindows) {
      if (!window.value) continue;
      const distance = editDistance(window.value, normalized);
      if (distance <= maxDistance && (!bestCandidates.has(name) || distance < bestCandidates.get(name)!)) bestCandidates.set(name, distance);
    }
  }
  if (!bestCandidates.size) return { exact: Array.from(new Set(exactNames)), suggested: [] };
  const bestDistance = Math.min(...bestCandidates.values());
  return {
    exact: Array.from(new Set(exactNames)),
    suggested: Array.from(bestCandidates.entries()).filter(([, distance]) => distance === bestDistance).map(([name]) => name).slice(0, 4),
  };
}

export function parseChatIntent(input: string, knownSchools: string[], knownCountries: string[] = [], knownAggregators: string[] = [], role: UserRole = 'AGENT', knownIntakes: string[] = []): ChatIntent {
  const text = normalizeChatVocabulary(sanitizeChatInput(input));
  const normalizedSchools = Array.from(new Set(knownSchools.filter(Boolean)));
  const asksQuantity = /\bhow\s+many\b|\bnumber\s+of\b|\bcount\s+(?:the\s+)?/i.test(text);
  const quantity: ChatIntent['quantity'] = asksQuantity
    ? /\b(routes?|records?|entries|commissions?)\b/i.test(text)
      ? 'routes'
      : /\b(schools?|universit(?:y|ies)|institutions?)\b/i.test(text)
        ? 'schools'
        : /\b(focus|preferred|priority|allowed|permitted|restricted|avoid|do not use)\b/i.test(text)
          ? 'schools'
          : undefined
    : undefined;
  const exactMatches = normalizedSchools.filter((name) => includesPhrase(text, name));
  const exactSchoolTerms = exactMatches.filter((name) => !exactMatches.some((other) => other !== name && other.length > name.length && other.toLowerCase().includes(name.toLowerCase())));
  const countryAliases: Record<string, string[]> = {
    'united kingdom': ['uk', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'],
    uk: ['united kingdom', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'],
    'united states': ['usa', 'u.s.a.', 'us', 'u.s.', 'america'],
    usa: ['united states', 'u.s.a.', 'us', 'u.s.', 'america'],
  };
  const normalizedCountries = Array.from(new Set(knownCountries.filter(Boolean)));
  const directCountries = normalizedCountries.filter((country) => includesPhrase(text, country));
  const aliasCountries = normalizedCountries.filter((country) => (countryAliases[country.toLowerCase()] || []).some((alias) => includesPhrase(text, alias)));
  const requestsUnitedKingdom = ['united kingdom', 'uk', 'u.k.', 'britain', 'great britain'].some((alias) => includesPhrase(text, alias));
  const unitedKingdomLabels = ['united kingdom', 'uk', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'];
  const countryTerms = Array.from(new Set(requestsUnitedKingdom
    ? [...directCountries, ...aliasCountries, ...normalizedCountries.filter((country) => unitedKingdomLabels.includes(country.toLowerCase()))]
    : directCountries.length ? directCountries : aliasCountries));
  const countryMentions = [...normalizedCountries.flatMap((country) => [country, ...(countryAliases[country.toLowerCase()] || [])]).filter((term) => includesPhrase(text, term)),
    ...(requestsUnitedKingdom ? ['united kingdom', 'uk', 'u.k.', 'britain', 'great britain'] : [])];
  const canReadPayout = role !== 'STAFF';
  const canReadRouting = role !== 'AGENT';
  const defaultKnownAggregators = ['SI-UK', 'EDVOY', 'UAP', 'CRIZAC', 'BASECHAN', 'Direct'];
  const allAggregatorsToMatch = Array.from(new Set([...knownAggregators, ...defaultKnownAggregators].filter(Boolean)));
  const aggregatorMatches = canReadRouting ? matchLocalNames(text, allAggregatorsToMatch) : { exact: [], suggested: [] };
  const aggregatorTerms = aggregatorMatches.exact;
  const suggestedAggregators = aggregatorMatches.suggested;

  const containsYearRangeText = /\b20\d{2}\s*(?:[-–—]|to|through|and)\s*20\d{2}\b/i.test(text);
  const intakeMatches = containsYearRangeText ? { exact: [], suggested: [] } : matchLocalNames(text, knownIntakes);
  const exactMonthIntakes = sanitizeChatInput(input).match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter)\s*(?:[-/]\s*)?20\d{2}\b/gi) || [];
  const intakeSuggestions = containsYearRangeText || exactMonthIntakes.length ? [] : intakeMatches.suggested;

  const exactIntakeTerms = containsYearRangeText
    ? []
    : exactMonthIntakes.length > 0
      ? exactMonthIntakes
      : intakeSuggestions.length > 0
        ? []
        : (/\b20\d{2}\b/.test(text) ? text.match(/\b20\d{2}\b/g) || [] : []);

  const minimumMatch = canReadPayout ? text.match(/\b(?:at least|minimum|min|over|above|more than|greater than|>=?)\s*[£$]?\s*(\d+(?:\.\d+)?)\s*(%|percent)?/i) : null;
  const maximumMatch = canReadPayout ? text.match(/\b(?:up to|maximum|max|under|below|less than|fewer than|<=?)\s*[£$]?\s*(\d+(?:\.\d+)?)\s*(%|percent)?/i) : null;
  const thresholdMatch = minimumMatch || maximumMatch;
  const rateMinimum = minimumMatch ? Number(minimumMatch[1]) : undefined;
  const rateMaximum = maximumMatch ? Number(maximumMatch[1]) : undefined;
  const feeType = canReadPayout && (/\b(flat fee|fixed fee)\b/i.test(input) || /[£$]/.test(input))
    ? 'FLAT'
    : canReadPayout && /\b(percent|percentage|commission rate)\b/i.test(input) || thresholdMatch?.[2]
      ? 'PERCENTAGE'
      : undefined;
  const sortBy = canReadPayout && /\b(highest payout|highest paying|best paying|largest payout|top paying)\b/i.test(text)
    ? 'rate_desc'
    : canReadPayout && /\b(lowest payout|lowest paying|smallest payout|bottom paying)\b/i.test(text)
      ? 'rate_asc'
      : undefined;
  const intakeOrder = /\b(?:highest|latest|newest|most recent|last|furthest|farthest)\b.{0,32}\bintakes?\b|\bintakes?\b.{0,32}\b(?:highest|latest|newest|most recent|last|furthest|farthest)\b/i.test(text)
    ? 'latest'
    : /\b(?:lowest|earliest|oldest|first)\b.{0,32}\bintakes?\b|\bintakes?\b.{0,32}\b(?:lowest|earliest|oldest|first)\b/i.test(text)
      ? 'earliest'
      : undefined;
  const scopeSelection: ChatIntent['scopeSelection'] = /\b(?:general|overall|everything|all of them|all available)\b|\b(?:all|every)\s+(?:available\s+)?(?:intakes? and (?:study\s+)?levels?|routes?|schools?)\b|\b(?:all|every)\s+(?:study\s+)?levels?\s+and\s+(?:available\s+)?intakes?\b/i.test(text)
    ? 'all'
    : /\b(?:choose\s+(?:(?:a|an)\s+)?(?:specific\s+)?intake|specific\s+intake|particular\s+intake)\b/i.test(text)
      ? 'intake'
      : /\b(?:choose\s+(?:(?:a|an)\s+)?(?:specific\s+)?(?:study\s+)?level|specific\s+(?:study\s+)?level|particular\s+(?:study\s+)?level)\b/i.test(text)
        ? 'level'
        : undefined;
  const rankingUnclear = !intakeOrder && /\b(best|top|recommended|recommend|highest|lowest|largest|smallest)\b/i.test(text)
    && !/\b(highest payout|highest paying|lowest payout|lowest paying|top paying|best paying|largest payout|smallest payout)\b/i.test(text);
  const unsupportedMetric = !canReadPayout && /\b(highest|lowest|top|best)\b.{0,24}\b(payout|paying|commission|rate)\b/i.test(text)
    ? 'payout ranking'
    : /\b(fastest|processing time|conversion rate|conversion|success rate|deadline|processing speed)\b/i.test(text)
      ? ( /\b(conversion|success rate)\b/i.test(text) ? 'conversion rate' : 'processing time' )
    : undefined;
  const schoolText = [...countryMentions, ...countryTerms, ...aggregatorTerms, ...suggestedAggregators, ...intakeSuggestions].reduce((remaining, term) => remaining.replace(new RegExp(term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'ig'), ' '), text);
  const genericSchoolWords = new Set([
    'university', 'universities', 'school', 'schools', 'college', 'colleges', 'institute', 'institutes', 'international', 'group', 'campus', 'center', 'centre', 'foundation', 'undergraduate', 'postgraduate', 'bachelor', 'master', 'doctoral', 'focus', 'preferred', 'priority', 'allowed', 'permitted', 'restricted', 'compare', 'school', 'routes', 'available', 'partner', 'highest', 'lowest', 'recommended', 'processing', 'conversion', 'success', 'give', 'take', 'change', 'add', 'remove', 'update', 'increase', 'decrease', 'filter', 'adjust', 'set', 'show', 'find', 'check', 'get', 'make',
    ...Array.from(GRAMMAR_LEXICON.RELATIONAL_ADJECTIVES),
    ...Array.from(GRAMMAR_LEXICON.ACTION_VERBS),
    ...Array.from(GRAMMAR_LEXICON.DOMAIN_NOUNS),
    ...Array.from(GRAMMAR_LEXICON.GUIDANCE_ADJECTIVES),
  ]);
  const wordMatches = normalizedSchools.filter((name) => name.toLowerCase().split(/\s+/).some((word) => word.length >= 5 && !genericSchoolWords.has(word) && includesPhrase(schoolText, word)));
  const schoolTerms = (exactSchoolTerms.length ? exactSchoolTerms : wordMatches).sort((a, b) => b.length - a.length).slice(0, MAX_COMPARISON_SCHOOLS);
  const ambiguousSchools = exactSchoolTerms.length > MAX_COMPARISON_SCHOOLS ? exactSchoolTerms : [];
  const intakeTerms = Array.from(new Set([...exactIntakeTerms, ...intakeMatches.exact]));
  const yearRangeMatch = text.match(/\b(?:from\s+|between\s+)?(20\d{2})\s*(?:[-–—]|to|through|and)\s*(20\d{2})\b/i);
  const intakeYearRange: IntakeYearRange | undefined = yearRangeMatch && Number(yearRangeMatch[1]) <= Number(yearRangeMatch[2])
    ? { startYear: Number(yearRangeMatch[1]), endYear: Number(yearRangeMatch[2]) }
    : undefined;
  const invalidIntakeYearRange = Boolean(yearRangeMatch && Number(yearRangeMatch[1]) > Number(yearRangeMatch[2]));
  const guidances = [
    ...( /\b(focus|preferred|priority)\b/i.test(text) ? ['FOCUS' as const] : []),
    ...( /\b(avoid|restricted|do not use)\b/i.test(text) ? ['DO_NOT_USE' as const] : []),
    ...( /\b(allowed|permitted)\b/i.test(text) ? ['ALLOWED' as const] : []),
  ];
  const guidance = guidances[0];
  const level = findLevel(text);
  const explicitBroadSearch = /\b(?:all|any|every|available|active|listed|partner)\s+(?:available\s+|active\s+|listed\s+|partner\s+)?(?:schools?|universit(?:y|ies)|institutions?|routes?)\b|\b(?:show|list|find)\s+(?:me\s+)?everything\b/i.test(text);

  const relationalWordsRegex = Array.from(GRAMMAR_LEXICON.RELATIONAL_ADJECTIVES).join('|');
  const actionWordsRegex = Array.from(GRAMMAR_LEXICON.ACTION_VERBS).join('|');
  const domainNounsRegex = Array.from(GRAMMAR_LEXICON.DOMAIN_NOUNS).join('|');

  const scrubbed = schoolText
    .replace(new RegExp(`\\b(?:${relationalWordsRegex}|${actionWordsRegex}|${domainNounsRegex}|how|many|number|count|which|what|about|do|does|they|their|is|are|have|currently|current|presently|compare|versus|vs|difference|between|show|find|list|search|school|schools|university|universities|institution|institutions|route|routes|record|records|entry|entries|result|results|my|rate|rates|commission|commissions|payout|paying|paid|flat|fee|fixed|percentage|percent|highest|lowest|latest|earliest|newest|oldest|last|first|largest|smallest|top|bottom|best|fastest|processing|time|conversion|success|minimum|min|maximum|max|least|more|less|greater|than|above|below|over|under|at|up|to|from|with|without|same|also|instead|this|that|these|those|it|sort|by|for|me|please|want|need|help|check|choose|specific|particular|general|overall|everything|them|all|any|every|available|active|listed|partner|name|two|three|four|the|a|an|and|in|on|of|study|focus|preferred|priority|avoid|restricted|do not use|allowed|permitted|foundation|fd|undergrad(?:uate)?|bachelor'?s|bsc|post\s*grad(?:uate)?|master'?s|msc|phd|doctoral|levels?|intakes?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter|give|take|change|add|remove|update|increase|decrease|adjust|set|filter|get|make|20\\d{2})\\b`, 'gi'), ' ')
    .replace(/\b\d+(?:\.\d+)?\b|[£$%>=]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
    
  const unmatchedSchoolLikeTerms = scrubbed.split(/\s+/).filter((term) => term.length >= 4
    && !normalizedSchools.some((name) => name.toLowerCase().split(/\s+/).some((word) => word === term))
    && ![...suggestedAggregators, ...intakeSuggestions].some((name) => {
      const entityName = normalizeChatEntityName(name);
      return editDistance(term, entityName) <= (entityName.length >= 7 ? 2 : 1);
    }));
  const hasNonSchoolFilter = countryTerms.length > 0 || aggregatorTerms.length > 0 || suggestedAggregators.length > 0 || intakeSuggestions.length > 0 || guidances.length > 0 || rateMinimum !== undefined || rateMaximum !== undefined || feeType !== undefined || sortBy !== undefined || rankingUnclear || intakeOrder !== undefined || intakeYearRange !== undefined || invalidIntakeYearRange;
  const broadSearch = explicitBroadSearch || quantity !== undefined || intakeOrder !== undefined || (hasNonSchoolFilter && (Boolean(level) || intakeTerms.length > 0 || guidances.length > 0));
  const suggestedSchools = Array.from(new Set(unmatchedSchoolLikeTerms.flatMap((term) => {
    const candidates = normalizedSchools
      .map((name) => ({ name, distance: Math.min(...name.toLowerCase().split(/\s+/).map((word) => editDistance(term, word))) }))
      .filter((candidate) => candidate.distance <= (term.length >= 7 ? 1 : 0))
      .sort((a, b) => a.distance - b.distance);
    const bestDistance = candidates[0]?.distance;
    return bestDistance === undefined ? [] : candidates.filter((candidate) => candidate.distance === bestDistance).slice(0, 4).map((candidate) => candidate.name);
  })));
  const domainCue = /\b(search|show|find|list|school|schools|university|universities|institution|institutions|rate|rates|commission|route|routes|aggregator|compare|versus|vs|payout|focus|preferred|priority|avoid|restricted|do not use|allowed|permitted|foundation|undergraduate|postgraduate|bachelor|master|intake|level|best|top|recommended|fastest|conversion|how many|number of|count|from|between|to|through)\b/i.test(text);
  const outOfScope = !domainCue && !schoolTerms.length && !countryTerms.length && !aggregatorTerms.length && !guidance && rateMinimum === undefined && rateMaximum === undefined && !intakeTerms.length;
  return {
    schoolTerms,
    intakeTerms,
    level,
    compare: /\b(compare|versus|vs\.?|difference between)\b/i.test(text),
    guidance,
    needsLevel: !level && (
      schoolTerms.length > 0
      || /\b(compare|versus|vs\.?|difference between)\b/i.test(text)
      || (!hasNonSchoolFilter && !broadSearch)
    ),
    needsSchool: schoolTerms.length === 0 && !hasNonSchoolFilter && !broadSearch,
    ambiguousSchools,
    unmatchedSchoolLikeTerms,
    suggestedSchools,
    outOfScope,
    countryTerms,
    aggregatorTerms,
    suggestedAggregators,
    intakeSuggestions,
    rateMinimum,
    rateMaximum,
    feeType,
    feeTypeUnclear: role === 'AGENT' && thresholdMatch !== null && feeType === undefined,
    sortBy,
    broadSearch,
    rankingUnclear,
    unsupportedMetric,
    quantity,
    guidances,
    intakeOrder,
    intakeYearRange,
    invalidIntakeYearRange,
    scopeSelection,
  };
}

export function filterRatesByIntent(rates: CommissionRate[], intent: ChatIntent): CommissionRate[] {
  return rates.filter((rate) => {
    if (intent.invalidIntakeYearRange) return false;
    if (intent.intakeYearRange) {
      const startYear = getIntakeStartYear(rate.intake);
      if (startYear === null || startYear < intent.intakeYearRange.startYear || startYear > intent.intakeYearRange.endYear) return false;
    }
    if (intent.schoolTerms.length && !intent.schoolTerms.some((school) => school.toLowerCase() === rate.universityName.toLowerCase())) return false;
    if (intent.intakeTerms.length && !intent.intakeTerms.some((intake) => rate.intake.toLowerCase().includes(intake.toLowerCase()))) return false;
    if (intent.level && rate.studyLevel !== intent.level && rate.studyLevel !== 'ALL') return false;
    const requestedGuidances = intent.guidances?.length ? intent.guidances : intent.guidance ? [intent.guidance] : [];
    if (requestedGuidances.length && !requestedGuidances.includes(rate.guidance || 'ALLOWED')) return false;
    if (intent.countryTerms.length && !intent.countryTerms.some((country) => (rate.country || '').toLowerCase() === country.toLowerCase())) return false;
    if (intent.aggregatorTerms.length && !intent.aggregatorTerms.some((aggregator) => (rate.aggregator || '').toLowerCase() === aggregator.toLowerCase())) return false;
    if (intent.rateMinimum !== undefined && (rate.agentRate ?? 0) < intent.rateMinimum) return false;
    if (intent.rateMaximum !== undefined && (rate.agentRate ?? Number.POSITIVE_INFINITY) > intent.rateMaximum) return false;
    if (intent.feeType === 'FLAT' && !rate.isFlatFee) return false;
    if (intent.feeType === 'PERCENTAGE' && rate.isFlatFee) return false;
    return true;
  });
}

export function getIntakeStartYear(intake: string): number | null {
  const academicYear = intake.match(/\b(20\d{2})\s*[-–—/]\s*20\d{2}\b/);
  if (academicYear) return Number(academicYear[1]);
  const datedLabel = intake.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter)\s*(?:[-/]\s*)?(20\d{2})\b/i);
  return datedLabel ? Number(datedLabel[1]) : null;
}

export function getIntakeDateKey(intake: string): number | null {
  const monthMap: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const monthMatches = Array.from(intake.toLowerCase().matchAll(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:[-/]\s*)?(20\d{2})\b/g));
  const lastMonth = monthMatches.at(-1);
  if (lastMonth) return new Date(Number(lastMonth[2]), monthMap[lastMonth[1].slice(0, 3)], 1).getTime();
  const season = intake.toLowerCase().match(/\b(spring|summer|fall|autumn|winter)\s*(20\d{2})\b/);
  if (!season) return null;
  const seasonMonth: Record<string, number> = { spring: 2, summer: 5, fall: 8, autumn: 8, winter: 11 };
  return new Date(Number(season[2]), seasonMonth[season[1]], 1).getTime();
}

export function getDefaultIntake(rates: CommissionRate[], now = new Date()): string | undefined {
  const intakes = Array.from(new Set(rates.map((rate) => rate.intake)));
  const monthMap: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const toTime = (intake: string): number | null => {
    const normalized = intake.toLowerCase();
    const monthMatch = normalized.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(?:[-/]\s*)?(20\d{2})/);
    if (monthMatch) return new Date(Number(monthMatch[2]), monthMap[monthMatch[1]], 1).getTime();
    const seasonMatch = normalized.match(/(spring|summer|fall|autumn|winter)\s*(20\d{2})/);
    if (!seasonMatch) return null;
    const seasonMonth: Record<string, number> = { spring: 2, summer: 5, fall: 8, autumn: 8, winter: 11 };
    return new Date(Number(seasonMatch[2]), seasonMonth[seasonMatch[1]], 1).getTime();
  };
  const dated = intakes.map((intake) => ({ intake, time: toTime(intake) })).filter((item): item is { intake: string; time: number } => item.time !== null);
  if (!dated.length) {
    const current = rates.find((rate) => /current|ongoing|nearest/i.test(rate.intake));
    return current?.intake || intakes[0];
  }
  const future = dated.filter(({ time }) => time >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()).sort((a, b) => a.time - b.time);
  if (future[0]) return future[0].intake;
  const datedDescending = [...dated].sort((a, b) => b.time - a.time);
  return datedDescending[0]?.intake || rates.find((rate) => /current|ongoing|nearest/i.test(rate.intake))?.intake || intakes[0];
}

export function buildClarifyingQuestions(intent: ChatIntent): string[] {
  if (intent.outOfScope) return ['I can help find and compare Basechan schools, guidance, intakes, and role-appropriate rates. What would you like to search?'];
  const questions: string[] = [];
  if (intent.invalidIntakeYearRange) questions.push('The start year must be before the end year. Which intake year range should I use?');
  if (intent.suggestedAggregators.length) questions.push(intent.suggestedAggregators.length === 1
    ? `Did you mean ${intent.suggestedAggregators[0]}? Choose it to apply the aggregator filter.`
    : `Which aggregator did you mean: ${intent.suggestedAggregators.join(', ')}?`);
  if (intent.intakeSuggestions.length) questions.push(intent.intakeSuggestions.length === 1
    ? `Did you mean the ${intent.intakeSuggestions[0]} intake? Choose it to apply the intake filter.`
    : `Which intake did you mean: ${intent.intakeSuggestions.join(', ')}?`);
  if (intent.unsupportedMetric) questions.push(intent.unsupportedMetric === 'payout ranking'
    ? 'Payout rankings aren’t available for your role. I can filter by country, level, intake, or Focus guidance. Which would help?'
    : `I can’t rank schools by ${intent.unsupportedMetric} because that information isn’t in the local database. I can filter by country, level, intake, Focus guidance${intent.unsupportedMetric === 'conversion rate' ? '' : ', or available rates'}. What would you like to use?`);
  if (intent.feeTypeUnclear) questions.push('Should I compare percentage payouts or flat fees?');
  if (intent.rankingUnclear) questions.push('What should “best” mean for this search? Choose a supported option such as Focus schools, highest available payout, or a specific country, level, or intake.');
  if (intent.quantity === 'schools' && intent.scopeSelection === 'intake' && !intent.intakeTerms.length) {
    questions.push('Which available intake should I use?');
  } else if (intent.quantity === 'schools' && intent.scopeSelection === 'level' && !intent.level) {
    questions.push('Which study level should I use: Foundation, Undergraduate, or Postgraduate?');
  }
  if (intent.needsLevel) questions.push('Which study level should I use: Foundation, Undergraduate, or Postgraduate?');
  if (intent.ambiguousSchools.length) questions.push(`I found ${intent.ambiguousSchools.length} schools; which four or fewer should I include: ${intent.ambiguousSchools.join(', ')}?`);
  if (intent.unmatchedSchoolLikeTerms.length) questions.push(intent.suggestedSchools.length
    ? `I couldn’t match “${intent.unmatchedSchoolLikeTerms.join(' ')}”. Did you mean ${intent.suggestedSchools.join(' or ')}? Please confirm before I search.`
    : `I couldn’t match “${intent.unmatchedSchoolLikeTerms.join(' ')}” to a school name. Please check the spelling or choose a school from the results.`);
  if (intent.needsSchool) questions.push('Which school or schools are you interested in? You can name up to four to compare.');
  return questions;
}
