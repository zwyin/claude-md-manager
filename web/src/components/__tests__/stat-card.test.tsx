// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, act } from '@testing-library/react';
import { StatCard } from '../stat-card';

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive">{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

describe('StatCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders label', () => {
    render(<StatCard label="Sessions" value={42} />);
    expect(screen.getByText('Sessions')).toBeTruthy();
  });

  it('renders sublabel when provided', () => {
    render(<StatCard label="Rules" value={10} sublabel="active rules" />);
    expect(screen.getByText('active rules')).toBeTruthy();
  });

  it('renders as link when href provided', () => {
    render(<StatCard label="Test" value={5} href="/rules" />);
    const link = document.querySelector('a[href="/rules"]');
    expect(link).toBeTruthy();
  });

  it('renders trend chart when trend data provided', () => {
    const trend = [
      { date: '2024-01', count: 5 },
      { date: '2024-02', count: 10 },
    ];
    render(<StatCard label="Trend" value={10} trend={trend} />);
    expect(screen.getByTestId('area-chart')).toBeTruthy();
  });

  it('does not render trend chart with single data point', () => {
    const trend = [{ date: '2024-01', count: 5 }];
    render(<StatCard label="No Trend" value={10} trend={trend} />);
    expect(screen.queryByTestId('area-chart')).toBeNull();
  });

  it('animates from 0 to target value', () => {
    render(<StatCard label="Count" value={42} />);
    // Initial render shows animated value starting from 0.
    // Component uses inline style `fontFamily: var(--font-display)` (was `.text-3xl` class, c612946)
    const valueEl = document.querySelector('[style*="--font-display"]');
    expect(valueEl).toBeTruthy();
    expect(valueEl?.textContent).toBe('0');
  });

  it('renders color bar indicator', () => {
    const { container } = render(<StatCard label="Test" value={5} />);
    // Component uses CSS-variable `background` shorthand on the card surface (was `background-color`, c612946)
    const bar = container.querySelector('[style*="background"]');
    expect(bar).toBeTruthy();
  });

  it('animates to final integer value', () => {
    render(<StatCard label="Count" value={42} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('animates to final percentage value', () => {
    render(<StatCard label="Coverage" value={75.5} percentage />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('76%')).toBeTruthy();
  });

  it('animates to final decimal value', () => {
    render(<StatCard label="Score" value="3.14" />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('3.14')).toBeTruthy();
  });

  it('renders percentage with color style', () => {
    render(<StatCard label="Pct" value={80} percentage />);
    act(() => { vi.advanceTimersByTime(1000); });
    // Component sets `color: color` inline when `percentage` is true (was `.text-3xl` class, c612946)
    const valueEl = document.querySelector('[style*="--font-display"]');
    expect(valueEl?.getAttribute('style')).toContain('color');
  });

  it('handles NaN target value', () => {
    render(<StatCard label="Invalid" value="not-a-number" />);
    const valueEl = document.querySelector('[style*="--font-display"]');
    expect(valueEl?.textContent).toBe('0');
  });
});
