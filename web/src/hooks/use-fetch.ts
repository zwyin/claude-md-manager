import { useCallback, useReducer, useEffect } from 'react';
import { fetchJson } from '@/lib/fetch';

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  fetchedAt: number | null;
};

type Action<T> =
  | { type: 'start' }
  | { type: 'success'; data: T; fetchedAt: number }
  | { type: 'error'; error: string };

function reducer<T>(state: FetchState<T>, action: Action<T>): FetchState<T> {
  switch (action.type) {
    case 'start': return { ...state, loading: true, error: null };
    case 'success': return { ...state, data: action.data, loading: false, error: null, fetchedAt: action.fetchedAt };
    case 'error': return { ...state, loading: false, error: action.error };
  }
}

export function useFetch<T>(url: string | null): FetchState<T> {
  const [refreshCount, bump] = useReducer((c: number) => c + 1, 0);
  const refresh = useCallback(() => { bump(); }, []);

  const [state, dispatch] = useReducer(reducer<T>, {
    data: null,
    loading: url !== null,
    error: null,
    refresh,
    fetchedAt: null,
  });

  useEffect(() => {
    if (!url) return;
    dispatch({ type: 'start' });

    let cancelled = false;
    fetchJson<T>(url)
      .then((data) => { if (!cancelled) dispatch({ type: 'success', data, fetchedAt: Date.now() }); })
      .catch((err) => { if (!cancelled) dispatch({ type: 'error', error: err.message }); });

    return () => { cancelled = true; };
  }, [url, refreshCount]);

  return { ...state, refresh };
}
