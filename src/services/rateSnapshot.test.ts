import { describe, expect, it } from 'vitest';
import { selectRatesForScope } from './rateSnapshot';

describe('scoped rate snapshots', () => {
  it('does not expose a prior account or organization snapshot after scope changes', () => {
    const previous = [{ id: 'rate-a', agentRate: 20 }];

    expect(selectRatesForScope(previous, 'agent-a:AGENT:approved:org-a', 'agent-b:AGENT:approved:org-a')).toEqual([]);
    expect(selectRatesForScope(previous, 'agent-a:AGENT:approved:org-a', 'agent-a:AGENT:approved:org-b')).toEqual([]);
    expect(selectRatesForScope(previous, 'agent-a:AGENT:approved:org-a', 'agent-a:AGENT:revoked:org-a')).toEqual([]);
    expect(selectRatesForScope(previous, 'agent-a:AGENT:approved:org-a', 'agent-a:AGENT:approved:org-a')).toBe(previous);
  });
});
