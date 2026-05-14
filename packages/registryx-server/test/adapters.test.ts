import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NpmAdapter } from '../src/adapters/npm.js';
import { PypiAdapter } from '../src/adapters/pypi.js';
import { MavenAdapter } from '../src/adapters/maven.js';
import { CratesAdapter } from '../src/adapters/crates.js';
import { Cache } from '../src/cache.js';
import type { Config } from '../src/config.js';

const config: Config = {
  registries: ['npm', 'pypi', 'maven', 'crates'],
  timeoutMs: 5000,
  cacheTtlMs: 60000,
};

function mockFetch(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(data),
  });
}

describe('NpmAdapter', () => {
  let adapter: NpmAdapter;
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache(60000);
    adapter = new NpmAdapter(config, cache);
    vi.unstubAllGlobals();
  });

  it('search returns packages', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        objects: [
          { package: { name: 'express', version: '4.18.0', description: 'Web framework' } },
        ],
      })
    );
    const results = await adapter.search('express', 5);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('express');
    expect(results[0].registry).toBe('npm');
  });

  it('getPackage returns metadata', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        name: 'express',
        'dist-tags': { latest: '4.18.0' },
        description: 'Web framework',
        license: 'MIT',
        homepage: 'https://expressjs.com',
        repository: { url: 'git+https://github.com/expressjs/express.git' },
        keywords: ['web', 'framework'],
        versions: { '4.18.0': {} },
      })
    );
    const pkg = await adapter.getPackage('express');
    expect(pkg.name).toBe('express');
    expect(pkg.license).toBe('MIT');
    expect(pkg.registry).toBe('npm');
  });

  it('listVersions returns versions', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        versions: { '1.0.0': {}, '2.0.0-beta.1': {}, '2.0.0': {} },
        time: { '1.0.0': '2020-01-01', '2.0.0-beta.1': '2021-01-01', '2.0.0': '2022-01-01' },
      })
    );
    const versions = await adapter.listVersions('express', 10, true);
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  it('getVersion returns detail', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        name: 'express',
        version: '4.18.0',
        license: 'MIT',
        dist: { unpackedSize: 204800 },
        dependencies: { accepts: '~1.3.8' },
      })
    );
    const v = await adapter.getVersion('express', '4.18.0');
    expect(v.name).toBe('express');
    expect(v.dependencies.length).toBe(1);
  });

  it('getDependencies returns runtime deps', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        dependencies: { lodash: '^4.0.0' },
        devDependencies: { vitest: '^2.0.0' },
      })
    );
    const deps = await adapter.getDependencies('test', '1.0.0', 'runtime');
    expect(deps.length).toBe(1);
    expect(deps[0].type).toBe('runtime');
  });

  it('getDependencies returns all deps', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        dependencies: { lodash: '^4.0.0' },
        devDependencies: { vitest: '^2.0.0' },
      })
    );
    const deps = await adapter.getDependencies('test', '1.0.0', 'all');
    expect(deps.length).toBe(2);
  });

  it('getDownloadStats returns stats', async () => {
    vi.stubGlobal('fetch', mockFetch({ downloads: 1000000 }));
    const stats = await adapter.getDownloadStats('express', 'last-month');
    expect(stats.total).toBe(1000000);
  });

  it('getReadme returns readme', async () => {
    vi.stubGlobal('fetch', mockFetch({ readme: '# Express' }));
    const readme = await adapter.getReadme('express');
    expect(readme).toBe('# Express');
  });

  it('getMaintainers returns list', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ maintainers: [{ name: 'dougwilson', email: 'doug@somethingdoug.com' }] })
    );
    const maintainers = await adapter.getMaintainers('express');
    expect(maintainers.length).toBe(1);
  });

  it('getPackageHealth returns health', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        name: 'express',
        'dist-tags': { latest: '4.18.0' },
        description: 'Web framework',
        license: 'MIT',
        versions: { '4.18.0': { dependencies: {}, types: 'index.d.ts' } },
        time: { '4.18.0': '2024-01-01' },
        readme: 'x'.repeat(600),
        keywords: [],
      })
    );
    const health = await adapter.getPackageHealth('express');
    expect(health.score).toBeGreaterThan(0);
  });

  it('getSecurityAdvisories returns empty on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const advisories = await adapter.getSecurityAdvisories('express');
    expect(advisories).toEqual([]);
  });

  it('getReverseDependencies returns packages', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        objects: [{ package: { name: 'helmet', version: '7.0.0', description: 'security' } }],
      })
    );
    const results = await adapter.getReverseDependencies('express', 5);
    expect(results.length).toBe(1);
  });

  it('caches search results', async () => {
    const fetchMock = mockFetch({
      objects: [{ package: { name: 'a', version: '1', description: '' } }],
    });
    vi.stubGlobal('fetch', fetchMock);
    await adapter.search('test', 5);
    await adapter.search('test', 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('PypiAdapter', () => {
  let adapter: PypiAdapter;
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache(60000);
    adapter = new PypiAdapter(config, cache);
    vi.unstubAllGlobals();
  });

  it('search returns packages', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        info: { name: 'requests', version: '2.31.0', summary: 'HTTP library' },
      })
    );
    const results = await adapter.search('requests', 5);
    expect(results.length).toBe(1);
    expect(results[0].registry).toBe('pypi');
  });

  it('getPackage returns metadata', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        info: {
          name: 'requests',
          version: '2.31.0',
          summary: 'HTTP library',
          license: 'Apache 2.0',
          home_page: 'https://requests.readthedocs.io',
          project_urls: { Source: 'https://github.com/psf/requests' },
          keywords: 'http,client',
        },
      })
    );
    const pkg = await adapter.getPackage('requests');
    expect(pkg.name).toBe('requests');
    expect(pkg.registry).toBe('pypi');
  });

  it('listVersions filters pre-releases', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        releases: {
          '2.30.0': [{ upload_time_iso_8601: '2023-01-01' }],
          '2.31.0a1': [{ upload_time_iso_8601: '2023-06-01' }],
          '2.31.0': [{ upload_time_iso_8601: '2023-07-01' }],
        },
      })
    );
    const versions = await adapter.listVersions('requests', 10, true);
    expect(versions.every((v) => !v.prerelease)).toBe(true);
  });

  it('getVersion returns version detail', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        info: {
          name: 'requests',
          version: '2.31.0',
          license: 'Apache 2.0',
          requires_dist: ['charset-normalizer', 'idna'],
        },
        urls: [{ upload_time_iso_8601: '2023-07-01', size: 62574 }],
      })
    );
    const v = await adapter.getVersion('requests', '2.31.0');
    expect(v.dependencies.length).toBe(2);
  });

  it('getReverseDependencies returns empty', async () => {
    const results = await adapter.getReverseDependencies('requests', 5);
    expect(results).toEqual([]);
  });

  it('getDownloadStats returns stats', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        info: { name: 'requests', version: '2.31.0', summary: '' },
      })
    );
    const stats = await adapter.getDownloadStats('requests', 'last-month');
    expect(stats.registry).toBe('pypi');
  });

  it('getReadme returns description', async () => {
    vi.stubGlobal('fetch', mockFetch({ info: { description: '# Requests\nHTTP library' } }));
    const readme = await adapter.getReadme('requests');
    expect(readme).toContain('Requests');
  });

  it('getMaintainers returns authors', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        info: { author: 'Kenneth Reitz', author_email: 'me@kennethreitz.org' },
      })
    );
    const m = await adapter.getMaintainers('requests');
    expect(m.length).toBe(1);
    expect(m[0].name).toBe('Kenneth Reitz');
  });

  it('getPackageHealth returns health', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        info: {
          name: 'requests',
          version: '2.31.0',
          summary: '',
          license: 'Apache 2.0',
          description: 'x'.repeat(600),
          requires_python: '>=3.7',
          project_urls: { Documentation: 'https://docs.python-requests.org' },
          requires_dist: ['a', 'b'],
          classifiers: ['Typing :: Typed'],
        },
        urls: [{ upload_time_iso_8601: '2023-07-01' }],
      })
    );
    const health = await adapter.getPackageHealth('requests');
    expect(health.score).toBeGreaterThan(0);
  });

  it('getSecurityAdvisories returns empty on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const advisories = await adapter.getSecurityAdvisories('requests');
    expect(advisories).toEqual([]);
  });
});

describe('MavenAdapter', () => {
  let adapter: MavenAdapter;
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache(60000);
    adapter = new MavenAdapter(config, cache);
    vi.unstubAllGlobals();
  });

  it('throws for invalid coordinates', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    await expect(adapter.getPackage('invalid')).rejects.toThrow('groupId:artifactId');
  });

  it('search returns results', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        response: { docs: [{ g: 'com.google.guava', a: 'guava', latestVersion: '33.0.0' }] },
      })
    );
    const results = await adapter.search('guava', 5);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('com.google.guava:guava');
  });

  it('getPackage returns metadata', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        response: {
          docs: [{ g: 'com.google.guava', a: 'guava', latestVersion: '33.0.0', p: 'jar' }],
        },
      })
    );
    const pkg = await adapter.getPackage('com.google.guava:guava');
    expect(pkg.registry).toBe('maven');
  });

  it('listVersions returns versions', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        response: {
          docs: [
            { v: '33.0.0', timestamp: 1700000000000 },
            { v: '33.0.0-beta', timestamp: 1699000000000 },
          ],
        },
      })
    );
    const versions = await adapter.listVersions('com.google.guava:guava', 10, true);
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  it('getReadme returns message', async () => {
    const readme = await adapter.getReadme('com.google.guava:guava');
    expect(readme).toContain('Maven Central');
  });

  it('getMaintainers returns empty', async () => {
    const m = await adapter.getMaintainers('com.google.guava:guava');
    expect(m).toEqual([]);
  });

  it('getDependencies returns empty', async () => {
    const deps = await adapter.getDependencies('com.google.guava:guava', '33.0.0', 'all');
    expect(deps).toEqual([]);
  });

  it('getReverseDependencies returns empty', async () => {
    const results = await adapter.getReverseDependencies('com.google.guava:guava', 5);
    expect(results).toEqual([]);
  });

  it('getDownloadStats returns zeroed stats', async () => {
    const stats = await adapter.getDownloadStats('com.google.guava:guava', 'last-month');
    expect(stats.total).toBe(0);
  });

  it('getPackageHealth returns baseline', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        response: { docs: [{ g: 'com.google.guava', a: 'guava', latestVersion: '33.0.0' }] },
      })
    );
    const health = await adapter.getPackageHealth('com.google.guava:guava');
    expect(health.score).toBe(5);
  });

  it('getSecurityAdvisories returns empty on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const adv = await adapter.getSecurityAdvisories('com.google.guava:guava');
    expect(adv).toEqual([]);
  });
});

describe('CratesAdapter', () => {
  let adapter: CratesAdapter;
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache(60000);
    adapter = new CratesAdapter(config, cache);
    vi.unstubAllGlobals();
  });

  it('search returns crates', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        crates: [
          { name: 'serde', max_version: '1.0.200', description: 'Serialize', downloads: 100000 },
        ],
      })
    );
    const results = await adapter.search('serde', 5);
    expect(results.length).toBe(1);
    expect(results[0].registry).toBe('crates');
  });

  it('getPackage returns metadata', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        crate: {
          name: 'serde',
          max_version: '1.0.200',
          description: 'Serialize',
          homepage: 'https://serde.rs',
          repository: 'https://github.com/serde-rs/serde',
          keywords: ['serde'],
        },
      })
    );
    const pkg = await adapter.getPackage('serde');
    expect(pkg.name).toBe('serde');
    expect(pkg.registry).toBe('crates');
  });

  it('listVersions returns versions', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        versions: [
          { num: '1.0.200', created_at: '2024-01-01' },
          { num: '1.0.200-rc.1', created_at: '2023-12-01' },
        ],
      })
    );
    const versions = await adapter.listVersions('serde', 10, true);
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  it('getVersion returns detail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            version: {
              crate: 'serde',
              num: '1.0.200',
              created_at: '2024-01-01',
              license: 'MIT/Apache-2.0',
              crate_size: 102400,
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            dependencies: [{ crate_id: 'serde_derive', req: '^1.0', kind: 'normal' }],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const v = await adapter.getVersion('serde', '1.0.200');
    expect(v.name).toBe('serde');
    expect(v.dependencies.length).toBe(1);
  });

  it('getDependencies returns filtered deps', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        dependencies: [
          { crate_id: 'serde_derive', req: '^1.0', kind: 'normal' },
          { crate_id: 'serde_test', req: '^1.0', kind: 'dev' },
        ],
      })
    );
    const deps = await adapter.getDependencies('serde', '1.0.200', 'runtime');
    expect(deps.length).toBe(1);
    expect(deps[0].type).toBe('runtime');
  });

  it('getReverseDependencies returns dependents', async () => {
    vi.stubGlobal('fetch', mockFetch({ versions: [{ crate: 'serde_json', num: '1.0.0' }] }));
    const results = await adapter.getReverseDependencies('serde', 5);
    expect(results.length).toBe(1);
  });

  it('getDownloadStats returns downloads', async () => {
    vi.stubGlobal('fetch', mockFetch({ crate: { downloads: 500000 } }));
    const stats = await adapter.getDownloadStats('serde', 'last-month');
    expect(stats.total).toBe(500000);
  });

  it('getReadme returns content', async () => {
    vi.stubGlobal('fetch', mockFetch({ crate: { readme: '# Serde' } }));
    const readme = await adapter.getReadme('serde');
    expect(readme).toBe('# Serde');
  });

  it('getMaintainers returns owners', async () => {
    vi.stubGlobal('fetch', mockFetch({ users: [{ login: 'dtolnay', name: 'David Tolnay' }] }));
    const m = await adapter.getMaintainers('serde');
    expect(m.length).toBe(1);
  });

  it('getPackageHealth returns health', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        crate: {
          name: 'serde',
          max_version: '1.0.200',
          description: 'Serialize',
          documentation: 'https://docs.rs/serde',
          repository: 'https://github.com/serde-rs/serde',
          homepage: 'https://serde.rs',
          updated_at: '2024-01-01',
          recent_downloads: 5000000,
          keywords: [],
        },
      })
    );
    const health = await adapter.getPackageHealth('serde');
    expect(health.score).toBeGreaterThan(0);
  });

  it('getSecurityAdvisories returns empty on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const adv = await adapter.getSecurityAdvisories('serde');
    expect(adv).toEqual([]);
  });
});
