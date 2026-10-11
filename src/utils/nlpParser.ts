import type { ParseResult } from '../types/search';
import { AGGREGATOR_DICTIONARY, COUNTRY_DICTIONARY, STATUS_DICTIONARY, STUDY_LEVEL_DICTIONARY } from '../constants/searchDictionaries';
import type { CommissionRate } from '../types';

export function getLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

const ACTION_STOP_WORDS = new Set([
  'find', 'search', 'show', 'list', 'get', 'compare', 'filter', 'check',
  'the', 'a', 'an', 'for', 'in', 'at', 'with', 'school', 'schools', 'university', 'universities', 'route', 'routes'
]);

interface RateIndex {
  schools: Array<{ id: string; name: string; alias: string }>;
  intakes: Array<{ id: string; name: string; alias: string }>;
}

let cachedRatesRef: CommissionRate[] | null = null;
let cachedIndex: RateIndex | null = null;

export function getRateIndex(rates: CommissionRate[]): RateIndex {
  if (cachedRatesRef === rates && cachedIndex) {
    return cachedIndex;
  }

  const seenSchools = new Set<string>();
  const schools: Array<{ id: string; name: string; alias: string }> = [];
  for (const r of rates) {
    if (r.universityName && !seenSchools.has(r.universityName)) {
      seenSchools.add(r.universityName);
      schools.push({
        id: r.universityId || r.universityName,
        name: r.universityName,
        alias: r.universityName.toLowerCase(),
      });
    }
  }

  const seenIntakes = new Set<string>();
  const intakes: Array<{ id: string; name: string; alias: string }> = [];
  for (const r of rates) {
    if (r.intake && !seenIntakes.has(r.intake)) {
      seenIntakes.add(r.intake);
      intakes.push({
        id: r.intake,
        name: r.intake,
        alias: r.intake.toLowerCase(),
      });
    }
  }

  cachedRatesRef = rates;
  cachedIndex = { schools, intakes };
  return cachedIndex;
}

export function parseNaturalLanguage(input: string, rates: CommissionRate[] = []): ParseResult {
  const result: ParseResult = { tokens: [], remainingText: '' };
  if (!input.trim()) return result;

  const { schools: knownSchools, intakes: knownIntakes } = getRateIndex(rates);

  let workingInput = input.trim();

  // 1. Multi-word phrase matching across all dictionaries (sorted longest phrase first)
  const allPhrases: Array<{
    phrase: string;
    token: { id: string; type: 'level' | 'status' | 'country' | 'aggregator' | 'intake'; label: string; value: string };
  }> = [];

  for (const item of COUNTRY_DICTIONARY) {
    for (const alias of item.aliases) {
      if (alias.includes(' ')) {
        allPhrases.push({ phrase: alias.toLowerCase(), token: { id: item.id, type: 'country', label: item.name, value: item.id } });
      }
    }
  }

  for (const item of AGGREGATOR_DICTIONARY) {
    for (const alias of item.aliases) {
      if (alias.includes(' ')) {
        allPhrases.push({ phrase: alias.toLowerCase(), token: { id: item.id, type: 'aggregator', label: item.name, value: item.id } });
      }
    }
  }

  for (const item of STATUS_DICTIONARY) {
    for (const alias of item.aliases) {
      if (alias.includes(' ')) {
        allPhrases.push({ phrase: alias.toLowerCase(), token: { id: item.id, type: 'status', label: item.name, value: item.id } });
      }
    }
  }

  for (const intake of knownIntakes) {
    allPhrases.push({ phrase: intake.alias, token: { id: intake.id, type: 'intake', label: intake.name, value: intake.id } });
  }

  // Sort phrases by length descending so longer phrases match first (e.g. "sept 2027" before "sept")
  allPhrases.sort((a, b) => b.phrase.length - a.phrase.length);

  for (const { phrase, token } of allPhrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(workingInput)) {
      if (!result.tokens.some((t) => t.id === token.id)) {
        result.tokens.push(token);
      }
      workingInput = workingInput.replace(regex, ' ').trim();
    }
  }

  // 2. Tokenize remaining words
  const words = workingInput.toLowerCase().split(/\s+/).filter(Boolean);
  const unparsedWords: string[] = [];

  for (const word of words) {
    if (ACTION_STOP_WORDS.has(word)) {
      continue;
    }

    let matched = false;

    // Level
    for (const item of STUDY_LEVEL_DICTIONARY) {
      if (item.aliases.includes(word)) {
        if (!result.tokens.some((t) => t.id === item.id)) {
          result.tokens.push({ id: item.id, type: 'level', label: item.name, value: item.id });
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Status
    for (const item of STATUS_DICTIONARY) {
      if (item.aliases.includes(word)) {
        if (!result.tokens.some((t) => t.id === item.id)) {
          result.tokens.push({ id: item.id, type: 'status', label: item.name, value: item.id });
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Country
    for (const item of COUNTRY_DICTIONARY) {
      if (item.aliases.includes(word)) {
        if (!result.tokens.some((t) => t.id === item.id)) {
          result.tokens.push({ id: item.id, type: 'country', label: item.name, value: item.id });
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Aggregator
    for (const item of AGGREGATOR_DICTIONARY) {
      if (item.aliases.includes(word) || item.name.toLowerCase() === word) {
        if (!result.tokens.some((t) => t.id === item.id)) {
          result.tokens.push({ id: item.id, type: 'aggregator', label: item.name, value: item.id });
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Exact school match on single word if word is long enough
    for (const school of knownSchools) {
      if (school.alias === word) {
        if (!result.tokens.some((t) => t.id === school.id)) {
          result.tokens.push({ id: school.id, type: 'school', label: school.name, value: school.name });
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Fuzzy matching
    if (word.length >= 4 && !result.didYouMean) {
      // Aggregators fuzzy match
      for (const item of AGGREGATOR_DICTIONARY) {
        const minDistance = Math.min(...item.aliases.map((alias) => getLevenshteinDistance(word, alias)));
        if (minDistance <= 2) {
          result.didYouMean = {
            original: word,
            suggestion: { id: item.id, type: 'aggregator', label: item.name, value: item.id },
          };
          matched = true;
          break;
        }
      }

      // Countries fuzzy match
      if (!matched) {
        for (const item of COUNTRY_DICTIONARY) {
          const minDistance = Math.min(...item.aliases.map((alias) => getLevenshteinDistance(word, alias)));
          if (minDistance <= 2) {
            result.didYouMean = {
              original: word,
              suggestion: { id: item.id, type: 'country', label: item.name, value: item.id },
            };
            matched = true;
            break;
          }
        }
      }

      // Schools fuzzy match
      if (!matched && word.length >= 3) {
        for (const school of knownSchools) {
          const wordsInSchool = school.alias
            .split(/\s+/)
            .filter((w) => w.length >= 3 && !ACTION_STOP_WORDS.has(w) && w !== 'of' && w !== 'and' && w !== 'the');
          if (wordsInSchool.length === 0) continue;
          const bestDistance = Math.min(...wordsInSchool.map((w) => getLevenshteinDistance(word, w)));
          if (bestDistance <= 2) {
            result.didYouMean = {
              original: word,
              suggestion: { id: school.id, type: 'school', label: school.name, value: school.name },
            };
            matched = true;
            break;
          }
        }
      }
    }

    if (!matched) unparsedWords.push(word);
  }

  result.remainingText = unparsedWords.join(' ');
  return result;
}

