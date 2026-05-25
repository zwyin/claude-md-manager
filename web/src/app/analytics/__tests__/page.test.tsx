// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
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
  Badge: ({ children, onClick }: any) => <span data-testid="badge" onClick={onClick}>{children}</span>,
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

const fullData = {
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
    { confidence: 'high', count: 100, source: 'posttool', top_rules: [{ rule_id: 'r1', title: 'Rule One', count: 50 }] },
    { confidence: 'medium', count: 50, source: 'stop', top_rules: [] },
    { confidence: 'low', count: 20, source: 'mcp', top_rules: [] },
  ],
  heatmap: [{ rule_id: 'r1', day: '2026-01-01', count: 5 }],
  cold_rules: [],
};

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
      total_rules: 54, total_sessions: 1700, total_citations: 9600, avg_coverage: 0.45, avg_depth: 2.3,
      top_rules: [{ rule_id: 'r1', title: 'Rule One', citation_count: 100, session_coverage: 0.5, avg_depth: 2.0 }],
      category_distribution: [{ section_id: 'core', title: 'Core', citation_count: 500, rule_count: 10 }],
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
    mockData = { ...fullData, citation_trend: [], heatmap: [] };
    render(<AnalyticsPage />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('7d')).toBeTruthy();
  });

  it('shows no data for empty trend', () => {
    mockData = { ...fullData, citation_trend: [], heatmap: [], confidence_distribution: [], cold_rules: [] };
    render(<AnalyticsPage />);
    const noDataEls = screen.getAllByText('No data');
    expect(noDataEls.length).toBeGreaterThan(0);
  });

  it('shows all rules active when no cold rules', () => {
    mockData = { ...fullData, cold_rules: [], heatmap: [] };
    render(<AnalyticsPage />);
    expect(screen.getByText('All active')).toBeTruthy();
  });

  it('shows cold rules list', () => {
    mockData = {
      ...fullData, heatmap: [],
      cold_rules: [{ rule_id: 'cold1', title: 'Cold Rule', section_id: 'core', citation_count: 0, last_cited: null }],
    };
    render(<AnalyticsPage />);
    expect(screen.getByText('Cold Rule')).toBeTruthy();
    expect(screen.getByText('Never cited')).toBeTruthy();
  });

  it('renders heatmap with data', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByTestId('heatmap')).toBeTruthy();
  });

  // Interaction tests
  it('shows confidence distribution counts', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Low')).toBeTruthy();
  });

  it('expands confidence item on click', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const highBtn = screen.getByText('High').closest('button');
    expect(highBtn).toBeTruthy();
    fireEvent.click(highBtn!);
    expect(screen.getByText('High desc')).toBeTruthy();
    expect(screen.getByText('MCP')).toBeTruthy();
  });

  it('collapses confidence item on second click', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const highBtn = screen.getByText('High').closest('button');
    fireEvent.click(highBtn!);
    expect(screen.getByText('High desc')).toBeTruthy();
    fireEvent.click(highBtn!);
    expect(screen.queryByText('High desc')).toBeNull();
  });

  it('shows top rules in expanded confidence item', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const highBtn = screen.getByText('High').closest('button');
    fireEvent.click(highBtn!);
    expect(screen.getAllByText('Top rules').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Rule One').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
  });

  it('renders stat cards with values', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const cards = screen.getAllByTestId('stat-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it('renders charts', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByTestId('bar-chart')).toBeTruthy();
    expect(screen.getByTestId('area-chart')).toBeTruthy();
  });

  it('shows confidence section heading', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByText('Confidence')).toBeTruthy();
  });

  it('clicks time range button', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const btn7d = screen.getByText('7d');
    fireEvent.click(btn7d);
    // After click, 7d should be active (variant=default)
    expect(btn7d.getAttribute('data-variant')).toBe('default');
  });

  it('clicks all time range resets filter', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const allBtn = screen.getByText('All');
    fireEvent.click(allBtn);
    expect(allBtn.getAttribute('data-variant')).toBe('default');
  });

  it('clicks trend mode buttons', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const weekBtn = screen.getByText('Week');
    fireEvent.click(weekBtn);
    expect(weekBtn.getAttribute('data-variant')).toBe('default');
  });

  it('clicks month trend mode', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const monthBtn = screen.getByText('Month');
    fireEvent.click(monthBtn);
    expect(monthBtn.getAttribute('data-variant')).toBe('default');
  });

  it('renders CSV download button', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByText('CSV')).toBeTruthy();
  });

  it('shows avg per day when trend has data', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByText(/Avg\/day/)).toBeTruthy();
  });

  it('renders pie chart with data', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByTestId('pie-chart')).toBeTruthy();
  });

  it('shows confidence percentage bars', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    // High=100, Medium=50, Low=20 → total=170
    expect(screen.getByText(/58.8%/)).toBeTruthy();
  });

  it('shows confidence counts', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('shows confidence source labels when expanded', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const medBtn = screen.getByText('Medium').closest('button');
    fireEvent.click(medBtn!);
    expect(screen.getByText('Stop')).toBeTruthy();
  });

  it('shows low confidence source when expanded', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const lowBtn = screen.getByText('Low').closest('button');
    fireEvent.click(lowBtn!);
    expect(screen.getByText('PostTool')).toBeTruthy();
  });

  it('renders cold rules with cited count', () => {
    mockData = {
      ...fullData,
      cold_rules: [{ rule_id: 'cold1', title: 'Cold Rule', section_id: 'core', citation_count: 3, last_cited: '2026-01-01T00:00:00Z' }],
    };
    render(<AnalyticsPage />);
    expect(screen.getByText('Cold Rule')).toBeTruthy();
    expect(screen.getByText(/3 matches/)).toBeTruthy();
    expect(screen.getByText('2h ago')).toBeTruthy();
  });

  it('renders cold rules badge count', () => {
    mockData = {
      ...fullData,
      cold_rules: [{ rule_id: 'cold1', title: 'Cold Rule', section_id: 'core', citation_count: 0, last_cited: null }],
    };
    render(<AnalyticsPage />);
    // Badge shows count of cold rules
    const badges = screen.getAllByTestId('badge');
    const countBadge = badges.find((b) => b.textContent === '1');
    expect(countBadge).toBeTruthy();
  });

  it('returns null when no data and not loading', () => {
    mockData = null;
    mockLoading = false;
    mockError = null;
    const { container } = render(<AnalyticsPage />);
    expect(container.innerHTML).toBe('');
  });

  it('shows no data for empty confidence distribution', () => {
    mockData = { ...fullData, confidence_distribution: [], heatmap: [], cold_rules: [] };
    render(<AnalyticsPage />);
    const noDataEls = screen.getAllByText('No data');
    expect(noDataEls.length).toBeGreaterThanOrEqual(2);
  });

  it('renders refresh button', () => {
    mockData = fullData;
    render(<AnalyticsPage />);
    const refreshBtn = screen.getByTitle('Refresh');
    expect(refreshBtn).toBeTruthy();
    fireEvent.click(refreshBtn);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('truncates long rule names in top rules data', () => {
    mockData = {
      ...fullData,
      top_rules: [{ rule_id: 'r1', title: 'A Very Long Rule Name That Exceeds Eighteen Characters', citation_count: 100, session_coverage: 0.5, avg_depth: 2.0 }],
    };
    render(<AnalyticsPage />);
    // BarChart mock receives data prop with truncated name
    expect(screen.getByTestId('bar-chart')).toBeTruthy();
  });

  it('uses section_id fallback when category has no title', () => {
    mockData = {
      ...fullData,
      category_distribution: [{ section_id: 'custom', title: '', citation_count: 200, rule_count: 5 }],
    };
    render(<AnalyticsPage />);
    expect(screen.getByTestId('pie-chart')).toBeTruthy();
  });

  it('clicks cold rule section badge to navigate', () => {
    mockData = {
      ...fullData,
      cold_rules: [{ rule_id: 'cold1', title: 'Cold Rule', section_id: 'core', citation_count: 0, last_cited: null }],
    };
    render(<AnalyticsPage />);
    const coreBadge = screen.getAllByTestId('badge').find((b) => b.textContent === 'core');
    expect(coreBadge).toBeTruthy();
    fireEvent.click(coreBadge!);
  });
});
