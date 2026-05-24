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
      card: '#18181b',
      border: '#27272a',
      foreground: '#fafafa',
      mutedForeground: '#a1a1aa',
    });
  });

  it('reads CSS variables after mount', async () => {
    const style = document.createElement('style');
    style.textContent = `:root { --card: #1a1a2e; --border: #16213e; --foreground: #e0e0e0; --muted-foreground: #7f8c8d; }`;
    document.head.appendChild(style);

    const { result } = renderHook(() => useChartTheme());

    await waitFor(() => {
      expect(result.current.card).toBe('#1a1a2e');
      expect(result.current.border).toBe('#16213e');
      expect(result.current.foreground).toBe('#e0e0e0');
      expect(result.current.mutedForeground).toBe('#7f8c8d');
    });

    document.head.removeChild(style);
  });

  it('falls back to defaults when CSS variable is empty', async () => {
    const { result } = renderHook(() => useChartTheme());
    // rAF fires, getComputedStyle returns empty for unset vars
    await waitFor(() => {
      expect(result.current.card).toBe('#18181b');
    });
  });
});
