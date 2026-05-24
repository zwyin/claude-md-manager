// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { CitationHeatmap } from '../citation-heatmap';

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children, ...props }: any) => <div data-testid="trigger" {...props}>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'table.matches': 'Matches',
      };
      return map[key] ?? key;
    },
  }),
}));

const sampleData = [
  { rule_id: 'rule-a', title: 'Rule A', section_id: 'sec-1', day: '2024-01-01', count: 5 },
  { rule_id: 'rule-a', title: 'Rule A', section_id: 'sec-1', day: '2024-01-02', count: 3 },
  { rule_id: 'rule-b', title: 'Rule B', section_id: 'sec-2', day: '2024-01-01', count: 2 },
];

describe('CitationHeatmap', () => {
  afterEach(cleanup);

  it('returns null for empty data', () => {
    const { container } = render(<CitationHeatmap data={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders rule titles', () => {
    render(<CitationHeatmap data={sampleData} />);
    expect(screen.getAllByText('Rule A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rule B').length).toBeGreaterThan(0);
  });

  it('renders day labels', () => {
    render(<CitationHeatmap data={sampleData} />);
    expect(screen.getByText('01-01')).toBeTruthy();
    expect(screen.getByText('01-02')).toBeTruthy();
  });

  it('limits rules to maxRules', () => {
    const manyRules = Array.from({ length: 40 }, (_, i) => ({
      rule_id: `rule-${i}`,
      title: `Rule ${i}`,
      section_id: 'sec-1',
      day: '2024-01-01',
      count: i + 1,
    }));
    render(<CitationHeatmap data={manyRules} maxRules={5} />);
    // Each rule appears in label + tooltip content, so unique rule IDs in links is better
    const links = document.querySelectorAll('a[href^="/rules/rule-"]');
    const uniqueRules = new Set([...links].map((l) => (l as HTMLAnchorElement).getAttribute('href')));
    expect(uniqueRules.size).toBeLessThanOrEqual(5);
  });

  it('renders tooltip cells', () => {
    render(<CitationHeatmap data={sampleData} />);
    const tooltips = screen.getAllByTestId('trigger');
    expect(tooltips.length).toBeGreaterThan(0);
  });

  it('renders links to rule detail pages', () => {
    render(<CitationHeatmap data={sampleData} />);
    const links = document.querySelectorAll('a[href="/rules/rule-a"]');
    expect(links.length).toBeGreaterThan(0);
  });
});
