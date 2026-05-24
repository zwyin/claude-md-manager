import { describe, it, expect } from 'vitest';
import { GET as getEditorRules } from '../editor/rules/route';
import { GET as getPublishHistory } from '../editor/publish-history/route';
import { NextRequest } from 'next/server';

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

describe('GET /api/editor/rules', () => {
  it('returns rules with draft status', async () => {
    const res = await getEditorRules();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules.length).toBeGreaterThan(0);

    const rule = body.rules[0];
    expect(rule).toHaveProperty('rule_id');
    expect(rule).toHaveProperty('title');
    expect(rule).toHaveProperty('order');
    expect(rule).toHaveProperty('has_draft');
  });
});

describe('GET /api/editor/publish-history', () => {
  it('returns publish history', async () => {
    const res = await getPublishHistory(makeRequest('/api/editor/publish-history'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('history');
    expect(Array.isArray(body.history)).toBe(true);
  });
});
