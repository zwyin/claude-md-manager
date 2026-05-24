import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as validate } from '../editor/validate/route';
import { POST as reorder } from '../editor/reorder/route';
import { GET as getDraft, PUT as saveDraft, DELETE as deleteDraft } from '../editor/rules/[id]/draft/route';
import { POST as rollback } from '../history/rollback/route';

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost'), init);
}

describe('POST /api/editor/validate', () => {
  it('returns 400 for non-array body', async () => {
    const res = await validate(makeRequest('/api/editor/validate', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('array');
  });

  it('returns 400 for draft without rule_id', async () => {
    const res = await validate(makeRequest('/api/editor/validate', {
      method: 'POST',
      body: JSON.stringify([{ frontmatter: 'x' }]),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('rule_id');
  });

  it('returns valid for valid drafts', async () => {
    const res = await validate(makeRequest('/api/editor/validate', {
      method: 'POST',
      body: JSON.stringify([{
        rule_id: 'test-rule',
        frontmatter_yaml: 'id: test-rule\ntitle: Test\norder: 1',
        markdown_body: '# Test',
      }]),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('valid');
    expect(body).toHaveProperty('errors');
    expect(Array.isArray(body.errors)).toBe(true);
  });
});

describe('POST /api/editor/reorder', () => {
  it('returns 400 for non-array body', async () => {
    const res = await reorder(makeRequest('/api/editor/reorder', {
      method: 'POST',
      body: JSON.stringify('not array'),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for item missing rule_id', async () => {
    const res = await reorder(makeRequest('/api/editor/reorder', {
      method: 'POST',
      body: JSON.stringify([{ order: 1 }]),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('rule_id');
  });

  it('returns 400 for item missing order', async () => {
    const res = await reorder(makeRequest('/api/editor/reorder', {
      method: 'POST',
      body: JSON.stringify([{ rule_id: 'test' }]),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('order');
  });

  it('returns ok for valid reorder', async () => {
    // Get real rules first
    const { GET: getRules } = await import('../editor/rules/route');
    const rulesRes = await getRules();
    const rulesBody = await rulesRes.json();
    const rules = rulesBody.rules.slice(0, 3);

    const res = await reorder(makeRequest('/api/editor/reorder', {
      method: 'POST',
      body: JSON.stringify(rules.map((r: any, i: number) => ({
        rule_id: r.rule_id,
        order: i + 1,
      }))),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('Draft CRUD /api/editor/rules/[id]/draft', () => {
  const testRuleId = 'test-draft-crud';

  afterAll(async () => {
    // Clean up: delete the test draft
    await deleteDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: testRuleId }) },
    );
  });

  it('GET returns 404 when no draft exists', async () => {
    const res = await getDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`),
      { params: Promise.resolve({ id: testRuleId }) },
    );
    expect(res.status).toBe(404);
  });

  it('PUT returns 400 when missing fields', async () => {
    const res = await saveDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ frontmatter_yaml: 'x' }),
      }),
      { params: Promise.resolve({ id: testRuleId }) },
    );
    expect(res.status).toBe(400);
  });

  it('PUT saves and GET retrieves a draft', async () => {
    const fm = 'id: test-draft-crud\ntitle: Test\norder: 99';
    const md = '# Test body';

    const putRes = await saveDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ frontmatter_yaml: fm, markdown_body: md }),
      }),
      { params: Promise.resolve({ id: testRuleId }) },
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.ok).toBe(true);

    const getRes = await getDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`),
      { params: Promise.resolve({ id: testRuleId }) },
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.frontmatter_yaml).toBe(fm);
    expect(getBody.markdown_body).toBe(md);
  });

  it('DELETE removes the draft', async () => {
    // First ensure draft exists
    await saveDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`, {
        method: 'PUT',
        body: JSON.stringify({
          frontmatter_yaml: 'id: test\ntitle: T\norder: 1',
          markdown_body: 'body',
        }),
      }),
      { params: Promise.resolve({ id: testRuleId }) },
    );

    const delRes = await deleteDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: testRuleId }) },
    );
    expect(delRes.status).toBe(200);

    const getRes = await getDraft(
      makeRequest(`/api/editor/rules/${testRuleId}/draft`),
      { params: Promise.resolve({ id: testRuleId }) },
    );
    expect(getRes.status).toBe(404);
  });
});

describe('POST /api/history/rollback', () => {
  it('returns 400 for missing filename', async () => {
    const res = await rollback(makeRequest('/api/history/rollback', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for path traversal filename', async () => {
    const res = await rollback(makeRequest('/api/history/rollback', {
      method: 'POST',
      body: JSON.stringify({ filename: '../../../etc/passwd' }),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent snapshot', async () => {
    const res = await rollback(makeRequest('/api/history/rollback', {
      method: 'POST',
      body: JSON.stringify({ filename: 'nonexistent-snapshot.md' }),
    }));
    expect(res.status).toBe(404);
  });
});
