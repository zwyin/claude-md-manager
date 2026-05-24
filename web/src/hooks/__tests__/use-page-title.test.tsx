// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Dict } from '@/i18n/zh';
import { usePageTitle, useDynamicPageTitle } from '../use-page-title';
import { I18nProvider } from '@/i18n';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('usePageTitle', () => {
  afterEach(() => {
    document.title = '';
  });

  it('sets document title from translation key', () => {
    renderHook(() => usePageTitle('dashboard.title'), { wrapper });
    expect(document.title).toContain('CLAUDE.md Manager');
  });

  it('updates title when key changes', () => {
    const { rerender } = renderHook(({ key }) => usePageTitle(key), {
      wrapper,
      initialProps: { key: 'dashboard.title' as keyof Dict },
    });
    const first = document.title;
    rerender({ key: 'rules.title' as keyof Dict });
    expect(document.title).not.toBe(first);
    expect(document.title).toContain('CLAUDE.md Manager');
  });
});

describe('useDynamicPageTitle', () => {
  afterEach(() => {
    document.title = '';
  });

  it('sets title from dynamic string', () => {
    renderHook(() => useDynamicPageTitle('My Rule'));
    expect(document.title).toBe('My Rule | CLAUDE.md Manager');
  });

  it('does not set title when value is null', () => {
    document.title = 'Original';
    renderHook(() => useDynamicPageTitle(null));
    expect(document.title).toBe('Original');
  });

  it('does not set title when value is undefined', () => {
    document.title = 'Original';
    renderHook(() => useDynamicPageTitle(undefined));
    expect(document.title).toBe('Original');
  });

  it('updates when value changes', () => {
    const { rerender } = renderHook(({ t }) => useDynamicPageTitle(t), {
      initialProps: { t: 'First' },
    });
    expect(document.title).toBe('First | CLAUDE.md Manager');
    rerender({ t: 'Second' });
    expect(document.title).toBe('Second | CLAUDE.md Manager');
  });
});
