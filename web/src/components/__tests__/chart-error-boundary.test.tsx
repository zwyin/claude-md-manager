// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { ChartErrorBoundary } from '../chart-error-boundary';

// Suppress console.error from componentDidCatch
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

function ThrowingChild(): React.ReactElement {
  throw new Error('test chart error');
}

function GoodChild(): React.ReactElement {
  return <div data-testid="child">OK</div>;
}

describe('ChartErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    consoleSpy.mockClear();
  });

  it('renders children when no error', () => {
    render(
      <ChartErrorBoundary>
        <GoodChild />
      </ChartErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders default fallback on error', () => {
    render(
      <ChartErrorBoundary>
        <ThrowingChild />
      </ChartErrorBoundary>,
    );
    expect(screen.getByText('Chart unavailable')).toBeTruthy();
  });

  it('renders custom fallback on error', () => {
    render(
      <ChartErrorBoundary fallback={<div data-testid="custom-fallback">Custom error</div>}>
        <ThrowingChild />
      </ChartErrorBoundary>,
    );
    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
  });

  it('logs error to console', () => {
    render(
      <ChartErrorBoundary>
        <ThrowingChild />
      </ChartErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalledWith('Chart render error:', expect.any(Error));
  });
});
