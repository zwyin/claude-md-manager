export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = '';
    try { const body = await res.json(); detail = body.error || ''; } catch { /* ignore */ }
    throw new Error(detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`);
  }
  return res.json();
}
