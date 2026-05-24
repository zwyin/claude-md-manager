// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import SessionsPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/use-fetch', () => ({
  useFetch: () => ({ data: mockData, loading: mockLoading, error: mockError, refresh: mockRefresh }),
}));

vi.mock('@/hooks/use-page-title', () => ({
  usePageTitle: () => {},
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        'session.listTitle': 'Sessions',
        'session.listSubtitle': 'All sessions',
        'session.searchPlaceholder': 'Search',
        'session.allTime': 'All',
        'session.allModels': 'All models',
        'session.allConfidence': 'All confidence',
        'session.sortBy': 'Sort by',
        'session.sort.time': 'Time',
        'session.sort.citations': 'Citations',
        'session.sort.rules': 'Rules',
        'session.sort.duration': 'Duration',
        'session.avgDuration': 'Avg duration',
        'session.avgCitations': 'Avg citations',
        'session.noSessions': 'No sessions',
        'session.copyId': 'Copy ID',
        'dashboard.totalSessions': 'Sessions',
        'dashboard.refresh': 'Refresh',
        'status.error': params?.error ? `Error: ${params.error}` : 'Error',
        'pagination.prev': 'Prev',
        'pagination.next': 'Next',
        'ruleDetail.copied': 'Copied',
        'table.rules': 'rules',
        'table.matches': 'matches',
        'analytics.time.7d': '7d',
        'analytics.time.30d': '30d',
        'analytics.time.90d': '90d',
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
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef((props: any, ref: any) => <input ref={ref} {...props} />),
}));

vi.mock('@/components/page-states', () => ({
  SessionsSkeleton: () => <div data-testid="sessions-skeleton">Loading...</div>,
  PageError: ({ message }: any) => <div data-testid="page-error">{message}</div>,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

vi.mock('@/lib/relative-time', () => ({
  formatDuration: (sec: number) => sec > 3600 ? '1h+' : sec > 60 ? '1m+' : '',
}));

describe('SessionsPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
  });
  afterEach(cleanup);

  it('renders loading skeleton', () => {
    mockLoading = true;
    render(<SessionsPage />);
    expect(screen.getByTestId('sessions-skeleton')).toBeTruthy();
  });

  it('renders error state', () => {
    mockError = 'Server error';
    render(<SessionsPage />);
    expect(screen.getByTestId('page-error')).toBeTruthy();
    expect(screen.getByText(/Server error/)).toBeTruthy();
  });

  it('renders sessions list with data', () => {
    mockData = {
      sessions: [
        { session_id: 'abc123def', started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z', model: 'claude', task_summary: 'Test task', duration_sec: 3600, rule_count: 3, citation_count: 10 },
      ],
      total: 1,
      avg_duration: 3600,
      avg_citations: 10,
      models: ['claude', 'gpt-4'],
      limit: 50,
      offset: 0,
    };
    render(<SessionsPage />);
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeTruthy();
    expect(screen.getByText('Test task')).toBeTruthy();
  });

  it('shows empty state', () => {
    mockData = {
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: [],
      limit: 50,
      offset: 0,
    };
    render(<SessionsPage />);
    expect(screen.getByText('No sessions')).toBeTruthy();
  });

  it('renders sort buttons', () => {
    mockData = {
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: [],
      limit: 50,
      offset: 0,
    };
    render(<SessionsPage />);
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getByText('Citations')).toBeTruthy();
  });

  it('shows model filter when multiple models', () => {
    mockData = {
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: ['claude', 'gpt-4'],
      limit: 50,
      offset: 0,
    };
    render(<SessionsPage />);
    expect(screen.getByText('All models')).toBeTruthy();
    expect(screen.getByText('claude')).toBeTruthy();
    expect(screen.getByText('gpt-4')).toBeTruthy();
  });

  it('hides model filter for single model', () => {
    mockData = {
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: ['claude'],
      limit: 50,
      offset: 0,
    };
    render(<SessionsPage />);
    expect(screen.queryByText('All models')).toBeNull();
  });
});
