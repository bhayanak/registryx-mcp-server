<p align="center">
  <img src="logo.png" alt="RegistryX" width="300" height="300" />
</p>

<h1 align="center">RegistryX MCP Server</h1>

<p align="center">
  <em>Explore npm, PyPI, Maven Central, and crates.io packages directly from GitHub Copilot Chat</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/VS%20Code-%3E%3D1.99-007ACC.svg" alt="VS Code >= 1.99" />
  <img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible" />
  <img src="https://img.shields.io/badge/tools-13-orange.svg" alt="13 Tools" />
</p>

---

## Features

- **Universal search** — search packages across npm, PyPI, Maven Central, and crates.io simultaneously
- **Cross-registry alternatives** — find the PyPI equivalent of an npm package, or the Rust equivalent of a Java library
- **Version explorer** — list versions, get details, compare two versions with dependency diffs
- **Dependency analysis** — view runtime/dev dependencies and reverse-dependents
- **Health & security** — download stats, health scores, and CVE advisories via OSV.dev
- **Auto-registration** — appears in the VS Code MCP Servers panel immediately after install
- **Settings UI** — configure registries, npm token, timeout, and cache TTL via VS Code settings

## Getting Started

1. Install the extension (VSIX from [Releases](https://github.com/bhayanak/registryx-mcp-server/releases) or the Marketplace)
2. Open the **MCP Servers** panel in VS Code
3. Click **Start** next to **RegistryX**
4. Open GitHub Copilot Chat and start exploring packages

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `registryx.registries` | `npm,pypi,maven,crates` | Enabled registries (comma-separated) |
| `registryx.npmToken` | _(empty)_ | npm auth token for private packages |
| `registryx.timeoutMs` | `15000` | HTTP request timeout in milliseconds |
| `registryx.cacheTtlMs` | `300000` | Cache TTL in milliseconds (0 to disable) |

## Example Prompts

```
Search for JSON schema validation libraries across all registries

What are the top alternatives to express.js in other languages?

Show me the latest stable versions of serde with a release history

Compare lodash v4.17.20 and v4.17.21 — what dependencies changed?

Does log4j 2.14.1 have any known security vulnerabilities?

What packages depend on react?

Get the health score and maintenance signals for requests (PyPI)
```

## Tools

| Tool | What it does |
|------|-------------|
| `registryx_search` | Search packages by name/keyword across registries |
| `registryx_search_alternatives` | Find cross-ecosystem equivalents |
| `registryx_get_package` | Package metadata, license, homepage |
| `registryx_get_readme` | README content |
| `registryx_get_maintainers` | Authors and maintainers |
| `registryx_list_versions` | Version history with pre-release filter |
| `registryx_get_version` | Specific version details |
| `registryx_compare_versions` | Side-by-side version diff |
| `registryx_get_dependencies` | Runtime/dev dependencies |
| `registryx_reverse_dependencies` | Who depends on this package |
| `registryx_download_stats` | Download counts by time period |
| `registryx_package_health` | Health score and signals |
| `registryx_security_advisories` | CVEs via OSV.dev |

## Supported Registries

| Registry | Search | Package | Versions | Deps | Reverse Deps | Stats | Security |
|----------|--------|---------|----------|------|--------------|-------|----------|
| **npm** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PyPI** | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| **Maven Central** | ✅ | ✅ | ✅ | — | — | — | ✅ |
| **crates.io** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Troubleshooting

**Server doesn't appear in MCP panel:**
- Ensure VS Code 1.99 or later
- Run **Developer: Reload Window** and check the MCP Servers panel

**"Registry not enabled" error:**
- Check `registryx.registries` in Settings — the registry must be in the list

**Private npm packages not found:**
- Set `registryx.npmToken` to your npm access token in VS Code settings

## License

[MIT](https://github.com/bhayanak/registryx-mcp-server/blob/main/LICENSE)
