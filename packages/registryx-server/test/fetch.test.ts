import { describe, it, expect, vi } from 'vitest';
import { registryFetch } from '../src/utils/fetch.js';
import type { Config } from '../src/config.js';

const mockConfig: Config = {
  registries: ['npm'],
  timeoutMs: 5000,
  cacheTtlMs: 0,
};

describe('registryFetch', () => {
  it('rejects non-HTTPS URLs', async () => {
    await expect(registryFetch('http://registry.npmjs.org/', mockConfig)).rejects.toThrow(
      'Only HTTPS'
    );
  });

  it('rejects disallowed hosts', async () => {
    await expect(registryFetch('https://evil.com/data', mockConfig)).rejects.toThrow(
      'Host not allowed'
    );
  });

  it('allows registry.npmjs.org', async () => {
    const mockResponse = { ok: true, json: () => ({}) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
    const res = await registryFetch('https://registry.npmjs.org/express', mockConfig);
    expect(res.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('adds npm auth header when token is set', async () => {
    const configWithToken = { ...mockConfig, npmToken: 'secret' };
    const mockResponse = { ok: true, json: () => ({}) };
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchSpy);
    await registryFetch('https://registry.npmjs.org/express', configWithToken);
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer secret');
    vi.unstubAllGlobals();
  });

  it('throws on non-OK responses', async () => {
    const mockResponse = { ok: false, status: 404 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
    await expect(
      registryFetch('https://registry.npmjs.org/nonexistent', mockConfig)
    ).rejects.toThrow('HTTP 404');
    vi.unstubAllGlobals();
  });
});
