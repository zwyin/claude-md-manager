import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock better-sqlite3 — must use function (not arrow) so `new` works
vi.mock('better-sqlite3', () => ({
  default: vi.fn(function DatabaseMock(this: any) {
    this.prepare = vi.fn(() => ({
      bind: vi.fn(function (this: any) { return this; }),
      all: vi.fn(() => []),
      get: vi.fn(() => undefined),
    }));
    this.close = vi.fn();
  }),
}));

// Mock @/lib/db with controlled return values
const mockGetFilteredSessions = vi.fn();
const mockGetSessionDetail = vi.fn();

vi.mock('@/lib/db', () => ({
  getFilteredSessions: (...args: unknown[]) => mockGetFilteredSessions(...args),
  getSessionDetail: (...args: unknown[]) => mockGetSessionDetail(...args),
}));

// Import after mocks are set up
import { GET as getSessions } from '../sessions/route';
import { GET as getSessionDetail } from '../sessions/[id]/route';

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

describe('GET /api/sessions', () => {
  beforeEach(() => {
    mockGetFilteredSessions.mockReset();
  });

  it('returns sessions with default pagination', async () => {
    mockGetFilteredSessions.mockReturnValue({
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: ['claude-sonnet'],
    });

    const res = await getSessions(makeRequest('/api/sessions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('respects limit and offset params', async () => {
    mockGetFilteredSessions.mockReturnValue({
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: [],
    });

    const res = await getSessions(makeRequest('/api/sessions?limit=5&offset=2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(2);
    expect(body.sessions.length).toBeLessThanOrEqual(5);
  });

  it('clamps limit to max 200', async () => {
    mockGetFilteredSessions.mockReturnValue({
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: [],
    });

    const res = await getSessions(makeRequest('/api/sessions?limit=999'));
    const body = await res.json();

    expect(body.limit).toBe(200);
  });

  it('clamps limit to min 1', async () => {
    mockGetFilteredSessions.mockReturnValue({
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: [],
    });

    const res = await getSessions(makeRequest('/api/sessions?limit=-5'));
    const body = await res.json();

    expect(body.limit).toBe(1);
  });

  it('falls back to limit 50 on NaN', async () => {
    mockGetFilteredSessions.mockReturnValue({
      sessions: [],
      total: 0,
      avg_duration: null,
      avg_citations: null,
      models: [],
    });

    const res = await getSessions(makeRequest('/api/sessions?limit=abc'));
    const body = await res.json();

    expect(body.limit).toBe(50);
  });

  it('sorts by time DESC by default', async () => {
    mockGetFilteredSessions.mockReturnValue({
      sessions: [
        { session_id: 'a', started_at: '2026-05-25T10:00:00Z', citation_count: 1, rule_count: 1, duration_sec: 0 },
        { session_id: 'b', started_at: '2026-05-24T10:00:00Z', citation_count: 2, rule_count: 2, duration_sec: 0 },
      ],
      total: 2,
      avg_duration: null,
      avg_citations: null,
      models: [],
    });

    const res = await getSessions(makeRequest('/api/sessions?limit=10'));
    const body = await res.json();

    expect(res.status).toBe(200);
    const timestamps = body.sessions.map((s: any) => new Date(s.started_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
    }
  });

  it('supports dir=asc', async () => {
    mockGetFilteredSessions.mockReturnValue({
      sessions: [
        { session_id: 'a', started_at: '2026-05-24T10:00:00Z', citation_count: 1, rule_count: 1, duration_sec: 0 },
        { session_id: 'b', started_at: '2026-05-25T10:00:00Z', citation_count: 2, rule_count: 2, duration_sec: 0 },
      ],
      total: 2,
      avg_duration: null,
      avg_citations: null,
      models: [],
    });

    const res = await getSessions(makeRequest('/api/sessions?limit=10&dir=asc'));
    const body = await res.json();

    expect(res.status).toBe(200);
    const timestamps = body.sessions.map((s: any) => new Date(s.started_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it('filters by days', async () => {
    mockGetFilteredSessions.mockImplementation((opts: any) => {
      if (opts.days === 1) {
        return {
          sessions: [{ session_id: 'recent', started_at: '2026-05-25T10:00:00Z', citation_count: 1, rule_count: 1, duration_sec: 0 }],
          total: 1,
          avg_duration: null,
          avg_citations: null,
          models: [],
        };
      }
      return {
        sessions: [
          { session_id: 'recent', started_at: '2026-05-25T10:00:00Z', citation_count: 1, rule_count: 1, duration_sec: 0 },
          { session_id: 'old', started_at: '2026-05-01T10:00:00Z', citation_count: 1, rule_count: 1, duration_sec: 0 },
        ],
        total: 2,
        avg_duration: null,
        avg_citations: null,
        models: [],
      };
    });

    const resAll = await getSessions(makeRequest('/api/sessions?limit=200'));
    const all = await resAll.json();

    const res = await getSessions(makeRequest('/api/sessions?days=1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions.length).toBeLessThanOrEqual(all.sessions.length);
  });
});

describe('GET /api/sessions/[id]', () => {
  beforeEach(() => {
    mockGetSessionDetail.mockReset();
  });

  it('returns session with null fields for nonexistent session', async () => {
    mockGetSessionDetail.mockReturnValue({
      session: { session_id: 'nonexistent-session-id', started_at: null, ended_at: null, model: null, task_summary: null },
      citations: [],
      sections: [],
    });

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
    mockGetSessionDetail.mockReturnValue({
      session: { session_id: 'test-session-1', started_at: '2026-05-25T10:00:00Z', ended_at: '2026-05-25T10:05:00Z', model: 'claude-sonnet', task_summary: 'test' },
      citations: [{ rule_id: 'core-principles.brain', title: 'Brain', section_id: 'core-principles', matched_keyword: 'brain', confidence: 'high', timestamp: '2026-05-25T10:01:00Z' }],
      sections: [{ section_id: 'core-principles', section_title: 'Core' }],
    });

    const res = await getSessionDetail(
      makeRequest('/api/sessions/test-session-1'),
      { params: Promise.resolve({ id: 'test-session-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.session.session_id).toBe('test-session-1');
    expect(body.citations).toBeDefined();
  });
});
