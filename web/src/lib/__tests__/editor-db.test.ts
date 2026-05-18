import { describe, it, expect, vi } from 'vitest';

// Mock fs and better-sqlite3 so we can import editor-db without filesystem access
vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
}));

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => ({
      prepare: vi.fn(() => ({
        all: vi.fn(() => []),
        get: vi.fn(() => null),
        run: vi.fn(),
      })),
      transaction: vi.fn((fn) => fn),
      close: vi.fn(),
    })),
  };
});

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { validateDrafts } from '../editor-db';

describe('validateDrafts', () => {
  it('returns empty array for valid drafts', () => {
    const drafts = [
      {
        rule_id: 'r1',
        frontmatter_yaml: 'id: r1\ntitle: My Rule\norder: 1',
      },
    ];
    expect(validateDrafts(drafts)).toEqual([]);
  });

  it('reports missing id', () => {
    const drafts = [
      {
        rule_id: 'r1',
        frontmatter_yaml: 'title: My Rule\norder: 1',
      },
    ];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("missing 'id'");
  });

  it('reports missing title', () => {
    const drafts = [
      {
        rule_id: 'r1',
        frontmatter_yaml: 'id: r1\norder: 1',
      },
    ];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("missing 'title'");
  });

  it('reports missing order', () => {
    const drafts = [
      {
        rule_id: 'r1',
        frontmatter_yaml: 'id: r1\ntitle: My Rule',
      },
    ];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("missing 'order'");
  });

  it('reports multiple errors for one draft', () => {
    const drafts = [
      {
        rule_id: 'r1',
        frontmatter_yaml: '',
      },
    ];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(3);
  });

  it('validates multiple drafts independently', () => {
    const drafts = [
      {
        rule_id: 'r1',
        frontmatter_yaml: 'id: r1\ntitle: Good\norder: 1',
      },
      {
        rule_id: 'r2',
        frontmatter_yaml: 'title: No ID\norder: 2',
      },
    ];
    const errors = validateDrafts(drafts);
    expect(errors).toHaveLength(1);
    expect(errors[0].rule_id).toBe('r2');
  });
});
