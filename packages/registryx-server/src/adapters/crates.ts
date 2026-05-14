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

export class CratesAdapter implements RegistryAdapter {
  readonly name = 'crates' as const;
  constructor(
    private config: Config,
    private cache: Cache
  ) {}

  async search(query: string, limit: number): Promise<PackageSearchResult[]> {
    const key = `crates:search:${query}:${limit}`;
    const cached = this.cache.get<PackageSearchResult[]>(key);
    if (cached) return cached;

    const url = `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=${limit}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    const results: PackageSearchResult[] = (data.crates ?? []).map(
      (c: { name: string; max_version: string; description?: string; downloads: number }) => ({
        name: c.name,
        version: c.max_version,
        description: c.description ?? '',
        downloads: `${c.downloads} total`,
        registry: 'crates' as const,
      })
    );
    this.cache.set(key, results);
    return results;
  }

  async getPackage(name: string): Promise<PackageMetadata> {
    const key = `crates:pkg:${name}`;
    const cached = this.cache.get<PackageMetadata>(key);
    if (cached) return cached;

    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const crate = data.crate;
    if (!crate) throw new Error(`Crate not found: ${name}`);

    const result: PackageMetadata = {
      name: crate.name,
      version: crate.max_version ?? '',
      description: crate.description ?? '',
      license: '',
      homepage: crate.homepage ?? '',
      repository: crate.repository ?? '',
      keywords: crate.keywords ?? [],
      registry: 'crates',
    };
    this.cache.set(key, result);
    return result;
  }

  async getReadme(name: string): Promise<string> {
    try {
      const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
      const res = await registryFetch(url, this.config);
      const data = (await res.json()) as any;
      // crates.io doesn't return readme in main endpoint; link to it
      return data.crate?.readme ?? `See https://crates.io/crates/${name}`;
    } catch {
      return 'README not available.';
    }
  }

  async getMaintainers(name: string): Promise<MaintainerInfo[]> {
    try {
      const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/owner_user`;
      const res = await registryFetch(url, this.config);
      const data = (await res.json()) as any;
      return (data.users ?? []).map((u: { login: string; name?: string; url?: string }) => ({
        name: u.name ?? u.login,
        url: u.url,
      }));
    } catch {
      return [];
    }
  }

  async listVersions(name: string, limit: number, stableOnly: boolean): Promise<VersionInfo[]> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/versions`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    let results: VersionInfo[] = (data.versions ?? []).map(
      (v: { num: string; created_at: string }) => ({
        version: v.num,
        date: v.created_at,
        prerelease: /[-]/.test(v.num.replace(/^\d+\.\d+\.\d+/, '')),
      })
    );

    if (stableOnly) results = results.filter((v) => !v.prerelease);
    return results.slice(0, limit);
  }

  async getVersion(name: string, version: string): Promise<VersionDetail> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${version}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const v = data.version;
    if (!v) throw new Error(`Version not found: ${name}@${version}`);

    const depUrl = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${version}/dependencies`;
    let deps: Dependency[] = [];
    try {
      const depRes = await registryFetch(depUrl, this.config);
      const depData = (await depRes.json()) as any;
      deps = (depData.dependencies ?? []).map(
        (d: { crate_id: string; req: string; kind: string }) => ({
          name: d.crate_id,
          version: d.req,
          type: d.kind === 'dev' ? ('dev' as const) : ('runtime' as const),
        })
      );
    } catch {
      // Dependencies endpoint might fail
    }

    return {
      name: v.crate ?? name,
      version: v.num ?? version,
      date: v.created_at ?? '',
      license: v.license ?? 'Unknown',
      size: v.crate_size ? `${Math.round(v.crate_size / 1024)}KB` : 'Unknown',
      dependencies: deps,
      registry: 'crates',
    };
  }

  async getDependencies(
    name: string,
    version: string,
    type: 'runtime' | 'dev' | 'all'
  ): Promise<Dependency[]> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${version}/dependencies`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    let deps: Dependency[] = (data.dependencies ?? []).map(
      (d: { crate_id: string; req: string; kind: string }) => ({
        name: d.crate_id,
        version: d.req,
        type: d.kind === 'dev' ? ('dev' as const) : ('runtime' as const),
      })
    );

    if (type !== 'all') {
      deps = deps.filter((d) => d.type === type);
    }
    return deps;
  }

  async getReverseDependencies(name: string, limit: number): Promise<PackageSearchResult[]> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/reverse_dependencies?per_page=${limit}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    return (data.versions ?? []).map((v: { crate: string; num: string }) => ({
      name: v.crate ?? '',
      version: v.num ?? '',
      description: '',
      downloads: '',
      registry: 'crates' as const,
    }));
  }

  async getDownloadStats(name: string, period: string): Promise<DownloadStats> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    return {
      name,
      registry: 'crates',
      period,
      total: data.crate?.downloads ?? 0,
      breakdown: [],
    };
  }

  async getPackageHealth(name: string): Promise<PackageHealth> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const crate = data.crate ?? {};

    const signals: string[] = [];
    if (crate.documentation) signals.push('Has documentation');
    if (crate.repository) signals.push('Has repository');
    if (crate.homepage) signals.push('Has homepage');
    if (crate.description) signals.push('Has description');

    return {
      name,
      registry: 'crates',
      score: Math.min(10, signals.length * 2 + 3),
      lastPublish: crate.updated_at ?? '',
      weeklyDownloads: crate.recent_downloads,
      dependencyCount: 0,
      hasTests: false,
      hasTypings: false,
      signals,
    };
  }

  async getSecurityAdvisories(name: string, _version?: string): Promise<SecurityAdvisory[]> {
    try {
      const url = 'https://osv.dev/v1/query';
      const body = { package: { name, ecosystem: 'crates.io' } };
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
