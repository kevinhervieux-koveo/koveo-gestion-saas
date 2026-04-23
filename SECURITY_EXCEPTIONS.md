# Security Exception Registry

## Residual Dependency Vulnerabilities (Transitive)

The following 13 vulnerabilities (2 low, 11 moderate) cannot be resolved without
making prohibited breaking changes. They are documented here for audit purposes.

### Why They Cannot Be Fixed

Fixing these requires either:
- Adding `"overrides"` to `package.json` (restricted per project guidelines)
- Running `npm audit fix --force` which would **downgrade** `@google-cloud/storage`
  from v7 → v5 and `drizzle-kit` from v0.31 → v0.18 (major breaking regressions)

### Residual Vulnerabilities

#### Group 1: uuid < 14.0.0 (GHSA-w5hq-g745-h8pq) — Moderate
Missing buffer bounds check in v3/v5/v6 when `buf` param is provided.

Affected nested paths:
- `node_modules/@google-cloud/storage/node_modules/uuid@8.3.2`
- `node_modules/gaxios/node_modules/uuid@9.0.1`
- `node_modules/googleapis-common/node_modules/uuid@9.0.1`
- `node_modules/teeny-request/node_modules/uuid@9.0.1`

Root cause: `@google-cloud/storage@7.x` → `teeny-request`, `gaxios`,
`googleapis-common` all pin older uuid. Upstream has not yet released patched
versions within their v7 branch.

Mitigation: Vulnerability only triggers when the `buf` optional parameter is
explicitly passed to `v3`/`v5`/`v6`; normal `uuidv4()` usage is unaffected.

#### Group 2: esbuild <= 0.24.2 (GHSA-67mh-4wv8-2f99) — Moderate
Development server may respond to cross-origin requests.

Affected nested path:
- `node_modules/@esbuild-kit/core-utils@3.3.2/node_modules/esbuild@0.18.20`

Root cause: `drizzle-kit@0.31.x` depends on `@esbuild-kit/esm-loader@2.6.5`
which depends on `@esbuild-kit/core-utils@3.3.2` which uses old esbuild.
The `@esbuild-kit` packages are archived; no fix is forthcoming from upstream.

Mitigation: This esbuild instance is only active during `drizzle-kit` CLI
invocations (database schema push), not during application runtime or the
production build. Exposure is limited to the development environment.

#### Group 3: @tootallnate/once < 3.0.1 (GHSA-vpq2-c234-7xj6) — Low
Incorrect control flow scoping.

Affected nested path:
- `node_modules/teeny-request/node_modules/http-proxy-agent@5.0.0`
  → `@tootallnate/once@2.0.0`

Root cause: Same `@google-cloud/storage` dependency chain as Group 1.

Mitigation: Only triggered through an HTTP proxy agent in the teeny-request
library, which is used for Google Cloud Storage internal HTTP proxying.

### Resolution Plan

Monitor upstream releases of:
- `@google-cloud/storage` (next major after v7) for updated `teeny-request`/`gaxios`
- `drizzle-kit` for removing or updating the `@esbuild-kit` dependency

Re-run `npm audit fix` when upstream packages release updated sub-dependency trees.
