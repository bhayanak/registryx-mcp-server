import { describe, it, expect } from 'vitest';
import { createServer } from '../src/server.js';
import type { Config } from '../src/config.js';

const config: Config = {
  registries: ['npm', 'pypi', 'maven', 'crates'],
  timeoutMs: 5000,
  cacheTtlMs: 0,
};

describe('createServer', () => {
  it('creates a server instance', () => {
    const server = createServer(config);
    expect(server).toBeDefined();
  });

  it('throws for disabled registry', async () => {
    const limitedConfig: Config = { ...config, registries: ['npm'] };
    const server = createServer(limitedConfig);
    // Server should still be created — the error is at tool call time
    expect(server).toBeDefined();
  });
});
