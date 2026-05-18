import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock global fetch
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

async function importFetchJson() {
  const mod = await import('../fetch');
  return mod.fetchJson;
}

describe('fetchJson', () => {
  it('returns parsed JSON on success', async () => {
    globalThis.fetch = async () => new Response('{"a":1,"b":"hello"}', { status: 200 });
    const fetchJson = await importFetchJson();
    const result = await fetchJson<{ a: number; b: string }>('http://test');
    assert.deepEqual(result, { a: 1, b: 'hello' });
  });

  it('throws on non-200 status', async () => {
    globalThis.fetch = async () => new Response('not found', { status: 404 });
    const fetchJson = await importFetchJson();
    await assert.rejects(() => fetchJson('http://test'), { message: 'HTTP 404' });
  });

  it('throws on 500 status', async () => {
    globalThis.fetch = async () => new Response('error', { status: 500 });
    const fetchJson = await importFetchJson();
    await assert.rejects(() => fetchJson('http://test'), { message: 'HTTP 500' });
  });

  it('passes URL through to fetch', async () => {
    let calledUrl = '';
    globalThis.fetch = async (input) => { calledUrl = String(input); return new Response('{}'); };
    const fetchJson = await importFetchJson();
    await fetchJson('http://test/path?q=1');
    assert.equal(calledUrl, 'http://test/path?q=1');
  });
});
