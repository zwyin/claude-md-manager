// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { PreviewPanel } from '../PreviewPanel';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = { 'editor.preview': 'Preview' };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}));

vi.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));

describe('PreviewPanel', () => {
  afterEach(cleanup);

  it('renders preview label', () => {
    render(<PreviewPanel markdownBody="# Hello" />);
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('passes markdown to ReactMarkdown', () => {
    render(<PreviewPanel markdownBody="**bold text**" />);
    expect(screen.getByTestId('md').textContent).toBe('**bold text**');
  });

  it('renders empty body', () => {
    render(<PreviewPanel markdownBody="" />);
    expect(screen.getByTestId('md')).toBeTruthy();
  });
});
