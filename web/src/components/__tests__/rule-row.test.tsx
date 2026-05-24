// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react';
import { RuleRow } from '../rule-row';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'accessibility.collapse': 'Collapse',
        'accessibility.expand': 'Expand',
        'status.loading': 'Loading...',
        'ruleDetail.noContent': 'No content',
        'rules.viewDetail': 'View detail',
        'ruleDetail.editInEditor': 'Edit in editor',
        'table.sessions': 'Sessions',
        'table.matches': 'Matches',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/metric-visualizations', () => ({
  MiniSparkline: () => <span data-testid="sparkline" />,
  MiniCoverageBar: () => <span data-testid="coverage-bar" />,
  MiniDepthBar: () => <span data-testid="depth-bar" />,
  InlineMetricBar: () => <span data-testid="inline-bar" />,
}));

vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

const mockRule = {
  rule_id: 'test-rule',
  title: 'Test Rule Title',
  match_count: 5,
  session_count: 10,
  session_coverage: 0.5,
  avg_depth: 3.5,
  citation_share: 0.2,
};

describe('RuleRow', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders rule title and id', () => {
    render(<RuleRow rule={mockRule as any} totalSessions={20} maxDepth={10} />);
    expect(screen.getByText('Test Rule Title')).toBeTruthy();
    expect(screen.getByText('test-rule')).toBeTruthy();
  });

  it('renders match count badge', () => {
    render(<RuleRow rule={mockRule as any} totalSessions={20} maxDepth={10} />);
    const badges = screen.getAllByTestId('badge');
    expect(badges.some((b) => b.textContent === '5')).toBe(true);
  });

  it('expands and fetches rule body on click', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rule: { body: '# Hello World' } }),
    } as Response);

    render(<RuleRow rule={mockRule as any} totalSessions={20} maxDepth={10} />);
    const expandBtn = screen.getByLabelText('Expand');
    await act(async () => expandBtn.click());

    expect(fetchSpy).toHaveBeenCalledWith('/api/rules/test-rule');
    expect(screen.getByTestId('markdown')).toBeTruthy();
    expect(screen.getByText('# Hello World')).toBeTruthy();
  });

  it('handles fetch error gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<RuleRow rule={mockRule as any} totalSessions={20} maxDepth={10} />);
    const expandBtn = screen.getByLabelText('Expand');
    await act(async () => { fireEvent.click(expandBtn); });

    expect(screen.getByText('No content')).toBeTruthy();
  });

  it('collapses on second click', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rule: { body: 'content' } }),
    } as Response);

    render(<RuleRow rule={mockRule as any} totalSessions={20} maxDepth={10} />);
    const expandBtn = screen.getByLabelText('Expand');
    await act(async () => { expandBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByText(/View detail/)).toBeTruthy();

    const collapseBtn = screen.getByLabelText('Collapse');
    await act(async () => { collapseBtn.click(); });
    expect(screen.queryByText(/View detail/)).toBeNull();
  });

  it('renders link to rule detail page', () => {
    render(<RuleRow rule={mockRule as any} totalSessions={20} maxDepth={10} />);
    const link = document.querySelector('a[href="/rules/test-rule"]');
    expect(link).toBeTruthy();
  });
});
