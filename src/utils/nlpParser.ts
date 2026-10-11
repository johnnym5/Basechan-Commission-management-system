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

export function parseNaturalLanguage(input: string, rates: CommissionRate[] = []): ParseResult {
  const result: ParseResult = { tokens: [], remainingText: '' };
  if (!input.trim()) return result;

  const words = input.toLowerCase().split(/\s+/).filter(Boolean);
  const unparsedWords: string[] = [];

  const knownSchools = Array.from(new Set(rates.map((r) => r.universityName).filter(Boolean))).map((name) => ({
    id: rates.find((r) => r.universityName === name)?.universityId || name,
    name,
    alias: name.toLowerCase(),
  }));

  const knownIntakes = Array.from(new Set(rates.map((r) => r.intake).filter(Boolean))).map((intake) => ({
    id: intake,
    name: intake,
    alias: intake.toLowerCase(),
  }));

  for (const word of words) {
    if (ACTION_STOP_WORDS.has(word)) {
      continue; // Strip action verbs and generic stop words
    }

    let matched = false;

    // 1. Check Level
    for (const item of STUDY_LEVEL_DICTIONARY) {
      if (item.aliases.includes(word)) {
        result.tokens.push({ id: item.id, type: 'level', label: item.name, value: item.id });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2. Check Status Guidance
    for (const item of STATUS_DICTIONARY) {
      if (item.aliases.includes(word)) {
        result.tokens.push({ id: item.id, type: 'status', label: item.name, value: item.id });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 3. Check Country
    for (const item of COUNTRY_DICTIONARY) {
      if (item.aliases.includes(word)) {
        result.tokens.push({ id: item.id, type: 'country', label: item.name, value: item.id });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 4. Check Aggregator / Submission Portal Route
    for (const item of AGGREGATOR_DICTIONARY) {
      if (item.aliases.includes(word) || item.name.toLowerCase() === word) {
        result.tokens.push({ id: item.id, type: 'aggregator', label: item.name, value: item.id });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 5. Check Exact Intakes
    for (const intake of knownIntakes) {
      if (intake.alias === word || intake.alias.includes(word)) {
        result.tokens.push({ id: intake.id, type: 'intake', label: intake.name, value: intake.id });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 6. Check Fuzzy Match for Aggregators, Intakes, Countries, and Schools
    if (word.length >= 4 && !result.didYouMean) {
      // 6a. Check Aggregators fuzzy match
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

      // 6b. Check Intakes fuzzy match
      if (!matched) {
        for (const intake of knownIntakes) {
          const wordsInIntake = intake.alias.split(/\s+/);
          const minDistance = Math.min(...wordsInIntake.map((w) => getLevenshteinDistance(word, w)));
          if (minDistance <= 2) {
            result.didYouMean = {
              original: word,
              suggestion: { id: intake.id, type: 'intake', label: intake.name, value: intake.id },
            };
            matched = true;
            break;
          }
        }
      }

      // 6c. Check Countries fuzzy match
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

      // 6d. Check Schools fuzzy match
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
