import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Config } from './config.js';
import type { RegistryAdapter, RegistryName } from './types.js';
import { Cache } from './cache.js';
import { NpmAdapter, PypiAdapter, MavenAdapter, CratesAdapter } from './adapters/index.js';
import { formatNumber, padRight, truncate } from './utils/format.js';

function buildAdapters(config: Config, cache: Cache): Map<RegistryName, RegistryAdapter> {
  const map = new Map<RegistryName, RegistryAdapter>();
  const factories: Record<RegistryName, () => RegistryAdapter> = {
    npm: () => new NpmAdapter(config, cache),
    pypi: () => new PypiAdapter(config, cache),
    maven: () => new MavenAdapter(config, cache),
    crates: () => new CratesAdapter(config, cache),
  };
  for (const reg of config.registries) {
    map.set(reg, factories[reg]());
  }
  return map;
}

function getAdapter(
  adapters: Map<RegistryName, RegistryAdapter>,
  name: RegistryName
): RegistryAdapter {
  const adapter = adapters.get(name);
  if (!adapter)
    throw new Error(
      `Registry "${name}" is not enabled. Enabled: ${[...adapters.keys()].join(', ')}`
    );
  return adapter;
}

function getAdaptersForRegistry(
  adapters: Map<RegistryName, RegistryAdapter>,
  registry: string
): RegistryAdapter[] {
  if (registry === 'all') return [...adapters.values()];
  return [getAdapter(adapters, registry as RegistryName)];
}

const registryEnum = z.enum(['npm', 'pypi', 'maven', 'crates']);
const registryOrAll = z.enum(['npm', 'pypi', 'maven', 'crates', 'all']).default('all');

export function createServer(config: Config): McpServer {
  const cache = new Cache(config.cacheTtlMs);
  const adapters = buildAdapters(config, cache);

  const server = new McpServer({
    name: 'registryx',
    version: '0.1.0',
  });

  // ── 1. registryx_search ──
  server.tool(
    'registryx_search',
    'Search packages across npm, PyPI, Maven Central, and crates.io registries',
    {
      query: z.string().describe('Package search text'),
      registry: registryOrAll.describe('Registry to search (default: all)'),
      limit: z.number().min(1).max(50).default(10).describe('Max results per registry'),
    },
    async ({ query, registry, limit }) => {
      const targets = getAdaptersForRegistry(adapters, registry);
      const sections: string[] = [`RegistryX Search — "${query}"\n`];

      const results = await Promise.allSettled(
        targets.map(async (a) => ({ name: a.name, results: await a.search(query, limit) }))
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { name, results: pkgs } = r.value;
          sections.push(`📦 ${name} (${pkgs.length} results):`);
          for (const p of pkgs) {
            sections.push(
              `  ${padRight(p.name, 30)} ${padRight(p.version, 12)} ${p.downloads ? padRight(p.downloads, 14) : ''}${truncate(p.description, 60)}`
            );
          }
          sections.push('');
        } else {
          sections.push(`❌ Error: ${r.reason}`);
        }
      }

      return { content: [{ type: 'text', text: sections.join('\n') }] };
    }
  );

  // ── 2. registryx_search_alternatives ──
  server.tool(
    'registryx_search_alternatives',
    'Find equivalent packages across different registries',
    {
      packageName: z.string().describe('Package name to find alternatives for'),
      sourceRegistry: registryEnum.describe('Registry the package is from'),
      targetRegistries: z.array(registryEnum).optional().describe('Registries to search in'),
    },
    async ({ packageName, sourceRegistry, targetRegistries }) => {
      const source = getAdapter(adapters, sourceRegistry);
      const pkg = await source.getPackage(packageName);
      const searchTerms = [pkg.name.replace(/[^a-zA-Z0-9 ]/g, ' '), ...pkg.keywords.slice(0, 3)];
      const query = searchTerms.join(' ');

      const targets = targetRegistries
        ? targetRegistries.filter((r) => r !== sourceRegistry).map((r) => getAdapter(adapters, r))
        : [...adapters.values()].filter((a) => a.name !== sourceRegistry);

      const sections: string[] = [
        `Alternatives for "${packageName}" (${sourceRegistry}): ${pkg.description}\n`,
      ];

      const results = await Promise.allSettled(
        targets.map(async (a) => ({ name: a.name, results: await a.search(query, 5) }))
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { name, results: pkgs } = r.value;
          sections.push(`📦 ${name}:`);
          for (const p of pkgs) {
            sections.push(
              `  ${padRight(p.name, 30)} ${padRight(p.version, 12)} ${truncate(p.description, 60)}`
            );
          }
          sections.push('');
        }
      }

      return { content: [{ type: 'text', text: sections.join('\n') }] };
    }
  );

  // ── 3. registryx_get_package ──
  server.tool(
    'registryx_get_package',
    'Get detailed package metadata from a registry',
    {
      name: z.string().describe('Package name (Maven: groupId:artifactId)'),
      registry: registryEnum.describe('Package registry'),
    },
    async ({ name, registry }) => {
      const adapter = getAdapter(adapters, registry);
      const pkg = await adapter.getPackage(name);
      const lines = [
        `📦 ${pkg.name} v${pkg.version} (${pkg.registry})`,
        `Description: ${pkg.description}`,
        `License: ${pkg.license}`,
        `Homepage: ${pkg.homepage || 'N/A'}`,
        `Repository: ${pkg.repository || 'N/A'}`,
        `Keywords: ${pkg.keywords.join(', ') || 'N/A'}`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 4. registryx_get_readme ──
  server.tool(
    'registryx_get_readme',
    'Get README content for a package',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
    },
    async ({ name, registry }) => {
      const adapter = getAdapter(adapters, registry);
      const readme = await adapter.getReadme(name);
      return { content: [{ type: 'text', text: truncate(readme, 8000) }] };
    }
  );

  // ── 5. registryx_get_maintainers ──
  server.tool(
    'registryx_get_maintainers',
    'Get package maintainers/authors',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
    },
    async ({ name, registry }) => {
      const adapter = getAdapter(adapters, registry);
      const maintainers = await adapter.getMaintainers(name);
      if (maintainers.length === 0)
        return { content: [{ type: 'text', text: 'No maintainer info available.' }] };
      const lines = [`Maintainers for ${name} (${registry}):`];
      for (const m of maintainers) {
        lines.push(`  👤 ${m.name}${m.email ? ` <${m.email}>` : ''}${m.url ? ` (${m.url})` : ''}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 6. registryx_list_versions ──
  server.tool(
    'registryx_list_versions',
    'List available versions for a package',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
      limit: z.number().min(1).max(100).default(20).describe('Max versions to return'),
      stable: z.boolean().default(true).describe('Exclude pre-release versions'),
    },
    async ({ name, registry, limit, stable }) => {
      const adapter = getAdapter(adapters, registry);
      const versions = await adapter.listVersions(name, limit, stable);
      const lines = [`Versions for ${name} (${registry}) — ${stable ? 'stable only' : 'all'}:`];
      for (const v of versions) {
        lines.push(
          `  ${padRight(v.version, 20)} ${v.date ? v.date.split('T')[0] : ''}${v.prerelease ? ' [pre]' : ''}`
        );
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 7. registryx_get_version ──
  server.tool(
    'registryx_get_version',
    'Get details for a specific package version',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
      version: z.string().describe('Version string'),
    },
    async ({ name, registry, version }) => {
      const adapter = getAdapter(adapters, registry);
      const vd = await adapter.getVersion(name, version);
      const lines = [
        `📦 ${vd.name} v${vd.version} (${vd.registry})`,
        `Date: ${vd.date || 'Unknown'}`,
        `License: ${vd.license}`,
        `Size: ${vd.size}`,
        `Dependencies: ${vd.dependencies.length}`,
      ];
      if (vd.dependencies.length > 0) {
        lines.push('');
        for (const d of vd.dependencies.slice(0, 20)) {
          lines.push(`  ${d.type === 'dev' ? '[dev] ' : ''}${d.name} ${d.version}`);
        }
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 8. registryx_compare_versions ──
  server.tool(
    'registryx_compare_versions',
    'Compare two versions of a package',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
      version1: z.string().describe('First version'),
      version2: z.string().describe('Second version'),
    },
    async ({ name, registry, version1, version2 }) => {
      const adapter = getAdapter(adapters, registry);
      const [v1, v2] = await Promise.all([
        adapter.getVersion(name, version1),
        adapter.getVersion(name, version2),
      ]);

      const deps1 = new Set(v1.dependencies.map((d) => d.name));
      const deps2 = new Set(v2.dependencies.map((d) => d.name));
      const added = [...deps2].filter((d) => !deps1.has(d));
      const removed = [...deps1].filter((d) => !deps2.has(d));

      const lines = [
        `Comparing ${name} v${version1} ↔ v${version2} (${registry})`,
        '',
        `  v${version1}: ${v1.date || 'Unknown'} | ${v1.license} | ${v1.size} | ${v1.dependencies.length} deps`,
        `  v${version2}: ${v2.date || 'Unknown'} | ${v2.license} | ${v2.size} | ${v2.dependencies.length} deps`,
      ];

      if (added.length > 0) lines.push(`\n  ➕ Added: ${added.join(', ')}`);
      if (removed.length > 0) lines.push(`  ➖ Removed: ${removed.join(', ')}`);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 9. registryx_get_dependencies ──
  server.tool(
    'registryx_get_dependencies',
    'Get package dependencies',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
      version: z.string().optional().describe('Version (latest if omitted)'),
      type: z.enum(['runtime', 'dev', 'all']).default('runtime').describe('Dependency type'),
    },
    async ({ name, registry, version, type }) => {
      const adapter = getAdapter(adapters, registry);
      const ver = version ?? (await adapter.getPackage(name)).version;
      const deps = await adapter.getDependencies(name, ver, type);
      if (deps.length === 0)
        return {
          content: [{ type: 'text', text: `No ${type} dependencies found for ${name}@${ver}.` }],
        };

      const lines = [`Dependencies for ${name}@${ver} (${registry}, ${type}):`];
      for (const d of deps) {
        lines.push(`  ${d.type === 'dev' ? '[dev] ' : ''}${padRight(d.name, 30)} ${d.version}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 10. registryx_reverse_dependencies ──
  server.tool(
    'registryx_reverse_dependencies',
    'Find packages that depend on this one',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
      limit: z.number().min(1).max(100).default(20).describe('Max results'),
    },
    async ({ name, registry, limit }) => {
      const adapter = getAdapter(adapters, registry);
      const rdeps = await adapter.getReverseDependencies(name, limit);
      if (rdeps.length === 0)
        return {
          content: [
            {
              type: 'text',
              text: `No reverse dependency data available for ${name} on ${registry}.`,
            },
          ],
        };

      const lines = [`Packages that depend on ${name} (${registry}):`];
      for (const p of rdeps) {
        lines.push(`  ${padRight(p.name, 30)} ${p.version}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 11. registryx_download_stats ──
  server.tool(
    'registryx_download_stats',
    'Get download statistics for a package',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
      period: z
        .enum(['last-day', 'last-week', 'last-month', 'last-year'])
        .default('last-month')
        .describe('Time period'),
    },
    async ({ name, registry, period }) => {
      const adapter = getAdapter(adapters, registry);
      const stats = await adapter.getDownloadStats(name, period);
      const lines = [
        `📊 Download stats for ${name} (${registry})`,
        `Period: ${stats.period}`,
        `Total: ${formatNumber(stats.total)}`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 12. registryx_package_health ──
  server.tool(
    'registryx_package_health',
    'Get package health score and maintenance signals',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
    },
    async ({ name, registry }) => {
      const adapter = getAdapter(adapters, registry);
      const health = await adapter.getPackageHealth(name);
      const lines = [
        `🏥 Health for ${name} (${registry})`,
        `Score: ${health.score}/10`,
        `Last publish: ${health.lastPublish || 'Unknown'}`,
        `Dependencies: ${health.dependencyCount}`,
        `Has typings: ${health.hasTypings ? '✅' : '❌'}`,
        `Has tests: ${health.hasTests ? '✅' : '❌'}`,
        '',
        'Signals:',
        ...health.signals.map((s) => `  ✅ ${s}`),
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // ── 13. registryx_security_advisories ──
  server.tool(
    'registryx_security_advisories',
    'Check for security advisories (via OSV.dev)',
    {
      name: z.string().describe('Package name'),
      registry: registryEnum.describe('Package registry'),
      version: z.string().optional().describe('Specific version to check'),
    },
    async ({ name, registry, version }) => {
      const adapter = getAdapter(adapters, registry);
      const advisories = await adapter.getSecurityAdvisories(name, version);
      if (advisories.length === 0) {
        return {
          content: [
            { type: 'text', text: `✅ No known security advisories for ${name} (${registry}).` },
          ],
        };
      }
      const lines = [`🔒 Security advisories for ${name} (${registry}):`];
      for (const a of advisories) {
        lines.push(`  ⚠️ ${a.id}: ${a.title}`);
        lines.push(`     Severity: ${a.severity} | ${a.url}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  return server;
}
