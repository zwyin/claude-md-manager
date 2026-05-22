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
  version: number;
  diffStats?: { added: number; removed: number };
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
  const files = fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse();

  // Deduplicate: skip snapshots with identical content to the previous one
  const deduped: string[] = [];
  let lastContent: string | null = null;
  for (const f of files) {
    const content = fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8');
    if (content === lastContent) continue;
    deduped.push(f);
    lastContent = content;
  }

  const totalVersions = deduped.length;
  const snapshots: SnapshotInfo[] = deduped.map((f, idx) => ({
    filename: f,
    timestamp: f.replace('.md', ''),
    size: fs.statSync(path.join(HISTORY_DIR, f)).size,
    version: totalVersions - idx,
  }));

  // Compute diff stats against the next (older) snapshot
  for (let i = 0; i < snapshots.length - 1; i++) {
    const curr = fs.readFileSync(path.join(HISTORY_DIR, snapshots[i].filename), 'utf-8');
    const prev = fs.readFileSync(path.join(HISTORY_DIR, snapshots[i + 1].filename), 'utf-8');
    const lines = diffLines(prev.split('\n'), curr.split('\n'));
    snapshots[i].diffStats = {
      added: lines.filter((l) => l.type === 'added').length,
      removed: lines.filter((l) => l.type === 'removed').length,
    };
  }

  return snapshots;
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
