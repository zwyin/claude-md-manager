// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { RoutedErrorBoundary } from '../routed-error-boundary';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

let mockPathname = '/';

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'errorBoundary.title': 'Error',
      'errorBoundary.default': 'Default error',
      'errorBoundary.retry': 'Retry',
    };
    return map[key] ?? key;
  },
}));

function ThrowingChild(): React.ReactElement {
  throw new Error('route error');
}

function GoodChild(): React.ReactElement {
  return <div data-testid="child">OK</div>;
}

const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('RoutedErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    consoleSpy.mockClear();
  });

  it('renders children when no error', () => {
    render(
      <RoutedErrorBoundary>
        <GoodChild />
      </RoutedErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('catches errors and renders fallback', () => {
    render(
      <RoutedErrorBoundary>
        <ThrowingChild />
      </RoutedErrorBoundary>,
    );
    expect(screen.getByText('Error')).toBeTruthy();
  });
});
