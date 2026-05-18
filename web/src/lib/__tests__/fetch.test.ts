import { describe, it, expect, vi, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('fetchJson', () => {
  it('returns parsed JSON on success', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{"a":1,"b":"hello"}', { status: 200 }));
    const { fetchJson } = await import('../fetch');
    const result = await fetchJson<{ a: number; b: string }>('http://test');
    expect(result).toEqual({ a: 1, b: 'hello' });
  });

  it('throws on non-200 status', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not found', { status: 404 }));
    const { fetchJson } = await import('../fetch');
    await expect(fetchJson('http://test')).rejects.toThrow('HTTP 404');
  });

  it('throws on 500 status', async () => {
    globalThis.fetch = vi.fn(async () => new Response('error', { status: 500 }));
    const { fetchJson } = await import('../fetch');
    await expect(fetchJson('http://test')).rejects.toThrow('HTTP 500');
  });

  it('passes URL through to fetch', async () => {
    let calledUrl = '';
    globalThis.fetch = vi.fn(async (input) => { calledUrl = String(input); return new Response('{}'); });
    const { fetchJson } = await import('../fetch');
    await fetchJson('http://test/path?q=1');
    expect(calledUrl).toBe('http://test/path?q=1');
  });

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const { fetchJson } = await import('../fetch');
    await expect(fetchJson('http://test')).rejects.toThrow('Failed to fetch');
  });

  it('throws on invalid JSON response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not json', { status: 200 }));
    const { fetchJson } = await import('../fetch');
    await expect(fetchJson('http://test')).rejects.toThrow();
  });

  it('returns empty object for empty JSON body', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const { fetchJson } = await import('../fetch');
    const result = await fetchJson('http://test');
    expect(result).toEqual({});
  });

  it('returns array for JSON array response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('[1,2,3]', { status: 200 }));
    const { fetchJson } = await import('../fetch');
    const result = await fetchJson<number[]>('http://test');
    expect(result).toEqual([1, 2, 3]);
  });
});
