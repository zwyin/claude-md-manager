import { describe, it, expect } from 'vitest';
import { relativeTime, formatDuration } from '../relative-time';

describe('formatDuration', () => {
  it('returns null for zero', () => {
    expect(formatDuration(0)).toBeNull();
  });

  it('returns null for negative', () => {
    expect(formatDuration(-5)).toBeNull();
  });

  it('formats seconds', () => {
    expect(formatDuration(30)).toBe('30s');
  });

  it('formats minutes', () => {
    expect(formatDuration(120)).toBe('2m');
  });

  it('formats minutes with seconds', () => {
    expect(formatDuration(90)).toBe('1m30s');
  });

  it('formats hours', () => {
    expect(formatDuration(3600)).toBe('1h');
  });

  it('formats hours with minutes', () => {
    expect(formatDuration(5400)).toBe('1h30m');
  });
});

describe('relativeTime', () => {
  it('formats recent seconds', () => {
    const now = new Date().toISOString();
    const result = relativeTime(now, 'en');
    expect(result).toBeTruthy();
  });

  it('formats past date in Chinese', () => {
    const past = new Date(Date.now() - 7200000).toISOString();
    const result = relativeTime(past, 'zh');
    expect(result).toBeTruthy();
  });

  it('formats days ago', () => {
    const past = new Date(Date.now() - 3 * 86400000).toISOString();
    const result = relativeTime(past, 'en');
    expect(result).toContain('3');
  });

  it('formats minutes ago', () => {
    const past = new Date(Date.now() - 5 * 60000).toISOString();
    const result = relativeTime(past, 'en');
    expect(result).toContain('5');
  });
});
