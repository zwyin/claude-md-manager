// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { ScrollRestorer } from '../scroll-restorer';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

let mockPathname = '/';

// jsdom doesn't implement scrollTo on elements
const origScrollTo = HTMLElement.prototype.scrollTo;
beforeAll(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterAll(() => {
  HTMLElement.prototype.scrollTo = origScrollTo;
});

describe('ScrollRestorer', () => {
  afterEach(() => {
    cleanup();
    mockPathname = '/';
  });

  it('renders children', () => {
    const { container } = render(
      <ScrollRestorer>
        <div data-testid="child">Content</div>
      </ScrollRestorer>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it('renders main element', () => {
    const { container } = render(
      <ScrollRestorer>
        <span>test</span>
      </ScrollRestorer>,
    );
    const main = container.querySelector('main');
    expect(main).toBeTruthy();
    expect(main?.className).toContain('overflow-y-auto');
  });
});
