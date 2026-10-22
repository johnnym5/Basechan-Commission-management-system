import { describe, expect, it } from 'vitest';
import { resolveUniversityCountry, groupRatesByCountry, groupRatesByUniversity, isHistoricalIntake } from './groupingUtils';
import type { CommissionRate } from '../types';

const mockRates: CommissionRate[] = [
  { id: '1', universityId: 'u-toronto', universityName: 'University of Toronto', country: '', intake: 'Sept 2026', studyLevel: 'PG', aggregator: 'SI-UK', masterRate: 0, agentRate: 15, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' },
  { id: '2', universityId: 'u-coventry', universityName: 'Coventry University', country: '', intake: 'Jan 2026', studyLevel: 'UG', aggregator: 'Edvoy', masterRate: 0, agentRate: 12, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'ALLOWED' },
  { id: '3', universityId: 'u-monash', universityName: 'Monash University', country: 'Australia', intake: 'Feb 2026', studyLevel: 'PG', aggregator: 'SI-UK', masterRate: 0, agentRate: 14, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' },
];

describe('groupingUtils - Country Resolution', () => {
  it('resolves country from explicit row data when present', () => {
    expect(resolveUniversityCountry('Monash University', 'Australia', mockRates)).toBe('Australia');
  });

  it('resolves country using university name geographic keywords when country is missing', () => {
    expect(resolveUniversityCountry('University of Toronto', '', mockRates)).toBe('Canada');
    expect(resolveUniversityCountry('Coventry University', '', mockRates)).toBe('UK');
  });

  it('groups rates by country accurately using smart country resolution', () => {
    const groups = groupRatesByCountry(mockRates);
    const countryNames = groups.map((g) => g.groupName);
    expect(countryNames).toContain('Canada');
    expect(countryNames).toContain('UK');
    expect(countryNames).toContain('Australia');
  });

  it('groups rates for the same school into a single card even if universityIds differ', () => {
    const ratesWithMismatchedIds: CommissionRate[] = [
      { id: '1', universityId: 'alexander_college', universityName: 'Alexander College', country: 'Canada', intake: 'Sept 2026', studyLevel: 'UG', aggregator: 'SI-UK', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS' },
      { id: '2', universityId: 'alexander_college', universityName: 'Alexander College', country: 'Canada', intake: 'Sept 2026', studyLevel: 'PG', aggregator: 'SI-UK', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS' },
      { id: '3', universityId: 'alexander_college', universityName: 'Alexander College', country: 'Canada', intake: 'Jan 2026', studyLevel: 'UG', aggregator: 'Edvoy', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS' },
      { id: '4', universityId: 'alexander', universityName: 'Alexander College', country: 'Canada', intake: 'Jan 2026', studyLevel: 'PG', aggregator: 'Edvoy', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS' },
    ];
    const grouped = groupRatesByUniversity(ratesWithMismatchedIds);
    expect(grouped.length).toBe(1);
    expect(grouped[0].displayName).toBe('Alexander College');
    expect(grouped[0].totalRoutes).toBe(4);
  });

  describe('isHistoricalIntake', () => {
    // Pass referenceMonth=8 (August) so these tests are deterministic regardless of
    // which real-world month they run in. Sept 2026 with referenceMonth=8 is future
    // (month 9 > 8), and Sept 2025 with referenceYear 2026 is always historical.
    it('correctly classifies historical years across 2010s and 2020s', () => {
      expect(isHistoricalIntake('Sept 2018', 2026, 8)).toBe(true);
      expect(isHistoricalIntake('Jan 2019', 2026, 8)).toBe(true);
      expect(isHistoricalIntake('Jan 2024', 2026, 8)).toBe(true);
      expect(isHistoricalIntake('Sept 2025', 2026, 8)).toBe(true);
      expect(isHistoricalIntake('Sept 2026', 2026, 8)).toBe(false); // Sept is future relative to Aug
      expect(isHistoricalIntake('Jan 2027', 2026, 8)).toBe(false);
    });

    it('classifies same-year intakes before the reference month as historical', () => {
      expect(isHistoricalIntake('Jan 2026', 2026, 8)).toBe(true);  // Jan < Aug
      expect(isHistoricalIntake('Sept 2026', 2026, 10)).toBe(true); // Sept < Oct
      expect(isHistoricalIntake('Sept 2026', 2026, 9)).toBe(false); // Sept = Sept (current)
    });

    it('safely handles missing, empty, or undefined intake strings without throwing', () => {
      expect(isHistoricalIntake(undefined, 2026, 8)).toBe(false);
      expect(isHistoricalIntake('', 2026, 8)).toBe(false);
      expect(isHistoricalIntake('Standard Intake', 2026, 8)).toBe(false);
    });
  });
});
