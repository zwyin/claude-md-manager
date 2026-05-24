// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import EditorPage from '../page';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/use-page-title', () => ({
  usePageTitle: () => {},
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        'editor.title': 'Editor',
        'editor.subtitle': 'Edit rules',
        'editor.publishAll': 'Publish',
        'editor.unsavedDrafts': params ? `${params.count} drafts` : '',
        'editor.publishHistory': 'Publish history',
        'editor.noPublishHistory': 'No history',
        'editor.selectRule': 'Select a rule',
        'editor.preview': 'Preview',
        'editor.loadFailed': 'Load failed',
        'editor.published': params ? `Published ${params.count} rules` : 'Published',
        'editor.draftSaved': 'Saved',
        'editor.draftSaveFailed': 'Save failed',
        'editor.draftLoadFailed': 'Draft load failed',
        'editor.draftDiscarded': 'Discarded',
        'editor.draftDiscardFailed': 'Discard failed',
        'editor.reorderFailed': 'Reorder failed',
        'editor.publishFailed': params ? `Failed: ${params.error}` : 'Failed',
        'editor.hideRules': 'Hide',
        'editor.showRules': 'Show',
        'editor.cancel': 'Cancel',
        'status.loading': 'Loading',
        'dashboard.buildStatus.success': 'Success',
        'dashboard.buildStatus.failed': 'Failed',
      };
      return map[key] ?? key;
    },
    locale: 'en',
  }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open }: any) => <div data-open={open}>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/page-states', () => ({
  PageLoader: ({ message }: any) => <div data-testid="page-loader">{message || 'Loading'}</div>,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../EditorLayout', () => ({
  EditorLayout: ({ children }: any) => {
    if (children && typeof children === 'object' && !React.isValidElement(children)) {
      return <div data-testid="editor-layout">{Object.values(children)}</div>;
    }
    return <div data-testid="editor-layout">{typeof children === 'function' ? children() : children}</div>;
  },
}));

vi.mock('../RuleListPanel', () => ({
  RuleListPanel: ({ rules, selectedId, onSelect }: any) => (
    <div data-testid="rule-list">
      {rules.map((r: any) => (
        <button key={r.rule_id} data-selected={selectedId === r.rule_id} onClick={() => onSelect(r.rule_id)}>{r.rule_id}</button>
      ))}
    </div>
  ),
}));

vi.mock('../EditorPanel', () => ({
  EditorPanel: (props: any) => (
    <div data-testid="editor-panel">
      <span>{props.frontmatterYaml}</span>
      <span>{props.markdownBody}</span>
    </div>
  ),
}));

vi.mock('../PreviewPanel', () => ({
  PreviewPanel: ({ markdownBody }: any) => <div data-testid="preview-panel">{markdownBody}</div>,
}));

vi.mock('../PublishDialog', () => ({
  PublishDialog: ({ rules, onPublish, onCancel }: any) => (
    <div data-testid="publish-dialog">
      <button onClick={onPublish}>Do publish</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const mockRules = [
  { rule_id: 'rule-a', title: 'Rule A', frontmatter_yaml: 'id: rule-a', markdown_body: 'Body A', has_draft: false, source_file: 'core.md', section_id: 'core', order: 0 },
  { rule_id: 'rule-b', title: 'Rule B', frontmatter_yaml: 'id: rule-b', markdown_body: 'Body B', has_draft: true, source_file: 'core.md', section_id: 'core', order: 10 },
];

describe('EditorPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/editor/rules') && !url.includes('/draft')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rules: mockRules }) });
      }
      if (url.includes('/draft')) {
        return Promise.resolve({ ok: true, status: 404, json: () => Promise.resolve(null) });
      }
      if (url.includes('/publish-history')) {
        return Promise.resolve({ json: () => Promise.resolve({ history: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });
  afterEach(cleanup);

  it('shows loading initially', () => {
    render(<EditorPage />);
    expect(screen.getByTestId('page-loader')).toBeTruthy();
  });

  it('renders editor after load', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Editor' })).toBeTruthy();
    });
  });

  it('shows unsaved drafts count', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText(/1 drafts/)).toBeTruthy();
    });
  });

  it('renders rule list', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByTestId('rule-list')).toBeTruthy();
    });
  });

  it('selects first rule by default', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-panel')).toBeTruthy();
    });
  });

  it('renders publish history section', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish history')).toBeTruthy();
    });
  });

  it('shows no publish history when empty', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('No history')).toBeTruthy();
    });
  });

  it('shows publish button', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeTruthy();
    });
  });
});
