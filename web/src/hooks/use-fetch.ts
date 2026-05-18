import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/fetch';

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useFetch<T>(url: string | null): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: url !== null,
    error: null,
  });

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setState({ data: null, loading: true, error: null });
    });

    fetchJson<T>(url)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [url]);

  return state;
}
