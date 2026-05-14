<p align="center">
  <img src="logo.png" alt="RegistryX" width="300" height="300" />
</p>

<h1 align="center">RegistryX MCP Server</h1>

<p align="center">
  <em>Unified package registry explorer for AI assistants — npm, PyPI, Maven Central, and crates.io in one tool.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-green.svg" alt="Node.js >= 20" />
  <img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible" />
  <img src="https://img.shields.io/badge/tools-13-orange.svg" alt="13 Tools" />
  <img src="https://img.shields.io/badge/registries-4-teal.svg" alt="4 Registries" />
</p>

---

## Overview

RegistryX is an MCP (Model Context Protocol) server that gives AI assistants a single, consistent interface to search and explore packages across four major ecosystems. Instead of four separate integrations, you get one unified tool with a `registry` parameter.

```
┌──────────────────┐     MCP (stdio)     ┌──────────────────────────────┐
│   AI Client      │ ◄─────────────────► │  RegistryX MCP Server        │
│ (Claude, Copilot)│                     │   (TypeScript/Node)          │
└──────────────────┘                     └────────────┬─────────────────┘
                                              ┌───────┼───────┬──────────┐
                                              ▼       ▼       ▼          ▼
                                           npm     PyPI    Maven    crates.io
```

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`registryx-server`](packages/registryx-server/) | Standalone MCP server, publishable to npm | 0.1.0 |
| [`registryx-vscode-extension`](packages/registryx-vscode-extension/) | VS Code extension for automatic MCP registration | 0.1.0 |

## Tools (13 total)

| Category | Tool | Description |
|----------|------|-------------|
| **Search** | `registryx_search` | Search packages across all registries simultaneously |
| **Search** | `registryx_search_alternatives` | Find equivalent packages in other ecosystems |
| **Package** | `registryx_get_package` | Get metadata, license, keywords |
| **Package** | `registryx_get_readme` | Fetch README content |
| **Package** | `registryx_get_maintainers` | List package authors/maintainers |
| **Versions** | `registryx_list_versions` | List versions with pre-release filter |
| **Versions** | `registryx_get_version` | Details for a specific version |
| **Versions** | `registryx_compare_versions` | Diff two versions (deps added/removed) |
| **Dependencies** | `registryx_get_dependencies` | Runtime, dev, or all dependencies |
| **Dependencies** | `registryx_reverse_dependencies` | Packages that depend on this one |
| **Health** | `registryx_download_stats` | Download counts by time period |
| **Health** | `registryx_package_health` | Health score and maintenance signals |
| **Health** | `registryx_security_advisories` | Known CVEs via OSV.dev |

## Quick Start

### Option A — VS Code Extension (recommended)

Install the VSIX from [Releases](https://github.com/bhayanak/registryx-mcp-server/releases):

```bash
code --install-extension registryx-0.1.0.vsix
```

The MCP server auto-registers in the VS Code MCP Servers panel. Configure via **Settings → RegistryX MCP Server**.

### Option B — npm + mcp.json

```bash
npm install -g registryx-server
```

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "registryx": {
      "type": "stdio",
      "command": "registryx-server"
    }
  }
}
```

### Option C — Claude Desktop

```json
{
  "mcpServers": {
    "registryx": {
      "command": "npx",
      "args": ["registryx-server"]
    }
  }
}
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `REGISTRYX_MCP_REGISTRIES` | `npm,pypi,maven,crates` | Enabled registries |
| `REGISTRYX_MCP_NPM_TOKEN` | — | npm auth token for private packages |
| `REGISTRYX_MCP_TIMEOUT_MS` | `15000` | HTTP request timeout (ms) |
| `REGISTRYX_MCP_CACHE_TTL_MS` | `300000` | In-memory cache TTL (ms, 0 = disabled) |

## Development

```bash
pnpm install
pnpm run ci          # typecheck + lint + format + test:coverage
pnpm run build       # build server + extension
pnpm run package     # build VSIX
```

## License

[MIT](LICENSE)
