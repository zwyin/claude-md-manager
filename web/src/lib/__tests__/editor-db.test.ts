import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { execFileSync } from 'child_process';

// Mock modules
vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
}));

const mockPrepare = vi.fn();
const mockTransaction = vi.fn((fn) => fn);
const mockClose = vi.fn();

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(function (this: unknown) {
      return {
        prepare: mockPrepare,
        transaction: mockTransaction,
        close: mockClose,
      };
    }),
  };
});

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

// Helpers
function mockStatement(stmt: { all?: unknown; get?: unknown; run?: unknown }) {
  return {
    all: vi.fn(() => stmt.all ?? []),
    get: vi.fn(() => stmt.get ?? null),
    run: vi.fn(),
    bind: vi.fn(function (this: unknown) { return this; }),
  };
}

// Import after mocks
import {
  validateDrafts,
  getDraft,
  saveDraft,
  deleteDraft,
  saveReorder,
  getPublishHistory,
  getAllRulesWithDraftStatus,
  publishDrafts,
} from '../editor-db';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnValue(mockStatement({}));
});

// ── validateDrafts ──

describe('validateDrafts', () => {
  it('returns empty array for valid drafts', () => {
    const drafts = [
      { rule_id: 'r1', frontmatter_yaml: 'id: r1\ntitle: My Rule\norder: 1' },
    ];
    expect(validateDrafts(drafts)).toEqual([]);
  });

  it('reports missing id', () => {
    const drafts = [{ rule_id: 'r1', frontmatter_yaml: 'title: My Rule\norder: 1' }];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("missing 'id'");
  });

  it('reports missing title', () => {
    const drafts = [{ rule_id: 'r1', frontmatter_yaml: 'id: r1\norder: 1' }];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("missing 'title'");
  });

  it('reports missing order', () => {
    const drafts = [{ rule_id: 'r1', frontmatter_yaml: 'id: r1\ntitle: My Rule' }];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("missing 'order'");
  });

  it('reports multiple errors for one draft', () => {
    const drafts = [{ rule_id: 'r1', frontmatter_yaml: '' }];
    expect(validateDrafts(drafts)).toHaveLength(3);
  });

  it('validates multiple drafts independently', () => {
    const drafts = [
      { rule_id: 'r1', frontmatter_yaml: 'id: r1\ntitle: Good\norder: 1' },
      { rule_id: 'r2', frontmatter_yaml: 'title: No ID\norder: 2' },
    ];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].rule_id).toBe('r2');
  });
});

// ── getDraft ──

describe('getDraft', () => {
  it('returns draft when found', () => {
    const draft = { rule_id: 'r1', frontmatter_yaml: 'id: r1', markdown_body: 'body', order_override: null, created_at: '2026-01-01', updated_at: '2026-01-01' };
    mockPrepare.mockReturnValue(mockStatement({ get: draft }));

    const result = getDraft('r1');
    expect(result).toEqual(draft);
  });

  it('returns null when not found', () => {
    mockPrepare.mockReturnValue(mockStatement({ get: null }));
    expect(getDraft('nonexistent')).toBeNull();
  });
});

// ── saveDraft ──

describe('saveDraft', () => {
  it('calls prepare with upsert SQL', () => {
    const stmt = mockStatement({});
    mockPrepare.mockReturnValue(stmt);

    saveDraft('r1', 'yaml', 'body', 10);

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(stmt.run).toHaveBeenCalledWith('r1', 'yaml', 'body', 10);
  });

  it('passes null for missing order_override', () => {
    const stmt = mockStatement({});
    mockPrepare.mockReturnValue(stmt);

    saveDraft('r1', 'yaml', 'body');

    expect(stmt.run).toHaveBeenCalledWith('r1', 'yaml', 'body', null);
  });
});

// ── deleteDraft ──

describe('deleteDraft', () => {
  it('calls delete SQL with ruleId', () => {
    const stmt = mockStatement({});
    mockPrepare.mockReturnValue(stmt);

    deleteDraft('r1');

    expect(stmt.run).toHaveBeenCalledWith('r1');
  });
});

// ── saveReorder ──

describe('saveReorder', () => {
  it('saves multiple items in a transaction', () => {
    const stmt = mockStatement({});
    mockPrepare.mockReturnValue(stmt);

    saveReorder([
      { rule_id: 'r1', order: 10 },
      { rule_id: 'r2', order: 20 },
    ]);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(stmt.run).toHaveBeenCalledTimes(2);
    expect(stmt.run).toHaveBeenCalledWith('r1', 10);
    expect(stmt.run).toHaveBeenCalledWith('r2', 20);
  });
});

// ── getPublishHistory ──

describe('getPublishHistory', () => {
  it('returns history rows', () => {
    const rows = [
      { id: 1, published_at: '2026-01-01', rules_changed: 3, snapshot_name: 'snap.md', status: 'success', error_message: null },
    ];
    mockPrepare.mockReturnValue(mockStatement({ all: rows }));

    const result = getPublishHistory();
    expect(result).toEqual(rows);
  });

  it('returns empty array when no history', () => {
    mockPrepare.mockReturnValue(mockStatement({ all: [] }));
    expect(getPublishHistory()).toEqual([]);
  });
});

// ── getAllRulesWithDraftStatus ──

describe('getAllRulesWithDraftStatus', () => {
  it('reads rules from disk and merges with drafts', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['01-intro.md', '02-core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockImplementation(((_path: unknown) => {
      const p = String(_path);
      if (p.includes('01-intro')) return '---\nid: intro\ntitle: Intro\norder: 10\n---\nIntro body';
      if (p.includes('02-core')) return '---\nid: core\ntitle: Core\norder: 20\n---\nCore body';
      return '';
    })) as unknown as typeof fs.readFileSync;

    mockPrepare.mockReturnValue(mockStatement({ all: [{ rule_id: 'core', order_override: 5 }] }));

    const rules = getAllRulesWithDraftStatus();
    expect(rules).toHaveLength(2);
    expect(rules[0].rule_id).toBe('core'); // order_override=5 sorts first
    expect(rules[0].has_draft).toBe(true);
    expect(rules[0].draft_order_override).toBe(5);
    expect(rules[1].rule_id).toBe('intro');
    expect(rules[1].has_draft).toBe(false);
  });

  it('handles rule file with no frontmatter', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['bare.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('Just plain markdown, no frontmatter');

    const rules = getAllRulesWithDraftStatus();
    expect(rules).toHaveLength(1);
    expect(rules[0].rule_id).toBe('');
    expect(rules[0].title).toBe('');
    expect(rules[0].order).toBe(999);
    expect(rules[0].markdown_body).toBe('Just plain markdown, no frontmatter');
  });

  it('handles rule file with missing YAML fields', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['partial.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: partial\n---\nbody only');

    const rules = getAllRulesWithDraftStatus();
    expect(rules).toHaveLength(1);
    expect(rules[0].rule_id).toBe('partial');
    expect(rules[0].title).toBe('partial'); // falls back to ruleId
    expect(rules[0].order).toBe(999); // falls back to default
  });
});

// ── publishDrafts ──

describe('publishDrafts', () => {
  it('returns early when no drafts exist', () => {
    const stmt = mockStatement({ all: [] });
    mockPrepare.mockReturnValue(stmt);

    const result = publishDrafts();
    expect(result).toEqual({ rulesChanged: 0, snapshotName: null });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('writes drafts to disk and runs assemble', () => {
    const drafts = [
      { rule_id: 'core', frontmatter_yaml: 'id: core\ntitle: Core\norder: 10', markdown_body: 'body', order_override: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    // First call: SELECT * FROM rule_drafts → returns drafts
    // Subsequent calls: INSERT, DELETE, etc.
    let prepareCallCount = 0;
    mockPrepare.mockImplementation(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return mockStatement({ all: drafts });
      return mockStatement({});
    });

    // Mock getAllRulesWithDraftStatus's filesystem reads
    vi.mocked(fs.readdirSync).mockReturnValue(['core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: core\ntitle: Core\norder: 10\n---\nCore body');

    // Mock assemble.py success
    vi.mocked(execFileSync).mockReturnValue('Built CLAUDE.md at /some/path');

    const result = publishDrafts();
    expect(result.rulesChanged).toBe(1);
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(execFileSync).toHaveBeenCalledWith('python', ['build/assemble.py'], expect.any(Object));
  });

  it('handles assemble.py failure gracefully', () => {
    const drafts = [
      { rule_id: 'core', frontmatter_yaml: 'id: core\norder: 10', markdown_body: 'body', order_override: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    let prepareCallCount = 0;
    mockPrepare.mockImplementation(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return mockStatement({ all: drafts });
      return mockStatement({});
    });

    vi.mocked(fs.readdirSync).mockReturnValue(['core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: core\norder: 10\n---\nbody');
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error('assemble failed') as Error & { stderr?: string };
      err.stderr = 'Traceback...';
      throw err;
    });

    const result = publishDrafts();
    expect(result.error).toBe('Traceback...');
  });

  it('applies order override to frontmatter', () => {
    const drafts = [
      { rule_id: 'core', frontmatter_yaml: 'id: core\norder: 10', markdown_body: 'body', order_override: 5, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    let prepareCallCount = 0;
    mockPrepare.mockImplementation(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return mockStatement({ all: drafts });
      return mockStatement({});
    });

    vi.mocked(fs.readdirSync).mockReturnValue(['core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: core\norder: 10\n---\nbody');
    vi.mocked(execFileSync).mockReturnValue('Built CLAUDE.md');

    publishDrafts();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(written[1]).toContain('order: 5');
    expect(written[1]).not.toContain('order: 10');
  });

  it('skips drafts with no matching rule file and counts correctly', () => {
    const drafts = [
      { rule_id: 'orphan', frontmatter_yaml: 'id: orphan\norder: 1', markdown_body: 'body', order_override: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { rule_id: 'core', frontmatter_yaml: 'id: core\norder: 10', markdown_body: 'body', order_override: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    let prepareCallCount = 0;
    mockPrepare.mockImplementation(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return mockStatement({ all: drafts });
      return mockStatement({});
    });

    vi.mocked(fs.readdirSync).mockReturnValue(['core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: core\norder: 10\n---\nbody');
    vi.mocked(execFileSync).mockReturnValue('Built CLAUDE.md');

    const result = publishDrafts();
    expect(result.rulesChanged).toBe(1);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it('handles assemble error without stderr falling back to message', () => {
    const drafts = [
      { rule_id: 'core', frontmatter_yaml: 'id: core\norder: 10', markdown_body: 'body', order_override: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    let prepareCallCount = 0;
    mockPrepare.mockImplementation(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return mockStatement({ all: drafts });
      return mockStatement({});
    });

    vi.mocked(fs.readdirSync).mockReturnValue(['core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: core\norder: 10\n---\nbody');
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('spawn failed');
    });

    const result = publishDrafts();
    expect(result.error).toBe('spawn failed');
  });

  it('handles non-Error thrown from assemble', () => {
    const drafts = [
      { rule_id: 'core', frontmatter_yaml: 'id: core\norder: 10', markdown_body: 'body', order_override: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    let prepareCallCount = 0;
    mockPrepare.mockImplementation(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return mockStatement({ all: drafts });
      return mockStatement({});
    });

    vi.mocked(fs.readdirSync).mockReturnValue(['core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: core\norder: 10\n---\nbody');
    vi.mocked(execFileSync).mockImplementation(() => {
      throw 'string error'; // non-Error thrown value
    });

    const result = publishDrafts();
    expect(result.error).toBe('string error');
  });

  it('preserves disk content for reorder-only drafts with empty yaml/body', () => {
    const drafts = [
      { rule_id: 'core', frontmatter_yaml: '', markdown_body: '', order_override: 5, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    let prepareCallCount = 0;
    mockPrepare.mockImplementation(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return mockStatement({ all: drafts });
      return mockStatement({});
    });

    vi.mocked(fs.readdirSync).mockReturnValue(['core.md'] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue('---\nid: core\ntitle: Core\norder: 10\n---\nOriginal body');
    vi.mocked(execFileSync).mockReturnValue('Built CLAUDE.md');

    publishDrafts();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(written[1]).toContain('id: core');
    expect(written[1]).toContain('title: Core');
    expect(written[1]).toContain('order: 5');
    expect(written[1]).toContain('Original body');
    expect(written[1]).not.toContain('order: 10');
  });
});
