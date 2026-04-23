# Koveo Gestion Development Framework

## Overview
Koveo Gestion is an AI-powered SaaS platform designed for property management in Quebec's residential communities. It provides comprehensive tools for documentation, maintenance, financial planning, and complaint resolution, ensuring compliance with Quebec's Law 25. The platform supports both French and English, targets co-ownership properties, and aims to be an enterprise-grade application with high test coverage and production reliability.

## User Preferences
Preferred communication style: Simple, everyday language.
Working Methodology: **CRITICAL** - Always restart the "Start application" workflow after making code changes and before each checkpoint or testing phase. This ensures the hot reload system properly rebuilds and loads all changes, preventing issues with stale code or missing updates.

## System Architecture

### UI/UX Decisions
The UI is built using Shadcn/ui (Radix UI) and Tailwind CSS for a responsive design, complemented by Lucide React for icons. It features a Hierarchical Navigation HOC with intelligent auto-forwarding and role-based filtering, optimized caching, and a Contextual Help System with keyboard navigation and ARIA attributes. Cascading Filters provide dynamic, data-driven filtering.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation.
- **Backend**: Node.js, Express.js, TypeScript (ES modules) providing a RESTful API.
- **Database**: PostgreSQL with Drizzle ORM and Drizzle Kit.
- **Authentication**: Express sessions with PostgreSQL store, custom username/password, token-based password reset, and multi-step registration with Law 25 consent.
- **Authorization**: Four-tier Role-Based Access Control (RBAC: Admin, Manager, Tenant, Resident) with granular permissions, including building-level access.
- **Demo User System**: Provides comprehensive read-only access for product demonstrations, integrated with backend middleware, frontend error handling, and RBAC.
- **File Storage**: Replit Object Storage with a unified `DocumentService` for DRY document management. All document paths use a consistent `/objects/` prefix and hierarchical structure, with uploads using presigned URLs and ACL-based access control.
- **Internationalization**: Custom language provider for English and French.
- **Testing**: Jest test suite with ts-jest (`isolatedModules: true`) for unit, integration, and API routes. Run unit tests with `npm run test:unit`, integration tests with `npm run test:integration`. Jest config in `jest.config.cjs` (`testTimeout: 3000`, `forceExit: true`, `verbose: false`, cache enabled at `.jest-cache`).

### Feature Specifications
- **Document Management**: Features role-based access, hierarchical storage, secure file access, 30-day quarantine, and categorized upload/download with dynamic filters and automatic folder routing.
- **Property Management**: Includes management for Buildings and Residences with advanced search and sorting. Inventory Management supports UNIFORMAT codes, condition tracking, and lifecycle management.
- **Financial Management**: Includes a Financial Overview Dashboard with budget trend analysis and future projections, Budget Forecast & Capital Investments with intelligent recalculation, and Bill Management supporting single/multiple payments, auto-generation for recurrent bills, and template creation with fiscal year tracking. Project costs are shown as a separate teal chart line (not included in spending line) while still counted in total monthly expense summaries. Punctual revenue growth entries apply from their specified year+month forward (not retroactively).
- **Maintenance Projects**: Provides consistent visibility across pages, displaying unfinished projects, with quick projects and integrated project costs in budget graphs.
- **Bilingual Support**: Full translation for Inventory, Projects, and Bills management pages, compliant with Law 25.
- **Communication & Notification Management**: Features user-level preferences, building-level automated notifications, general broadcast communications with scheduling, and bilingual email templates.
- **LLM Documentation System (v4.0)**: Enhanced documentation generator in Admin > Documentation Center with:
  - Section toggles for customizing output (Schema, Hooks, Testing, Code Patterns, Workflows, APIs, Dependencies)
  - Format selection (Text or Markdown)
  - XML-structured sections for optimal LLM parsing (`<SECTION_NAME>...</SECTION_NAME>`)
  - Enhanced schema analysis with entity-relationship diagrams, foreign key chains, and cascade delete behaviors
  - Hooks & utilities documentation from client/src/hooks and client/src/lib
  - Testing documentation extracted from tests/ directory
  - Code pattern examples for API, React, and database patterns
  - Business workflow documentation with steps, roles, data transformations, and error handling
  - Optimized for Claude and ChatGPT consumption

### System Design Choices
- **Monorepo Structure**: Single workspace for client, server, and shared code.
- **Development Framework (Pillar Methodology)**: Emphasizes modular components, quality assurance, testing, and security, integrated with a hot reload system.
- **Security**: Law 25 compliant, featuring secure database connections, malware detection, input sanitization, SSRF protection, secure error handling, parameterized SQL queries, and environment variable management.
- **Code Consolidation**: Standardized form patterns, unified card components, consolidated form hooks, and shared chart components (`ChartContainer`/`ChartTooltipContent`/`ChartLegendContent` from `ui/chart.tsx`). Shared chart utilities in `lib/chart-colors.ts` (color palette, `buildChartConfig`, `currencyFormatter`). `DualLineChart.tsx` extracts the past/future dual-line rendering pattern used by budget and overview charts. All chart files migrated from raw Recharts `ResponsiveContainer`/`Tooltip` to shared chart components.
- **Query Optimization**: Eliminated N+1 patterns and improved data lookup speeds. `getBillSummary` uses single scoped query instead of two sequential queries. Budget debug logging gated by NODE_ENV.
- **Access Control**: User read endpoints (`GET /api/users/:id`, `GET /api/users/email/:email`) require authentication and object-level authorization (self or admin/manager). `POST /api/users` prevents privilege escalation (admin/manager role creation requires admin session). `GET /api/manager/buildings` uses `requireAuth` middleware. Frontend routes use `ProtectedRoute` component (`client/src/components/common/ProtectedRoute.tsx`) to enforce role-based access: admin routes require `admin` role, manager routes require `manager` role, using `hasRoleOrHigher` from `navigation.ts` role hierarchy. Unauthorized users are redirected to dashboard. Backend migration/diagnostic endpoints in `documents.ts` (`cleanup-enum`, `fix-user-links`, `fix-enum-migration`, `fix-invitations-dependency`, `restore-invitations-default`, `migrate-owner-to-admin`, `remove-all-enum-dependencies`, `restore-all-defaults`, `complete-schema-sync`, `diagnostic`) secured with `requireAuth` + `requireRole(['admin'])`. Demo security via `enforceDemoSecurity()` middleware applied globally on `/api/*`. Intentionally public routes: `GET /api/demo/users` (login page demo list), `POST /api/users` (self-registration with internal privilege guard), `POST /api/invitations/*` (invitation acceptance), `POST /api/trial-requests` (public form).
- **Pre-commit Hooks**: Husky `pre-commit` runs JSDoc templating, lint:fix, and `validate:pre-commit`. When any staged file is under `server/`, it additionally runs `npx tsx scripts/generate-route-manifest.ts --check` to block commits that introduce/modify routes without regenerating `server/route-manifest.json`. On failure, regenerate via `npx tsx scripts/generate-route-manifest.ts` and stage the updated manifest. See CONTRIBUTING.md → Pre-commit Hooks.
- **Schema Debt**: `paymentType` enum/field marked `@deprecated` (use `billType`+`paymentStructure`). `buildingTypeEnum` documents `apartment`/`appartement` duplicate.
- **Filter Organization**: All filter dropdown options are alphabetically sorted.
- **Testing Infrastructure**: Jest-based testing suite (unit + integration). Unit tests use `jest.setup.simple.ts` with DB mocking via `server/__mocks__/db.ts` and `__mocks__/server/db.ts`. DB-dependent unit tests use `jest.mock('../../server/db')` + the `describeIfDb` pattern to skip gracefully when no real DB is available. **Drizzle-orm mock policy**: no package-wide `jest.mock('drizzle-orm*', ...)` calls in any setup file or custom resolver, and no package-level `__mocks__/drizzle-orm*` files (those auto-apply to every importer of `drizzle-orm`/`drizzle-orm/pg-core` and silently break when schemas adopt new column types or chainable methods). Suites that need stubbed drizzle behavior opt in inline via `jest.mock('drizzle-orm', () => require('../manual-mocks/drizzle-orm'))` (and `drizzle-orm/pg-core` analogously); everything else loads the real `drizzle-orm` package. Logger mock at `__mocks__/client/src/lib/logger.ts` is mapped first in `jest.config.cjs` `moduleNameMapper` before the generic `@/` pattern to prevent `import.meta.env` errors in Jest. The standalone `typecheck` workflow can OOM when run alongside tests — run `npx tsc --noEmit` directly when other workflows are stopped.

### MCP Server (Model Context Protocol)
The platform exposes an MCP server at `/mcp` for LLM integration (e.g., Claude Desktop, Cursor). It uses Streamable HTTP transport with API key authentication.

- **Endpoint**: `POST/GET/DELETE /mcp` (Streamable HTTP)
- **Auth**: Bearer token via `Authorization: Bearer <MCP_API_KEY>` header
- **Files**: `server/mcp/server.ts` (tools), `server/mcp/index.ts` (Express integration), `server/mcp/seed-mcp-data.ts` (test data)
- **Scoping**: All access is restricted to two test organizations: MCP-1 (management_company, Montréal) and MCP-2 (syndicate, Québec)
- **Roles**: Each tool accepts a `role` parameter (`admin`, `manager`, `tenant`) to simulate different user perspectives
- **Test Users**: mcp-admin@koveo-mcp.test, mcp-manager@koveo-mcp.test, mcp-tenant@koveo-mcp.test (password: `McpTest2024!`)
- **Seed Data**: 3 buildings, ~13 residences, 4 bills, 4 maintenance requests, 2 demands, 3 common spaces (idempotent seeding — skipped if `MCP-1` org already exists)
- **Production Seeding**: Sandbox seeding is disabled in production by default. To seed once after deployment, set the env var `MCP_SEED_PRODUCTION=true`, deploy (or restart), and verify the `[MCP SEED]` startup logs show "completed successfully" (or "already exists, skipping" on subsequent boots). The flag is safe to leave on — once seeded, the routine is a no-op.
- **Tools (~45)**: list_organizations, get_organization, list_buildings, get_building, create_building, list_residences, get_residence, create_residence, link_user_to_residence, unlink_user_from_residence, list_users, get_user, list_bills, get_bill, create_bill, update_bill_status, list_maintenance_requests, get_maintenance_request, create_maintenance_request, update_maintenance_request, list_demands, get_demand, create_demand, list_common_spaces, list_communications, create_communication, list_meetings, create_meeting, list_documents, list_budgets, list_invoices, get_mcp_info, get_budget_settings, update_budget_settings, add_custom_revenue_line, update_custom_revenue_line, remove_custom_revenue_line, add_punctual_growth, update_punctual_growth, remove_punctual_growth, update_unplanned_bills, list_capital_investments, create_capital_investment, update_capital_investment, delete_capital_investment, get_budget_forecast (budget tools live in `server/mcp/budget-tools.ts`; the forecast tool reuses the exported `forecastHandler` from `server/api/budgets.ts` so MCP and the UI share one calculation pipeline — task #195)
- **Write Error Handling**: Every `server.tool(...)` handler that performs an INSERT, UPDATE, or DELETE MUST wrap the write in `try/catch`, log the full error with `console.error("[mcp:<tool>]", e)`, and return `buildWriteErrorResponse(e, '<entityLabel>', 'create' | 'update' | 'delete')` so raw driver text (SQL, bound parameters) never leaks to the LLM. The 'delete' branch parses the FK `referenced from table "X"` detail and emits `blocking_entity` JSON; create/update parse the `is not present in table "X"` detail and emit `referenced_entity`. Both actions also produce friendly `unique_violation` JSON for code 23505. `buildDeleteErrorResponse` is kept as a backwards-compatible alias for `buildWriteErrorResponse(e, label, 'delete')` (see tasks #239, #242, #243, #244). New write tools added to expand MCP coverage must follow this pattern.
- **Dependencies**: `@modelcontextprotocol/sdk`

### Deployment & Production
- **Deployment Target**: Autoscale (configured in `.replit` `[deployment]` section)
- **Build Command**: `npm run build:production` (runs drizzle-kit push, Vite build, esbuild server bundle)
- **Run Command**: `npm run start` (runs `NODE_ENV=production node dist/index.js`)
- **Rate Limiter**: All `rateLimit()` calls with custom `keyGenerator` require `validate: { keyGeneratorIpFallback: false }` to prevent `express-rate-limit` v7+ IPv6 validation crash in production
- **Health Checks**: `/health`, `/healthz`, `/ready`, `/ping`, `/status`, `/api/health` — all return 200 OK immediately on startup before full app load
- **Startup Strategy**: HTTP server opens port immediately; full application (routes, auth, DB) loads asynchronously in background; scope-cache warmup and query optimization are deferred and non-blocking
- **Debug Logging**: All `[DB DEBUG]`, `[SESSION STORE DB]`, `[MCP SEED]`, and optimization diagnostic logs are silenced in `NODE_ENV=production`; errors are still logged
- **Session Security**: In production, cookies use `secure: true`, `sameSite: 'strict'`, `httpOnly: true`; session secret must be 32+ characters
- **Environment Variables**: See `.env.example` for all required and optional variables

### MCP Tooling
- **Write-Error Envelope (`server/mcp/server.ts` → `buildWriteErrorResponse`)**: All MCP write tools must wrap database failures with this helper. The text payload is a JSON object of shape `{ status, code, retryable, message, pgCode?, referenced_entity?, blocking_entity? }`.
  - **Permanent codes** (LLM callers should surface to the user, not retry — `retryable: false`):
    - `FK_VIOLATION` (PG `23503`) — also includes `referenced_entity` (create/update) or `blocking_entity` (delete).
    - `UNIQUE_VIOLATION` (PG `23505`).
    - `CHECK_VIOLATION` (PG `23514`).
    - `NOT_NULL_VIOLATION` (PG `23502`).
  - **Retryable codes** (LLM callers should retry with exponential backoff — `retryable: true`):
    - `SERIALIZATION_FAILURE` (PG `40001`).
    - `DEADLOCK_DETECTED` (PG `40P01`).
    - `STATEMENT_TIMEOUT` (PG `57014`).
    - `CONNECTION_FAILURE` (PG `08006`, `08001`, `08003`, `08004`).
  - **Unknown/unmapped errors** fall back to the plain string `Failed to {action} {entityLabel} — please retry` (no JSON envelope, no retryable flag).
  - The envelope intentionally excludes the raw driver `message`, `detail`, and stack traces so PII (emails, tokens, file paths, secrets) and schema fragments cannot leak into the LLM transcript. Only the friendly per-action sentence, the stable envelope `code`, and the SQLSTATE are exposed.
- **In-process retry (`server/mcp/server.ts` → `withRetryableDbCall`)**: Every MCP write tool wraps its database call(s) with this helper so transient blips (the same SQLSTATEs flagged `retryable: true` above — `40001`, `40P01`, `57014`, `08006/08001/08003/08004`) are absorbed before the error reaches the LLM. Bounded retries (default 3 attempts) with exponential backoff (`baseDelayMs * 2^(attempt-1)`) plus jitter in `[0, baseDelayMs)`. Non-retryable errors short-circuit on the first failure so `buildWriteErrorResponse` keeps its deterministic envelope behaviour for permanent failures. The retryable SQLSTATE set is exported as `RETRYABLE_PG_CODES` and is verified in tests to match the catalog so the two cannot drift.

## External Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL connector.
- **drizzle-orm**: Type-safe ORM.
- **drizzle-kit**: Schema migration tools.
- **zod**: Runtime type validation.
- **@tanstack/react-query**: Frontend server state management.
- **@radix-ui/**: Accessible UI primitives.
- **@hookform/resolvers**: Form validation integration.
- **tailwindcss**: Utility-first CSS framework.
- **wouter**: Small React routing library.
- **lucide-react**: Icon library.
- **vite**: Frontend build tool.
- **esbuild**: Fast JavaScript bundler.
- **tsx**: TypeScript execution for Node.js.
- **@replit/vite-plugin-***: Replit-specific Vite plugins.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit**: Development and hosting platform.
- **Express.js**: Backend web framework.
- **SendGrid**: Email service.