// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, act } from '@testing-library/react';
import { EditorLayout } from '../EditorLayout';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'editor.hideRules': 'Hide Rules',
        'editor.showRules': 'Show Rules',
        'editor.hidePreview': 'Hide Preview',
        'editor.showPreview': 'Show Preview',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

function renderLayout() {
  return render(
    <EditorLayout>
      {{
        ruleList: <div data-testid="rule-list">Rules</div>,
        editor: <div data-testid="editor">Editor</div>,
        preview: <div data-testid="preview">Preview</div>,
      }}
    </EditorLayout>,
  );
}

describe('EditorLayout', () => {
  afterEach(cleanup);

  it('renders all three panels', () => {
    renderLayout();
    expect(screen.getByTestId('rule-list')).toBeTruthy();
    expect(screen.getByTestId('editor')).toBeTruthy();
    expect(screen.getByTestId('preview')).toBeTruthy();
  });

  it('toggles preview panel on button click', () => {
    renderLayout();
    expect(screen.getByTestId('preview')).toBeTruthy();
    const btn = screen.getByRole('button', { name: /Preview/ });
    act(() => btn.click());
    expect(screen.queryByTestId('preview')).toBeNull();
  });

  it('toggles rule list on button click', () => {
    renderLayout();
    expect(screen.getByTestId('rule-list')).toBeTruthy();
    const btn = screen.getByRole('button', { name: /Rules/ });
    act(() => btn.click());
    expect(screen.queryByTestId('rule-list')).toBeNull();
  });

  it('toggles preview on Cmd+Shift+P', () => {
    renderLayout();
    expect(screen.getByTestId('preview')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', metaKey: true, shiftKey: true, bubbles: true }));
    });
    expect(screen.queryByTestId('preview')).toBeNull();
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderLayout();
    unmount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', metaKey: true, shiftKey: true, bubbles: true }));
    });
  });
});
