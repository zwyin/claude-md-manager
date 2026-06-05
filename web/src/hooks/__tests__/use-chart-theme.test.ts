// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChartTheme } from '../use-chart-theme';

describe('useChartTheme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default values when no CSS variables set', () => {
    const { result } = renderHook(() => useChartTheme());
    expect(result.current).toEqual({
      card: '#faf9f5',
      border: '#f0eee6',
      foreground: '#141413',
      mutedForeground: '#87867f',
    });
  });

  it('reads CSS variables after mount', async () => {
    const style = document.createElement('style');
    style.textContent = `:root { --card: #ffffff; --border: #e0e0e0; --foreground: #111111; --muted-foreground: #666666; }`;
    document.head.appendChild(style);

    const { result } = renderHook(() => useChartTheme());

    await waitFor(() => {
      expect(result.current.card).toBe('#ffffff');
      expect(result.current.border).toBe('#e0e0e0');
      expect(result.current.foreground).toBe('#111111');
      expect(result.current.mutedForeground).toBe('#666666');
    });

    document.head.removeChild(style);
  });

  it('falls back to defaults when CSS variable is empty', async () => {
    const { result } = renderHook(() => useChartTheme());
    // rAF fires, getComputedStyle returns empty for unset vars
    await waitFor(() => {
      expect(result.current.card).toBe('#faf9f5');
    });
  });
});
