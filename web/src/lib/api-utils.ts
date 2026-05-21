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
