import { useEffect, useState } from 'react';

function getVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function useChartTheme() {
  const [theme, setTheme] = useState({
    card: '#1e293b',
    border: '#334155',
    foreground: '#e2e8f0',
    mutedForeground: '#cbd5e1',
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTheme({
        card: getVar('--card') || '#1e293b',
        border: getVar('--border') || '#334155',
        foreground: getVar('--foreground') || '#e2e8f0',
        mutedForeground: getVar('--muted-foreground') || '#cbd5e1',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return theme;
}
