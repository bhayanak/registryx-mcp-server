import type { Config } from '../config.js';
import type { Cache } from '../cache.js';
import type {
  RegistryAdapter,
  PackageSearchResult,
  PackageMetadata,
  VersionInfo,
  VersionDetail,
  Dependency,
  DownloadStats,
  MaintainerInfo,
  PackageHealth,
  SecurityAdvisory,
} from '../types.js';
import { registryFetch } from '../utils/fetch.js';

export class PypiAdapter implements RegistryAdapter {
  readonly name = 'pypi' as const;
  constructor(
    private config: Config,
    private cache: Cache
  ) {}

  async search(query: string, limit: number): Promise<PackageSearchResult[]> {
    const key = `pypi:search:${query}:${limit}`;
    const cached = this.cache.get<PackageSearchResult[]>(key);
    if (cached) return cached;

    const results: PackageSearchResult[] = [];
    try {
      const pkgUrl = `https://pypi.org/pypi/${encodeURIComponent(query)}/json`;
      const res = await registryFetch(pkgUrl, this.config);
      const data = (await res.json()) as any;
      results.push({
        name: data.info.name,
        version: data.info.version,
        description: data.info.summary ?? '',
        downloads: '',
        registry: 'pypi',
      });
    } catch {
      // Package not found directly — that's OK
    }
    this.cache.set(key, results.slice(0, limit));
    return results.slice(0, limit);
  }

  async getPackage(name: string): Promise<PackageMetadata> {
    const key = `pypi:pkg:${name}`;
    const cached = this.cache.get<PackageMetadata>(key);
    if (cached) return cached;

    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const info = data.info;

    const result: PackageMetadata = {
      name: info.name,
      version: info.version,
      description: info.summary ?? '',
      license: info.license ?? 'Unknown',
      homepage: info.home_page ?? info.project_url ?? '',
      repository: info.project_urls?.Source ?? info.project_urls?.Repository ?? '',
      keywords: info.keywords ? info.keywords.split(',').map((k: string) => k.trim()) : [],
      registry: 'pypi',
    };
    this.cache.set(key, result);
    return result;
  }

  async getReadme(name: string): Promise<string> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    return data.info.description ?? 'No README available.';
  }

  async getMaintainers(name: string): Promise<MaintainerInfo[]> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const info = data.info;
    const maintainers: MaintainerInfo[] = [];
    if (info.author) maintainers.push({ name: info.author, email: info.author_email });
    if (info.maintainer) maintainers.push({ name: info.maintainer, email: info.maintainer_email });
    return maintainers;
  }

  async listVersions(name: string, limit: number, stableOnly: boolean): Promise<VersionInfo[]> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    const releases = Object.keys(data.releases ?? {}).reverse();
    let results: VersionInfo[] = releases.map((v) => {
      const files = data.releases[v] ?? [];
      const date = files[0]?.upload_time_iso_8601 ?? '';
      return {
        version: v,
        date,
        prerelease: /(?:a|b|rc|dev|alpha|beta)\d*/i.test(v),
      };
    });

    if (stableOnly) results = results.filter((v) => !v.prerelease);
    return results.slice(0, limit);
  }

  async getVersion(name: string, version: string): Promise<VersionDetail> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/${version}/json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const info = data.info;

    const deps: Dependency[] = (info.requires_dist ?? []).map((d: string) => {
      const match = d.match(/^([^\s;]+)/);
      return {
        name: match?.[1] ?? d,
        version: '',
        type: 'runtime' as const,
      };
    });

    return {
      name: info.name,
      version: info.version,
      date: data.urls?.[0]?.upload_time_iso_8601 ?? '',
      license: info.license ?? 'Unknown',
      size: data.urls?.[0]?.size ? `${Math.round(data.urls[0].size / 1024)}KB` : 'Unknown',
      dependencies: deps,
      registry: 'pypi',
    };
  }

  async getDependencies(
    name: string,
    version: string,
    _type: 'runtime' | 'dev' | 'all'
  ): Promise<Dependency[]> {
    const vd = await this.getVersion(name, version);
    return vd.dependencies;
  }

  async getReverseDependencies(_name: string, _limit: number): Promise<PackageSearchResult[]> {
    return []; // PyPI doesn't expose reverse dependencies
  }

  async getDownloadStats(name: string, period: string): Promise<DownloadStats> {
    return {
      name,
      registry: 'pypi',
      period,
      total: 0, // PyPI doesn't have a public real-time download API
      breakdown: [],
    };
  }

  async getPackageHealth(name: string): Promise<PackageHealth> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const info = data.info;

    const signals: string[] = [];
    if (info.description && info.description.length > 500) signals.push('Detailed description');
    if (info.license) signals.push('License specified');
    if (info.requires_python) signals.push('Python version specified');
    if (info.project_urls?.Documentation) signals.push('Has documentation URL');

    const depCount = (info.requires_dist ?? []).length;

    return {
      name,
      registry: 'pypi',
      score: Math.min(10, signals.length * 2 + 3),
      lastPublish: data.urls?.[0]?.upload_time_iso_8601 ?? '',
      dependencyCount: depCount,
      hasTests: false,
      hasTypings: info.classifiers?.some((c: string) => c.includes('Typing')) ?? false,
      signals,
    };
  }

  async getSecurityAdvisories(name: string, _version?: string): Promise<SecurityAdvisory[]> {
    try {
      const url = 'https://osv.dev/v1/query';
      const body = { package: { name, ecosystem: 'PyPI' } };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      return (data.vulns ?? []).map(
        (v: {
          id: string;
          summary?: string;
          severity?: { score: string }[];
          references?: { url: string }[];
        }) => ({
          id: v.id,
          title: v.summary ?? v.id,
          severity: v.severity?.[0]?.score ?? 'Unknown',
          url: v.references?.[0]?.url ?? `https://osv.dev/vulnerability/${v.id}`,
          affectedVersions: 'See advisory',
        })
      );
    } catch {
      return [];
    }
  }
}
