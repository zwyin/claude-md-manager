import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getSessions } from '../sessions/route';
import { GET as getSessionDetail } from '../sessions/[id]/route';

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

describe('GET /api/sessions', () => {
  it('returns sessions with default pagination', async () => {
    const res = await getSessions(makeRequest('/api/sessions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('respects limit and offset params', async () => {
    const res = await getSessions(makeRequest('/api/sessions?limit=5&offset=2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(2);
    expect(body.sessions.length).toBeLessThanOrEqual(5);
  });

  it('clamps limit to max 200', async () => {
    const res = await getSessions(makeRequest('/api/sessions?limit=999'));
    const body = await res.json();

    expect(body.limit).toBe(200);
  });

  it('clamps limit to min 1', async () => {
    const res = await getSessions(makeRequest('/api/sessions?limit=-5'));
    const body = await res.json();

    expect(body.limit).toBe(1);
  });

  it('falls back to limit 50 on NaN', async () => {
    const res = await getSessions(makeRequest('/api/sessions?limit=abc'));
    const body = await res.json();

    expect(body.limit).toBe(50);
  });

  it('sorts by time DESC by default', async () => {
    const res = await getSessions(makeRequest('/api/sessions?limit=10'));
    const body = await res.json();

    expect(res.status).toBe(200);
    const timestamps = body.sessions.map((s: any) => new Date(s.started_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
    }
  });

  it('supports dir=asc', async () => {
    const res = await getSessions(makeRequest('/api/sessions?limit=10&dir=asc'));
    const body = await res.json();

    expect(res.status).toBe(200);
    const timestamps = body.sessions.map((s: any) => new Date(s.started_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it('filters by days', async () => {
    const resAll = await getSessions(makeRequest('/api/sessions?limit=200'));
    const all = await resAll.json();

    const res = await getSessions(makeRequest('/api/sessions?days=1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions.length).toBeLessThanOrEqual(all.sessions.length);
  });
});

describe('GET /api/sessions/[id]', () => {
  it('returns session with null fields for nonexistent session', async () => {
    const res = await getSessionDetail(
      makeRequest('/api/sessions/nonexistent-session-id'),
      { params: Promise.resolve({ id: 'nonexistent-session-id' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.session.session_id).toBe('nonexistent-session-id');
    expect(body.session.model).toBeNull();
    expect(body.citations).toEqual([]);
  });

  it('returns session detail for valid session', async () => {
    // First get a real session ID
    const listRes = await getSessions(makeRequest('/api/sessions?limit=1'));
    const listBody = await listRes.json();
    if (listBody.sessions.length === 0) return;

    const sid = listBody.sessions[0].session_id;
    const res = await getSessionDetail(
      makeRequest(`/api/sessions/${sid}`),
      { params: Promise.resolve({ id: sid }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.session.session_id).toBe(sid);
    expect(body.citations).toBeDefined();
  });
});
