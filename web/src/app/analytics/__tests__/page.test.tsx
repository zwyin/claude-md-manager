// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import AnalyticsPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-fetch', () => ({
  useFetch: () => ({ data: mockData, loading: mockLoading, error: mockError, refresh: mockRefresh }),
}));

vi.mock('@/hooks/use-page-title', () => ({
  usePageTitle: () => {},
}));

vi.mock('@/hooks/use-chart-theme', () => ({
  useChartTheme: () => ({ mutedForeground: '#999' }),
}));

vi.mock('@/hooks/use-chart-tooltip', () => ({
  useTooltipStyle: () => ({}),
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        'analytics.title': 'Analytics',
        'analytics.subtitle': 'Statistics',
        'analytics.timeRange': 'Range',
        'analytics.time.all': 'All',
        'analytics.time.7d': '7d',
        'analytics.time.30d': '30d',
        'analytics.time.90d': '90d',
        'analytics.trend.day': 'Day',
        'analytics.trend.week': 'Week',
        'analytics.trend.month': 'Month',
        'analytics.topRules': 'Top rules',
        'analytics.sectionDist': 'Distribution',
        'analytics.citationTrend': 'Citation trend',
        'analytics.avgPerDay': 'Avg/day',
        'analytics.noData': 'No data',
        'analytics.confidence': 'Confidence',
        'analytics.confidence.subtitle': 'Distribution',
        'analytics.confidence.high': 'High',
        'analytics.confidence.high.desc': 'High desc',
        'analytics.confidence.medium': 'Medium',
        'analytics.confidence.medium.desc': 'Medium desc',
        'analytics.confidence.low': 'Low',
        'analytics.confidence.low.desc': 'Low desc',
        'analytics.confidence.source': 'Source',
        'analytics.confidence.source.mcp': 'MCP',
        'analytics.confidence.source.stop': 'Stop',
        'analytics.confidence.source.posttool': 'PostTool',
        'analytics.heatmap': 'Heatmap',
        'analytics.heatmap.subtitle': 'Heatmap desc',
        'analytics.neverCited': 'Never cited',
        'analytics.allRulesActive': 'All active',
        'dashboard.totalRules': 'Rules',
        'dashboard.totalSessions': 'Sessions',
        'dashboard.refresh': 'Refresh',
        'metric.coverage': 'Coverage',
        'metric.coverage.desc': 'Coverage desc',
        'metric.depth': 'Depth',
        'metric.depth.desc': 'Depth desc',
        'metric.share': 'Share',
        'term.citation': 'Citation',
        'term.citation.desc': 'Citation desc',
        'term.coldRule': 'Cold rules',
        'term.coldRule.desc': 'Cold desc',
        'table.rules': 'rules',
        'table.matches': 'matches',
        'status.error': params?.error ? `Error: ${params.error}` : 'Error',
      };
      return map[key] ?? key;
    },
    locale: 'en',
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/stat-card', () => ({
  StatCard: ({ label, value }: any) => <div data-testid="stat-card">{label}: {value}</div>,
}));

vi.mock('@/components/term-tooltip', () => ({
  TermTooltip: ({ term }: any) => <span>{term}</span>,
}));

vi.mock('@/components/citation-heatmap', () => ({
  CitationHeatmap: ({ data }: any) => <div data-testid="heatmap">Heatmap ({data.length})</div>,
}));

vi.mock('@/components/page-states', () => ({
  AnalyticsSkeleton: () => <div data-testid="analytics-skeleton">Loading...</div>,
  PageError: ({ message }: any) => <div data-testid="page-error">{message}</div>,
}));

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Cell: () => <div />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  Legend: () => <div />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
}));

vi.mock('@/lib/chart-colors', () => ({
  CHART_COLORS: ['#6366f1', '#8b5cf6'],
  STAT_COLORS: { rules: '#6366f1', sessions: '#8b5cf6', activeRate: '#a855f7', citations: '#ec4899', avgCoverage: '#f59e0b', avgDepth: '#10b981' },
  PRIMARY: '#6366f1',
}));

vi.mock('@/lib/relative-time', () => ({
  relativeTime: () => '2h ago',
}));

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
  });
  afterEach(cleanup);

  it('renders loading skeleton', () => {
    mockLoading = true;
    render(<AnalyticsPage />);
    expect(screen.getByTestId('analytics-skeleton')).toBeTruthy();
  });

  it('renders error state', () => {
    mockError = 'Fail';
    render(<AnalyticsPage />);
    expect(screen.getByTestId('page-error')).toBeTruthy();
  });

  it('renders analytics with data', () => {
    mockData = {
      total_rules: 54,
      total_sessions: 1700,
      total_citations: 9600,
      avg_coverage: 0.45,
      avg_depth: 2.3,
      top_rules: [
        { rule_id: 'r1', title: 'Rule One', citation_count: 100, session_coverage: 0.5, avg_depth: 2.0 },
      ],
      category_distribution: [
        { section_id: 'core', title: 'Core', citation_count: 500, rule_count: 10 },
      ],
      citation_trend: [{ period: '2026-01', count: 50 }],
      confidence_distribution: [
        { confidence: 'high', count: 100, top_rules: [] },
        { confidence: 'medium', count: 50, top_rules: [] },
        { confidence: 'low', count: 20, top_rules: [] },
      ],
      heatmap: [],
      cold_rules: [],
    };
    render(<AnalyticsPage />);
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeTruthy();
  });

  it('shows time range buttons', () => {
    mockData = {
      total_rules: 0, total_sessions: 0, total_citations: 0, avg_coverage: 0, avg_depth: 0,
      top_rules: [], category_distribution: [], citation_trend: [], confidence_distribution: [], heatmap: [], cold_rules: [],
    };
    render(<AnalyticsPage />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('7d')).toBeTruthy();
  });

  it('shows no data for empty trend', () => {
    mockData = {
      total_rules: 0, total_sessions: 0, total_citations: 0, avg_coverage: 0, avg_depth: 0,
      top_rules: [], category_distribution: [], citation_trend: [], confidence_distribution: [], heatmap: [], cold_rules: [],
    };
    render(<AnalyticsPage />);
    const noDataEls = screen.getAllByText('No data');
    expect(noDataEls.length).toBeGreaterThan(0);
  });

  it('shows all rules active when no cold rules', () => {
    mockData = {
      total_rules: 1, total_sessions: 1, total_citations: 1, avg_coverage: 1, avg_depth: 1,
      top_rules: [], category_distribution: [], citation_trend: [], confidence_distribution: [], heatmap: [], cold_rules: [],
    };
    render(<AnalyticsPage />);
    expect(screen.getByText('All active')).toBeTruthy();
  });

  it('shows cold rules list', () => {
    mockData = {
      total_rules: 2, total_sessions: 1, total_citations: 1, avg_coverage: 0.5, avg_depth: 1,
      top_rules: [], category_distribution: [], citation_trend: [], confidence_distribution: [], heatmap: [],
      cold_rules: [{ rule_id: 'cold1', title: 'Cold Rule', section_id: 'core', citation_count: 0, last_cited: null }],
    };
    render(<AnalyticsPage />);
    expect(screen.getByText('Cold Rule')).toBeTruthy();
    expect(screen.getByText('Never cited')).toBeTruthy();
  });

  it('renders heatmap with data', () => {
    mockData = {
      total_rules: 1, total_sessions: 1, total_citations: 1, avg_coverage: 1, avg_depth: 1,
      top_rules: [], category_distribution: [], citation_trend: [], confidence_distribution: [],
      heatmap: [{ rule_id: 'r1', day: '2026-01-01', count: 5 }],
      cold_rules: [],
    };
    render(<AnalyticsPage />);
    expect(screen.getByTestId('heatmap')).toBeTruthy();
  });
});
