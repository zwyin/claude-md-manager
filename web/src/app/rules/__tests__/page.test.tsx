// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import RulesPage from '../page';

let mockData: any = null;
let mockLoading = false;
let mockError: string | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

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
        'rules.title': 'Rules',
        'rules.subtitle': params ? `${params.total} rules in ${params.sections} sections` : '',
        'rules.totalMatches': params ? `${params.count} matches` : 'matches',
        'rules.searchPlaceholder': 'Search rules',
        'rules.clearSearch': 'Clear',
        'rules.allSections': 'All sections',
        'rules.noResults': 'No results',
        'rules.showing': params ? `Showing ${params.shown} of ${params.total}` : '',
        'rules.ruleName': 'Rule',
        'status.error': params?.error ? `Error: ${params.error}` : 'Error',
        'metric.coverage': 'Coverage',
        'metric.depth': 'Depth',
        'metric.share': 'Share',
        'metric.coverage.desc': 'Coverage desc',
        'metric.depth.desc': 'Depth desc',
        'metric.share.desc': 'Share desc',
        'table.rules': 'rules',
        'table.matches': 'matches',
        'editor.hideRules': 'Hide',
        'editor.showRules': 'Show',
      };
      return map[key] ?? key;
    },
    locale: 'en',
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
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

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open }: any) => <div data-testid="collapsible" data-open={open}>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/term-tooltip', () => ({
  TermTooltip: ({ term }: any) => <span>{term}</span>,
}));

vi.mock('@/components/rule-row', () => ({
  RuleRow: ({ rule }: any) => <div data-testid="rule-row">{rule.title}</div>,
}));

vi.mock('@/components/page-states', () => ({
  PageLoader: () => <div>Loading</div>,
  RulesSkeleton: () => <div data-testid="rules-skeleton">Loading...</div>,
  PageError: ({ message }: any) => <div data-testid="page-error">{message}</div>,
}));

vi.mock('@/lib/chart-colors', () => ({
  SECTION_COLORS: ['#6366f1', '#8b5cf6'],
}));

describe('RulesPage', () => {
  beforeEach(() => {
    mockData = null;
    mockLoading = false;
    mockError = null;
  });
  afterEach(cleanup);

  it('renders loading skeleton', () => {
    mockLoading = true;
    render(<RulesPage />);
    expect(screen.getByTestId('rules-skeleton')).toBeTruthy();
  });

  it('renders error state', () => {
    mockError = 'Fail';
    render(<RulesPage />);
    expect(screen.getByTestId('page-error')).toBeTruthy();
  });

  it('renders rules with data', () => {
    mockData = {
      rules: [
        { rule_id: 'rule-a', title: 'Rule A', section_id: 'core', source_file: 'core.md', match_count: 10, session_coverage: 0.5, avg_depth: 2.0, citation_share: 0.3, keywords: ['test'] },
        { rule_id: 'rule-b', title: 'Rule B', section_id: 'core', source_file: 'core.md', match_count: 5, session_coverage: 0.3, avg_depth: 1.5, citation_share: 0.15, keywords: [] },
      ],
      sections: [{ section_id: 'core', title: 'Core', total_citations: 15, rule_count: 2 }],
      total_rules: 2,
      total_sessions: 100,
      total_citations: 30,
      avg_coverage: 0.4,
      avg_depth: 1.8,
    };
    render(<RulesPage />);
    expect(screen.getByRole('heading', { name: 'Rules' })).toBeTruthy();
    expect(screen.getAllByTestId('rule-row').length).toBe(2);
  });

  it('shows search input', () => {
    mockData = {
      rules: [],
      sections: [],
      total_rules: 0,
      total_sessions: 0,
      total_citations: 0,
      avg_coverage: 0,
      avg_depth: 0,
    };
    render(<RulesPage />);
    expect(screen.getByPlaceholderText(/Search rules/)).toBeTruthy();
  });

  it('shows section filter buttons', () => {
    mockData = {
      rules: [
        { rule_id: 'r1', title: 'R1', section_id: 'core', source_file: 'core.md', match_count: 1, session_coverage: 0, avg_depth: 0, citation_share: 0, keywords: [] },
      ],
      sections: [{ section_id: 'core', title: 'Core', total_citations: 1, rule_count: 1 }],
      total_rules: 1,
      total_sessions: 10,
      total_citations: 1,
      avg_coverage: 0,
      avg_depth: 0,
    };
    render(<RulesPage />);
    expect(screen.getByText('All sections')).toBeTruthy();
    expect(screen.getAllByText('Core').length).toBeGreaterThan(0);
  });
});
