// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import RuleDetailPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'rule-a' }),
}));

vi.mock('@/hooks/use-fetch', () => ({
  useFetch: () => ({ data: mockData, loading: mockLoading, error: mockError }),
}));

vi.mock('@/hooks/use-page-title', () => ({
  useDynamicPageTitle: () => {},
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
        'rules.title': 'Rules',
        'ruleDetail.backTo': params?.section ? `Back to ${params.section}` : 'Back',
        'ruleDetail.content': 'Content',
        'ruleDetail.section': 'Section',
        'ruleDetail.source': 'Source',
        'ruleDetail.lastCited': 'Last cited',
        'ruleDetail.editInEditor': 'Edit',
        'ruleDetail.copyId': 'Copy ID',
        'ruleDetail.copyContent': 'Copy',
        'ruleDetail.copied': 'Copied',
        'ruleDetail.noContent': 'No content',
        'ruleDetail.noCitations': 'No citations',
        'ruleDetail.sameSection': 'Same section',
        'ruleDetail.coOccurring': 'Co-occurring',
        'ruleDetail.coOccurring.desc': 'Rules cited in same sessions',
        'ruleDetail.citationTrend': 'Citation trend',
        'ruleDetail.showing': `Showing ${params?.shown} of ${params?.total}`,
        'ruleDetail.loadMore': 'Load more',
        'ruleDetail.model': 'Model',
        'status.error': params?.error ? `Error: ${params.error}` : 'Error',
        'metric.coverage': 'Coverage',
        'metric.coverage.full': 'Coverage',
        'metric.coverage.desc': 'Coverage desc',
        'metric.depth': 'Depth',
        'metric.depth.full': 'Depth',
        'metric.depth.desc': 'Depth desc',
        'metric.share': 'Share',
        'metric.share.full': 'Share',
        'metric.share.desc': 'Share desc',
        'term.keywords': 'Keywords',
        'term.keywords.desc': 'Keywords desc',
        'term.citation': 'Citation',
        'term.citation.desc': 'Citation desc',
        'table.sessions': 'sessions',
        'table.matches': 'matches',
        'table.time': 'Time',
        'table.keyword': 'Keyword',
        'analytics.time.all': 'All',
        'analytics.time.7d': '7d',
        'analytics.time.30d': '30d',
        'analytics.time.90d': '90d',
        'analytics.confidence.high': 'High',
        'analytics.confidence.medium': 'Medium',
        'analytics.confidence.low': 'Low',
        'editor.words': 'words',
        'editor.lines': 'lines',
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
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

vi.mock('@/components/term-tooltip', () => ({
  TermTooltip: ({ term }: any) => <span>{term}</span>,
}));

vi.mock('@/components/metric-visualizations', () => ({
  DetailMetricBar: ({ value }: any) => <div data-testid="detail-metric-bar" data-value={value} />,
  DepthGauge: ({ value }: any) => <div data-testid="depth-gauge" data-value={value} />,
}));

vi.mock('@/components/page-states', () => ({
  RuleDetailSkeleton: () => <div data-testid="rule-detail-skeleton">Loading...</div>,
  PageError: ({ message }: any) => <div data-testid="page-error">{message}</div>,
}));

vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('remark-gfm', () => ({ default: () => {} }));

vi.mock('@/lib/chart-colors', () => ({
  STAT_COLORS: { avgCoverage: '#6366f1', citations: '#8b5cf6', avgDepth: '#a855f7' },
  PRIMARY: '#6366f1',
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

describe('RuleDetailPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
  });
  afterEach(cleanup);

  it('renders loading skeleton', () => {
    mockLoading = true;
    render(<RuleDetailPage />);
    expect(screen.getByTestId('rule-detail-skeleton')).toBeTruthy();
  });

  it('renders error state', () => {
    mockError = 'Not found';
    render(<RuleDetailPage />);
    expect(screen.getByTestId('page-error')).toBeTruthy();
    expect(screen.getByText(/Not found/)).toBeTruthy();
  });

  it('renders rule detail with data', () => {
    mockData = {
      rule: { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', section_title: 'Core', source_file: 'core.md', citation_count: 10, keywords: ['test'], body: 'Hello world', last_cited: '2026-01-01T10:00:00Z' },
      citations: [
        { id: 1, rule_id: 'rule-a', timestamp: '2026-01-01T10:00:00Z', matched_keyword: 'test', confidence: 'high', session_id: 's1', model: 'claude', task_summary: 'Task' },
      ],
      siblings: [],
      co_occurring: [],
      total_sessions: 100,
      total_citations: 500,
    };
    render(<RuleDetailPage />);
    expect(screen.getByRole('heading', { name: 'Rule A' })).toBeTruthy();
    expect(screen.getByText('core.md')).toBeTruthy();
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('shows keyword badges', () => {
    mockData = {
      rule: { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', section_title: 'Core', source_file: 'core.md', citation_count: 0, keywords: ['alpha', 'beta'], body: null },
      citations: [],
      siblings: [],
      co_occurring: [],
      total_sessions: 0,
      total_citations: 0,
    };
    render(<RuleDetailPage />);
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.getByText('beta')).toBeTruthy();
  });

  it('shows no content when body is null', () => {
    mockData = {
      rule: { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', section_title: 'Core', source_file: 'core.md', citation_count: 0, keywords: [], body: null },
      citations: [],
      siblings: [],
      co_occurring: [],
      total_sessions: 0,
      total_citations: 0,
    };
    render(<RuleDetailPage />);
    expect(screen.getByText('No content')).toBeTruthy();
  });

  it('renders siblings section', () => {
    mockData = {
      rule: { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', section_title: 'Core', source_file: 'core.md', citation_count: 5, keywords: [], body: null },
      citations: [],
      siblings: [{ rule_id: 'rule-b', title: 'Rule B', match_count: 3, session_coverage: 0.5, avg_depth: 1.2 }],
      co_occurring: [],
      total_sessions: 10,
      total_citations: 50,
    };
    render(<RuleDetailPage />);
    expect(screen.getByText(/Same section/)).toBeTruthy();
    expect(screen.getByText('Rule B')).toBeTruthy();
  });

  it('renders co-occurring section', () => {
    mockData = {
      rule: { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', section_title: 'Core', source_file: 'core.md', citation_count: 5, keywords: [], body: null },
      citations: [],
      siblings: [],
      co_occurring: [{ rule_id: 'rule-c', title: 'Rule C', section_id: 'project', co_sessions: 8, total_matches: 20 }],
      total_sessions: 10,
      total_citations: 50,
    };
    render(<RuleDetailPage />);
    expect(screen.getByText('Co-occurring')).toBeTruthy();
    expect(screen.getByText('Rule C')).toBeTruthy();
  });

  it('shows load more when citations exceed limit', () => {
    const citations = Array.from({ length: 60 }, (_, i) => ({
      id: i, rule_id: 'rule-a', timestamp: '2026-01-01T10:00:00Z', matched_keyword: 'test', confidence: 'high', session_id: `s${i}`, model: null, task_summary: null,
    }));
    mockData = {
      rule: { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', section_title: 'Core', source_file: 'core.md', citation_count: 60, keywords: [], body: null },
      citations,
      siblings: [],
      co_occurring: [],
      total_sessions: 100,
      total_citations: 500,
    };
    render(<RuleDetailPage />);
    expect(screen.getByText('Load more')).toBeTruthy();
  });

  it('shows no citations message when empty', () => {
    mockData = {
      rule: { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', section_title: 'Core', source_file: 'core.md', citation_count: 0, keywords: [], body: null },
      citations: [],
      siblings: [],
      co_occurring: [],
      total_sessions: 0,
      total_citations: 0,
    };
    render(<RuleDetailPage />);
    expect(screen.getByText('No citations')).toBeTruthy();
  });
});
