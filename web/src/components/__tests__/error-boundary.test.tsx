// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { ErrorBoundary } from '../error-boundary';

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

const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

function ThrowingChild(): React.ReactElement {
  throw new Error('test error');
}

function GoodChild(): React.ReactElement {
  return <div data-testid="child">OK</div>;
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    consoleSpy.mockClear();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders default fallback with error message', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('test error')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom">Custom</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('custom')).toBeTruthy();
  });

  it('shows default message when error has no message', () => {
    function ThrowNoMessage(): React.ReactElement {
      throw new Error();
    }
    render(
      <ErrorBoundary>
        <ThrowNoMessage />
      </ErrorBoundary>,
    );
    expect(screen.getByText('An unexpected error occurred')).toBeTruthy();
  });

  it('resets error state on retry click', () => {
    let shouldThrow = true;
    function ConditionalChild(): React.ReactElement {
      if (shouldThrow) throw new Error('conditional');
      return <div data-testid="recovered">Recovered</div>;
    }
    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Try again')).toBeTruthy();
    shouldThrow = false;
    screen.getByText('Try again').click();
    rerender(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('recovered')).toBeTruthy();
  });
});
