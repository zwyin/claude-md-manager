'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type FontScale = 0.875 | 1 | 1.125 | 1.25;

const STORAGE_KEY = 'claude-md-font-scale';
const SCALES: FontScale[] = [0.875, 1, 1.125, 1.25];
const SCALE_INDEX_DEFAULT = 1; // 1 = 100%

interface FontScaleContextValue {
  scale: FontScale;
  scaleIndex: number;
  increase: () => void;
  decrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
  label: string;
}

const FontScaleContext = createContext<FontScaleContextValue>({
  scale: 1,
  scaleIndex: 1,
  increase: () => {},
  decrease: () => {},
  canIncrease: true,
  canDecrease: true,
  label: '100%',
});

export function useFontScale() {
  return useContext(FontScaleContext);
}

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scaleIndex, setScaleIndex] = useState(() => {
    if (typeof window === 'undefined') return SCALE_INDEX_DEFAULT;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const idx = parseInt(saved, 10);
      if (idx >= 0 && idx < SCALES.length) return idx;
    }
    return SCALE_INDEX_DEFAULT;
  });

  const scale = SCALES[scaleIndex];

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale * 100}%`;
  }, [scale]);

  const increase = useCallback(() => {
    setScaleIndex((i) => Math.min(i + 1, SCALES.length - 1));
  }, []);

  const decrease = useCallback(() => {
    setScaleIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(scaleIndex));
  }, [scaleIndex]);

  return (
    <FontScaleContext.Provider value={{
      scale,
      scaleIndex,
      increase,
      decrease,
      canIncrease: scaleIndex < SCALES.length - 1,
      canDecrease: scaleIndex > 0,
      label: `${Math.round(scale * 100)}%`,
    }}>
      {children}
    </FontScaleContext.Provider>
  );
}
