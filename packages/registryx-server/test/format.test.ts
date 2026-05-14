import { describe, it, expect } from 'vitest';
import { formatNumber, padRight, truncate } from '../src/utils/format.js';

describe('formatNumber', () => {
  it('formats billions', () => {
    expect(formatNumber(1_200_000_000)).toBe('1.2B');
  });
  it('formats millions', () => {
    expect(formatNumber(45_000_000)).toBe('45.0M');
  });
  it('formats thousands', () => {
    expect(formatNumber(1_500)).toBe('1.5K');
  });
  it('formats small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('padRight', () => {
  it('pads shorter strings', () => {
    expect(padRight('abc', 6)).toBe('abc   ');
  });
  it('does not pad when already long enough', () => {
    expect(padRight('abcdef', 3)).toBe('abcdef');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('a'.repeat(100), 10)).toBe('a'.repeat(7) + '...');
  });
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
});
