// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, act } from '@testing-library/react';
import { BackToTop } from '../back-to-top';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'accessibility.backToTop': 'Back to top',
      };
      return map[key] ?? key;
    },
  }),
}));

function createMockMain(scrollTop: number) {
  const main = document.createElement('main');
  let _scrollTop = scrollTop;
  Object.defineProperty(main, 'scrollTop', {
    get: () => _scrollTop,
    set: (v: number) => { _scrollTop = v; },
    configurable: true,
  });
  main.scrollTo = vi.fn();
  document.body.appendChild(main);
  return main;
}

describe('BackToTop', () => {
  afterEach(() => {
    cleanup();
    const main = document.querySelector('main');
    if (main) main.remove();
  });

  it('hides button when scrolled to top', () => {
    createMockMain(0);
    render(<BackToTop />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows button when scrolled past 400px', () => {
    const main = createMockMain(500);
    render(<BackToTop />);
    act(() => main.dispatchEvent(new Event('scroll', { bubbles: true })));
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('scrolls to top on click', () => {
    const main = createMockMain(500);
    render(<BackToTop />);
    act(() => main.dispatchEvent(new Event('scroll', { bubbles: true })));
    const btn = screen.getByRole('button');
    act(() => btn.click());
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('uses aria-label for accessibility', () => {
    const main = createMockMain(500);
    render(<BackToTop />);
    act(() => main.dispatchEvent(new Event('scroll', { bubbles: true })));
    expect(screen.getByLabelText('Back to top')).toBeTruthy();
  });
});
