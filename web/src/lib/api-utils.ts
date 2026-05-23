export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function parseDays(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 && n <= 3650 && String(n) === raw ? n : undefined;
}

export function parseEnum<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  if (!raw) return fallback;
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

const RULE_ID_RE = /^[a-zA-Z0-9._-]+$/;

export function sanitizeRuleId(id: string): string {
  const decoded = decodeURIComponent(id);
  if (!RULE_ID_RE.test(decoded)) {
    throw new ValidationError('Invalid rule ID format');
  }
  return decoded;
}

export function zeroFillTrend(
  data: { period: string; count: number }[],
  days?: number,
): { period: string; count: number }[] {
  if (data.length === 0) return data;
  const end = new Date(data[data.length - 1].period + 'T00:00:00');
  const start = days
    ? new Date(Date.now() - days * 86400000)
    : new Date(data[0].period + 'T00:00:00');
  const lookup = new Map(data.map((d) => [d.period, d.count]));
  const result: { period: string; count: number }[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    result.push({ period: key, count: lookup.get(key) ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  return result;
}
