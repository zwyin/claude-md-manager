import fs from 'fs';
import path from 'path';
import { diffLines, type DiffLine } from './diff';

const HISTORY_DIR = path.join(process.cwd(), '..', 'data', 'history');
const OUTPUT_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.claude',
  'CLAUDE.md'
);

const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

function safePath(filename: string): string {
  if (!SAFE_FILENAME_RE.test(filename)) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  return path.join(HISTORY_DIR, filename);
}

export interface SnapshotInfo {
  filename: string;
  timestamp: string;
  size: number;
}

export { type DiffLine };

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
  const filePath = safePath(filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

export function computeDiff(fromFile: string, toFile: string): DiffResult | null {
  const fromContent = getSnapshotContent(fromFile);
  const toContent = getSnapshotContent(toFile);
  if (fromContent === null || toContent === null) return null;

  const lines = diffLines(fromContent.split('\n'), toContent.split('\n'));

  const stats = {
    added: lines.filter((l) => l.type === 'added').length,
    removed: lines.filter((l) => l.type === 'removed').length,
    unchanged: lines.filter((l) => l.type === 'unchanged').length,
  };

  return { from: fromFile, to: toFile, lines, stats };
}

export function rollbackToSnapshot(filename: string): boolean {
  const filePath = safePath(filename);
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf-8');
  fs.writeFileSync(OUTPUT_PATH, content, 'utf-8');
  return true;
}
