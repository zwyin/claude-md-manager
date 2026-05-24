import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCitations } from '../citations/route';

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

describe('GET /api/citations', () => {
  it('returns citation trend data', async () => {
    const res = await getCitations(makeRequest('/api/citations'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('groups by day by default', async () => {
    const res = await getCitations(makeRequest('/api/citations'));
    const body = await res.json();

    expect(res.status).toBe(200);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('period');
      expect(body[0]).toHaveProperty('count');
    }
  });

  it('supports group_by=week', async () => {
    const res = await getCitations(makeRequest('/api/citations?group_by=week'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('filters by rule_id', async () => {
    const res = await getCitations(makeRequest('/api/citations?rule_id=surgical-changes'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('filters by days', async () => {
    const all = await getCitations(makeRequest('/api/citations')).then(r => r.json());
    const filtered = await getCitations(makeRequest('/api/citations?days=7')).then(r => r.json());

    const allTotal = all.reduce((s: number, c: any) => s + (c.count || 0), 0);
    const filteredTotal = filtered.reduce((s: number, c: any) => s + (c.count || 0), 0);
    expect(filteredTotal).toBeLessThanOrEqual(allTotal);
  });
});
