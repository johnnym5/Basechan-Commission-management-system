import { describe, expect, it } from 'vitest';
import { getLevenshteinDistance, parseNaturalLanguage } from './nlpParser';
import type { CommissionRate } from '../types';

const mockRates: CommissionRate[] = [
  { id: '1', universityId: 'u-leicester', universityName: 'University of Leicester', country: 'United Kingdom', intake: 'Sept 2026', studyLevel: 'PG', aggregator: 'SI-UK', masterRate: 0, agentRate: 15, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' },
  { id: '2', universityId: 'u-aberdeen', universityName: 'Aberdeen University', country: 'United Kingdom', intake: 'Jan 2027', studyLevel: 'UG', aggregator: 'SI-UK', masterRate: 0, agentRate: 10, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'ALLOWED' },
];

describe('nlpParser', () => {
  it('calculates edit distance correctly', () => {
    expect(getLevenshteinDistance('licester', 'leicester')).toBe(1);
    expect(getLevenshteinDistance('aberdeen', 'aberdeen')).toBe(0);
  });

  it('extracts tokens for study level and country', () => {
    const parsed = parseNaturalLanguage('postgrad uk', mockRates);
    expect(parsed.tokens).toHaveLength(2);
    expect(parsed.tokens.map((t) => t.type)).toEqual(['level', 'country']);
    expect(parsed.tokens[0].value).toBe('PG');
    expect(parsed.tokens[1].value).toBe('UK');
  });

  it('extracts aggregator/portal route tokens correctly for basechan and edvoy', () => {
    const parsedBasechan = parseNaturalLanguage('basechan', mockRates);
    expect(parsedBasechan.tokens).toHaveLength(1);
    expect(parsedBasechan.tokens[0].type).toBe('aggregator');
    expect(parsedBasechan.tokens[0].value).toBe('BASECHAN');

    const parsedEdvoy = parseNaturalLanguage('edvoy', mockRates);
    expect(parsedEdvoy.tokens).toHaveLength(1);
    expect(parsedEdvoy.tokens[0].type).toBe('aggregator');
    expect(parsedEdvoy.tokens[0].value).toBe('EDVOY');
  });

  it('extracts guidance status tokens correctly for focus and allowed', () => {
    const parsedFocus = parseNaturalLanguage('focus uk pg', mockRates);
    expect(parsedFocus.tokens.map((t) => t.type)).toEqual(['status', 'country', 'level']);
    expect(parsedFocus.tokens[0].value).toBe('FOCUS');
    expect(parsedFocus.tokens[1].value).toBe('UK');
    expect(parsedFocus.tokens[2].value).toBe('PG');
  });

  it('provides didYouMean typo correction for school names, aggregators, intakes, and countries', () => {
    const parsedSchool = parseNaturalLanguage('licester', mockRates);
    expect(parsedSchool.didYouMean).toBeDefined();
    expect(parsedSchool.didYouMean?.suggestion.label).toBe('University of Leicester');

    const parsedAggregator = parseNaturalLanguage('edvoyy', mockRates);
    expect(parsedAggregator.didYouMean).toBeDefined();
    expect(parsedAggregator.didYouMean?.suggestion.type).toBe('aggregator');
    expect(parsedAggregator.didYouMean?.suggestion.value).toBe('EDVOY');

    const parsedCountry = parseNaturalLanguage('canad', mockRates);
    expect(parsedCountry.didYouMean).toBeDefined();
    expect(parsedCountry.didYouMean?.suggestion.type).toBe('country');
    expect(parsedCountry.didYouMean?.suggestion.value).toBe('Canada');
  });

  it('safely handles missing or undefined universityName in rates without throwing', () => {
    const brokenRates = [
      { id: 'broken1', universityId: 'u1', country: 'UK' } as unknown as CommissionRate,
      { id: 'broken2', universityName: undefined, country: 'UK' } as unknown as CommissionRate,
    ];
    expect(() => parseNaturalLanguage('leicester', brokenRates)).not.toThrow();
  });

  it('does not falsely suggest school match for short stop words like "of"', () => {
    const ratesWithOxford: CommissionRate[] = [
      { id: '1', universityId: 'u-oxford', universityName: 'University of Oxford', country: 'UK', intake: 'Sept 2026', studyLevel: 'PG', aggregator: 'SI-UK', masterRate: 0, agentRate: 15, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' },
    ];
    const parsed = parseNaturalLanguage('roof', ratesWithOxford);
    // "roof" is edit distance 2 from "of", but "of" is a stop word and should NOT trigger a suggestion for University of Oxford
    expect(parsed.didYouMean).toBeUndefined();
  });
});
