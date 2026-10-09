import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialChatState, processChatTurn } from './chatSession';
import type { CommissionRate } from '../types';

vi.mock('./chatPersistence', () => ({ MAX_QUERIES_PER_MINUTE: 10, MAX_QUERIES_PER_SESSION: 50, PREFERENCE_LEARNING_THRESHOLD: 10 }));

const rates: CommissionRate[] = [
  { id: 'a-pg', universityId: 'a', universityName: 'Aberdeen University', intake: 'Jan 2027', aggregator: '', studyLevel: 'PG', masterRate: 0, agentRate: 15, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS' },
  { id: 'a-ug', universityId: 'a', universityName: 'Aberdeen University', intake: 'Jan 2027', aggregator: '', studyLevel: 'UG', masterRate: 0, agentRate: 10, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS' },
];

describe('chat session query policy', () => {
  beforeEach(() => vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('00000000-0000-4000-8000-000000000001').mockReturnValue('00000000-0000-4000-8000-000000000002'));

  it('asks the user for level when they only provide a school', () => {
    const result = processChatTurn(createInitialChatState('u1'), 'Aberdeen University', rates, 1_000);
    expect(result.clarificationQuestions[0]).toMatch(/study level/i);
    expect(result.matchingRates).toHaveLength(0);
  });

  it('accepts exactly 500 characters and rejects 501 before recording a turn', () => {
    const atLimit = processChatTurn(createInitialChatState('u1'), `Aberdeen postgraduate ${'x'.repeat(478)}`, rates, 1_000);
    expect(atLimit.state.conversation.queryCount).toBe(1);
    expect(() => processChatTurn(createInitialChatState('u1'), `Aberdeen postgraduate ${'x'.repeat(479)}`, rates, 1_000)).toThrow(/500 characters/i);
  });

  it('retains the school context while the user answers a level clarification', () => {
    const first = processChatTurn(createInitialChatState('u1'), 'Aberdeen University', rates, 1_000);
    const second = processChatTurn(first.state, 'Postgraduate', rates, 2_000);
    expect(second.matchingRates.map((rate) => rate.id)).toEqual(['a-pg']);
    expect(second.clarificationQuestions).toEqual([]);
  });

  it('carries the previous level and intake into a short same-filter follow-up', () => {
    const comparable = [rates[0], { ...rates[0], id: 'b-pg', universityId: 'b', universityName: 'Bristol University', agentRate: 20 }];
    const first = processChatTurn(createInitialChatState('u1'), 'Aberdeen postgraduate', comparable, new Date('2026-10-01T00:00:00.000Z').getTime());
    const second = processChatTurn(first.state, 'same for Bristol', comparable, new Date('2026-10-01T00:00:01.000Z').getTime());
    expect(second.matchingRates.map((rate) => rate.id)).toEqual(['b-pg']);
    expect(second.state.conversation.activeLevel).toBe('PG');
    expect(second.state.conversation.activeIntake).toBe('Jan 2027');
  });

  it('returns tailored results after level is specified and uses an intake default', () => {
    const result = processChatTurn(createInitialChatState('u1'), 'Aberdeen postgraduate', rates, 1_000);
    expect(result.matchingRates.map((rate) => rate.id)).toEqual(['a-pg']);
    expect(result.state.conversation.messages[1].text).toMatch(/Jan 2027/);
  });

  it('defaults named-school queries to that school’s nearest applicable intake', () => {
    const datedRates = [
      { ...rates[0], intake: 'Jan 2026' },
      { ...rates[0], id: 'a-pg-sept', intake: 'Sept 2027' },
      { ...rates[1], intake: 'Jan 2027' },
    ];
    const result = processChatTurn(createInitialChatState('u1'), 'Aberdeen postgraduate', datedRates, new Date('2026-10-01T00:00:00.000Z').getTime());
    expect(result.matchingRates.map((rate) => rate.intake)).toEqual(['Sept 2027']);
  });

  it('uses the default future intake for broad filters such as Focus schools', () => {
    const mixedIntakes = [
      { ...rates[0], id: 'a-old', intake: 'Sept 2026', guidance: 'FOCUS' as const },
      { ...rates[0], id: 'a-next', intake: 'Jan 2027', guidance: 'FOCUS' as const },
      { ...rates[1], id: 'b-next', intake: 'Jan 2027', guidance: 'FOCUS' as const },
    ];
    const result = processChatTurn(createInitialChatState('u1'), 'show focus undergraduate', mixedIntakes, new Date('2026-10-01T00:00:00.000Z').getTime());
    expect(result.matchingRates.map((rate) => rate.intake)).toEqual(['Jan 2027']);
  });

  it('clarifies the count scope and counts distinct schools across every intake and level when selected', () => {
    const countryRates = [
      { ...rates[0], country: 'UK' },
      { ...rates[1], country: 'UK' },
      { ...rates[0], id: 'a-pg-sept', intake: 'Sept 2027', country: 'UK' },
      { ...rates[0], id: 'b-pg', universityId: 'b', universityName: 'Bristol University', country: 'UK' },
    ];
    const first = processChatTurn(createInitialChatState('u1'), 'How many schools are in UK?', countryRates, 1_000);
    expect(first.clarificationQuestions.join(' ')).toMatch(/all available intakes and study levels/i);
    expect(first.matchingRates).toEqual([]);
    expect(first.state.conversation.pendingClarification?.choices).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'All available intakes and levels' }),
      expect.objectContaining({ label: 'Choose an intake' }),
      expect.objectContaining({ label: 'Choose a study level' }),
    ]));

    const answer = processChatTurn(first.state, 'all available intakes and levels', countryRates, 2_000);
    expect(answer.matchingRates).toHaveLength(4);
    expect(answer.state.conversation.messages.at(-1)?.text).toMatch(/2 schools in your available UK data across all available intakes and all study levels/i);
  });

  it('offers available intake choices and counts unique schools after the user narrows the scope', () => {
    const countryRates = [
      { ...rates[0], country: 'UK' },
      { ...rates[1], country: 'UK' },
      { ...rates[0], id: 'a-pg-sept', intake: 'Sept 2027', country: 'UK' },
      { ...rates[0], id: 'b-pg', universityId: 'b', universityName: 'Bristol University', country: 'UK' },
    ];
    const first = processChatTurn(createInitialChatState('u1'), 'How many schools are in UK?', countryRates, 1_000);
    const chooseIntake = processChatTurn(first.state, 'choose an intake', countryRates, 2_000);
    expect(chooseIntake.state.conversation.pendingClarification?.choices.map(({ label }) => label)).toContain('Jan 2027');

    const answer = processChatTurn(chooseIntake.state, 'Jan 2027', countryRates, 3_000);
    expect(new Set(answer.matchingRates.map((rate) => rate.universityId))).toEqual(new Set(['a', 'b']));
    expect(answer.state.conversation.messages.at(-1)?.text).toMatch(/2 schools in your available UK data for Jan 2027/i);
  });

  it('asks for a study level when the user narrows a country count by level', () => {
    const countryRates = [
      { ...rates[0], country: 'UK' },
      { ...rates[1], country: 'UK' },
      { ...rates[0], id: 'b-ug', universityId: 'b', universityName: 'Bristol University', studyLevel: 'UG' as const, country: 'UK' },
    ];
    const first = processChatTurn(createInitialChatState('u1'), 'How many schools are in UK?', countryRates, 1_000);
    const chooseLevel = processChatTurn(first.state, 'choose a study level', countryRates, 2_000);
    expect(chooseLevel.state.conversation.pendingClarification?.choices.map(({ label }) => label)).toEqual(['Foundation', 'Undergraduate', 'Postgraduate']);

    const answer = processChatTurn(chooseLevel.state, 'Undergraduate', countryRates, 3_000);
    expect(new Set(answer.matchingRates.map((rate) => rate.universityId))).toEqual(new Set(['a', 'b']));
    expect(answer.state.conversation.messages.at(-1)?.text).toMatch(/2 schools in your available UK data at UG level/i);
  });

  it('limits comparison results to a shared intake and level', () => {
    const comparable = [rates[0], { ...rates[0], id: 'b-pg', universityId: 'b', universityName: 'Bristol University', agentRate: 20 }];
    const result = processChatTurn(createInitialChatState('u1'), 'Compare Aberdeen University and Bristol University postgraduate', comparable, new Date('2026-10-01T00:00:00.000Z').getTime());
    expect(result.matchingRates.map((rate) => rate.id)).toEqual(['a-pg', 'b-pg']);
    expect(result.matchingRates.every((rate) => rate.studyLevel === 'PG' && rate.intake === 'Jan 2027')).toBe(true);
  });

  it('compares the four schools from the last displayed result set on “compare all 4”', () => {
    const fourSchools = ['Aberdeen University', 'Bristol University', 'Cardiff University', 'Dundee University']
      .map((universityName, index) => ({ ...rates[0], id: `school-${index}`, universityId: `school-${index}`, universityName, guidance: 'FOCUS' as const }));
    const first = processChatTurn(createInitialChatState('u1'), 'show focus postgraduate', fourSchools, new Date('2026-10-01T00:00:00.000Z').getTime());
    expect(first.clarificationQuestions).toEqual([]);
    expect(first.matchingRates).toHaveLength(4);
    expect(first.state.conversation.lastResultSchoolIds).toEqual(['school-0', 'school-1', 'school-2', 'school-3']);

    const comparison = processChatTurn(first.state, 'compare all 4', fourSchools, new Date('2026-10-01T00:00:01.000Z').getTime());
    expect(comparison.clarificationQuestions).toEqual([]);
    expect(comparison.matchingRates.map((rate) => rate.universityId)).toEqual(['school-0', 'school-1', 'school-2', 'school-3']);
  });

  it('asks for a shared intake when comparison schools do not have matching routes', () => {
    const otherLevel = { ...rates[1], id: 'b-ug', universityId: 'b', universityName: 'Bristol University' };
    const result = processChatTurn(createInitialChatState('u1'), 'Compare Aberdeen University and Bristol University postgraduate', [rates[0], otherLevel], new Date('2026-10-01T00:00:00.000Z').getTime());
    expect(result.matchingRates).toHaveLength(0);
    expect(result.clarificationQuestions.join(' ')).toMatch(/same intake/i);
  });

  it('enforces session and rolling minute limits and starts preference suggestions after ten queries', () => {
    let state = createInitialChatState('u1');
    for (let i = 0; i < 10; i++) state = processChatTurn(state, 'Aberdeen postgraduate', rates, 100_000 + i * 60_000).state;
    expect(state.profile.suggestionTerms.length).toBeGreaterThan(0);
    const capped = { ...state, queryCount: 50, conversation: { ...state.conversation, queryCount: 50 } };
    expect(() => processChatTurn(capped, 'Aberdeen postgraduate', rates, 1_000_000)).toThrow(/50 question/i);
    const rateLimited = { ...state, queryTimestamps: Array.from({ length: 10 }, (_, index) => 600_000 + index) };
    expect(() => processChatTurn(rateLimited, 'Aberdeen postgraduate', rates, 600_500)).toThrow(/10 questions per minute/i);
  });

  it('enforces the rolling minute limit after switching to a new conversation', () => {
    const now = 900_000;
    let accountTimestamps: number[] = [];
    for (let i = 0; i < 10; i++) {
      const newConversation = { ...createInitialChatState('u1'), queryTimestamps: accountTimestamps };
      accountTimestamps = processChatTurn(newConversation, 'Aberdeen postgraduate', rates, now + i).state.queryTimestamps;
    }
    const switchedConversation = { ...createInitialChatState('u1'), queryTimestamps: accountTimestamps };
    expect(() => processChatTurn(switchedConversation, 'Aberdeen postgraduate', rates, now + 10)).toThrow(/10 questions per minute/i);
  });

  it('answers how many schools are in a country using distinct school count', () => {
    const UKRates = [
      { ...rates[0], country: 'UK' },
      { ...rates[1], id: 'a-pg-second-route', country: 'UK', intake: 'Sept 2027' },
      { ...rates[1], id: 'b-ug', universityId: 'b', universityName: 'Bristol University', country: 'UK' },
    ];
    const result = processChatTurn(createInitialChatState('u1'), 'how many schools are in UK?', UKRates, 1_000, 'AGENT');
    expect(result.matchingRates).toHaveLength(0);
    expect(result.clarificationQuestions.join(' ')).toMatch(/all available intakes and study levels/i);
  });

  it('counts routes rather than unique schools when asked how many routes match', () => {
    const UKRates = [
      { ...rates[0], country: 'UK' },
      { ...rates[1], id: 'a-pg-second-route', universityId: 'a', universityName: 'Aberdeen University', country: 'UK' },
    ];
    const result = processChatTurn(createInitialChatState('u1'), 'how many routes are in UK?', UKRates, 1_000, 'STAFF');
    expect(result.matchingRates).toHaveLength(2);
    expect(result.state.conversation.messages[1].text).toMatch(/2 routes in UK/i);
  });

  it('lists matching Focus schools and counts unique schools for “how many are in Focus”', () => {
    const focusRates = [
      { ...rates[0], country: 'UK', guidance: 'FOCUS' as const },
      { ...rates[1], id: 'a-focus-ug', country: 'UK', guidance: 'FOCUS' as const },
      { ...rates[1], id: 'b-allowed', universityId: 'b', universityName: 'Bristol University', country: 'UK', guidance: 'ALLOWED' as const },
    ];
    const list = processChatTurn(createInitialChatState('u1'), 'Which schools are currently in Focus?', focusRates, 1_000, 'AGENT');
    expect(list.matchingRates.map((rate) => rate.universityId)).toEqual(['a', 'a']);
    expect(list.state.conversation.messages[1].text).toMatch(/Focus.*Aberdeen University/i);
    const count = processChatTurn(createInitialChatState('u1'), 'How many are in Focus?', focusRates, 1_000, 'AGENT');
    expect(count.state.conversation.messages[1].text).toMatch(/1 school.*Focus/i);
  });

  it('uses dated intake order and excludes undated records from highest and lowest', () => {
    const intakeRates = [
      { ...rates[0], intake: 'Jan 2026' },
      { ...rates[1], id: 'b-future', universityId: 'b', universityName: 'Bristol University', intake: 'Sept 2027' },
      { ...rates[1], id: 'c-undated', universityId: 'c', universityName: 'Cardiff University', intake: 'Current intake' },
    ];
    const highest = processChatTurn(createInitialChatState('u1'), 'Which is the highest intake?', intakeRates, 1_000, 'STAFF');
    expect(highest.matchingRates.map((rate) => rate.universityName)).toEqual(['Bristol University']);
    expect(highest.state.conversation.messages[1].text).toMatch(/latest.*Sept 2027/i);
    const lowest = processChatTurn(createInitialChatState('u1'), 'Which is the lowest intake?', intakeRates, 1_000, 'STAFF');
    expect(lowest.matchingRates.map((rate) => rate.universityName)).toEqual(['Aberdeen University']);
  });

  it('asks what a standalone this and that refer to when there is no chat context', () => {
    const result = processChatTurn(createInitialChatState('u1'), 'Which schools do this and that?', rates, 1_000, 'STAFF');
    expect(result.clarificationQuestions.join(' ')).toMatch(/what should “this and that” refer to/i);
    expect(result.matchingRates).toHaveLength(0);
  });

  it('treats multiple requested guidance statuses as alternatives and de-duplicates school names', () => {
    const guidanceRates = [
      { ...rates[0], guidance: 'FOCUS' as const },
      { ...rates[1], id: 'a-allowed-ug', guidance: 'ALLOWED' as const },
      { ...rates[1], id: 'b-focus', universityId: 'b', universityName: 'Bristol University', guidance: 'FOCUS' as const },
    ];
    const result = processChatTurn(createInitialChatState('u1'), 'Which schools are in Focus and Allowed?', guidanceRates, 1_000, 'STAFF');
    expect(result.matchingRates.map((rate) => rate.id)).toEqual(['a-pg', 'a-allowed-ug', 'b-focus']);
    expect(result.state.conversation.messages[1].text).toMatch(/Focus or Allowed schools: Aberdeen University, Bristol University/i);
  });

  it('explains when all matching intakes are undated instead of guessing an order', () => {
    const undated = [{ ...rates[0], intake: 'Current intake' }, { ...rates[1], intake: 'Legacy' }];
    const result = processChatTurn(createInitialChatState('u1'), 'Which is the highest intake?', undated, 1_000, 'STAFF');
    expect(result.matchingRates).toHaveLength(0);
    expect(result.state.conversation.messages[1].text).toMatch(/no matching routes with dated intakes/i);
  });
});

describe('chat dashboard filter handoff', () => {
  const activeFilters = { query: '', schoolIds: [], countries: ['UK'], levels: [], intakes: [], guidances: ['FOCUS'], aggregators: [] };
  it('greeting leaves dashboard filters unchanged', () => {
    const result = processChatTurn(createInitialChatState('u1'), 'hi', rates, 1_000, 'STAFF', activeFilters);
    expect(result.dashboardFilters).toBeUndefined();
  });
  it('ambiguous school leaves dashboard filters unchanged until level clarification is resolved', () => {
    const result = processChatTurn(createInitialChatState('u1'), 'Aberdeen University', rates, 1_000, 'STAFF', activeFilters);
    expect(result.clarificationQuestions.length).toBeGreaterThan(0);
    expect(result.dashboardFilters).toBeUndefined();
  });
  it('resolved school choice updates filters', () => {
    const initial = processChatTurn(createInitialChatState('u1'), 'Aberdeen University', rates, 1_000, 'STAFF', activeFilters);
    const resolved = processChatTurn(initial.state, 'Postgraduate', rates, 2_000, 'STAFF', activeFilters);
    expect(resolved.dashboardFilters).toMatchObject({ schoolIds: ['a'], levels: ['PG'] });
  });
  it('manual dashboard filters inform recognized Chat follow-ups', () => {
    const result = processChatTurn(createInitialChatState('u1'), 'same Focus', rates.map(rate => ({ ...rate, country: 'UK', guidance: 'FOCUS' as const })), 1_000, 'STAFF', activeFilters);
    expect(result.matchingRates.length).toBeGreaterThan(0);
    expect(result.matchingRates.every(rate => rate.country === 'UK')).toBe(true);
  });
});


