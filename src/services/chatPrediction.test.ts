import { describe, expect, it } from 'vitest';
import type { CommissionRate } from '../types';
import { predictQueryCompletions } from './chatPrediction';

const rates: CommissionRate[] = [
  { id: 'a', universityId: 'a', universityName: 'Aberdeen University', country: 'UK', intake: 'Jan 2027', studyLevel: 'PG', aggregator: 'SI-UK', guidance: 'FOCUS', masterRate: 0, agentRate: 12, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS' },
  { id: 'b', universityId: 'b', universityName: 'Bristol University', country: 'UK', intake: 'Sept 2027', studyLevel: 'UG', aggregator: 'UAP', guidance: 'ALLOWED', masterRate: 0, agentRate: 15, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS' },
];

describe('local role-aware query prediction', () => {
  it('offers contextual completions that preserve the typed query prefix', () => {
    const suggestions = predictQueryCompletions('show focus', rates, 'AGENT');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every(({ completion }) => completion.toLowerCase().startsWith('show focus'))).toBe(true);
  });

  it('never suggests payout queries to Staff or routing queries to Agents', () => {
    const staffSuggestions = predictQueryCompletions('show', rates, 'STAFF').map(({ completion }) => completion.toLowerCase()).join(' ');
    const agentSuggestions = predictQueryCompletions('show', rates, 'AGENT').map(({ completion }) => completion.toLowerCase()).join(' ');
    expect(staffSuggestions).not.toMatch(/payout|commission rate/);
    expect(agentSuggestions).not.toMatch(/si-uk|uap|aggregator/);
  });

  it('uses local country and intake values in query completions', () => {
    const suggestions = predictQueryCompletions('show schools in', rates, 'STAFF');
    expect(suggestions.map(({ completion }) => completion)).toContain('Show schools in UK');
  });

  it('offers Nigerian conversational completions without adding Staff-only fields for Agents', () => {
    const nigerian = predictQueryCompletions('show schools wey', rates, 'AGENT').map(({ completion }) => completion);
    expect(nigerian).toContain('Show schools wey get Focus');
    const payout = predictQueryCompletions('how much', rates, 'AGENT').map(({ completion }) => completion.toLowerCase()).join(' ');
    expect(payout).toContain('how much dem dey pay for');
  });
});
