import fs from 'fs';
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), '..', 'data', 'history');
const OUTPUT_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.claude',
  'CLAUDE.md'
);

export interface SnapshotInfo {
  filename: string;
  timestamp: string;
  size: number;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNum: { old?: number; new?: number };
}

export interface DiffResult {
  from: string;
  to: string;
  lines: DiffLine[];
  stats: { added: number; removed: number; unchanged: number };
}

export function listSnapshotFiles(): SnapshotInfo[] {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  return fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse()
    .map((f) => ({
      filename: f,
      timestamp: f.replace('.md', ''),
      size: fs.statSync(path.join(HISTORY_DIR, f)).size,
    }));
}

export function getSnapshotContent(filename: string): string | null {
  const filePath = path.join(HISTORY_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

export function computeDiff(fromFile: string, toFile: string): DiffResult | null {
  const fromContent = getSnapshotContent(fromFile);
  const toContent = getSnapshotContent(toFile);
  if (fromContent === null || toContent === null) return null;

  const fromLines = fromContent.split('\n');
  const toLines = toContent.split('\n');
  const lines: DiffLine[] = [];

  // LCS-based diff using simple DP
  const m = fromLines.length;
  const n = toLines.length;

  // For performance, use a simple greedy approach for small files
  // or an optimized LCS for larger ones
  const maxLen = Math.max(m, n);
  if (maxLen > 5000) {
    // Fallback: line-by-line comparison for very large files
    const max = Math.max(m, n);
    for (let i = 0; i < max; i++) {
      if (i < m && i < n && fromLines[i] === toLines[i]) {
        lines.push({ type: 'unchanged', content: fromLines[i], lineNum: { old: i + 1, new: i + 1 } });
      } else {
        if (i < m) lines.push({ type: 'removed', content: fromLines[i], lineNum: { old: i + 1 } });
        if (i < n) lines.push({ type: 'added', content: toLines[i], lineNum: { new: i + 1 } });
      }
    }
  } else {
    // LCS diff
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (fromLines[i - 1] === toLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to produce diff
    const result: DiffLine[] = [];
    let i = m,
      j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && fromLines[i - 1] === toLines[j - 1]) {
        result.push({ type: 'unchanged', content: fromLines[i - 1], lineNum: { old: i, new: j } });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'added', content: toLines[j - 1], lineNum: { new: j } });
        j--;
      } else {
        result.push({ type: 'removed', content: fromLines[i - 1], lineNum: { old: i } });
        i--;
      }
    }
    result.reverse();
    lines.push(...result);
  }

  const stats = {
    added: lines.filter((l) => l.type === 'added').length,
    removed: lines.filter((l) => l.type === 'removed').length,
    unchanged: lines.filter((l) => l.type === 'unchanged').length,
  };

  return { from: fromFile, to: toFile, lines, stats };
}

export function rollbackToSnapshot(filename: string): boolean {
  const filePath = path.join(HISTORY_DIR, filename);
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf-8');
  fs.writeFileSync(OUTPUT_PATH, content, 'utf-8');
  return true;
}
