// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import GlobalError from '../global-error';

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'errorBoundary.title': 'Something went wrong',
      'errorBoundary.default': 'An unexpected error occurred',
      'errorBoundary.retry': 'Try again',
    };
    return map[key] ?? key;
  },
}));

describe('GlobalError page', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'en'),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders error message', () => {
    render(<GlobalError error={new Error('global error')} reset={vi.fn()} />);
    expect(screen.getByText('global error')).toBeTruthy();
  });

  it('renders retry button', () => {
    render(<GlobalError error={new Error('err')} reset={vi.fn()} />);
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('calls reset on button click', () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error('err')} reset={reset} />);
    screen.getByText('Try again').click();
    expect(reset).toHaveBeenCalled();
  });

  it('renders error title', () => {
    render(<GlobalError error={new Error('crash')} reset={vi.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});
