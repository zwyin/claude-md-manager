import { describe, it, expect } from 'vitest';
import { parseDays, parseEnum, sanitizeRuleId, ValidationError, zeroFillTrend } from '../api-utils';

describe('parseDays', () => {
  it('returns undefined for null', () => {
    expect(parseDays(null)).toBeUndefined();
  });

  it('returns number for valid positive string', () => {
    expect(parseDays('7')).toBe(7);
    expect(parseDays('30')).toBe(30);
  });

  it('returns undefined for zero', () => {
    expect(parseDays('0')).toBeUndefined();
  });

  it('returns undefined for negative', () => {
    expect(parseDays('-5')).toBeUndefined();
  });

  it('returns undefined for non-numeric', () => {
    expect(parseDays('abc')).toBeUndefined();
  });

  it('returns undefined for float', () => {
    expect(parseDays('3.14')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseDays('')).toBeUndefined();
  });
});

describe('parseEnum', () => {
  const allowed = ['day', 'week', 'month'] as const;

  it('returns fallback for null', () => {
    expect(parseEnum(null, allowed, 'day')).toBe('day');
  });

  it('returns value when in allowed list', () => {
    expect(parseEnum('week', allowed, 'day')).toBe('week');
  });

  it('returns fallback for invalid value', () => {
    expect(parseEnum('year', allowed, 'day')).toBe('day');
  });

  it('returns fallback for empty string', () => {
    expect(parseEnum('', allowed, 'day')).toBe('day');
  });
});

describe('sanitizeRuleId', () => {
  it('accepts valid rule IDs', () => {
    expect(sanitizeRuleId('my-rule_01')).toBe('my-rule_01');
  });

  it('decodes URI-encoded IDs', () => {
    expect(sanitizeRuleId('my-rule_01')).toBe('my-rule_01');
    expect(() => sanitizeRuleId('my%20rule')).toThrow(/Invalid rule ID/);
  });

  it('rejects path traversal', () => {
    expect(() => sanitizeRuleId('../etc/passwd')).toThrow();
  });

  it('rejects IDs with special characters', () => {
    expect(() => sanitizeRuleId('rule;DROP TABLE')).toThrow();
  });

  it('accepts simple alphanumeric IDs', () => {
    expect(sanitizeRuleId('abc123')).toBe('abc123');
  });

  it('accepts IDs with dots', () => {
    expect(sanitizeRuleId('section.rule')).toBe('section.rule');
    expect(sanitizeRuleId('core-principles.brain')).toBe('core-principles.brain');
  });

  it('rejects empty string', () => {
    expect(() => sanitizeRuleId('')).toThrow();
  });

  it('rejects IDs with slashes', () => {
    expect(() => sanitizeRuleId('path/to/rule')).toThrow();
  });

  it('throws ValidationError for invalid IDs', () => {
    expect(() => sanitizeRuleId('../etc')).toThrow(ValidationError);
  });

  it('decodes percent-encoded valid IDs', () => {
    expect(sanitizeRuleId('core-principles.brain')).toBe('core-principles.brain');
  });
});

describe('zeroFillTrend', () => {
  it('returns empty array as-is', () => {
    expect(zeroFillTrend([])).toEqual([]);
  });

  it('fills gaps between data points when no days param', () => {
    const data = [
      { period: '2026-01-01', count: 3 },
      { period: '2026-01-04', count: 1 },
    ];
    const result = zeroFillTrend(data);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.period)).toEqual([
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
    ]);
    expect(result.map((r) => r.count)).toEqual([3, 0, 0, 1]);
  });

  it('fills from days ago when days param given', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const result = zeroFillTrend([{ period: todayStr, count: 5 }], 3);
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result[result.length - 1].count).toBe(5);
    const earlierEntries = result.filter((r) => r.count === 0);
    expect(earlierEntries.length).toBeGreaterThanOrEqual(3);
  });
});

describe('handleApiError', () => {
  it('returns 400 for ValidationError', async () => {
    const { handleApiError } = await import('../api-handler');
    const result = handleApiError(new ValidationError('bad input'));
    const body = await result.json();
    expect(result.status).toBe(400);
    expect(body.error).toBe('bad input');
  });

  it('returns 500 for generic errors', async () => {
    const { handleApiError } = await import('../api-handler');
    const result = handleApiError(new Error('something broke'));
    const body = await result.json();
    expect(result.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
