// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
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
      <button data-testid="do-publish" onClick={onPublish}>Do publish</button>
      <button data-testid="cancel-publish" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const mockRules = [
  { rule_id: 'rule-a', title: 'Rule A', frontmatter_yaml: 'id: rule-a', markdown_body: 'Body A', has_draft: false, source_file: 'core.md', section_id: 'core', order: 0 },
  { rule_id: 'rule-b', title: 'Rule B', frontmatter_yaml: 'id: rule-b', markdown_body: 'Body B', has_draft: true, source_file: 'core.md', section_id: 'core', order: 10 },
];

const mockRulesWithDraft = [
  { ...mockRules[0], has_draft: true },
  { ...mockRules[1], has_draft: true },
];

function setupFetchMock(overrides: Record<string, any> = {}) {
  mockFetch.mockImplementation((url: string, opts?: any) => {
    if (overrides[url]) return overrides[url]();
    if (url.includes('/api/editor/rules') && !url.includes('/draft') && (!opts || opts.method === 'GET' || !opts.method)) {
      const rules = overrides.rulesResponse ?? mockRules;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rules }) });
    }
    if (url.includes('/draft') && opts?.method === 'PUT') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url.includes('/draft') && opts?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url.includes('/draft') && (!opts || !opts.method || opts.method === 'GET')) {
      if (overrides.draftResponse) return overrides.draftResponse();
      return Promise.resolve({ ok: true, status: 404, json: () => Promise.resolve(null) });
    }
    if (url.includes('/publish-history')) {
      const history = overrides.publishHistory ?? [];
      return Promise.resolve({ json: () => Promise.resolve({ history }) });
    }
    if (url.includes('/api/editor/publish') && opts?.method === 'POST') {
      if (overrides.publishResponse) return overrides.publishResponse();
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rulesChanged: 2 }) });
    }
    if (url.includes('/api/editor/reorder')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('EditorPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setupFetchMock();
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

  // Interaction tests
  it('selects a rule on click', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('rule-a')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('rule-b'));
    await waitFor(() => {
      expect(screen.getByText('rule-b').getAttribute('data-selected')).toBe('true');
    });
  });

  it('shows publish dialog on publish click', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Publish'));
    expect(screen.getByTestId('publish-dialog')).toBeTruthy();
  });

  it('closes publish dialog on cancel', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Publish'));
    expect(screen.getByTestId('publish-dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cancel-publish'));
    await waitFor(() => {
      expect(screen.queryByTestId('publish-dialog')).toBeNull();
    });
  });

  it('publishes and shows success toast', async () => {
    const { toast } = await import('sonner');
    setupFetchMock({ rulesResponse: mockRulesWithDraft });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Publish'));
    fireEvent.click(screen.getByTestId('do-publish'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Published 2 rules');
    });
  });

  it('shows error toast on publish failure', async () => {
    const { toast } = await import('sonner');
    setupFetchMock({
      rulesResponse: mockRulesWithDraft,
      publishResponse: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ error: 'Build failed' }) }),
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Publish'));
    fireEvent.click(screen.getByTestId('do-publish'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed: Build failed');
    });
  });

  it('shows error toast on load failure', async () => {
    const { toast } = await import('sonner');
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/editor/rules') && !url.includes('/draft')) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Load failed');
    });
  });

  it('loads draft data when selecting a rule with draft', async () => {
    setupFetchMock({
      draftResponse: () => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          frontmatter_yaml: 'id: rule-a-draft',
          markdown_body: 'Draft body',
        }),
      }),
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('id: rule-a-draft')).toBeTruthy();
      expect(screen.getAllByText('Draft body').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders publish history entries', async () => {
    setupFetchMock({
      publishHistory: [
        { id: 1, published_at: '2026-01-01T10:00:00Z', rules_changed: 3, status: 'success' },
      ],
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeTruthy();
      expect(screen.getByText('Published 3 rules')).toBeTruthy();
    });
  });

  it('renders failed publish in history', async () => {
    setupFetchMock({
      publishHistory: [
        { id: 2, published_at: '2026-01-02T10:00:00Z', rules_changed: 0, status: 'failed' },
      ],
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeTruthy();
    });
  });

  it('disables publish button when no drafts', async () => {
    setupFetchMock({
      rulesResponse: [
        { ...mockRules[0], has_draft: false },
        { ...mockRules[1], has_draft: false },
      ],
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish').closest('button')?.disabled).toBe(true);
    });
  });

  it('saves draft via Cmd+S shortcut', async () => {
    const { toast } = await import('sonner');
    setupFetchMock({
      draftResponse: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) }),
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-panel')).toBeTruthy();
    });
    fireEvent.keyDown(window, { metaKey: true, key: 's' });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Saved');
    });
  });

  it('saves draft via Ctrl+S shortcut', async () => {
    const { toast } = await import('sonner');
    setupFetchMock({
      draftResponse: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) }),
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-panel')).toBeTruthy();
    });
    fireEvent.keyDown(window, { ctrlKey: true, key: 's' });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Saved');
    });
  });

  it('shows error toast on draft save failure', async () => {
    const { toast } = await import('sonner');
    mockFetch.mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/editor/rules') && !url.includes('/draft') && (!opts || !opts.method)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rules: mockRules }) });
      }
      if (url.includes('/draft') && opts?.method === 'PUT') {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      if (url.includes('/draft')) {
        return Promise.resolve({ ok: true, status: 404, json: () => Promise.resolve(null) });
      }
      if (url.includes('/publish-history')) {
        return Promise.resolve({ json: () => Promise.resolve({ history: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-panel')).toBeTruthy();
    });
    fireEvent.keyDown(window, { metaKey: true, key: 's' });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Save failed');
    });
  });

  it('loads rule body when no draft exists', async () => {
    setupFetchMock({
      draftResponse: () => Promise.resolve({ ok: true, status: 404, json: () => Promise.resolve(null) }),
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('id: rule-a')).toBeTruthy();
      expect(screen.getAllByText('Body A').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows error toast on network error during publish', async () => {
    const { toast } = await import('sonner');
    setupFetchMock({
      rulesResponse: mockRulesWithDraft,
      publishResponse: () => Promise.reject(new Error('Network error')),
    });
    render(<EditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Publish'));
    fireEvent.click(screen.getByTestId('do-publish'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed: Network error');
    });
  });
});
