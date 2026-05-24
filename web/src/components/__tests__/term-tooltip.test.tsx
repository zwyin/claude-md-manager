// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { TermTooltip } from '../term-tooltip';

// TooltipProvider is needed for Radix tooltips
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <span data-testid="trigger">{children}</span>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="content">{children}</div>,
}));

describe('TermTooltip', () => {
  afterEach(cleanup);

  it('renders the term text', () => {
    render(<TermTooltip term="Coverage" explanation="How often a rule is cited" />);
    expect(screen.getByText('Coverage')).toBeTruthy();
  });

  it('renders the explanation in tooltip content', () => {
    render(<TermTooltip term="Depth" explanation="Average confidence score" />);
    expect(screen.getByText('Average confidence score')).toBeTruthy();
  });

  it('renders help icon', () => {
    const { container } = render(<TermTooltip term="X" explanation="Y" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
