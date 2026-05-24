// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import ErrorPage from '../error';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'errorBoundary.title': 'Something went wrong',
        'errorBoundary.default': 'An unexpected error occurred',
        'errorBoundary.retry': 'Try again',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('Error page', () => {
  afterEach(cleanup);

  it('renders error message', () => {
    render(<ErrorPage error={new Error('test error')} reset={vi.fn()} />);
    expect(screen.getByText('test error')).toBeTruthy();
  });

  it('renders default message when error has no message', () => {
    render(<ErrorPage error={new Error()} reset={vi.fn()} />);
    expect(screen.getByText('An unexpected error occurred')).toBeTruthy();
  });

  it('renders retry button', () => {
    render(<ErrorPage error={new Error('err')} reset={vi.fn()} />);
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('calls reset on button click', () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('err')} reset={reset} />);
    screen.getByText('Try again').click();
    expect(reset).toHaveBeenCalled();
  });
});
