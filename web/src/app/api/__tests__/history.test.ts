import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getHistory } from '../history/route';
import { GET as getHistoryDiff } from '../history/diff/route';
import { GET as getSnapshot } from '../history/[ts]/route';

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

describe('GET /api/history/[ts]', () => {
  it('returns 400 for invalid timestamp format', async () => {
    const res = await getSnapshot(
      makeRequest('/api/history/invalid-ts'),
      { params: Promise.resolve({ ts: 'invalid-ts' }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  it('returns 404 for nonexistent timestamp', async () => {
    const res = await getSnapshot(
      makeRequest('/api/history/2020-01-01T00-00-00'),
      { params: Promise.resolve({ ts: '2020-01-01T00-00-00' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns snapshot content for valid timestamp', async () => {
    const list = await getHistory();
    const { snapshots } = await list.json();
    if (snapshots.length === 0) return;

    const ts = snapshots[0].timestamp;
    const res = await getSnapshot(
      makeRequest(`/api/history/${ts}`),
      { params: Promise.resolve({ ts }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('filename');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('size');
    expect(body).toHaveProperty('content');
    expect(typeof body.content).toBe('string');
  });
});
