# Threat Model

## Project Overview

Koveo Gestion is a production property-management SaaS for Quebec residential communities. It uses a React/Vite frontend, an Express/TypeScript backend, Drizzle/Postgres for persistence, Replit object storage for uploaded files, SendGrid for email, Google/Gemini integrations for document analysis, and an MCP server with OAuth-protected and legacy bearer-token access.

Production entry starts in `server/index.ts`, which applies security middleware and registers routes from `server/routes.ts`. Most sensitive server code lives under `server/api/*`, `server/auth.ts`, `server/mcp/*`, `server/objectStorage.ts`, and document/file services. The client is untrusted. Mock/demo/sandbox behavior is not considered production unless reachable from those production entry points.

Assumptions for this threat model:
- Replit-managed TLS protects browser-to-server traffic in production.
- `NODE_ENV` is `production` in deployed environments.
- Mockup sandbox and local development helpers are not deployed unless wired into production routes.

## Assets

- **User accounts and sessions** — email addresses, password hashes, session cookies, reset tokens, invitation tokens, and role assignments. Compromise enables impersonation and privileged access.
- **Organization, building, residence, billing, maintenance, and communication data** — tenant/resident information, operational records, financial data, and internal workflow state. This is both business-sensitive and privacy-sensitive.
- **Uploaded files and generated object-storage paths** — documents, bills, bug attachments, demand attachments, maintenance documents, and derived metadata. These may contain PII, contracts, invoices, or security-sensitive building information.
- **MCP credentials and OAuth artifacts** — bearer access tokens, client secrets, authorization codes, revocation flows, and the legacy `MCP_API_KEY`. Misuse could expose broad machine-access to production data.
- **Application secrets and third-party credentials** — database URLs, session secret, SendGrid credentials, Gemini API keys, object-storage access, and OAuth signing/verification material.

## Trust Boundaries

- **Browser to Express API** — all client requests are untrusted, including authenticated requests. Every protected route must enforce authentication and authorization server-side.
- **Public to authenticated to privileged users** — the app exposes public marketing/auth endpoints, authenticated tenant/resident endpoints, manager/admin workflows, and MCP machine access. Privilege boundaries must not depend on UI-only checks.
- **Express to PostgreSQL** — the server has broad database access; broken auth, injection, or over-broad queries at the API layer can expose or corrupt most application data.
- **Express to object storage** — presigned uploads, object ACLs, and `/objects/*` downloads cross a storage boundary. File path handling and ACL assignment are security-critical.
- **Express to external services** — SendGrid, Gemini/Google APIs, and MCP/OAuth clients are outside the app trust boundary. User-controlled URLs or redirect targets must not let attackers pivot to internal services or credential misuse.
- **Session-based web auth to bearer-token MCP auth** — the web app uses server-side sessions, while MCP uses OAuth bearer tokens or a legacy static API key. These auth systems must remain isolated and correctly scoped.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/auth.ts`, `server/mcp/index.ts`.
- **Highest-risk areas:** `server/api/users.ts`, `server/api/buildings*`, `server/api/residences.ts`, `server/api/common-spaces.ts`, `server/api/documents.ts`, `server/objectStorage.ts`, `server/mcp/*`.
- **Public surfaces:** health endpoints, `/api`, login/reset/invitation endpoints, `POST /api/users`, `GET /api/demo/users`, `POST /api/trial-requests`, and MCP OAuth discovery/auth endpoints.
- **Privileged surfaces:** manager/admin CRUD under `server/api/*`, document/object download and upload flows, and all `/mcp` tool operations.
- **Usually dev-only / lower priority unless wired into production:** `scripts/`, `tests/`, `server/simple-startup.ts`, standalone middleware not imported by `server/index.ts`, and route files not registered from `server/routes.ts`.

## Threat Categories

### Spoofing

Attackers may target session creation, password reset, invitation acceptance, or MCP bearer tokens to impersonate users or machine clients. The application must ensure passwords are stored only as strong bcrypt hashes, reset and invitation flows do not trust attacker-controlled hosts or headers for security decisions, session cookies remain secure and HTTP-only in production, and MCP access tokens/client secrets are verified exactly as issued.

### Tampering

Clients can submit arbitrary JSON, multipart files, object-storage paths, and role or organization identifiers. The server must validate all user-controlled input, derive sensitive associations server-side, and ensure uploaded files cannot be turned into unauthorized object writes, ACL changes, or cross-tenant document registration.

### Information Disclosure

The platform stores tenant/resident information, internal building records, financial documents, and uploaded files. API responses, object downloads, logs, debug endpoints, and OAuth/MCP error paths must not expose data outside the caller’s organization/building/residence scope, and public endpoints must not leak secrets, tokens, or sensitive internal state.

### Denial of Service

Public auth and onboarding routes, file uploads, AI/document analysis, and OAuth endpoints can be abused to consume email, database, storage, or CPU resources. Production guarantees required here include effective rate limiting on public and credential endpoints, bounded upload sizes, and time/resource controls around expensive background or external-service operations.

### Elevation of Privilege

This application has multiple role and scope layers: public, tenant/resident, manager, admin, organization-scoped access, building-scoped access, residence-scoped access, and MCP-scoped access. The system must enforce those boundaries server-side on every route and tool call. Global-access shortcuts, name-based trust decisions, missing ownership checks, and any path that lets a regular user create or obtain privileged capability are in scope and high priority.
