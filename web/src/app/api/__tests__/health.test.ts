import { describe, it, expect } from 'vitest';
import { GET } from '../health/route';

describe('GET /api/health', () => {
  it('returns ok status with sessions and response_ms', async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.sessions).toBe('number');
    expect(body.sessions).toBeGreaterThanOrEqual(0);
    expect(typeof body.response_ms).toBe('number');
    expect(body.response_ms).toBeGreaterThanOrEqual(0);
  });
});
