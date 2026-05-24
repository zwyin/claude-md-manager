import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRulesList } from '../rules/route';
import { GET as getRuleDetail } from '../rules/[id]/route';
import { GET as getAnalytics } from '../analytics/route';

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

describe('GET /api/rules', () => {
  it('returns rules with stats', async () => {
    const res = await getRulesList(makeRequest('/api/rules'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules.length).toBeGreaterThan(0);
    expect(typeof body.total_rules).toBe('number');
    expect(typeof body.total_sessions).toBe('number');
    expect(typeof body.total_citations).toBe('number');
    expect(typeof body.active_rule_pct).toBe('number');
    expect(body.active_rule_pct).toBeGreaterThanOrEqual(0);
    expect(body.active_rule_pct).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.citation_trend)).toBe(true);
    expect(Array.isArray(body.session_trend)).toBe(true);
    expect(Array.isArray(body.recent_citations)).toBe(true);
    expect(Array.isArray(body.recent_builds)).toBe(true);
    expect(Array.isArray(body.model_distribution)).toBe(true);
    expect(Array.isArray(body.recent_sessions)).toBe(true);
  });

  it('rules have expected fields', async () => {
    const res = await getRulesList(makeRequest('/api/rules'));
    const body = await res.json();
    const rule = body.rules[0];

    expect(rule).toHaveProperty('rule_id');
    expect(rule).toHaveProperty('title');
    expect(rule).toHaveProperty('match_count');
    expect(rule).toHaveProperty('session_coverage');
    expect(rule).toHaveProperty('avg_depth');
    expect(rule).toHaveProperty('citation_count');
  });

  it('supports days filter', async () => {
    const all = await getRulesList(makeRequest('/api/rules')).then(r => r.json());
    const filtered = await getRulesList(makeRequest('/api/rules?days=1')).then(r => r.json());

    expect(filtered.total_rules).toBe(all.total_rules);
    // With fewer days, total_citations should be <= all
    expect(filtered.total_citations).toBeLessThanOrEqual(all.total_citations);
  });

  it('sections are returned', async () => {
    const body = await getRulesList(makeRequest('/api/rules')).then(r => r.json());
    expect(Array.isArray(body.sections)).toBe(true);
  });
});

describe('GET /api/rules/[id]', () => {
  it('returns 404 for nonexistent rule', async () => {
    const res = await getRuleDetail(
      makeRequest('/api/rules/nonexistent'),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Rule not found');
  });

  it('returns rule detail with body', async () => {
    // Get a real rule ID first
    const list = await getRulesList(makeRequest('/api/rules')).then(r => r.json());
    const firstRule = list.rules[0];
    if (!firstRule) return;

    const res = await getRuleDetail(
      makeRequest(`/api/rules/${firstRule.rule_id}`),
      { params: Promise.resolve({ id: firstRule.rule_id }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rule.rule_id).toBe(firstRule.rule_id);
    expect(typeof body.rule.body).toBe('string');
    expect(typeof body.total_sessions).toBe('number');
    expect(typeof body.total_citations).toBe('number');
  });
});

describe('GET /api/analytics', () => {
  it('returns analytics data', async () => {
    const res = await getAnalytics(makeRequest('/api/analytics'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.total_rules).toBe('number');
    expect(typeof body.total_sessions).toBe('number');
    expect(typeof body.total_citations).toBe('number');
    expect(Array.isArray(body.confidence_distribution)).toBe(true);
    expect(Array.isArray(body.heatmap)).toBe(true);
    expect(Array.isArray(body.citation_trend)).toBe(true);
  });

  it('supports days filter', async () => {
    const res = await getAnalytics(makeRequest('/api/analytics?days=7'));
    expect(res.status).toBe(200);
  });
});
