import { describe, expect, it } from 'vitest';
import { COMMON_AGGREGATORS } from './aggregators';

describe('common aggregator options', () => {
  it('includes KC Overseas and AIMS Education', () => {
    expect(COMMON_AGGREGATORS).toContain('KC OVERSEAS');
    expect(COMMON_AGGREGATORS).toContain('AIMS EDUCATION');
  });
});
