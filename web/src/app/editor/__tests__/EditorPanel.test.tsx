// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { EditorPanel } from '../EditorPanel';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'editor.saveDraft': 'Save Draft',
        'editor.discardDraft': 'Discard',
        'editor.unsavedChanges': 'Unsaved',
        'editor.yamlFrontmatter': 'YAML',
        'editor.markdownBody': 'Markdown',
        'editor.words': 'words',
        'editor.lines': 'lines',
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

vi.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea data-testid="codemirror" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => [] }));
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => [] }));

describe('EditorPanel', () => {
  afterEach(cleanup);

  it('renders save draft button', () => {
    render(<EditorPanel frontmatterYaml="" markdownBody="" hasDraft={false} dirty={false} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={vi.fn()} onDiscardDraft={vi.fn()} />);
    expect(screen.getByText(/Save Draft/)).toBeTruthy();
  });

  it('shows discard button when has draft', () => {
    render(<EditorPanel frontmatterYaml="" markdownBody="" hasDraft={true} dirty={false} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={vi.fn()} onDiscardDraft={vi.fn()} />);
    expect(screen.getByText('Discard')).toBeTruthy();
  });

  it('hides discard button when no draft', () => {
    render(<EditorPanel frontmatterYaml="" markdownBody="" hasDraft={false} dirty={false} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={vi.fn()} onDiscardDraft={vi.fn()} />);
    expect(screen.queryByText('Discard')).toBeNull();
  });

  it('shows unsaved indicator when dirty', () => {
    render(<EditorPanel frontmatterYaml="" markdownBody="" hasDraft={false} dirty={true} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={vi.fn()} onDiscardDraft={vi.fn()} />);
    expect(screen.getByText('Unsaved')).toBeTruthy();
  });

  it('computes word and line stats', () => {
    const body = 'hello world\nsecond line';
    render(<EditorPanel frontmatterYaml="id: test" markdownBody={body} hasDraft={false} dirty={false} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={vi.fn()} onDiscardDraft={vi.fn()} />);
    const matches = screen.getAllByText((_content: string, node: Element | null) => {
      return (node?.textContent?.includes('4 words') && node?.textContent?.includes('2 lines')) ?? false;
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('calls onSaveDraft on save click', () => {
    const onSave = vi.fn();
    render(<EditorPanel frontmatterYaml="" markdownBody="" hasDraft={false} dirty={false} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={onSave} onDiscardDraft={vi.fn()} />);
    screen.getByText(/Save Draft/).click();
    expect(onSave).toHaveBeenCalled();
  });

  it('calls onDiscardDraft on discard click', () => {
    const onDiscard = vi.fn();
    render(<EditorPanel frontmatterYaml="" markdownBody="" hasDraft={true} dirty={false} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={vi.fn()} onDiscardDraft={onDiscard} />);
    screen.getByText('Discard').click();
    expect(onDiscard).toHaveBeenCalled();
  });

  it('renders two code editors', () => {
    render(<EditorPanel frontmatterYaml="id: test" markdownBody="body text" hasDraft={false} dirty={false} onFrontmatterChange={vi.fn()} onBodyChange={vi.fn()} onSaveDraft={vi.fn()} onDiscardDraft={vi.fn()} />);
    const editors = screen.getAllByTestId('codemirror');
    expect(editors.length).toBe(2);
  });
});
