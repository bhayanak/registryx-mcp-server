import { describe, it, expect, vi } from 'vitest';
import { Cache } from '../src/cache.js';

describe('Cache', () => {
  it('stores and retrieves values', () => {
    const cache = new Cache(60000);
    cache.set('key1', 'value1');
    expect(cache.get<string>('key1')).toBe('value1');
  });

  it('returns undefined for missing keys', () => {
    const cache = new Cache(60000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const cache = new Cache(100);
    cache.set('key1', 'value1');
    vi.useFakeTimers();
    vi.advanceTimersByTime(200);
    expect(cache.get('key1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('does not store when TTL is 0', () => {
    const cache = new Cache(0);
    cache.set('key1', 'value1');
    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('clears all entries', () => {
    const cache = new Cache(60000);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('reports size', () => {
    const cache = new Cache(60000);
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    expect(cache.size).toBe(1);
  });
});
