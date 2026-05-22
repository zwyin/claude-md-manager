import { useEffect, useState } from 'react';

function getVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function useChartTheme() {
  const [theme, setTheme] = useState({
    card: '#18181b',
    border: '#27272a',
    foreground: '#fafafa',
    mutedForeground: '#a1a1aa',
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTheme({
        card: getVar('--card') || '#18181b',
        border: getVar('--border') || '#27272a',
        foreground: getVar('--foreground') || '#fafafa',
        mutedForeground: getVar('--muted-foreground') || '#a1a1aa',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return theme;
}
