// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FontScaleProvider, useFontScale } from '../font-scale-provider';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <FontScaleProvider>{children}</FontScaleProvider>;
}

describe('FontScaleProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
    document.documentElement.style.fontSize = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.fontSize = '';
  });

  it('defaults to 100% scale', () => {
    const { result } = renderHook(() => useFontScale(), { wrapper });
    expect(result.current.scale).toBe(1);
    expect(result.current.label).toBe('100%');
  });

  it('reads saved scale index from localStorage', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'claude-md-font-scale' ? '2' : null),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
    const { result } = renderHook(() => useFontScale(), { wrapper });
    expect(result.current.scale).toBe(1.125);
    expect(result.current.label).toBe('113%');
  });

  it('ignores invalid saved index', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'claude-md-font-scale' ? '99' : null),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
    const { result } = renderHook(() => useFontScale(), { wrapper });
    expect(result.current.scale).toBe(1);
  });

  it('increases scale', () => {
    const { result } = renderHook(() => useFontScale(), { wrapper });
    expect(result.current.canIncrease).toBe(true);

    act(() => result.current.increase());
    expect(result.current.scale).toBe(1.125);
    expect(result.current.label).toBe('113%');
  });

  it('decreases scale', () => {
    const { result } = renderHook(() => useFontScale(), { wrapper });
    expect(result.current.canDecrease).toBe(true);

    act(() => result.current.decrease());
    expect(result.current.scale).toBe(0.875);
    expect(result.current.label).toBe('88%');
  });

  it('clamps at max scale', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'claude-md-font-scale' ? '3' : null),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
    const { result } = renderHook(() => useFontScale(), { wrapper });
    expect(result.current.scale).toBe(1.25);
    expect(result.current.canIncrease).toBe(false);

    act(() => result.current.increase());
    expect(result.current.scale).toBe(1.25);
  });

  it('clamps at min scale', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'claude-md-font-scale' ? '0' : null),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
    const { result } = renderHook(() => useFontScale(), { wrapper });
    expect(result.current.scale).toBe(0.875);
    expect(result.current.canDecrease).toBe(false);

    act(() => result.current.decrease());
    expect(result.current.scale).toBe(0.875);
  });

  it('persists scale index to localStorage', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem,
      clear: vi.fn(),
    });
    const { result } = renderHook(() => useFontScale(), { wrapper });
    act(() => result.current.increase());
    expect(setItem).toHaveBeenCalledWith('claude-md-font-scale', '2');
  });
});
