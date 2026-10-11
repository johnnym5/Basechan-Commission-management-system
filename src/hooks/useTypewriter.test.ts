import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTypewriter } from './useTypewriter';

describe('useTypewriter', () => {
  it('returns empty string when paused', () => {
    const { result } = renderHook(() => useTypewriter(['Search Leicester...'], true));
    expect(result.current).toBe('');
  });
});
