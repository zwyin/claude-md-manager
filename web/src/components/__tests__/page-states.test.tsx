// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import {
  PageLoader,
  PageError,
  Skeleton,
  DashboardSkeleton,
  RulesSkeleton,
  SessionsSkeleton,
  HistorySkeleton,
  SessionDetailSkeleton,
  RuleDetailSkeleton,
  AnalyticsSkeleton,
} from '../page-states';

describe('PageLoader', () => {
  afterEach(cleanup);

  it('renders spinner', () => {
    const { container } = render(<PageLoader />);
    // Component migrated from `.animate-spin` to `.spinner` class (commit c612946)
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('renders message when provided', () => {
    render(<PageLoader message="Loading rules..." />);
    expect(screen.getByText('Loading rules...')).toBeTruthy();
  });

  it('omits message span when not provided', () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelector('span')).toBeNull();
  });
});

describe('PageError', () => {
  afterEach(cleanup);

  it('renders error message', () => {
    render(<PageError message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});

describe('Skeleton', () => {
  afterEach(cleanup);

  it('renders with custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-8');
    expect(el.className).toContain('w-32');
    expect(el.className).toContain('animate-pulse');
  });

  it('renders without className', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('animate-pulse');
  });
});

describe('DashboardSkeleton', () => {
  afterEach(cleanup);

  it('renders 6 skeleton cards', () => {
    const { container } = render(<DashboardSkeleton />);
    // Card wrapper migrated from `.rounded-xl.border` to `.stat-card` class (commit c612946)
    const cards = container.querySelectorAll('.stat-card');
    expect(cards.length).toBe(6);
  });
});

describe('RulesSkeleton', () => {
  afterEach(cleanup);

  it('renders search bar skeleton', () => {
    const { container } = render(<RulesSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('SessionsSkeleton', () => {
  afterEach(cleanup);

  it('renders 8 skeleton rows', () => {
    const { container } = render(<SessionsSkeleton />);
    const rows = container.querySelectorAll('.border-b');
    expect(rows.length).toBe(8);
  });
});

describe('HistorySkeleton', () => {
  afterEach(cleanup);

  it('renders 4 timeline entries', () => {
    const { container } = render(<HistorySkeleton />);
    const entries = container.querySelectorAll('.relative.pl-8 > div');
    expect(entries.length).toBe(4);
  });
});

describe('SessionDetailSkeleton', () => {
  afterEach(cleanup);

  it('renders skeleton structure', () => {
    const { container } = render(<SessionDetailSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});

describe('RuleDetailSkeleton', () => {
  afterEach(cleanup);

  it('renders 3 metric columns', () => {
    const { container } = render(<RuleDetailSkeleton />);
    const cols = container.querySelectorAll('.grid-cols-3 > div');
    expect(cols.length).toBe(3);
  });
});

describe('AnalyticsSkeleton', () => {
  afterEach(cleanup);

  it('renders 5 stat card skeletons', () => {
    const { container } = render(<AnalyticsSkeleton />);
    const cards = container.querySelectorAll('.grid-cols-2 > div, .grid-cols-3 > div, .grid-cols-5 > div');
    expect(cards.length).toBe(5);
  });
});
