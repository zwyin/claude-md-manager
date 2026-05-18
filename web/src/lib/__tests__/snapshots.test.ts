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
    ] as unknown as string[]);
    vi.mocked(fs.statSync).mockReturnValue({ size: 42 } as fs.Stats);

    const result = listSnapshotFiles();
    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('2026-01-02.md');
    expect(result[0].size).toBe(42);
    expect(result[1].filename).toBe('2026-01-01.md');
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
