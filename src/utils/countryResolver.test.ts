import { describe, expect, it } from 'vitest';
import { resolveUniversityCountry } from './countryResolver';
import type { CommissionRate } from '../types';

describe('countryResolver', () => {
  it('returns explicit country if provided', () => {
    expect(resolveUniversityCountry('Random Uni', 'Canada')).toBe('Canada');
    expect(resolveUniversityCountry('Random Uni', 'United Kingdom')).toBe('UK');
  });

  it('infers country from university name keywords when explicit country is missing', () => {
    expect(resolveUniversityCountry('University of Toronto')).toBe('Canada');
    expect(resolveUniversityCountry('Harvard University')).toBe('USA');
    expect(resolveUniversityCountry('Monash University')).toBe('Australia');
    expect(resolveUniversityCountry('Coventry University')).toBe('UK');
  });

  it('lookup from rates dataset when university has a known country row', () => {
    const mockRates: CommissionRate[] = [
      { id: '1', universityId: 'u-mcgill', universityName: 'McGill University', country: 'Canada', intake: 'Sept 2026', studyLevel: 'UG', aggregator: 'SI-UK', masterRate: 0, agentRate: 10, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS' }
    ];

    expect(resolveUniversityCountry('McGill University', undefined, mockRates)).toBe('Canada');
  });

  it('defaults to UK for unknown universities without keywords', () => {
    expect(resolveUniversityCountry('A) Generic Higher Institute')).toBe('UK');
  });
});
