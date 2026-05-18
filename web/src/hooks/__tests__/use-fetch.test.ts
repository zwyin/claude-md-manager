import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('useFetch', () => {
  test('hook module exports useFetch function', async () => {
    const mod = await import('../use-fetch');
    assert.equal(typeof mod.useFetch, 'function');
  });
});

describe('chart-colors', () => {
  test('exports all color constants', async () => {
    const mod = await import('../../lib/chart-colors');
    assert.ok(Array.isArray(mod.CHART_COLORS));
    assert.ok(mod.CHART_COLORS.length > 0);
    assert.ok(Array.isArray(mod.SECTION_COLORS));
    assert.ok(mod.SECTION_COLORS.length > 0);
    assert.ok(typeof mod.PRIMARY === 'string');
    assert.ok(mod.PRIMARY.startsWith('#'));
    assert.ok(typeof mod.STAT_COLORS === 'object');
    assert.ok(mod.STAT_COLORS.rules);
    assert.ok(mod.STAT_COLORS.sessions);
    assert.ok(mod.STAT_COLORS.activeRate);
    assert.ok(mod.STAT_COLORS.citations);
  });

  test('all colors are valid hex', async () => {
    const mod = await import('../../lib/chart-colors');
    const hexRegex = /^#[0-9a-f]{6}$/;
    for (const c of mod.CHART_COLORS) {
      assert.match(c, hexRegex, `CHART_COLORS: ${c}`);
    }
    for (const c of mod.SECTION_COLORS) {
      assert.match(c, hexRegex, `SECTION_COLORS: ${c}`);
    }
    assert.match(mod.PRIMARY, hexRegex);
    for (const val of Object.values(mod.STAT_COLORS)) {
      assert.match(val, hexRegex, `STAT_COLORS value: ${val}`);
    }
  });
});

describe('fetchJson', () => {
  test('module exports fetchJson function', async () => {
    const mod = await import('../../lib/fetch');
    assert.equal(typeof mod.fetchJson, 'function');
  });
});
