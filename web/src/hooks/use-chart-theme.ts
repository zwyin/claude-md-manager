import { useEffect, useState } from 'react';

function getVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function useChartTheme() {
  const [theme, setTheme] = useState({
    card: '#faf9f5',
    border: '#f0eee6',
    foreground: '#141413',
    mutedForeground: '#87867f',
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTheme({
        card: getVar('--card') || '#faf9f5',
        border: getVar('--border') || '#f0eee6',
        foreground: getVar('--foreground') || '#141413',
        mutedForeground: getVar('--muted-foreground') || '#87867f',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return theme;
}
