import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns default config when no env vars set', () => {
    vi.stubEnv('REGISTRYX_MCP_REGISTRIES', '');
    // Override to test default
    vi.stubEnv('REGISTRYX_MCP_REGISTRIES', 'npm,pypi,maven,crates');
    const config = loadConfig();
    expect(config.registries).toEqual(['npm', 'pypi', 'maven', 'crates']);
    expect(config.timeoutMs).toBe(15000);
    expect(config.cacheTtlMs).toBe(300000);
  });

  it('parses custom registries', () => {
    vi.stubEnv('REGISTRYX_MCP_REGISTRIES', 'npm,crates');
    const config = loadConfig();
    expect(config.registries).toEqual(['npm', 'crates']);
  });

  it('filters invalid registries', () => {
    vi.stubEnv('REGISTRYX_MCP_REGISTRIES', 'npm,invalid,pypi');
    const config = loadConfig();
    expect(config.registries).toEqual(['npm', 'pypi']);
  });

  it('throws if no valid registries', () => {
    vi.stubEnv('REGISTRYX_MCP_REGISTRIES', 'invalid,nope');
    expect(() => loadConfig()).toThrow('No valid registries');
  });

  it('parses timeout', () => {
    vi.stubEnv('REGISTRYX_MCP_TIMEOUT_MS', '5000');
    const config = loadConfig();
    expect(config.timeoutMs).toBe(5000);
  });

  it('throws for invalid timeout', () => {
    vi.stubEnv('REGISTRYX_MCP_TIMEOUT_MS', '500');
    expect(() => loadConfig()).toThrow('REGISTRYX_MCP_TIMEOUT_MS');
  });

  it('parses npm token', () => {
    vi.stubEnv('REGISTRYX_MCP_NPM_TOKEN', 'test-token');
    const config = loadConfig();
    expect(config.npmToken).toBe('test-token');
  });

  it('returns undefined npmToken when empty', () => {
    vi.stubEnv('REGISTRYX_MCP_NPM_TOKEN', '');
    const config = loadConfig();
    expect(config.npmToken).toBeUndefined();
  });

  it('parses cache TTL', () => {
    vi.stubEnv('REGISTRYX_MCP_CACHE_TTL_MS', '60000');
    const config = loadConfig();
    expect(config.cacheTtlMs).toBe(60000);
  });

  it('throws for negative cache TTL', () => {
    vi.stubEnv('REGISTRYX_MCP_CACHE_TTL_MS', '-1');
    expect(() => loadConfig()).toThrow('REGISTRYX_MCP_CACHE_TTL_MS');
  });
});
