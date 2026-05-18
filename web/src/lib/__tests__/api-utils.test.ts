import { describe, it, expect } from 'vitest';
import { parseDays, parseEnum, sanitizeRuleId } from '../api-utils';

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
});
