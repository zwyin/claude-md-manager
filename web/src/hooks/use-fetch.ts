import { useEffect, useReducer } from 'react';
import { fetchJson } from '@/lib/fetch';

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type Action<T> =
  | { type: 'start' }
  | { type: 'success'; data: T }
  | { type: 'error'; error: string };

function reducer<T>(state: FetchState<T>, action: Action<T>): FetchState<T> {
  switch (action.type) {
    case 'start': return { data: null, loading: true, error: null };
    case 'success': return { data: action.data, loading: false, error: null };
    case 'error': return { data: null, loading: false, error: action.error };
  }
}

export function useFetch<T>(url: string | null): FetchState<T> {
  const [state, dispatch] = useReducer(reducer<T>, {
    data: null,
    loading: url !== null,
    error: null,
  });

  useEffect(() => {
    if (!url) return;
    dispatch({ type: 'start' });

    let cancelled = false;
    fetchJson<T>(url)
      .then((data) => { if (!cancelled) dispatch({ type: 'success', data }); })
      .catch((err) => { if (!cancelled) dispatch({ type: 'error', error: err.message }); });

    return () => { cancelled = true; };
  }, [url]);

  return state;
}
