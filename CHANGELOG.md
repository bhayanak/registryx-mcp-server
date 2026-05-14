# Changelog

All notable changes to the RegistryX MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-13

### Added
- Initial release of RegistryX MCP Server
- 13 MCP tools for unified package registry access
- **Registry adapters** for npm, PyPI, Maven Central, and crates.io
- **Universal search** across all registries simultaneously (`registryx_search`)
- **Cross-registry alternatives** discovery (`registryx_search_alternatives`)
- **Package metadata** retrieval (`registryx_get_package`)
- **README** fetching (`registryx_get_readme`)
- **Maintainer** info (`registryx_get_maintainers`)
- **Version listing** with pre-release filtering (`registryx_list_versions`)
- **Version details** (`registryx_get_version`)
- **Version comparison** with dependency diff (`registryx_compare_versions`)
- **Dependency analysis** by type (`registryx_get_dependencies`)
- **Reverse dependency** lookup (`registryx_reverse_dependencies`)
- **Download statistics** (`registryx_download_stats`)
- **Package health** scoring (`registryx_package_health`)
- **Security advisories** via OSV.dev (`registryx_security_advisories`)
- In-memory cache with configurable TTL
- SSRF protection — only allowed registry hosts
- VS Code extension with auto-registration and settings UI
- CI pipeline with Node 20/22 matrix, coverage, lint, format checks
- Release workflow for npm + GitHub Release with VSIX
