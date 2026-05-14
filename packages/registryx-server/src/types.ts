export type RegistryName = 'npm' | 'pypi' | 'maven' | 'crates';

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  downloads: string;
  registry: RegistryName;
}

export interface PackageMetadata {
  name: string;
  version: string;
  description: string;
  license: string;
  homepage: string;
  repository: string;
  keywords: string[];
  registry: RegistryName;
}

export interface VersionInfo {
  version: string;
  date: string;
  prerelease: boolean;
}

export interface VersionDetail {
  name: string;
  version: string;
  date: string;
  license: string;
  size: string;
  dependencies: Dependency[];
  registry: RegistryName;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'optional' | 'build';
}

export interface DownloadStats {
  name: string;
  registry: RegistryName;
  period: string;
  total: number;
  breakdown: { date: string; downloads: number }[];
}

export interface MaintainerInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface SecurityAdvisory {
  id: string;
  title: string;
  severity: string;
  url: string;
  affectedVersions: string;
}

export interface PackageHealth {
  name: string;
  registry: RegistryName;
  score: number;
  lastPublish: string;
  openIssues?: number;
  weeklyDownloads?: number;
  dependencyCount: number;
  hasTests: boolean;
  hasTypings: boolean;
  signals: string[];
}

export interface RegistryAdapter {
  readonly name: RegistryName;
  search(query: string, limit: number): Promise<PackageSearchResult[]>;
  getPackage(name: string): Promise<PackageMetadata>;
  getReadme(name: string): Promise<string>;
  getMaintainers(name: string): Promise<MaintainerInfo[]>;
  listVersions(name: string, limit: number, stableOnly: boolean): Promise<VersionInfo[]>;
  getVersion(name: string, version: string): Promise<VersionDetail>;
  getDependencies(
    name: string,
    version: string,
    type: 'runtime' | 'dev' | 'all'
  ): Promise<Dependency[]>;
  getReverseDependencies(name: string, limit: number): Promise<PackageSearchResult[]>;
  getDownloadStats(name: string, period: string): Promise<DownloadStats>;
  getPackageHealth(name: string): Promise<PackageHealth>;
  getSecurityAdvisories(name: string, version?: string): Promise<SecurityAdvisory[]>;
}
