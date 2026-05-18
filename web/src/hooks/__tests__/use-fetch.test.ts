import { describe, it, expect } from 'vitest';

describe('chart-colors', () => {
  it('exports all color constants', async () => {
    const mod = await import('../../lib/chart-colors');
    expect(Array.isArray(mod.CHART_COLORS)).toBe(true);
    expect(mod.CHART_COLORS.length).toBeGreaterThan(0);
    expect(Array.isArray(mod.SECTION_COLORS)).toBe(true);
    expect(mod.SECTION_COLORS.length).toBeGreaterThan(0);
    expect(typeof mod.PRIMARY).toBe('string');
    expect(mod.PRIMARY.startsWith('#')).toBe(true);
    expect(typeof mod.STAT_COLORS === 'object').toBe(true);
    expect(mod.STAT_COLORS.rules).toBeTruthy();
    expect(mod.STAT_COLORS.sessions).toBeTruthy();
    expect(mod.STAT_COLORS.activeRate).toBeTruthy();
    expect(mod.STAT_COLORS.citations).toBeTruthy();
  });

  it('all colors are valid hex', async () => {
    const mod = await import('../../lib/chart-colors');
    const hexRegex = /^#[0-9a-f]{6}$/;
    for (const c of mod.CHART_COLORS) {
      expect(c).toMatch(hexRegex);
    }
    for (const c of mod.SECTION_COLORS) {
      expect(c).toMatch(hexRegex);
    }
    expect(mod.PRIMARY).toMatch(hexRegex);
    for (const val of Object.values(mod.STAT_COLORS)) {
      expect(val).toMatch(hexRegex);
    }
  });
});

describe('fetchJson', () => {
  it('module exports fetchJson function', async () => {
    const mod = await import('../../lib/fetch');
    expect(typeof mod.fetchJson).toBe('function');
  });
});
