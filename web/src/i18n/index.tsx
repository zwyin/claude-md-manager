'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import zh from './zh';
import en from './en';
import type { Dict } from './zh';

const dicts: Record<string, Dict> = { zh, en };
const localeMap: Record<string, string> = { zh: 'zh-CN', en: 'en-US' };

type InterpolateArgs = Record<string, string | number>;

interface I18nContextValue {
  lang: string;
  locale: string;
  setLang: (lang: string) => void;
  t: (key: keyof Dict, args?: InterpolateArgs) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>('zh');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved && dicts[saved]) {
      queueMicrotask(() => setLangState(saved));
    }
  }, []);

  const setLang = useCallback((newLang: string) => {
    if (dicts[newLang]) {
      setLangState(newLang);
      localStorage.setItem('lang', newLang);
    }
  }, []);

  const t = useCallback(
    (key: keyof Dict, args?: InterpolateArgs): string => {
      let text = (dicts[lang]?.[key] as string) || (dicts.zh[key] as string) || (key as string);
      if (args) {
        for (const [k, v] of Object.entries(args)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, locale: localeMap[lang] || 'zh-CN', setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Standalone translate for class components that can't use hooks. */
export function t(key: keyof Dict, args?: InterpolateArgs): string {
  const lang = (typeof window !== 'undefined' && localStorage.getItem('lang')) || 'zh';
  let text = (dicts[lang]?.[key] as string) || (dicts.zh[key] as string) || (key as string);
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
