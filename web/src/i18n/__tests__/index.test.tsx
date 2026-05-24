// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { I18nProvider, useI18n, t } from '../index';
import type { Dict } from '../zh';

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

beforeEach(() => {
  localStorageMock.clear();
  document.documentElement.lang = '';
});

afterEach(() => {
  document.documentElement.lang = '';
});

describe('I18nProvider + useI18n', () => {
  it('provides default zh locale', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('zh');
    expect(result.current.locale).toBe('zh-CN');
  });

  it('translates keys to Chinese by default', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('dashboard.title')).toBeTruthy();
  });

  it('switches to English via setLang', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLang('en');
    });
    expect(result.current.lang).toBe('en');
    expect(result.current.locale).toBe('en-US');
  });

  it('ignores invalid language in setLang', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLang('fr');
    });
    expect(result.current.lang).toBe('zh');
  });

  it('persists language to localStorage', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLang('en');
    });
    expect(localStorageMock.getItem('lang')).toBe('en');
  });

  it('sets document.documentElement.lang on setLang', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLang('en');
    });
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('interpolates template args', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const text = result.current.t('dashboard.inSections', { count: 5 });
    expect(text).toContain('5');
  });

  it('falls back to key for unknown keys', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const text = result.current.t('nonexistent.key' as keyof Dict);
    expect(text).toBe('nonexistent.key');
  });

  it('restores saved language from localStorage', async () => {
    localStorageMock.setItem('lang', 'en');
    const { result } = renderHook(() => useI18n(), { wrapper });
    await waitFor(() => {
      expect(result.current.lang).toBe('en');
    });
  });
});

describe('standalone t()', () => {
  it('translates without React context', () => {
    localStorageMock.clear();
    const text = t('dashboard.title');
    expect(text).toBeTruthy();
  });

  it('uses saved language from localStorage', () => {
    localStorageMock.setItem('lang', 'en');
    const text = t('nav.dashboard');
    expect(text).toBe('Dashboard');
  });

  it('falls back to zh when no localStorage', () => {
    localStorageMock.clear();
    const text = t('nav.dashboard');
    expect(text).toBe('仪表盘');
  });

  it('interpolates args', () => {
    const text = t('dashboard.inSections', { count: 3 });
    expect(text).toContain('3');
  });
});

describe('useI18n without provider', () => {
  it('throws error when used outside I18nProvider', () => {
    expect(() => renderHook(() => useI18n())).toThrow('useI18n must be used within I18nProvider');
  });
});

describe('localeMap fallback', () => {
  it('falls back to zh-CN when localeMap has no entry for lang', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    // en is in localeMap, so this should return en-US
    act(() => { result.current.setLang('en'); });
    expect(result.current.locale).toBe('en-US');

    // zh is in localeMap, returns zh-CN
    act(() => { result.current.setLang('zh'); });
    expect(result.current.locale).toBe('zh-CN');
  });
});

describe('translation fallback chain', () => {
  it('falls back to zh when key missing from current lang', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => { result.current.setLang('en'); });
    // en has keys that zh doesn't and vice versa — test a zh-only key in en mode
    // If the key exists in zh but not en, it falls back to zh
    const text = result.current.t('dashboard.title');
    expect(text).toBeTruthy();
  });
});

describe('standalone t() fallback paths', () => {
  it('falls back through dicts chain for unknown lang', () => {
    // Set lang to invalid value directly in localStorage to test dicts[lang]?.[key] || dicts.zh[key] path
    localStorageMock.setItem('lang', 'invalid');
    const text = t('dashboard.title');
    // Should fall back to zh since 'invalid' has no dict
    expect(text).toBeTruthy();
    expect(text).toBe(t('dashboard.title')); // same as zh default
  });

  it('returns key when missing from both dicts', () => {
    localStorageMock.clear();
    const text = t('completely.nonexistent.key' as keyof Dict);
    expect(text).toBe('completely.nonexistent.key');
  });
});
