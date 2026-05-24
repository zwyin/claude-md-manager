// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import SessionDetailPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-session-123' }),
}));

vi.mock('@/hooks/use-fetch', () => ({
  useFetch: () => ({ data: mockData, loading: mockLoading, error: mockError }),
}));

vi.mock('@/hooks/use-page-title', () => ({
  useDynamicPageTitle: () => {},
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        'session.title': 'Session',
        'session.listTitle': 'Sessions',
        'session.citations': 'Citations',
        'session.sectionsHit': 'Sections',
        'session.confidence': 'Confidence',
        'status.error': params?.error ? `Error: ${params.error}` : 'Error',
        'ruleDetail.copied': 'Copied',
        'ruleDetail.noCitations': 'No citations',
        'table.rules': 'rules',
        'table.matches': 'matches',
        'table.time': 'Time',
        'table.keyword': 'Keyword',
        'table.sessionId': 'Session',
        'rules.ruleName': 'Rule',
        'analytics.confidence.high': 'High',
        'analytics.confidence.medium': 'Medium',
        'analytics.confidence.low': 'Low',
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

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

vi.mock('@/components/page-states', () => ({
  SessionDetailSkeleton: () => <div data-testid="session-detail-skeleton">Loading...</div>,
  PageError: ({ message }: any) => <div data-testid="page-error">{message}</div>,
}));

vi.mock('@/lib/chart-colors', () => ({
  SECTION_COLORS: ['#6366f1', '#8b5cf6', '#a855f7'],
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

vi.mock('@/lib/relative-time', () => ({
  relativeTime: (ts: string) => '2h ago',
  formatDuration: (sec: number) => sec > 60 ? '2m' : '',
}));

describe('SessionDetailPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
  });
  afterEach(cleanup);

  it('renders loading skeleton', () => {
    mockLoading = true;
    render(<SessionDetailPage />);
    expect(screen.getByTestId('session-detail-skeleton')).toBeTruthy();
  });

  it('renders error state', () => {
    mockError = 'Network fail';
    render(<SessionDetailPage />);
    expect(screen.getByTestId('page-error')).toBeTruthy();
    expect(screen.getByText(/Network fail/)).toBeTruthy();
  });

  it('renders session detail with data', () => {
    mockData = {
      session: { session_id: 'test-session-123', started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z', model: 'claude', task_summary: 'Test task' },
      citations: [
        { rule_id: 'rule-a', title: 'Rule A', timestamp: '2026-01-01T10:30:00Z', matched_keyword: 'test', confidence: 'high', section_id: 'core', session_id: 'test-session-123' },
      ],
      sections: [{ section_id: 'core', section_title: 'Core' }],
    };
    render(<SessionDetailPage />);
    expect(screen.getByText('Session')).toBeTruthy();
    expect(screen.getByText('Test task')).toBeTruthy();
  });

  it('renders nothing when no data', () => {
    render(<SessionDetailPage />);
    expect(screen.queryByTestId('session-detail-skeleton')).toBeNull();
    expect(screen.queryByTestId('page-error')).toBeNull();
  });

  it('displays model badge', () => {
    mockData = {
      session: { session_id: 's1', started_at: null, ended_at: null, model: 'gpt-4', task_summary: null },
      citations: [],
      sections: [],
    };
    render(<SessionDetailPage />);
    expect(screen.getByText('gpt-4')).toBeTruthy();
  });

  it('shows no citations message when empty', () => {
    mockData = {
      session: { session_id: 's1', started_at: null, ended_at: null, model: null, task_summary: null },
      citations: [],
      sections: [],
    };
    render(<SessionDetailPage />);
    expect(screen.getByText('No citations')).toBeTruthy();
  });
});
