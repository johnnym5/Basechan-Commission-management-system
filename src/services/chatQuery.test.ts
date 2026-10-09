import { describe, expect, it } from 'vitest';
import { buildClarifyingQuestions, filterRatesByIntent, getDefaultIntake, getIntakeDateKey, getIntakeStartYear, parseChatIntent, sanitizeChatInput } from './chatQuery';
import type { CommissionRate } from '../types';

const rates: CommissionRate[] = [
  { id: '1', universityId: 'a', universityName: 'Aberdeen University', intake: 'Sept 2027', aggregator: 'SI-UK', studyLevel: 'PG', masterRate: 20, agentRate: 12, diffMargin: 8, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' },
  { id: '2', universityId: 'b', universityName: 'Bristol University', intake: 'Jan 2027', aggregator: 'UAP', studyLevel: 'UG', masterRate: 18, agentRate: 10, diffMargin: 8, isFlatFee: false, netOrGross: 'GROSS', guidance: 'ALLOWED' },
];

describe('natural language chat query', () => {
  it('parses a school search without reading intake order before it is initialized', () => {
    expect(parseChatIntent('Show me Aberdeen University postgraduate', rates.map((rate) => rate.universityName))).toMatchObject({
      schoolTerms: ['Aberdeen University'],
      level: 'PG',
      needsSchool: false,
    });
  });

  it('sanitizes control and markup characters and limits input size', () => {
    expect(sanitizeChatInput('  show <script>\u0000 school  ')).toBe('show script school');
    expect(sanitizeChatInput('x'.repeat(600))).toHaveLength(500);
  });

  it('extracts known school, level, intake, comparison, and guidance terms', () => {
    expect(parseChatIntent('Compare Aberdeen University and Bristol University for postgraduate Sept 2027 focus', rates.map((rate) => rate.universityName))).toMatchObject({
      schoolTerms: ['Aberdeen University', 'Bristol University'], intakeTerms: ['Sept 2027'], level: 'PG', compare: true, guidance: 'FOCUS', needsLevel: false,
    });
  });

  it('asks for level and school when the request is vague', () => {
    expect(buildClarifyingQuestions(parseChatIntent('show me rates', rates.map((rate) => rate.universityName)))).toHaveLength(2);
  });

  it('lets broad country and guidance searches return results without forcing a level', () => {
    const intent = parseChatIntent('show focus schools in UK', [], ['UK']);
    expect(intent.needsLevel).toBe(false);
    expect(buildClarifyingQuestions(intent)).toEqual([]);
  });

  it('asks for a level for named-school and comparison searches, but not country-only searches', () => {
    const schools = rates.map((rate) => rate.universityName);
    expect(parseChatIntent('show Aberdeen University', schools).needsLevel).toBe(true);
    expect(parseChatIntent('compare Aberdeen University and Bristol University', schools).needsLevel).toBe(true);
    expect(parseChatIntent('show schools in UK', [], ['UK']).needsLevel).toBe(false);
  });

  it('filters matching rates and selects the nearest future intake', () => {
    const intent = parseChatIntent('Aberdeen postgraduate', rates.map((rate) => rate.universityName));
    expect(filterRatesByIntent(rates, intent).map((rate) => rate.id)).toEqual(['1']);
    expect(getDefaultIntake(rates, new Date('2027-02-01T00:00:00.000Z'))).toBe('Sept 2027');
  });

  it('does not silently guess among partial or misspelled school names', () => {
    const partial = parseChatIntent('Aberdeen postgraduate', rates.map((rate) => rate.universityName));
    expect(partial.schoolTerms).toEqual(['Aberdeen University']);
    const misspelled = parseChatIntent('Averdeen postgraduate', rates.map((rate) => rate.universityName));
    expect(buildClarifyingQuestions(misspelled).join(' ')).toMatch(/couldn’t match/i);
    expect(misspelled.suggestedSchools).toEqual(['Aberdeen University']);
    expect(buildClarifyingQuestions(misspelled).join(' ')).toMatch(/Did you mean Aberdeen University/i);
  });

  it('asks the user to narrow comparisons to at most four schools', () => {
    const schools = ['Alpha University', 'Beta University', 'Gamma University', 'Delta University', 'Epsilon University'];
    const intent = parseChatIntent(`compare ${schools.join(' ')}`, schools);
    expect(intent.ambiguousSchools).toHaveLength(5);
    expect(buildClarifyingQuestions(intent).join(' ')).toMatch(/four or fewer/i);
  });

  it('chooses the newest dated intake when no future intake exists', () => {
    expect(getDefaultIntake(rates, new Date('2028-02-01T00:00:00.000Z'))).toBe('Sept 2027');
  });

  it('understands seasonal intake names when selecting a future default', () => {
    const seasonal = [{ ...rates[0], intake: 'Autumn 2027' }, { ...rates[1], intake: 'Spring 2027' }];
    expect(getDefaultIntake(seasonal, new Date('2026-10-09T00:00:00.000Z'))).toBe('Spring 2027');
    expect(parseChatIntent('Aberdeen postgraduate Spring 2027', rates.map((rate) => rate.universityName)).intakeTerms).toEqual(['Spring 2027']);
  });

  it('falls back to an undated current intake when there are no dated choices', () => {
    const undated = [{ ...rates[0], intake: 'Current intake' }, { ...rates[1], intake: 'Legacy' }];
    expect(getDefaultIntake(undated, new Date('2026-10-09T00:00:00.000Z'))).toBe('Current intake');
  });

  it('returns no default intake when no records are available', () => {
    expect(getDefaultIntake([])).toBeUndefined();
  });

  it('filters using a known country without treating it as a school name', () => {
    const intent = parseChatIntent('show UK postgraduate schools', rates.map((rate) => rate.universityName), ['UK']);
    expect(intent.countryTerms).toEqual(['UK']);
    expect(intent.schoolTerms).toEqual([]);
    expect(filterRatesByIntent(rates.map((rate) => ({ ...rate, country: 'UK' })), intent).map((rate) => rate.id)).toEqual(['1']);
  });

  it('expands UK country aliases to constituent country labels in the local data', () => {
    const countryLabels = ['England', 'Scotland', 'Wales', 'Northern Ireland'];
    const intent = parseChatIntent('how many schools are in UK?', [], countryLabels);
    const ukRates = countryLabels.map((country, index) => ({ ...rates[0], id: `uk-${index}`, universityId: `uk-${index}`, country }));
    expect(intent.countryTerms).toEqual(countryLabels);
    expect(filterRatesByIntent(ukRates, intent)).toHaveLength(4);
  });

  it('filters by agent payout, fee type, and descending or ascending payout', () => {
    const intent = parseChatIntent('show schools paying at least 11 percent, highest paying', rates.map((rate) => rate.universityName));
    expect(intent).toMatchObject({ rateMinimum: 11, feeType: 'PERCENTAGE', sortBy: 'rate_desc', needsSchool: false });
    expect(filterRatesByIntent(rates, intent).map((rate) => rate.id)).toEqual(['1']);
    const flat = { ...rates[0], agentRate: 100, isFlatFee: true };
    expect(filterRatesByIntent([flat, ...rates], parseChatIntent('flat fee', rates.map((rate) => rate.universityName)))).toEqual([flat]);
  });

  it('filters staff by routing aggregator but ignores agent payout language for Staff', () => {
    const intent = parseChatIntent('show SI-UK schools with highest payout', [], [], ['SI-UK'], 'STAFF');
    expect(intent).toMatchObject({ aggregatorTerms: ['SI-UK'], sortBy: undefined, rateMinimum: undefined, needsSchool: false });
    expect(filterRatesByIntent(rates, intent).map((rate) => rate.id)).toEqual(['1']);
  });

  it('redirects unrelated requests to the supported school and rate domain', () => {
    const intent = parseChatIntent('What is the weather in Lagos?', rates.map((rate) => rate.universityName));
    expect(intent.outOfScope).toBe(true);
    expect(buildClarifyingQuestions(intent).join(' ')).toMatch(/Basechan schools/i);
  });

  it('does not recognize a Staff-only aggregator as an Agent filter', () => {
    const intent = parseChatIntent('show SI-UK schools', rates.map((rate) => rate.universityName), [], ['SI-UK'], 'AGENT');
    expect(intent.aggregatorTerms).toEqual([]);
  });

  it('does not treat payout fields or payout language as searchable for Staff', () => {
    const intent = parseChatIntent('show schools paying at least 10 percent, highest paying', [], [], [], 'STAFF');
    expect(intent).toMatchObject({ rateMinimum: undefined, rateMaximum: undefined, feeType: undefined, sortBy: undefined, needsSchool: true });
    const staffRate = { ...rates[0], agentRate: 99, masterRate: 150, diffMargin: 51, aggregator: 'SI-UK' };
    expect(filterRatesByIntent([staffRate], intent)).toEqual([staffRate]);
  });

  it('does not recognize staff routing fields as searchable for Agents', () => {
    const intent = parseChatIntent('show SI-UK schools', [], [], ['SI-UK'], 'AGENT');
    expect(intent.aggregatorTerms).toEqual([]);
  });

  it('understands Nigerian conversational phrasing for school searches', () => {
    const intent = parseChatIntent('Abeg show me postgraduate schools wey dey focus for UK', [], ['UK']);
    expect(intent).toMatchObject({ level: 'PG', guidance: 'FOCUS', countryTerms: ['UK'], needsSchool: false, outOfScope: false });
  });

  it('ignores polite English framing around a valid search', () => {
    const intent = parseChatIntent('Could you show me postgraduate schools in UK?', [], ['UK']);
    expect(intent).toMatchObject({ level: 'PG', countryTerms: ['UK'], needsSchool: false, outOfScope: false });
    expect(intent.unmatchedSchoolLikeTerms).toEqual([]);
  });

  it('corrects common domain misspellings without guessing a school name', () => {
    const intent = parseChatIntent('show postgradute universites in UK', [], ['UK']);
    expect(intent).toMatchObject({ level: 'PG', countryTerms: ['UK'], needsSchool: false, outOfScope: false });
    expect(intent.unmatchedSchoolLikeTerms).toEqual([]);
  });

  it('maps Nigerian negation phrases to restricted guidance', () => {
    const intent = parseChatIntent('schools wey I no go use', []);
    expect(intent).toMatchObject({ guidance: 'DO_NOT_USE', needsSchool: false, outOfScope: false });
  });

  it('understands conversational payout wording while keeping school resolution explicit', () => {
    const intent = parseChatIntent('Abeg how much dem dey pay for Aberdeen?', rates.map((rate) => rate.universityName));
    expect(intent.schoolTerms).toEqual(['Aberdeen University']);
    expect(intent.outOfScope).toBe(false);
  });

  it('recognizes English and Nigerian questions that ask for school or route counts', () => {
    const schools = rates.map((rate) => rate.universityName);
    expect(parseChatIntent('how many schools are in UK?', schools, ['UK'])).toMatchObject({ quantity: 'schools', countryTerms: ['UK'], needsSchool: false, outOfScope: false });
    expect(parseChatIntent('how many routes dey for UK?', schools, ['UK'])).toMatchObject({ quantity: 'routes', countryTerms: ['UK'], needsSchool: false, outOfScope: false });
  });

  it('asks for intake and level scope before counting an unqualified country query', () => {
    const intent = parseChatIntent('how many schools are in UK?', rates.map((rate) => rate.universityName), ['UK']);
    expect(buildClarifyingQuestions(intent).join(' ')).toMatch(/all available intakes and study levels/i);
    expect(parseChatIntent('how many schools in UK across all available intakes and levels', [], ['UK'])).toMatchObject({ scopeSelection: 'all' });
    expect(parseChatIntent('how many schools in UK choose an intake', [], ['UK'])).toMatchObject({ scopeSelection: 'intake' });
    expect(parseChatIntent('how many schools in UK general', [], ['UK'])).toMatchObject({ scopeSelection: 'all' });
  });

  it('recognizes latest and earliest intake ranking requests', () => {
    expect(parseChatIntent('Which is the highest intake?', rates.map((rate) => rate.universityName))).toMatchObject({ intakeOrder: 'latest', rankingUnclear: false, needsSchool: false });
    expect(parseChatIntent('Which schools have the lowest intake?', rates.map((rate) => rate.universityName))).toMatchObject({ intakeOrder: 'earliest', rankingUnclear: false, needsSchool: false });
  });

  it('recognizes multiple guidance categories as an either-status search', () => {
    expect(parseChatIntent('Which schools are in Focus and Allowed?', rates.map((rate) => rate.universityName))).toMatchObject({ guidances: ['FOCUS', 'ALLOWED'], needsSchool: false });
  });

  it('infers a school count when the user asks how many are in Focus', () => {
    expect(parseChatIntent('How many are currently in Focus?', rates.map((rate) => rate.universityName))).toMatchObject({ quantity: 'schools', guidance: 'FOCUS', unmatchedSchoolLikeTerms: [] });
  });

  it('understands seasonal intake order and treats range labels by their final dated month', () => {
    const dates = ['Autumn 2026', 'Oct 2026 - Feb 2027', 'Spring 2027'];
    const keys = dates.map((intake) => getIntakeDateKey(intake));
    expect(keys[0]).not.toBeNull();
    expect(keys[1]).toBeGreaterThan(keys[0]!);
    expect(keys[2]).toBeGreaterThan(keys[0]!);
    expect(getIntakeDateKey('Current intake')).toBeNull();
  });

  it('parses inclusive intake year ranges in common wording', () => {
    for (const query of ['from 2021 to 2025', 'between 2021 and 2025', '2021-2025']) {
      expect(parseChatIntent(query, []).intakeYearRange).toEqual({ startYear: 2021, endYear: 2025 });
    }
  });

  it('uses the intake cycle start year for range filtering', () => {
    const range = parseChatIntent('from 2021 to 2025', []);
    const candidates: CommissionRate[] = [
      { ...rates[0], id: 'academic', intake: '2021 - 2022' },
      { ...rates[0], id: 'month', intake: 'September 2021' },
      { ...rates[0], id: 'season', intake: 'Autumn 2021' },
      { ...rates[0], id: 'outside', intake: '2020 - 2021' },
      { ...rates[0], id: 'undated', intake: 'Current intake' },
    ];
    expect(getIntakeStartYear('2021 - 2022')).toBe(2021);
    expect(getIntakeStartYear('September 2021')).toBe(2021);
    expect(getIntakeStartYear('Autumn 2021')).toBe(2021);
    expect(getIntakeStartYear('Current intake')).toBeNull();
    expect(filterRatesByIntent(candidates, range).map((rate) => rate.id)).toEqual(['academic', 'month', 'season']);
  });

  it('flags reversed intake year ranges for clarification', () => {
    const intent = parseChatIntent('from 2025 to 2021', []);
    expect(intent.invalidIntakeYearRange).toBe(true);
    expect(intent.intakeYearRange).toBeUndefined();
    expect(buildClarifyingQuestions(intent).join(' ')).toMatch(/start year.*before.*end year/i);
  });
});
