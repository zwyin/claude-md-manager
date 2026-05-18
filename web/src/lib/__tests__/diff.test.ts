import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines } from '../diff';

describe('diffLines', () => {
  it('returns empty for two empty inputs', () => {
    const result = diffLines([], []);
    assert.deepEqual(result, []);
  });

  it('returns all added when from is empty', () => {
    const result = diffLines([], ['a', 'b']);
    assert.equal(result.length, 2);
    assert.equal(result[0].type, 'added');
    assert.equal(result[0].content, 'a');
    assert.equal(result[1].type, 'added');
    assert.equal(result[1].content, 'b');
  });

  it('returns all removed when to is empty', () => {
    const result = diffLines(['a', 'b'], []);
    assert.equal(result.length, 2);
    assert.equal(result[0].type, 'removed');
    assert.equal(result[1].type, 'removed');
  });

  it('returns all unchanged for identical inputs', () => {
    const result = diffLines(['a', 'b', 'c'], ['a', 'b', 'c']);
    assert.equal(result.length, 3);
    assert.ok(result.every((l) => l.type === 'unchanged'));
  });

  it('detects a single line change', () => {
    const result = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
    const types = result.map((l) => l.type);
    assert.ok(types.includes('removed'));
    assert.ok(types.includes('added'));
    assert.ok(types.includes('unchanged'));
  });

  it('detects insertion at beginning', () => {
    const result = diffLines(['b', 'c'], ['a', 'b', 'c']);
    assert.ok(result.some((l) => l.type === 'added' && l.content === 'a'));
    assert.ok(result.some((l) => l.type === 'unchanged' && l.content === 'b'));
  });

  it('detects deletion at end', () => {
    const result = diffLines(['a', 'b', 'c'], ['a', 'b']);
    assert.ok(result.some((l) => l.type === 'removed' && l.content === 'c'));
    assert.ok(result.some((l) => l.type === 'unchanged' && l.content === 'a'));
  });

  it('provides correct line numbers', () => {
    const result = diffLines(['a', 'b'], ['a', 'c']);
    const unchanged = result.find((l) => l.type === 'unchanged' && l.content === 'a');
    assert.equal(unchanged?.lineNum.old, 1);
    assert.equal(unchanged?.lineNum.new, 1);
  });

  it('handles multi-line diff correctly', () => {
    const from = ['# header', '', '- old item 1', '- old item 2', '', '## section'];
    const to = ['# header', '', '- new item 1', '- new item 2', '', '## section'];
    const result = diffLines(from, to);
    const added = result.filter((l) => l.type === 'added');
    const removed = result.filter((l) => l.type === 'removed');
    assert.ok(removed.some((l) => l.content === '- old item 1'));
    assert.ok(added.some((l) => l.content === '- new item 1'));
  });

  it('uses line-by-line fallback for large files', () => {
    const from = Array.from({ length: 5001 }, (_, i) => `line ${i}`);
    const to = [...from.slice(0, 100), 'inserted', ...from.slice(100)];
    const result = diffLines(from, to);
    assert.ok(result.length > 0);
    assert.ok(result.some((l) => l.type === 'added'));
  });

  it('stats count matches line types', () => {
    const result = diffLines(['a', 'b'], ['a', 'c', 'd']);
    const added = result.filter((l) => l.type === 'added').length;
    const removed = result.filter((l) => l.type === 'removed').length;
    const unchanged = result.filter((l) => l.type === 'unchanged').length;
    assert.equal(added + removed + unchanged, result.length);
  });
});
