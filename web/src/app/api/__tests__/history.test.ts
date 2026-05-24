import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getHistory } from '../history/route';
import { GET as getHistoryDiff } from '../history/diff/route';

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

describe('GET /api/history', () => {
  it('returns snapshot list', async () => {
    const res = await getHistory();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.snapshots)).toBe(true);
  });
});

describe('GET /api/history/diff', () => {
  it('returns 400 when missing params', async () => {
    const res = await getHistoryDiff(makeRequest('/api/history/diff'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Missing');
  });

  it('returns 400 for invalid filename', async () => {
    const res = await getHistoryDiff(makeRequest('/api/history/diff?from=../etc/passwd&to=foo.md'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid filename');
  });

  it('returns 404 for nonexistent snapshots', async () => {
    const res = await getHistoryDiff(makeRequest('/api/history/diff?from=nonexistent1.md&to=nonexistent2.md'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('returns diff for valid snapshots', async () => {
    // Get real snapshot filenames
    const list = await getHistory();
    const { snapshots } = await list.json();
    if (snapshots.length < 2) return;

    const res = await getHistoryDiff(
      makeRequest(`/api/history/diff?from=${snapshots[0].filename}&to=${snapshots[1].filename}`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('from');
    expect(body).toHaveProperty('to');
    expect(body).toHaveProperty('lines');
    expect(body).toHaveProperty('stats');
    expect(body.stats).toHaveProperty('added');
    expect(body.stats).toHaveProperty('removed');
    expect(body.stats).toHaveProperty('unchanged');
  });
});
