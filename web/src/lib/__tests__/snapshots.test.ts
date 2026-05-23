import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

// Mock fs before importing the module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
}));

// Import after mock
import {
  listSnapshotFiles,
  getSnapshotContent,
  computeDiff,
  rollbackToSnapshot,
} from '../snapshots';

describe('safePath (via getSnapshotContent)', () => {
  it('rejects path traversal with ..', () => {
    expect(() => getSnapshotContent('../etc/passwd.md')).toThrow(
      /Invalid filename/
    );
  });

  it('rejects filenames with slashes', () => {
    expect(() => getSnapshotContent('sub/file.md')).toThrow(/Invalid filename/);
  });

  it('rejects filenames with spaces', () => {
    expect(() => getSnapshotContent('my file.md')).toThrow(/Invalid filename/);
  });
});

describe('getSnapshotContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(getSnapshotContent('2026-01-01.md')).toBeNull();
  });

  it('returns file content when file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('hello');
    expect(getSnapshotContent('2026-01-01.md')).toBe('hello');
  });
});

describe('listSnapshotFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(listSnapshotFiles()).toEqual([]);
  });

  it('lists .md files sorted reverse with size', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '2026-01-01.md',
      '2026-01-02.md',
      'ignore.txt',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    // readFileSync calls: dedup(2 files) + diff stats(2 files)
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce('content-02')  // dedup: 2026-01-02 (sorted reverse, first)
      .mockReturnValueOnce('content-01')  // dedup: 2026-01-01 (different, kept)
      .mockReturnValueOnce('content-02')  // diff: 2026-01-02 current
      .mockReturnValueOnce('content-01'); // diff: 2026-01-01 previous
    vi.mocked(fs.statSync).mockReturnValue({ size: 42 } as fs.Stats);

    const result = listSnapshotFiles();
    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('2026-01-02.md');
    expect(result[0].size).toBe(42);
    expect(result[1].filename).toBe('2026-01-01.md');
  });

  it('deduplicates consecutive snapshots with identical content', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '2026-01-03.md',
      '2026-01-02.md',
      '2026-01-01.md',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    // All three have same content → deduped to 1
    vi.mocked(fs.readFileSync).mockReturnValue('same-content');
    vi.mocked(fs.statSync).mockReturnValue({ size: 10 } as fs.Stats);

    const result = listSnapshotFiles();
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('2026-01-03.md');
  });

  it('computes diffStats between consecutive different snapshots', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '2026-01-02.md',
      '2026-01-01.md',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce('line-a\nline-b')      // dedup: 2026-01-02
      .mockReturnValueOnce('line-a\nline-c')      // dedup: 2026-01-01 (different)
      .mockReturnValueOnce('line-a\nline-b')      // diff: 2026-01-02 current
      .mockReturnValueOnce('line-a\nline-c');     // diff: 2026-01-01 previous
    vi.mocked(fs.statSync).mockReturnValue({ size: 20 } as fs.Stats);

    const result = listSnapshotFiles();
    expect(result[0].diffStats).toEqual({ added: 1, removed: 1 });
    expect(result[1].diffStats).toBeUndefined();
  });
});

describe('computeDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when from file missing', () => {
    let callCount = 0;
    vi.mocked(fs.existsSync).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? false : true;
    });
    expect(computeDiff('missing.md', 'exists.md')).toBeNull();
  });

  it('returns null when to file missing', () => {
    let callCount = 0;
    vi.mocked(fs.existsSync).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? true : false;
    });
    expect(computeDiff('exists.md', 'missing.md')).toBeNull();
  });

  it('computes diff between two files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce('line1\nline2\nline3')
      .mockReturnValueOnce('line1\nmodified\nline3');

    const result = computeDiff('a.md', 'b.md');
    expect(result).not.toBeNull();
    expect(result!.stats.added).toBe(1);
    expect(result!.stats.removed).toBe(1);
    expect(result!.stats.unchanged).toBe(2);
  });
});

describe('rollbackToSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(rollbackToSnapshot('nonexistent.md')).toBe(false);
  });

  it('writes content to output path and returns true', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('rollback content');

    expect(rollbackToSnapshot('2026-01-01.md')).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
