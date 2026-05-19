import { describe, it, expect } from 'vitest';
import { diffLines } from '../diff';

describe('diffLines', () => {
  it('returns empty for two empty inputs', () => {
    const result = diffLines([], []);
    expect(result).toEqual([]);
  });

  it('returns all added when from is empty', () => {
    const result = diffLines([], ['a', 'b']);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('added');
    expect(result[0].content).toBe('a');
    expect(result[1].type).toBe('added');
    expect(result[1].content).toBe('b');
  });

  it('returns all removed when to is empty', () => {
    const result = diffLines(['a', 'b'], []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('removed');
    expect(result[1].type).toBe('removed');
  });

  it('returns all unchanged for identical inputs', () => {
    const result = diffLines(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(result).toHaveLength(3);
    expect(result.every((l) => l.type === 'unchanged')).toBe(true);
  });

  it('detects a single line change', () => {
    const result = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
    const types = result.map((l) => l.type);
    expect(types).toContain('removed');
    expect(types).toContain('added');
    expect(types).toContain('unchanged');
  });

  it('detects insertion at beginning', () => {
    const result = diffLines(['b', 'c'], ['a', 'b', 'c']);
    expect(result.some((l) => l.type === 'added' && l.content === 'a')).toBe(true);
    expect(result.some((l) => l.type === 'unchanged' && l.content === 'b')).toBe(true);
  });

  it('detects deletion at end', () => {
    const result = diffLines(['a', 'b', 'c'], ['a', 'b']);
    expect(result.some((l) => l.type === 'removed' && l.content === 'c')).toBe(true);
    expect(result.some((l) => l.type === 'unchanged' && l.content === 'a')).toBe(true);
  });

  it('provides correct line numbers', () => {
    const result = diffLines(['a', 'b'], ['a', 'c']);
    const unchanged = result.find((l) => l.type === 'unchanged' && l.content === 'a');
    expect(unchanged?.lineNum.old).toBe(1);
    expect(unchanged?.lineNum.new).toBe(1);
  });

  it('handles multi-line diff correctly', () => {
    const from = ['# header', '', '- old item 1', '- old item 2', '', '## section'];
    const to = ['# header', '', '- new item 1', '- new item 2', '', '## section'];
    const result = diffLines(from, to);
    const added = result.filter((l) => l.type === 'added');
    const removed = result.filter((l) => l.type === 'removed');
    expect(removed.some((l) => l.content === '- old item 1')).toBe(true);
    expect(added.some((l) => l.content === '- new item 1')).toBe(true);
  });

  it('uses line-by-line fallback for large files', () => {
    const from = Array.from({ length: 5001 }, (_, i) => `line ${i}`);
    const to = [...from.slice(0, 100), 'inserted', ...from.slice(100)];
    const result = diffLines(from, to);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((l) => l.type === 'added')).toBe(true);
  });

  it('fallback handles from longer than to', () => {
    const from = Array.from({ length: 5001 }, (_, i) => `line ${i}`);
    const to = from.slice(0, 2500);
    const result = diffLines(from, to);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((l) => l.type === 'removed')).toBe(true);
    const removed = result.filter((l) => l.type === 'removed');
    expect(removed.length).toBe(2501);
  });

  it('stats count matches line types', () => {
    const result = diffLines(['a', 'b'], ['a', 'c', 'd']);
    const added = result.filter((l) => l.type === 'added').length;
    const removed = result.filter((l) => l.type === 'removed').length;
    const unchanged = result.filter((l) => l.type === 'unchanged').length;
    expect(added + removed + unchanged).toBe(result.length);
  });

  it('handles lines with special characters', () => {
    const result = diffLines(['<div class="x">'], ['<div class="y">']);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('removed');
    expect(result[1].type).toBe('added');
  });

  it('handles empty string lines', () => {
    const result = diffLines(['', 'a'], ['', 'b']);
    expect(result.some((l) => l.type === 'unchanged' && l.content === '')).toBe(true);
  });

  it('handles single line diff', () => {
    const result = diffLines(['hello'], ['world']);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('removed');
    expect(result[1].type).toBe('added');
  });
});
