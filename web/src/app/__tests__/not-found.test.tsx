// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import NotFound from '../not-found';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'notFound.title': 'Page not found',
        'notFound.description': 'The page you are looking for does not exist.',
        'notFound.backDashboard': 'Back to Dashboard',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('NotFound page', () => {
  afterEach(cleanup);

  it('renders 404 indicator', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeTruthy();
  });

  it('renders title and description', () => {
    render(<NotFound />);
    expect(screen.getByText('Page not found')).toBeTruthy();
    expect(screen.getByText('The page you are looking for does not exist.')).toBeTruthy();
  });

  it('renders link back to dashboard', () => {
    render(<NotFound />);
    const link = screen.getByText('Back to Dashboard').closest('a');
    expect(link?.getAttribute('href')).toBe('/');
  });
});
