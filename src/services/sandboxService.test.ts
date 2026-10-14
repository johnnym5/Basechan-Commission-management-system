import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSandboxActive,
  setSandboxActive,
  importToSandbox,
} from './sandboxService';
import type { CommissionRate } from '../types';

describe('sandboxService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('manages sandbox active state in localStorage', () => {
    expect(isSandboxActive()).toBe(false);

    setSandboxActive(true);
    expect(isSandboxActive()).toBe(true);

    setSandboxActive(false);
    expect(isSandboxActive()).toBe(false);
  });

  it('handles sandbox imports gracefully', async () => {
    const mockRates: CommissionRate[] = [
      {
        id: 'test_uni_1',
        universityId: 'uni_1',
        universityName: 'University 1',
        country: 'Canada',
        intake: 'Sept 2026',
        aggregator: 'BASECHAN',
        studyLevel: 'UG',
        masterRate: 20,
        agentRate: 15,
        diffMargin: 5,
        isFlatFee: false,
        netOrGross: 'NET',
      },
    ];

    await expect(importToSandbox('test-uid', mockRates)).resolves.not.toThrow();
  });
});
