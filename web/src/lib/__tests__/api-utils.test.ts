import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

async function importUtils() {
  return import('../api-utils');
}

describe('parseDays', () => {
  test('returns undefined for null', async () => {
    const { parseDays } = await importUtils();
    assert.equal(parseDays(null), undefined);
  });

  test('returns number for valid positive string', async () => {
    const { parseDays } = await importUtils();
    assert.equal(parseDays('7'), 7);
    assert.equal(parseDays('30'), 30);
  });

  test('returns undefined for zero', async () => {
    const { parseDays } = await importUtils();
    assert.equal(parseDays('0'), undefined);
  });

  test('returns undefined for negative', async () => {
    const { parseDays } = await importUtils();
    assert.equal(parseDays('-5'), undefined);
  });

  test('returns undefined for non-numeric', async () => {
    const { parseDays } = await importUtils();
    assert.equal(parseDays('abc'), undefined);
  });

  test('returns undefined for float', async () => {
    const { parseDays } = await importUtils();
    assert.equal(parseDays('3.14'), undefined);
  });
});

describe('parseEnum', () => {
  const allowed = ['day', 'week', 'month'] as const;

  test('returns fallback for null', async () => {
    const { parseEnum } = await importUtils();
    assert.equal(parseEnum(null, allowed, 'day'), 'day');
  });

  test('returns value when in allowed list', async () => {
    const { parseEnum } = await importUtils();
    assert.equal(parseEnum('week', allowed, 'day'), 'week');
  });

  test('returns fallback for invalid value', async () => {
    const { parseEnum } = await importUtils();
    assert.equal(parseEnum('year', allowed, 'day'), 'day');
  });
});

describe('sanitizeRuleId', () => {
  test('accepts valid rule IDs', async () => {
    const { sanitizeRuleId } = await importUtils();
    assert.equal(sanitizeRuleId('my-rule_01'), 'my-rule_01');
  });

  test('decodes URI-encoded IDs', async () => {
    const { sanitizeRuleId } = await importUtils();
    assert.equal(sanitizeRuleId('my-rule_01'), 'my-rule_01');
    assert.throws(() => sanitizeRuleId('my%20rule'), /Invalid rule ID/);
  });

  test('rejects path traversal', async () => {
    const { sanitizeRuleId } = await importUtils();
    assert.throws(() => sanitizeRuleId('../etc/passwd'));
  });

  test('rejects IDs with special characters', async () => {
    const { sanitizeRuleId } = await importUtils();
    assert.throws(() => sanitizeRuleId('rule;DROP TABLE'));
  });

  test('accepts simple alphanumeric IDs', async () => {
    const { sanitizeRuleId } = await importUtils();
    assert.equal(sanitizeRuleId('abc123'), 'abc123');
  });
});
