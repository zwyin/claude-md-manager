import { useMemo } from 'react';
import { useChartTheme } from './use-chart-theme';

export function useTooltipStyle() {
  const theme = useChartTheme();
  return useMemo(() => ({
    contentStyle: {
      backgroundColor: theme.card,
      border: `1px solid ${theme.border}`,
      borderRadius: '8px',
      color: theme.foreground,
    },
  }), [theme]);
}
