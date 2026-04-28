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
- **Authorization**: Five-tier Role-Based Access Control (RBAC: Super Admin, Admin, Manager, Tenant, Resident) with granular permissions, including building-level access. `super_admin` is reserved for internal Koveo staff (@koveo-gestion.com) and unlocks all organisations and the Super Admin nav section. Regular `admin` is scoped to their own organisation(s).
- **Demo User System**: Provides comprehensive read-only access for product demonstrations, integrated with backend middleware, frontend error handling, and RBAC.
- **File Storage**: Replit Object Storage with a unified `DocumentService` for DRY document management. All document paths use a consistent `/objects/` prefix and hierarchical structure, with uploads using presigned URLs and ACL-based access control.
- **Internationalization**: Custom language provider for English and French.
- **Testing**: Jest test suite with ts-jest (`isolatedModules: true`) for unit, integration, and API routes. Run unit tests with `npm run test:unit`, integration tests with `npm run test:integration`. Jest config in `jest.config.cjs` (`testTimeout: 3000`, `forceExit: true`, `verbose: false`, cache enabled at `.jest-cache`).

### Feature Specifications
- **Document Management**: Features role-based access, hierarchical storage, secure file access, 30-day quarantine, and categorized upload/download with dynamic filters and automatic folder routing.
- **Property Management**: Includes management for Buildings and Residences with advanced search and sorting. Inventory Management supports UNIFORMAT codes, condition tracking, and lifecycle management. Element history events track edits with full before/after diffs in `element_history_audit_log` (Task #987); the HistoryTable UI shows an "edited" indicator with a tooltip displaying the date and editor name.
- **Financial Management**: Includes a Financial Overview Dashboard with budget trend analysis and future projections, Budget Forecast & Capital Investments with intelligent recalculation, and Bill Management supporting single/multiple payments, auto-generation for recurrent bills, and template creation with fiscal year tracking. Project costs are shown as a separate teal chart line (not included in spending line) while still counted in total monthly expense summaries. Punctual revenue growth entries apply from their specified year+month forward (not retroactively).
- **Maintenance Projects**: Provides consistent visibility across pages, displaying unfinished projects, with quick projects and integrated project costs in budget graphs. `financialYear` is editable on existing projects from two entry points: (1) the standard project form (`client/src/components/maintenance/projects/ProjectForm.tsx`), which submits via `PUT /api/maintenance/projects/:id` (`maintenanceProjectUpdateSchema`), and (2) the workflow modal's Planned tab (`client/src/components/maintenance/projects/workflow/PlannedTab.tsx`), which submits via `PATCH /api/maintenance/projects/:id` (`useUpdateProjectDetails` hook). Both endpoints persist the value as-is on `maintenance_projects.financial_year`. **Invariant**: budgets, dashboards, and reports never store per-project allocation rows — they group costs by `maintenance_projects.financial_year` (and `plannedStartDate`) on demand, so changing the year recomputes spreads on the next forecast read with no migration step. Both save paths invalidate `/api/budgets/forecast` and `['budgetForecast', buildingId]` so the UI refetches against the new year (tasks #1275, #1311).
- **Budget Page Active FY Indicator**: The budget page (`client/src/pages/manager/budget/index.tsx`) shows a prominent "Active fiscal year: [label]" badge (`data-testid="badge-active-fiscal-year"`) in the navigation bar, derived from `useCurrentFinancialYear`. The Year End Projection card tooltip also includes an "Active fiscal year" row (`data-testid="tooltip-year-end-projection-active-fy"`) so users always know which FY the projection targets (task #1311). The tooltip content is extracted to `client/src/pages/manager/budget/YearEndProjectionTooltipContent.tsx` for testability.
- **Project cost placement (budget spread)**: `server/api/project-cost-placement.ts` exports `getProjectCostForMonth(project, year, month)` and `getTotalProjectCostForMonth(projects, year, month)`. These encapsulate the two-rule placement algorithm used inside `forecastHandler` in `server/api/budgets.ts`: (1) projects with `plannedStartDate` land in the matching calendar month; (2) projects with only `financialYear` (no date) land in January of that year. Changing `maintenance_projects.financial_year` moves the project to the new January on the next forecast read — no stored rows to migrate.
- **Bilingual Support**: Full translation for Inventory, Projects, Bills management pages, and all 9 maintenance category labels (`plumbing`, `electrical`, `hvac`, `general`, `elevator`, `landscaping`, `cleaning`, `security`, `other`) in both EN and FR, compliant with Law 25.
- **Resident Self-Service Maintenance**: Residents can submit maintenance requests directly from the resident dashboard or from the My Residence page. The shared `MaintenanceRequestDialog` component (`client/src/components/maintenance/MaintenanceRequestDialog.tsx`) supports category picker, description, priority, and optional photo attachment (stored as base64 data URL in `images` jsonb). The REST endpoint `POST /api/maintenance-requests` (`server/api/auto/maintenance-requests.ts`) accepts an optional `images` array. Category labels use i18n keys so they render in the user's active language.
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
- **Boot-time Trigger Re-application (Task #1439)**: `server/ensure-trigger-migrations.ts` re-applies trigger-only SQL migrations idempotently on every boot as a best-effort drift-repair step. Each file runs inside its own transaction with bounded `SET LOCAL lock_timeout` (default 5 s, env `TRIGGER_REAPPLY_LOCK_TIMEOUT_MS`) and `SET LOCAL statement_timeout` (default 15 s, env `TRIGGER_REAPPLY_STATEMENT_TIMEOUT_MS`). The function **never throws**: on any PG error it logs `code`/SQLSTATE, `message`, `detail`, `hint`, `where`, `schema`, `table`, `constraint` (not the SQL body) and continues to the next file. A summary line (`trigger-only re-application: N ok, M failed: [files]`) is always emitted. Lock-contention variants (55P03/57014) are classified distinctly in the log. `server/index.ts` imports and calls this instead of the old inline implementation; the outer catch has a `setFrontendReady(true)` safety net for non-migration errors so the site never gets permanently stuck on the maintenance screen. Covered by 8-case regression test in `server/tests/ensure-trigger-migrations-non-fatal.test.ts`.
- **Security**: Law 25 compliant, featuring secure database connections, malware detection, input sanitization, SSRF protection, secure error handling, parameterized SQL queries, and environment variable management. **Multi-tenant data isolation hardened (Task #1306)**: `assertBuildingWriteAccess` org-scope guard added to invoice write endpoints (POST/PUT/DELETE) in `server/api/invoices.ts`; common-spaces write endpoints ported from ad-hoc `getAccessibleBuildingIds`+403 to `assertBuildingWriteAccess` in `server/api/common-spaces.ts`; common-spaces booking/calendar read endpoints return 404 (not 403) to avoid existence oracle leaks; `RESIDENCE_BUILDING_MISMATCH` (422) validation added to invoices, and documents' `resolveDocumentContext`; invitation creation (REST + MCP) rejects residenceId from a foreign organization with `RESIDENCE_ORGANIZATION_MISMATCH` (422). Recurring integrity check script at `server/scripts/check-cross-org-assignment-integrity.ts` scans demands/documents/invoices/invitations for cross-org residence drift with optional `--fix` flag.
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
- **FK Blocker Map (Task #1308)**: The `FK_BLOCKER_COLUMN_HINTS` constant maps entity tables (e.g. `buildings`, `residences`, `bills`, `maintenance_projects`, `common_spaces`, `building_elements`) to their blocking child tables, with `filterCol` and `labelCol` hints. After a FK violation (PG error 23503), `queryDeleteBlockers(e, tableName, parentId)` executes a follow-up DB query to retrieve actual blocking record IDs and labels. The `buildWriteErrorResponse` function accepts an optional `blockers` array; when non-empty, it is included in the JSON response as `blockers: [{id, label}]` alongside the existing `blocking_entity` and `message` fields (e.g. "Cannot delete building — 3 residence(s) still reference it."). All 6 delete tool handlers (delete_common_space, delete_inventory_element, delete_building, delete_residence, delete_bill, delete_project) call `queryDeleteBlockers` and pass results to `buildWriteErrorResponse`.
- **Input Validation Guards (Task #1308)**: Property write tools enforce numeric constraints at the MCP input schema layer. `create_building` / `update_building`: `totalUnits ≥ 1`, `totalFloors ≥ 1`, `parkingSpaces ≥ 0`, `storageSpaces ≥ 0`. `create_residence` / `update_residence`: `bedrooms ≥ 0`, `bathrooms ≥ 0`, `monthlyFees ≥ 0`, `squareFootage > 0`. `create_demand_comment`: `commentText` has `.trim().min(1)` guard rejecting empty and whitespace-only strings.
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
- **Production Migration DB URL (Task #936, hardened in Task #1614)**: `npm run migrate` (and `drizzle.production.config.ts`) accept either `DATABASE_URL_KOVEO` or `PRODUCTION_DATABASE_URL` — they are aliases. When `NODE_ENV=production` **or** when running inside a Replit deployment build:
  - The runner prints a banner naming which env var supplied the URL and the masked `host:port/db` it is about to migrate (no credentials).
  - If both prod vars are set, `DATABASE_URL_KOVEO` wins deterministically; if they point at different databases, a loud warning is logged and the alias is ignored.
  - If neither prod var is set, the runner refuses to fall back to `DATABASE_URL` (the dev DB) and exits non-zero so the deploy fails fast instead of silently corrupting prod.
  - **Deploy-context guard**: the runner detects Replit deployment builds via `REPLIT_DEPLOYMENT` (platform-provided) and `IS_DEPLOY_BUILD=true` (set explicitly in the `.replit` build command). In a deploy context, the production branch is forced even if `NODE_ENV` is missing or wrong — the deploy will fail with a clear error if `DATABASE_URL_KOVEO` is not configured.
  - **Prod-equals-dev sanity check**: if the resolved production URL is byte-equal to `DATABASE_URL` (the dev database), the runner throws an error naming both vars and the masked host, catching the operator mistake of copying the dev URL into the production secret.
  - **Required deployment secret**: `DATABASE_URL_KOVEO` (or its alias `PRODUCTION_DATABASE_URL`) MUST be configured as a deployment secret in the Manage → Secrets panel before publishing. The build command pins `IS_DEPLOY_BUILD=true NODE_ENV=production` for the migrate step. This is a one-time operator action.

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
- **MCP delete tools (`delete_building`, `delete_residence`, `delete_bill`, `delete_project`)**: Admin/manager only — tenants are always rejected. Each tool only operates on rows whose owning organization is in the MCP allowlist (`MCP_ORG_NAMES`); out-of-scope ids return `Access denied: ... is not in an MCP-scoped organization`. Authorization, scope, and existence checks are centralized in `authorizeDeleteInMcpScope`. All four tools cascade in application code inside a single transaction so the response can report exact per-table counts (`cascaded.<table>`), and `delete_project` additionally reports `evaluationSuggestionsCleared` for evaluation suggestions whose `projectId` was null-ed out by the DB-level `ON DELETE SET NULL` FK. The tools are auto-enumerated by `get_mcp_info` (it walks `_registeredTools`), so the chat assistant can discover them — including `delete_project` — without any hand-curated list.

## Conflict-Minimizing Feature Convention (READ BEFORE ADDING ANY NEW FEATURE)

The single biggest source of rebase conflicts between parallel tasks has been the small number of "central registry" files that every feature edits in the same place: `server/routes.ts`, `client/src/App.tsx`, `client/src/config/navigation.ts`, `client/src/config/help-content.ts`, `shared/schema.ts`. Two tasks both appending a line to the same block look like a conflict to git even though the additions are logically independent.

To make this rare, the codebase has two **auto-discovery** zones. **For any NEW feature work, use these. Do not edit the central registry files unless you have a documented reason.**

### Backend — `server/api/auto/`
- New API modules: create `server/api/auto/<feature>.ts`.
- Default-export a `(app) => void` registrar.
- Add **one alphabetically-sorted entry** to `server/api/auto/index.ts`:
  - Eager: `widgets: { load: () => import('./widgets') },`
  - Lazy: `widgets: { load: () => import('./widgets'), lazy: { matcher: '/api/widgets' } },` — the module file is NOT imported until the first request matching `matcher` arrives.
- Do NOT add `import { registerXxxRoutes } from './api/<feature>'` or `registerXxxRoutes(app)` calls to `server/routes.ts`. The single `await registerAutoRoutes(app)` already wired in `server/routes.ts` covers everything in the auto folder.
- Background: see `server/api/auto/README.md`. The conflict surface shrinks from a 700-line file to a small registry where each entry is one independent line, sorted alphabetically — git's recursive merge resolves parallel additions automatically in the common case. Two tasks adding the same key still collide, but adjacent additions to different keys do not.

### Frontend — `client/src/pages/auto/`
- New pages: create `client/src/pages/auto/<feature>.tsx`.
- Default-export the page component AND `export const route: AutoPageRoute = { path, role? }`.
- Vite's `import.meta.glob` discovers the file at build time. The page is mounted via `<AutoPageRoutes />` already wired into the main `<Switch>` in `client/src/App.tsx`. **No edits to `App.tsx` are needed.**
- Background: see `client/src/pages/auto/README.md`.

### What still requires editing central files
- Routes that must mount before session middleware (MCP/OAuth) — keep in `server/routes.ts`.
- Sidebar/navigation entries (`client/src/config/navigation.ts`) and contextual help (`client/src/config/help-content.ts`): not yet auto-discovered. Edit them carefully (one-line additions sorted with their existing peers minimize conflict surface).
- Schema additions still require a one-line `export *` in `shared/schema.ts`. Always append at the end of the existing block to keep diffs minimal.

### Migrating existing features
Migration is **explicitly out of scope**. The existing `register*Routes` calls in `server/routes.ts` and the explicit `<Route>` entries in `App.tsx` continue to work unchanged. Only NEW features should use the auto folders. Touching working code just to migrate it would re-introduce the very conflicts the convention is designed to prevent.

## Maintenance Scripts
- `scripts/backfill-bill-ai-fields.ts` (Task #347) — one-shot backfill that re-reads `bills.ai_analysis_data` for legacy AI-extracted bills and populates the post-Task-#338 columns (`issue_date`, `vendor_invoice_number`) plus per-installment `bills.costs` arrays when the JSON exposes a `customPayments` breakdown that sums to `total_amount`. Idempotent: only writes columns currently NULL (or a single-entry `costs` placeholder). Logs scanned/updated counts grouped by organization. Run with `npx tsx scripts/backfill-bill-ai-fields.ts` (add `--dry-run` to log without writing).
- `scripts/normalize-stored-filenames.ts` (Task #394) — one-shot maintenance pass that walks `documents.fileName` and `element_documents.fileName`, runs every stored value through the shared `normalizeFilename` helper (`server/utils/filenameNormalization.ts`), and rewrites rows whose stored value differs. Cleans up legacy filenames uploaded before Tasks #378 / #380 hardened new uploads, so naive Content-Disposition emitters can no longer choke on accents or control characters. Idempotent: a second pass is a no-op once all rows match their normalized form. Logs per-table `scanned / needsUpdate / updated / failed` counts and prints every rename it performs. Run with `npx tsx scripts/normalize-stored-filenames.ts` (add `--dry-run` to log proposed renames without writing).
- `scripts/cleanup-subrepl-refs.sh` (Task #1124) — prunes the `subrepl-*` local branches and remotes that Replit sub-agents auto-create on every isolated task run. Without it `.git/config` and `.git/packed-refs` accumulate hundreds of stale refs and slow every git operation down. Wired into `scripts/post-merge.sh` so cleanup happens automatically after every task merge; also runnable manually with `bash scripts/cleanup-subrepl-refs.sh` (or `--dry-run` to preview). Skips the currently-checked-out branch and never fails the caller.

## Document Tags
- `document_tags` and `document_tag_assignments` tables (`shared/schemas/documents.ts`).
- System "Koveo" tags (organizationId NULL, isSystem=true) auto-seeded by `seedKoveoDocumentTags` on startup (idempotent on isSystem+name) — covers CCQ / Loi 16 obligations in French.
- API: CRUD at `/api/document-tags` plus assign/unassign on `/api/documents/:id/tags` (server/api/document-tags.ts).
- GET /api/documents and /api/documents/:id include a `tags` array per document.
- UI: Admin-only page at `/admin/document-tags`, multi-select TagPicker on document create/edit, tag chips and tag filter on the unified document wrapper.
- MCP tools: list/create/update/delete document tags + assign/unassign on documents.

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
## Schema-drift guard
- `scripts/check-migration-coverage.ts` compares `shared/schema.ts` against the cumulative `migrations/*.sql` set by spinning up two ephemeral PGlite databases (one applies the migrations, the other applies `drizzle-kit export` of the schema) and diffing tables, columns, enums, primary keys, and unique constraints via `information_schema`.
- Wired into `.husky/pre-commit` (runs only when `shared/schemas/*` or `migrations/NNNN_*.sql` are staged) and `.github/workflows/migration-coverage-check.yml`.
- Pure helpers (`splitSqlStatements`, `diff`, `hasDrift`, `formatReport`) are covered by `tests/unit/check-migration-coverage.test.ts`.

## Bulk Document Import (Task #451)
- Admin-only page at `/admin/bulk-document-import` walks the user through a five-step AI-assisted onboarding pipeline (screening → sorting → branching → identification → linking) for one building.
- Backend at `server/api/bulk-import.ts` (REST) and `server/mcp/bulk-import-tools.ts` (MCP) drive the pipeline. Files are staged under `.staging/bulk-import/<sessionId>/` and never enter the real `documents` table until the linking step accepts them.
- AI is wrapped in `server/services/bulk-import-analyzer.ts` (Anthropic Claude). Falls back to deterministic low-confidence stubs when `ANTHROPIC_API_KEY` is missing.
- Schema lives in `shared/schemas/bulk-import.ts` (`bulk_import_sessions`, `bulk_import_items`, `client_document_fingerprints`, `client_excluded_fingerprints`); migrations `migrations/0009_bulk_document_import.sql` and `migrations/0011_excluded_fingerprints.sql`.
- Per-org dedup via `client_document_fingerprints (organization_id, content_hash)` unique index.
- **Exclusion memory (Task #847)**: `client_excluded_fingerprints (organization_id, content_hash)` remembers which files an org has manually excluded. On upload the handler checks this table (after the duplicate check); matching files are created with `status='rejected'`, `preExcludeStatus='pending'`, `excludeSource='prior_session'` so they never enter the AI pipeline. Un-excluding removes the persisted fingerprint in the same transaction. The UI shows "Previously excluded" instead of "Excluded" for auto-excluded items.
- Sessions auto-resume via `localStorage` (`bulkImportActiveSessionId`) and a server-side `currentStep` field.
- Bilingual help entry registered in `client/src/config/help-content.ts`; navigation entry in `client/src/config/navigation.ts` (admin only).
- **Residence picker (Task #780)**: In the Sorting/branching step, items routed to `residence_documents` must have a residence selected before advancing. `BranchResult` carries 5 residence fields (`residenceId`, `residenceName`, `residenceUnit`, `residenceAiSuggested`, `residenceManualOverride`). AI attempts to pick a residence from the building list. The frontend shows a per-row badge (blue=assigned, red=missing) and an expandable Select picker with Save/Clear; `NextStepBlock` blocks Next until all `residence_documents` items have a residence. Backend endpoint `POST /api/bulk-import/sessions/:id/items/:itemId/set-residence` validates and persists the choice; `residenceId` is passed through to the `documents` insert at commit time.
- **AI residence suggestion chip (Task #803)**: Each `residence_documents` row whose current pick is still the AI's original guess shows a small violet "AI" chip next to the residence badge so admins can spot AI picks without opening every picker. The bookkeeping lives in `branchDecision.residenceAiSuggestedId` (the AI's first pick — preserved across admin overrides) and `residenceAiConfirmed`. The `lite` endpoint exposes a derived boolean `residenceAiSuggested` (true when the current pick still matches the AI's guess and the admin hasn't yet confirmed or manually overridden it). Saving the AI's value via the per-row picker flips `residenceAiConfirmed: true`; the bulk endpoint `POST /api/admin/bulk-import/sessions/:id/items/confirm-ai-residences` does the same flip in batch and powers the "Review all AI suggestions" banner shown at the top of the branching step when one or more pending AI picks exist.

## Generic KPI events (Task #1406)
- Telemetry for product KPIs lives in the generic `kpi_events` table (`shared/schemas/kpi.ts`, migration `migrations/0028_kpi_events.sql`). Each row carries `metricKey`, `outcome`, optional `organizationId`/`userId`, and free-form `dimensions`/`payload` JSONB so new KPIs can be added without schema changes.
- The first KPI is `bulk_import.filename_suggestion` (constant `BULK_IMPORT_FILENAME_METRIC_KEY`): when an admin commits a sorting decision the bulk-import endpoint writes one row per final filename via `recordKpiEvent` (`server/services/kpi.ts`). Outcomes: `verbatim`, `edited`, `cleared`, `manual_no_suggestion`, `empty_no_suggestion`. Dimensions include `decision`, `branch`, `subCategory`, `mimeType`, `language` (from the new `uiLanguage` field on `setSortingDecisionSchema`), and optional `part: 0|1` for split rows. Inserts are fire-and-forget and never block the user-facing response.
- Read API: `GET /api/admin/kpi/bulk-import-filename-suggestions?sinceDays=N` (admin-gated, default 90 days) returns rows grouped by `(language, branch)` with totals + `acceptRate = verbatim / (verbatim + edited + cleared)`.
- Admin dashboard at `/admin/kpi-dashboard` (`client/src/pages/admin/kpi-dashboard.tsx`) renders an overall summary plus per-language and per-branch breakdown tables; nav entry registered in the admin section.

## Guided Tour / Onboarding System (Task #1572)
- Feature-flagged behind `ONBOARDING_ENABLED` (ON in dev/test, OFF in prod by default). Frontend flag: `VITE_ONBOARDING_ENABLED !== 'false'`.
- **DB**: 3 tables in `shared/schemas/onboarding.ts` — `onboarding_progress`, `onboarding_versions`, `onboarding_feature_manifest`; migration `migrations/0034_onboarding_tables.sql` (backfills existing users as 'skipped').
- **Backend**: 5 REST endpoints at `server/api/auto/onboarding.ts` (`GET /me`, `GET /catalog`, `POST /progress`, `POST /restart`, `GET /health`). Tour catalog definition in `server/api/auto/onboarding-content.ts`.
- **Frontend engine**: `client/src/contexts/OnboardingContext.tsx` — wraps driver.js, auto-starts pending tours after login, shows a ResumableFloater for in-progress tours. Provider added to `AuthenticatedLayout`.
- **Smoke tour**: step content in `client/src/content/onboarding/smoke.ts`. `data-onboarding` anchors on: `[data-onboarding="dashboard.header"]` (all Header variants in overview.tsx) and `[data-onboarding="settings.onboarding.link"]` (sidebar nav item).
- **Settings sub-page**: `/settings/onboarding` via `client/src/pages/auto/settings-onboarding.tsx` — lists tours with status badges, per-tour restart button, restart-all button, "What's new" card when content is updated.
- **Sidebar**: `helpOnboarding` nav item added to the Settings section in `client/src/config/navigation.ts`; `dataOnboarding` optional field added to `NavigationItem`; sidebar renders `data-onboarding` attribute when present.
- **Freshness monitor**: `scripts/onboarding-health.ts` — static analysis for uncovered required features, stale anchors, version skew. Exit non-zero if uncovered required features found.
- **E2E spec**: `tests/e2e/onboarding.base.e2e.test.ts` — Puppeteer test covering auto-start, step navigation, completion persistence, reload suppression, Settings page access, restart flow, and resume-after-navigation.
- **CONTRIBUTING.md**: Onboarding section added (anchor convention, tour authoring guide, freshness monitor, REST API table).
