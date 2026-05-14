import type { RegistryName } from './types.js';

export interface Config {
  registries: RegistryName[];
  npmToken?: string;
  timeoutMs: number;
  cacheTtlMs: number;
}

const VALID_REGISTRIES = new Set<RegistryName>(['npm', 'pypi', 'maven', 'crates']);

export function loadConfig(): Config {
  const registriesEnv = process.env.REGISTRYX_MCP_REGISTRIES ?? 'npm,pypi,maven,crates';
  const registries = registriesEnv
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter((r): r is RegistryName => VALID_REGISTRIES.has(r as RegistryName));

  if (registries.length === 0) {
    throw new Error(
      'No valid registries configured. Set REGISTRYX_MCP_REGISTRIES to comma-separated values: npm, pypi, maven, crates'
    );
  }

  const timeoutMs = parseInt(process.env.REGISTRYX_MCP_TIMEOUT_MS ?? '15000', 10);
  if (isNaN(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new Error('REGISTRYX_MCP_TIMEOUT_MS must be between 1000 and 120000');
  }

  const cacheTtlMs = parseInt(process.env.REGISTRYX_MCP_CACHE_TTL_MS ?? '300000', 10);
  if (isNaN(cacheTtlMs) || cacheTtlMs < 0) {
    throw new Error('REGISTRYX_MCP_CACHE_TTL_MS must be >= 0');
  }

  return {
    registries,
    npmToken: process.env.REGISTRYX_MCP_NPM_TOKEN || undefined,
    timeoutMs,
    cacheTtlMs,
  };
}
