import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSystemConfig } from './useSystemConfig';

describe('useSystemConfig', () => {
  it('provides system configuration default filters and methods', () => {
    const { result } = renderHook(() => useSystemConfig());
    expect(result.current.defaultIntake).toBeDefined();
    expect(result.current.loading).toBeDefined();
    expect(typeof result.current.updateDefaultIntake).toBe('function');
  });
});
