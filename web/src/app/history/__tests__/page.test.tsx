// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import HistoryPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;

vi.mock('@/hooks/use-fetch', () => ({
  useFetch: () => ({ data: mockData, loading: mockLoading, error: mockError }),
}));

vi.mock('@/hooks/use-page-title', () => ({
  usePageTitle: () => {},
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        'history.title': 'History',
        'history.subtitle': 'Snapshot history',
        'history.snapshotCount': params ? `${params.count} snapshots` : '',
        'history.selected': params ? `${params.count} selected` : '',
        'history.selectHint': 'Select two to compare',
        'history.compare': 'Compare',
        'history.rollback': 'Rollback',
        'history.rollbackConfirm': 'Confirm',
        'history.rollbackSuccess': params ? `Rolled back to ${params.ts}` : 'Rolled back',
        'history.rollbackFailed': 'Rollback failed',
        'history.content': 'Content',
        'history.close': 'Close',
        'history.selectSnapshot': 'Select',
        'history.size': params ? `${params.size} B` : '',
        'history.noSnapshots': 'No snapshots',
        'history.diffFailed': 'Diff failed',
        'history.contentFailed': 'Content failed',
        'history.diff.title': 'Diff',
        'history.diff.noDiff': 'No differences',
        'status.error': params?.error ? `Error: ${params.error}` : 'Error',
        'status.loading': 'Loading',
        'editor.cancel': 'Cancel',
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

vi.mock('@/components/page-states', () => ({
  HistorySkeleton: () => <div data-testid="history-skeleton">Loading...</div>,
  PageError: ({ message }: any) => <div data-testid="page-error">{message}</div>,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('remark-gfm', () => ({ default: () => {} }));

describe('HistoryPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
  });
  afterEach(cleanup);

  it('renders loading skeleton', () => {
    mockLoading = true;
    render(<HistoryPage />);
    expect(screen.getByTestId('history-skeleton')).toBeTruthy();
  });

  it('renders error state', () => {
    mockError = 'DB error';
    render(<HistoryPage />);
    expect(screen.getByTestId('page-error')).toBeTruthy();
    expect(screen.getByText(/DB error/)).toBeTruthy();
  });

  it('renders empty state', () => {
    mockData = { snapshots: [] };
    render(<HistoryPage />);
    expect(screen.getByText('No snapshots')).toBeTruthy();
  });

  it('renders snapshot list', () => {
    mockData = {
      snapshots: [
        { filename: '2026-01-01T10-00-00.md', timestamp: '2026-01-01T10:00:00', version: 1, size: 1024, diffStats: { added: 5, removed: 2 } },
      ],
    };
    render(<HistoryPage />);
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getByText(/1024 B/)).toBeTruthy();
  });

  it('shows diff stats in snapshot', () => {
    mockData = {
      snapshots: [
        { filename: '2026-01-01T10-00-00.md', timestamp: '2026-01-01T10:00:00', version: 1, size: 512, diffStats: { added: 10, removed: 3 } },
      ],
    };
    render(<HistoryPage />);
    expect(screen.getByText('+10')).toBeTruthy();
    expect(screen.getByText('-3')).toBeTruthy();
  });

  it('shows rollback and content buttons', () => {
    mockData = {
      snapshots: [
        { filename: '2026-01-01T10-00-00.md', timestamp: '2026-01-01T10:00:00', version: 1, size: 256 },
      ],
    };
    render(<HistoryPage />);
    expect(screen.getByText('Rollback')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('groups snapshots by date', () => {
    mockData = {
      snapshots: [
        { filename: '2026-01-01T10-00-00.md', timestamp: '2026-01-01T10:00:00', version: 1, size: 100 },
        { filename: '2026-01-01T14-00-00.md', timestamp: '2026-01-01T14:00:00', version: 2, size: 200 },
        { filename: '2026-01-02T10-00-00.md', timestamp: '2026-01-02T10:00:00', version: 3, size: 300 },
      ],
    };
    render(<HistoryPage />);
    expect(screen.getByText('3 snapshots')).toBeTruthy();
  });
});
