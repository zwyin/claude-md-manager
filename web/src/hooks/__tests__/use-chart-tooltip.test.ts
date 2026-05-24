// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTooltipStyle } from '../use-chart-tooltip';

describe('useTooltipStyle', () => {
  it('returns tooltip style with expected properties', async () => {
    const { result } = renderHook(() => useTooltipStyle());

    await waitFor(() => {
      const style = result.current.contentStyle;
      expect(style).toHaveProperty('backgroundColor');
      expect(style).toHaveProperty('border');
      expect(style).toHaveProperty('borderRadius', '8px');
      expect(style).toHaveProperty('color');
    });
  });

  it('includes theme-derived border color', async () => {
    const { result } = renderHook(() => useTooltipStyle());

    await waitFor(() => {
      expect(result.current.contentStyle.border).toContain('solid');
    });
  });
});
