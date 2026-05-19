// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFetch } from '../use-fetch';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe('useFetch', () => {
  it('starts loading when url is provided', () => {
    globalThis.fetch = vi.fn(async () => new Response('{}'));
    const { result } = renderHook(() => useFetch('/api/test'));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('stays idle when url is null', () => {
    const { result } = renderHook(() => useFetch(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('resolves with data on success', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{"key":"value"}'));
    const { result } = renderHook(() => useFetch<{ key: string }>('/api/test'));

    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ key: 'value' });
  });

  it('sets error on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Network error'); });
    const { result } = renderHook(() => useFetch('/api/test'));

    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('sets error on HTTP error status', async () => {
    globalThis.fetch = vi.fn(async () => new Response('error', { status: 500 }));
    const { result } = renderHook(() => useFetch('/api/test'));

    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.error).toBe('HTTP 500');
  });

  it('cancels pending request on unmount', async () => {
    let resolveResponse: (r: Response) => void;
    globalThis.fetch = vi.fn(async () => new Promise<Response>((r) => { resolveResponse = r; }));

    const { result, unmount } = renderHook(() => useFetch('/api/test'));
    unmount();
    resolveResponse!(new Response('{"data":1}'));

    await act(() => new Promise((r) => setTimeout(r, 0)));
    // State should remain as last rendered before unmount
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('re-fetches when url changes', async () => {
    const responses = [new Response('{"v":1}'), new Response('{"v":2}')];
    let callIdx = 0;
    globalThis.fetch = vi.fn(async () => responses[callIdx++]);

    const { result, rerender } = renderHook(
      ({ url }: { url: string }) => useFetch<{ v: number }>(url),
      { initialProps: { url: '/api/first' } }
    );

    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.data).toEqual({ v: 1 });

    rerender({ url: '/api/second' });

    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.data).toEqual({ v: 2 });
  });
});
