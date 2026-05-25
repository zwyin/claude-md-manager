// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import SessionsPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;
const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
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
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>{children}</button>
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

const sessionData = {
  sessions: [
    { session_id: 'abc123def', started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z', model: 'claude', task_summary: 'Test task', duration_sec: 3600, rule_count: 3, citation_count: 10 },
    { session_id: 'xyz789ghi', started_at: '2026-01-02T10:00:00Z', ended_at: '2026-01-02T10:30:00Z', model: 'gpt-4', task_summary: 'Another task', duration_sec: 1800, rule_count: 1, citation_count: 5 },
  ],
  total: 2,
  avg_duration: 2700,
  avg_citations: 7,
  models: ['claude', 'gpt-4'],
  limit: 50,
  offset: 0,
};

describe('SessionsPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
    mockPush.mockClear();
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
    mockData = sessionData;
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
    mockData = { ...sessionData, sessions: [] };
    render(<SessionsPage />);
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getByText('Citations')).toBeTruthy();
  });

  it('shows model filter when multiple models', () => {
    mockData = { ...sessionData, sessions: [] };
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

  // Interaction tests
  it('renders time range filter buttons', () => {
    mockData = { ...sessionData, sessions: [] };
    render(<SessionsPage />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('7d')).toBeTruthy();
    expect(screen.getByText('30d')).toBeTruthy();
    expect(screen.getByText('90d')).toBeTruthy();
  });

  it('renders confidence filter', () => {
    mockData = { ...sessionData, sessions: [] };
    render(<SessionsPage />);
    expect(screen.getByText('All confidence')).toBeTruthy();
  });

  it('renders search input', () => {
    mockData = { ...sessionData, sessions: [] };
    render(<SessionsPage />);
    expect(screen.getByPlaceholderText(/Search/)).toBeTruthy();
  });

  it('renders session rows with data', () => {
    mockData = sessionData;
    render(<SessionsPage />);
    expect(screen.getByText('abc123de')).toBeTruthy();
    expect(screen.getByText('xyz789gh')).toBeTruthy();
    expect(screen.getByText('Test task')).toBeTruthy();
    expect(screen.getByText('Another task')).toBeTruthy();
  });

  it('renders avg stats badges', () => {
    mockData = sessionData;
    render(<SessionsPage />);
    expect(screen.getByText(/Avg duration/)).toBeTruthy();
    expect(screen.getByText(/Avg citations/)).toBeTruthy();
  });

  it('renders pagination info', () => {
    mockData = { ...sessionData, total: 100 };
    render(<SessionsPage />);
    expect(screen.getByText(/1–50 \/ 100/)).toBeTruthy();
  });

  it('shows next button when more pages exist', () => {
    mockData = { ...sessionData, total: 100 };
    render(<SessionsPage />);
    expect(screen.getByText('Next →')).toBeTruthy();
  });

  it('does not show pagination for single page', () => {
    mockData = sessionData;
    render(<SessionsPage />);
    expect(screen.queryByText('Next →')).toBeNull();
    expect(screen.queryByText('← Prev')).toBeNull();
  });

  it('copies session id on click', async () => {
    const { toast } = await import('sonner');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mockData = sessionData;
    render(<SessionsPage />);
    const idBtn = screen.getByText('abc123de');
    fireEvent.click(idBtn);
    expect(writeText).toHaveBeenCalledWith('abc123def');
    expect(toast.success).toHaveBeenCalledWith('Copied');
  });

  it('shows model badges in session rows', () => {
    mockData = sessionData;
    render(<SessionsPage />);
    expect(screen.getAllByText('claude').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gpt-4').length).toBeGreaterThan(0);
  });

  it('shows sort direction indicator on active sort', () => {
    mockData = sessionData;
    render(<SessionsPage />);
    const allBtns = screen.getAllByRole('button');
    const timeBtn = allBtns.find((b) => b.textContent?.includes('Time'));
    expect(timeBtn?.getAttribute('data-variant')).toBe('default');
  });
});
