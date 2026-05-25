// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HistoryPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

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

const snapshots = [
  { filename: '2026-01-01T10-00-00.md', timestamp: '2026-01-01T10:00:00', version: 1, size: 1024, diffStats: { added: 5, removed: 2 } },
  { filename: '2026-01-01T14-00-00.md', timestamp: '2026-01-01T14:00:00', version: 2, size: 2048, diffStats: { added: 3, removed: 1 } },
  { filename: '2026-01-02T10-00-00.md', timestamp: '2026-01-02T10:00:00', version: 3, size: 512 },
];

describe('HistoryPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
    mockFetch.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

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
    mockData = { snapshots: [snapshots[0]] };
    render(<HistoryPage />);
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getByText(/1024 B/)).toBeTruthy();
  });

  it('shows diff stats in snapshot', () => {
    mockData = { snapshots: [snapshots[0]] };
    render(<HistoryPage />);
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByText('-2')).toBeTruthy();
  });

  it('shows rollback and content buttons', () => {
    mockData = { snapshots: [snapshots[0]] };
    render(<HistoryPage />);
    expect(screen.getByText('Rollback')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('groups snapshots by date', () => {
    mockData = { snapshots };
    render(<HistoryPage />);
    expect(screen.getByText('3 snapshots')).toBeTruthy();
  });

  // Interaction tests
  it('selects a snapshot on checkbox click', () => {
    mockData = { snapshots: [snapshots[0]] };
    render(<HistoryPage />);
    const checkbox = screen.getByRole('button', { name: 'Select' });
    fireEvent.click(checkbox);
    expect(screen.getByText(/1 selected/)).toBeTruthy();
  });

  it('shows compare button when 2 snapshots selected', () => {
    mockData = { snapshots: [snapshots[0], snapshots[1]] };
    render(<HistoryPage />);
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText(/2 selected/)).toBeTruthy();
    expect(screen.getByText('Compare')).toBeTruthy();
  });

  it('keeps only 2 selected when clicking a 3rd', () => {
    mockData = { snapshots };
    render(<HistoryPage />);
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    expect(screen.getByText(/2 selected/)).toBeTruthy();
  });

  it('deselects a snapshot on second click', () => {
    mockData = { snapshots: [snapshots[0], snapshots[1]] };
    render(<HistoryPage />);
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1 selected/)).toBeTruthy();
    fireEvent.click(checkboxes[0]);
    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it('shows diff result after compare', async () => {
    mockData = { snapshots: [snapshots[0], snapshots[1]] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        from: '2026-01-01T10-00-00.md',
        to: '2026-01-01T14-00-00.md',
        stats: { added: 3, removed: 1 },
        lines: [
          { type: 'added', lineNum: { new: 5 }, content: 'new line' },
          { type: 'removed', lineNum: { old: 3 }, content: 'old line' },
          { type: 'unchanged', lineNum: { old: 4, new: 6 }, content: 'same' },
        ],
      }),
    });
    render(<HistoryPage />);
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Compare'));
    await waitFor(() => {
      expect(screen.getByText('Diff')).toBeTruthy();
    });
    expect(screen.getByText('new line')).toBeTruthy();
    expect(screen.getByText('old line')).toBeTruthy();
    expect(screen.getByText('same')).toBeTruthy();
  });

  it('shows error toast on compare failure', async () => {
    const { toast } = await import('sonner');
    mockData = { snapshots: [snapshots[0], snapshots[1]] };
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<HistoryPage />);
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Compare'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Diff failed');
    });
  });

  it('enters rollback confirm state on rollback click', () => {
    mockData = { snapshots: [snapshots[0]] };
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('Rollback'));
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('cancels rollback confirm', () => {
    mockData = { snapshots: [snapshots[0]] };
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('Rollback'));
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(screen.getByText('Rollback')).toBeTruthy();
    expect(screen.queryByText('Confirm')).toBeNull();
  });

  it('shows success message on rollback confirm', async () => {
    mockData = { snapshots: [snapshots[0]] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('Rollback'));
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => {
      expect(screen.getByText(/Rolled back to/)).toBeTruthy();
    });
  });

  it('shows error message on rollback failure', async () => {
    mockData = { snapshots: [snapshots[0]] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: false }),
    });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('Rollback'));
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => {
      expect(screen.getByText('Rollback failed')).toBeTruthy();
    });
  });

  it('shows content viewer on content click', async () => {
    mockData = { snapshots: [snapshots[0]] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: '# Hello World' }),
    });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('Content'));
    await waitFor(() => {
      expect(screen.getByText('# Hello World')).toBeTruthy();
    });
  });

  it('shows error toast on content fetch failure', async () => {
    const { toast } = await import('sonner');
    mockData = { snapshots: [snapshots[0]] };
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('Content'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Content failed');
    });
  });

  it('closes content viewer on close click', async () => {
    mockData = { snapshots: [snapshots[0]] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: 'some text' }),
    });
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('Content'));
    await waitFor(() => {
      expect(screen.getByText('some text')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('some text')).toBeNull();
  });

  it('shows no differences when diff has no changes', async () => {
    mockData = { snapshots: [snapshots[0], snapshots[1]] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        from: 'a.md',
        to: 'b.md',
        stats: { added: 0, removed: 0 },
        lines: [],
      }),
    });
    render(<HistoryPage />);
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Compare'));
    await waitFor(() => {
      expect(screen.getByText('No differences')).toBeTruthy();
    });
  });
});
