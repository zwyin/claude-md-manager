import { describe, it, expect } from 'vitest';
import { handleApiError } from '../api-handler';
import { ValidationError } from '../api-utils';

describe('handleApiError', () => {
  it('returns 400 for ValidationError', () => {
    const result = handleApiError(new ValidationError('bad input'));
    expect(result.status).toBe(400);
    return result.json().then((body) => {
      expect(body).toEqual({ error: 'bad input' });
    });
  });

  it('returns 500 for generic Error', () => {
    const result = handleApiError(new Error('something broke'));
    expect(result.status).toBe(500);
    return result.json().then((body) => {
      expect(body.error).toBe('Internal server error');
    });
  });

  it('returns 500 for non-Error thrown values', () => {
    const result = handleApiError('string error');
    expect(result.status).toBe(500);
    return result.json().then((body) => {
      expect(body.error).toBe('Internal server error');
    });
  });

  it('returns 500 for null', () => {
    const result = handleApiError(null);
    expect(result.status).toBe(500);
  });
});
