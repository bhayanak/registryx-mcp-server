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

export class MavenAdapter implements RegistryAdapter {
  readonly name = 'maven' as const;
  constructor(
    private config: Config,
    private cache: Cache
  ) {}

  private parseCoords(name: string): { groupId: string; artifactId: string } {
    const parts = name.split(':');
    if (parts.length !== 2)
      throw new Error(`Maven package must be groupId:artifactId, got: ${name}`);
    return { groupId: parts[0], artifactId: parts[1] };
  }

  async search(query: string, limit: number): Promise<PackageSearchResult[]> {
    const key = `maven:search:${query}:${limit}`;
    const cached = this.cache.get<PackageSearchResult[]>(key);
    if (cached) return cached;

    const url = `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(query)}&rows=${limit}&wt=json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    const results: PackageSearchResult[] = (data.response?.docs ?? []).map(
      (doc: { g: string; a: string; latestVersion: string; p?: string }) => ({
        name: `${doc.g}:${doc.a}`,
        version: doc.latestVersion ?? '',
        description: doc.p ?? '',
        downloads: '',
        registry: 'maven' as const,
      })
    );
    this.cache.set(key, results);
    return results;
  }

  async getPackage(name: string): Promise<PackageMetadata> {
    const key = `maven:pkg:${name}`;
    const cached = this.cache.get<PackageMetadata>(key);
    if (cached) return cached;

    const { groupId, artifactId } = this.parseCoords(name);
    const url = `https://search.maven.org/solrsearch/select?q=g:${encodeURIComponent(groupId)}+AND+a:${encodeURIComponent(artifactId)}&rows=1&wt=json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const doc = data.response?.docs?.[0];
    if (!doc) throw new Error(`Package not found: ${name}`);

    const result: PackageMetadata = {
      name: `${doc.g}:${doc.a}`,
      version: doc.latestVersion ?? '',
      description: doc.p ?? '',
      license: '',
      homepage: '',
      repository: '',
      keywords: [],
      registry: 'maven',
    };
    this.cache.set(key, result);
    return result;
  }

  async getReadme(_name: string): Promise<string> {
    return 'Maven Central does not provide README content via API.';
  }

  async getMaintainers(_name: string): Promise<MaintainerInfo[]> {
    return []; // Maven Central API doesn't expose maintainer info easily
  }

  async listVersions(name: string, limit: number, stableOnly: boolean): Promise<VersionInfo[]> {
    const { groupId, artifactId } = this.parseCoords(name);
    const url = `https://search.maven.org/solrsearch/select?q=g:${encodeURIComponent(groupId)}+AND+a:${encodeURIComponent(artifactId)}&core=gav&rows=${limit * 2}&wt=json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;

    let results: VersionInfo[] = (data.response?.docs ?? []).map(
      (doc: { v: string; timestamp: number }) => ({
        version: doc.v,
        date: doc.timestamp ? new Date(doc.timestamp).toISOString() : '',
        prerelease: /[-.](?:alpha|beta|rc|snapshot|milestone|m\d)/i.test(doc.v),
      })
    );

    if (stableOnly) results = results.filter((v) => !v.prerelease);
    return results.slice(0, limit);
  }

  async getVersion(name: string, version: string): Promise<VersionDetail> {
    const { groupId, artifactId } = this.parseCoords(name);
    const url = `https://search.maven.org/solrsearch/select?q=g:${encodeURIComponent(groupId)}+AND+a:${encodeURIComponent(artifactId)}+AND+v:${encodeURIComponent(version)}&rows=1&wt=json`;
    const res = await registryFetch(url, this.config);
    const data = (await res.json()) as any;
    const doc = data.response?.docs?.[0];
    if (!doc) throw new Error(`Version not found: ${name}@${version}`);

    return {
      name: `${doc.g}:${doc.a}`,
      version: doc.v ?? version,
      date: doc.timestamp ? new Date(doc.timestamp).toISOString() : '',
      license: '',
      size: 'Unknown',
      dependencies: [],
      registry: 'maven',
    };
  }

  async getDependencies(
    _name: string,
    _version: string,
    _type: 'runtime' | 'dev' | 'all'
  ): Promise<Dependency[]> {
    return []; // Maven Central search API doesn't expose dependency info
  }

  async getReverseDependencies(_name: string, _limit: number): Promise<PackageSearchResult[]> {
    return []; // Not available via search API
  }

  async getDownloadStats(name: string, period: string): Promise<DownloadStats> {
    return { name, registry: 'maven', period, total: 0, breakdown: [] };
  }

  async getPackageHealth(name: string): Promise<PackageHealth> {
    return {
      name,
      registry: 'maven',
      score: 5,
      lastPublish: '',
      dependencyCount: 0,
      hasTests: false,
      hasTypings: false,
      signals: ['Available on Maven Central'],
    };
  }

  async getSecurityAdvisories(name: string, _version?: string): Promise<SecurityAdvisory[]> {
    try {
      const { groupId, artifactId } = this.parseCoords(name);
      const url = 'https://osv.dev/v1/query';
      const body = { package: { name: `${groupId}:${artifactId}`, ecosystem: 'Maven' } };
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
