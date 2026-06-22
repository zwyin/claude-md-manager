// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import DashboardPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-fetch', () => ({
  useFetch: () => ({ data: mockData, loading: mockLoading, error: mockError, refresh: mockRefresh, fetchedAt: null }),
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
        'dashboard.title': 'Dashboard',
        'dashboard.subtitle': 'Overview',
        'dashboard.totalRules': 'Rules',
        'dashboard.totalSessions': 'Sessions',
        'dashboard.inSections': params ? `${params.count} sections` : '',
        'dashboard.lastUpdated': params ? `Updated ${params.ago}` : '',
        'dashboard.lastActivity': params ? `Last ${params.time}` : '',
        'dashboard.recentBuilds': 'Builds',
        'dashboard.recentCitations': 'Recent citations',
        'dashboard.recentSessions': 'Recent sessions',
        'dashboard.viewAll': 'View all',
        'dashboard.refresh': 'Refresh',
        'dashboard.sections': 'Sections',
        'dashboard.sections.subtitle': 'By section',
        'dashboard.topRules': 'Top rules',
        'dashboard.modelDistribution': 'Models',
        'dashboard.sessionTrend': 'Session trend',
        'dashboard.buildStatus.success': 'Success',
        'dashboard.buildStatus.failed': 'Failed',
        'dashboard.coldRules.count': params ? `${params.count} cold` : '',
        'term.activeRate': 'Active',
        'term.activeRate.desc': 'Active desc',
        'term.citation': 'Citation',
        'term.citation.desc': 'Citation desc',
        'term.coldRule': 'Cold rules',
        'term.coldRule.desc': 'Cold desc',
        'metric.coverage': 'Coverage',
        'metric.coverage.desc': 'Coverage desc',
        'metric.depth': 'Depth',
        'metric.depth.desc': 'Depth desc',
        'analytics.citationTrend': 'Trend',
        'analytics.avgPerDay': 'Avg/day',
        'analytics.time.all': 'All',
        'analytics.time.7d': '7d',
        'analytics.time.30d': '30d',
        'analytics.time.90d': '90d',
        'analytics.neverCited': 'Never cited',
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

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open }: any) => <div data-open={open}>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/stat-card', () => ({
  StatCard: ({ label, value }: any) => <div data-testid="stat-card">{typeof label === 'string' ? label : 'tooltip'}: {value}</div>,
}));

vi.mock('@/components/term-tooltip', () => ({
  TermTooltip: ({ term }: any) => <span>{term}</span>,
}));

vi.mock('@/components/chart-error-boundary', () => ({
  ChartErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/page-states', () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton">Loading...</div>,
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
  formatDuration: (sec: number) => sec > 3600 ? '1h+' : sec > 60 ? '1m+' : '',
}));

const baseData = {
  rules: [
    { rule_id: 'r1', title: 'Rule One', section_id: 'core', source_file: 'core.md', match_count: 100, session_coverage: 0.5, avg_depth: 2.0, citation_share: 0.3, keywords: ['test'], last_cited: '2026-01-01T10:00:00Z' },
    { rule_id: 'r2', title: 'Rule Two', section_id: 'core', source_file: 'core.md', match_count: 5, session_coverage: 0.1, avg_depth: 0.5, citation_share: 0.05, keywords: [] },
  ],
  sections: [{ section_id: 'core', title: 'Core', total_citations: 105, rule_count: 2 }],
  total_rules: 2,
  total_sessions: 100,
  active_rule_pct: 50,
  total_citations: 200,
  avg_coverage: 0.3,
  avg_depth: 1.25,
  citation_trend: [{ period: '2026-01', count: 50 }],
  session_trend: [{ period: '2026-01', count: 20 }],
  recent_citations: [
    { rule_id: 'r1', title: 'Rule One', timestamp: '2026-01-01T10:00:00Z', matched_keyword: 'test', confidence: 'high', section_id: 'core', session_id: 's1', model: 'claude' },
  ],
  recent_builds: [
    { id: 1, published_at: '2026-01-01T10:00:00Z', rules_changed: 3, status: 'success' },
  ],
  model_distribution: [{ model: 'claude', count: 80 }, { model: 'gpt-4', count: 20 }],
  recent_sessions: [
    { session_id: 'abc123', started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z', model: 'claude', task_summary: 'Test', duration_sec: 3600, rule_count: 2, citation_count: 5 },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
  });
  afterEach(cleanup);

  it('renders loading skeleton', () => {
    mockLoading = true;
    render(<DashboardPage />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  it('renders error state', () => {
    mockError = 'Fail';
    render(<DashboardPage />);
    expect(screen.getByTestId('page-error')).toBeTruthy();
  });

  it('renders dashboard with data', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Overview')).toBeTruthy();
  });

  it('renders stat cards', () => {
    mockData = baseData;
    render(<DashboardPage />);
    const cards = screen.getAllByTestId('stat-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it('renders time range buttons', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('7d')).toBeTruthy();
  });

  it('renders recent citations', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Recent citations')).toBeTruthy();
    expect(screen.getAllByText('Rule One').length).toBeGreaterThan(0);
  });

  it('renders recent sessions', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Recent sessions')).toBeTruthy();
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('renders recent builds', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Builds')).toBeTruthy();
    expect(screen.getByText('Success')).toBeTruthy();
  });

  it('renders model distribution', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Models')).toBeTruthy();
    expect(screen.getAllByText('claude').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gpt-4').length).toBeGreaterThan(0);
  });

  it('renders cold rules', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Cold rules')).toBeTruthy();
    // 'Rule Two' may appear in both the Top Rules bar list and the Cold Rules table.
    // Use getAllByText since the data set is small (2 rules).
    expect(screen.getAllByText('Rule Two').length).toBeGreaterThan(0);
  });

  it('renders sections chart', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Sections')).toBeTruthy();
  });

  it('renders top rules chart', () => {
    mockData = baseData;
    render(<DashboardPage />);
    expect(screen.getByText('Top rules')).toBeTruthy();
  });
});
