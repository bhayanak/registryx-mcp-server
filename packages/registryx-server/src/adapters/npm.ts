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

export class NpmAdapter implements RegistryAdapter {
  readonly name = 'npm' as const;
  constructor(
    private config: Config,
    private cache: Cache
  ) {}

  async search(query: string, limit: number): Promise<PackageSearchResult[]> {
    const key = `npm:search:${query}:${limit}`;
    const cached = this.cache.get<PackageSearchResult[]>(key);
    if (cached) return cached;

    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    const results: PackageSearchResult[] = (data.objects ?? []).map(
      (obj: {
        package: { name: string; version: string; description?: string };
        downloads?: { monthly?: number };
      }) => ({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description ?? '',
        downloads: '',
        registry: 'npm' as const,
      })
    );
    this.cache.set(key, results);
    return results;
  }

  async getPackage(name: string): Promise<PackageMetadata> {
    const key = `npm:pkg:${name}`;
    const cached = this.cache.get<PackageMetadata>(key);
    if (cached) return cached;

    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const latest = data['dist-tags']?.latest ?? '';

    const result: PackageMetadata = {
      name: data.name,
      version: latest,
      description: data.description ?? '',
      license: typeof data.license === 'string' ? data.license : (data.license?.type ?? 'Unknown'),
      homepage: data.homepage ?? '',
      repository:
        typeof data.repository === 'string' ? data.repository : (data.repository?.url ?? ''),
      keywords: data.keywords ?? [],
      registry: 'npm',
    };
    this.cache.set(key, result);
    return result;
  }

  async getReadme(name: string): Promise<string> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    return data.readme ?? 'No README available.';
  }

  async getMaintainers(name: string): Promise<MaintainerInfo[]> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    return (data.maintainers ?? []).map((m: { name: string; email?: string }) => ({
      name: m.name,
      email: m.email,
    }));
  }

  async listVersions(name: string, limit: number, stableOnly: boolean): Promise<VersionInfo[]> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const versions = Object.keys(data.versions ?? {}).reverse();
    const timeMap = data.time ?? {};

    let results: VersionInfo[] = versions.map((v) => ({
      version: v,
      date: timeMap[v] ?? '',
      prerelease: /[-+]/.test(v.replace(/^\d+\.\d+\.\d+/, '')),
    }));

    if (stableOnly) results = results.filter((v) => !v.prerelease);
    return results.slice(0, limit);
  }

  async getVersion(name: string, version: string): Promise<VersionDetail> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    const deps: Dependency[] = Object.entries(data.dependencies ?? {}).map(([n, v]) => ({
      name: n,
      version: v as string,
      type: 'runtime' as const,
    }));

    return {
      name: data.name,
      version: data.version,
      date: '',
      license: typeof data.license === 'string' ? data.license : 'Unknown',
      size: data.dist?.unpackedSize ? `${Math.round(data.dist.unpackedSize / 1024)}KB` : 'Unknown',
      dependencies: deps,
      registry: 'npm',
    };
  }

  async getDependencies(
    name: string,
    version: string,
    type: 'runtime' | 'dev' | 'all'
  ): Promise<Dependency[]> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    const deps: Dependency[] = [];
    if (type === 'runtime' || type === 'all') {
      for (const [n, v] of Object.entries(data.dependencies ?? {})) {
        deps.push({ name: n, version: v as string, type: 'runtime' });
      }
    }
    if (type === 'dev' || type === 'all') {
      for (const [n, v] of Object.entries(data.devDependencies ?? {})) {
        deps.push({ name: n, version: v as string, type: 'dev' });
      }
    }
    return deps;
  }

  async getReverseDependencies(name: string, limit: number): Promise<PackageSearchResult[]> {
    const url = `https://registry.npmjs.org/-/v1/search?text=dependencies:${encodeURIComponent(name)}&size=${limit}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    return (data.objects ?? []).map(
      (obj: { package: { name: string; version: string; description?: string } }) => ({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description ?? '',
        downloads: '',
        registry: 'npm' as const,
      })
    );
  }

  async getDownloadStats(name: string, period: string): Promise<DownloadStats> {
    const npmPeriod = period === 'last-year' ? 'last-year' : period;
    const url = `https://api.npmjs.org/downloads/point/${npmPeriod}/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    return {
      name,
      registry: 'npm',
      period,
      total: data.downloads ?? 0,
      breakdown: [],
    };
  }

  async getPackageHealth(name: string): Promise<PackageHealth> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    const latest = data['dist-tags']?.latest ?? '';
    const latestInfo = data.versions?.[latest] ?? {};
    const timeMap = data.time ?? {};
    const lastPublish = timeMap[latest] ?? '';
    const depCount = Object.keys(latestInfo.dependencies ?? {}).length;
    const hasTypings = !!latestInfo.types || !!latestInfo.typings;

    const signals: string[] = [];
    if (hasTypings) signals.push('Has TypeScript typings');
    if (latestInfo.scripts?.test) signals.push('Has test script');
    if (data.readme && data.readme.length > 500) signals.push('Detailed README');

    return {
      name,
      registry: 'npm',
      score: Math.min(10, signals.length * 3 + 4),
      lastPublish,
      dependencyCount: depCount,
      hasTests: !!latestInfo.scripts?.test,
      hasTypings,
      signals,
    };
  }

  async getSecurityAdvisories(name: string, _version?: string): Promise<SecurityAdvisory[]> {
    try {
      const url = 'https://osv.dev/v1/query';
      const body = { package: { name, ecosystem: 'npm' } };
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
          severity?: { type: string; score: string }[];
          references?: { url: string }[];
          affected?: { ranges?: { events?: { introduced?: string; fixed?: string }[] }[] }[];
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
