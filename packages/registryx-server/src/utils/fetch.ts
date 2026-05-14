import type { Config } from '../config.js';

const ALLOWED_HOSTS = new Set([
  'registry.npmjs.org',
  'api.npmjs.org',
  'pypi.org',
  'search.maven.org',
  'crates.io',
  'osv.dev',
]);

export async function registryFetch(
  url: string,
  config: Config,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs allowed, got: ${parsed.protocol}`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host not allowed: ${parsed.hostname}`);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'registryx-mcp-server/0.1.0',
    ...extraHeaders,
  };

  if (parsed.hostname === 'registry.npmjs.org' && config.npmToken) {
    headers['Authorization'] = `Bearer ${config.npmToken}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${parsed.hostname}${parsed.pathname}`);
  }

  return response;
}
