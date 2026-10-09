import type { CommissionRate, UserRole } from '../types';
import { normalizeChatVocabulary } from './chatVocabulary';

export interface QueryCompletion {
  label: string;
  completion: string;
}

const baseQueries = [
  'Show Focus schools',
  'Show allowed schools',
  'Show restricted schools',
  'Show postgraduate schools',
  'Show undergraduate schools',
  'Show foundation schools',
  'Compare two schools',
  'Show schools in',
  'Show Focus schools in',
  'Show restricted schools in',
  'Show schools wey get Focus',
  'Show schools wey no go use',
  'Abeg show me postgraduate schools',
  'Same for',
];

function matchesPrefix(query: string, candidate: string): boolean {
  const queryWords = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const candidateWords = candidate.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!queryWords.length || queryWords.length > candidateWords.length) return false;
  return queryWords.every((word, index) => index === queryWords.length - 1
    ? candidateWords[index].startsWith(word)
    : candidateWords[index] === word);
}

export function predictQueryCompletions(
  input: string,
  rates: CommissionRate[],
  role: UserRole,
  limit = 4,
): QueryCompletion[] {
  const query = input.trim().replace(/\s+/g, ' ');
  if (!query || limit < 1) return [];
  const normalizedQuery = normalizeChatVocabulary(query);

  const countries = Array.from(new Set(rates.map((rate) => rate.country).filter((item): item is string => Boolean(item))));
  const schools = Array.from(new Map(rates.map((rate) => [rate.universityId, rate.universityName])).values());
  const intakes = Array.from(new Set(rates.map((rate) => rate.intake).filter(Boolean)));
  const aggregators = role === 'AGENT' ? [] : Array.from(new Set(rates.map((rate) => rate.aggregator).filter(Boolean)));
  const candidates = [
    ...baseQueries,
    ...countries.flatMap((country) => [
      `Show schools in ${country}`,
      `Show Focus schools in ${country}`,
      `Show restricted schools in ${country}`,
      `Show postgraduate schools in ${country}`,
      `Show undergraduate schools in ${country}`,
    ]),
    ...schools.slice(0, 30).flatMap((school) => [
      school,
      `${school} postgraduate routes`,
      `${school} undergraduate routes`,
      `Show ${school}`,
      `Show postgraduate routes for ${school}`,
      `Compare ${school} with`,
    ]),
    ...intakes.slice(0, 12).map((intake) => `Show schools for ${intake}`),
    ...aggregators.slice(0, 12).map((aggregator) => `Show routes by ${aggregator}`),
    ...(role !== 'STAFF' ? [
      'Show the highest payout routes',
      'Show the lowest payout routes',
      'Show flat-fee routes',
      'Show percentage commission routes',
      'Show routes paying at least',
      'How much dem dey pay for',
    ] : []),
  ];

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => candidate.toLocaleLowerCase() !== query.toLocaleLowerCase()
      && (matchesPrefix(query, candidate) || matchesPrefix(normalizedQuery, normalizeChatVocabulary(candidate))))
    .filter((candidate) => {
      const key = candidate.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((completion) => {
      const typedWords = query.split(/\s+/).length;
      const words = completion.split(/\s+/);
      const label = words.slice(typedWords - 1).join(' ');
      return { label, completion };
    });
}
