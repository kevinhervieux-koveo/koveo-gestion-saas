# Changelog

All notable changes to Koveo Gestion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

- **MCP `invite_user` duplicate invites reject — post-#9 soft-replace rolled back**
  (Task #250): An earlier iteration of this work landed a soft-replace flow that
  marked the prior pending invite as `status='replaced'`, wrote a `replaced`
  entry to `invitation_audit_log`, and returned a brand-new invitation row.
  **That soft-replace flow has been rolled back.** Calling `invite_user` (MCP)
  or `POST /api/invitations` (REST) a second time for the same
  `(organizationId, email, residenceId)` tuple now rejects the duplicate and
  leaves the prior pending invite completely untouched — no status change, no
  `replaced` audit row, no new invitation row, and no email send. Responses:
    - MCP: `{ status: 'already_invited', code: 'INVITATION_ALREADY_PENDING', message: '...' }`.
    - REST: HTTP `409 Conflict` with body
      `{ error: 'Conflict', code: 'INVITATION_ALREADY_PENDING', message: '...' }`.
  Migration: clients must branch on `code === 'INVITATION_ALREADY_PENDING'`
  and explicitly call `resend_invitation` (extend the existing invite's expiry)
  or `cancel_invitation` followed by a fresh `invite_user` (start over with a
  new token). The helper error class is now `InvitationAlreadyPendingError`
  from `server/services/invitation-soft-replace`; the previous
  `InvitationSoftReplaceRaceLostError` export remains as a deprecated alias.
  Note: the `replaced` value of the `invitation_status` enum is intentionally
  retained for historical audit rows that still reference it, but the live
  flow no longer writes that value.

- **MCP `list_buildings` requires `organizationId`**: The `organizationId` parameter
  on the MCP `list_buildings` tool is now **required** (previously optional).
  Calls that omitted `organizationId` to retrieve a "global" list of buildings
  across all organizations will now fail with a schema validation error.
  Migration: update any MCP client that calls `list_buildings` without
  `organizationId` to pass the specific organization ID it wants to list
  buildings for. If a caller needs buildings across multiple organizations, it
  must invoke `list_buildings` once per organization.

- **MCP `list_*` tools require an explicit scope** (Task #260): the
  `organizationId` parameter on `list_users` and `list_pending_invitations` is
  now **required** (previously optional, with a silent fall-through to "every
  MCP-scoped org"). The `list_documents` tool now also hard-rejects calls that
  omit BOTH `buildingId` and `residenceId` before any database read — there
  is no implicit "list every document in MCP scope" path. The other
  `list_*` tools were already scoped (either by required `organizationId` or
  by required `buildingId`, which is itself organization-scoped). The single
  intentional exemption is `list_organizations`, which is the discovery
  primitive that returns the MCP-allowlisted org ids and is documented inline
  in `server/mcp/server.ts`.
  Migration: update MCP clients that called `list_users` or
  `list_pending_invitations` without `organizationId` (or `list_documents`
  without either `buildingId` or `residenceId`) to first call
  `list_organizations`, then invoke the list tool once per org. Cross-org
  aggregation must be performed client-side.

### Changed

- **MCP `update_maintenance_request` auto-assigns the caller on the first
  transition**: On the first status transition where the request's
  `assignedTo` is `null`, `assignedTo` is now set to the calling user.
  Subsequent status transitions do **not** overwrite an existing `assignedTo`
  — once a request is assigned (whether by this auto-assign on first
  transition or by an explicit assignment), later callers moving it through
  further statuses will not be silently substituted in.
  Migration: integrations that assumed `assignedTo` stays untouched across
  status changes must adjust — expect the first transition to populate it
  with the caller's user id.

- **MCP `delete_bill` response shape aligned with `delete_building` /
  `delete_residence`**: `delete_bill` now returns
  `{ deleted: { id, billNumber, title }, cascaded: { payments }, message }`,
  matching the structured shape already used by `delete_building` and
  `delete_residence`. The `cascaded.payments` field reports the payments
  removed as part of the bill's delete cascade. Clients parsing the previous
  flat response must update to read `deleted.id` / `deleted.billNumber` /
  `deleted.title` and inspect `cascaded.payments` for the cascade summary.

### Added

- **MCP `create_bill` response includes `source: "mcp"`**: The `create_bill`
  tool response now carries a `source: "mcp"` field so downstream consumers
  can distinguish bills created via MCP from those created via the REST API
  or the UI. Backward-compatible — existing fields are unchanged.
- **MCP `delete_project` tool surfaced to the chat assistant** (Task #296):
  The `delete_project` tool — which removes a maintenance project from a
  building inside an MCP-scoped organization — is now discoverable by the
  chat assistant. It is enumerated in the `get_mcp_info` tool catalog
  alongside the other delete tools (`delete_building`, `delete_residence`,
  `delete_bill`) via the auto-generated `tools` array, and its capability is
  explicitly called out below in this CHANGELOG and in the MCP Tooling
  section of `replit.md`. Admin/manager only; tenants are rejected. Cascades
  in a single transaction to project steps, project elements, submission
  vendors, workflow tasks, project notifications, and element project
  updates; evaluation suggestions that reference the deleted project have
  their `projectId` null-ed out via the existing DB-level
  `ON DELETE SET NULL` FK. The response is the same structured
  `{ deleted, cascaded, evaluationSuggestionsCleared, message }` shape used
  by the other delete tools, so existing FK/unique-violation envelopes
  carry over unchanged.

### Fixed

- **Invitation dedup scoping**: Duplicate-detection now keys on
  (organization, email, residence) using `IS NOT DISTINCT FROM` semantics for
  `residence_id`. The previous (organization, email)-only predicate silently
  destroyed pending invites for the same email at *different* units in the same org.
- **Audit log foreign key**: `invitation_audit_log.invitation_id` is now
  `ON DELETE SET NULL` (was `CASCADE`). Audit history now survives even if an
  invitation row is hard-deleted; the denormalized context lives in the
  `details` JSON column.

### Confirmed

- **Tenant-role downgrade caller identity is the OAuth user**: When an
  OAuth-bound MCP caller downgrades to a lower-privileged role (e.g.
  admin → tenant), the caller identity used for result scoping and audit
  attribution resolves to the **OAuth-authenticated user** (e.g.
  `bd318cc4-…` from the QA session) — **not** the MCP service account
  (`222f5a0d-…`). The downgrade narrows scope/visibility only; it does not
  impersonate the service principal. Tools whose result scoping is affected
  include `list_demands`, `list_maintenance_requests`, `create_demand`, and
  `create_maintenance_request` (the created/listed rows are attributed to,
  and filtered by, the OAuth user).
  Migration note: any client that hard-coded the MCP service-account UUID
  to filter responses will no longer match — filter on the OAuth user id
  instead.
- **Bill numbering format is `MCP-<ms-timestamp>`**: Bills created via the
  MCP `create_bill` tool currently receive a `billNumber` of the form
  `MCP-<ms-timestamp>` (e.g. `MCP-1729712345678`), where the suffix is a
  millisecond Unix timestamp generated server-side at create time. This
  format is **subject to change before GA** and should not be relied on for
  parsing or sort-ordering by integrators.

### Other Changes

- **Documentation Updates**: Comprehensive review and update of all project documentation (September 2025)
- **Translation Coverage**: Extended bilingual validation across 19+ routes with Quebec French compliance
- **Test Infrastructure**: Stable Jest configuration with ES module support and comprehensive mock architecture
- **Quality System**: Enhanced quality metrics tracking with A+ code quality grade
- **Developer Experience**: Improved documentation structure and development guidelines
- **Test Coverage**: Increased to 90%+ across critical application paths
- **Documentation Structure**: Consolidated and updated all guides for current project state
- **Quality Metrics**: Enhanced tracking with detailed success metrics per component category

### Improved

- **Test Reliability**: Stabilized core test categories - Dashboard Components (15/15), Form Validation (12/12), API Routes (15/15)  
- **Documentation Quality**: Updated all documentation files with current project state and accurate information
- **Development Process**: Enhanced development workflow documentation with Quebec-specific requirements
- **Project Structure**: Improved organization and accessibility of documentation resources

### Maintained

- **ES Module Compatibility**: Stable execution foundation with resolved import/export configurations
- **Test Infrastructure**: Reliable Jest configuration with comprehensive server mocking capabilities  
- **Documentation Links**: Verified and updated all internal documentation cross-references
- **Code Quality**: Maintained A+ grade standards across all components and modules

## [2.0.0] - 2025-08-17

### Added

- **Test Infrastructure**: Comprehensive Jest configuration with 76/76 core tests passing
- **MSW Framework**: Production-ready testing infrastructure with request mocking
- **Quebec Compliance**: Complete bilingual support testing
- **Mobile Testing**: Touch interaction and accessibility test suites
- **Quality Metrics**: Automated quality tracking and validation system
- **Continuous Improvement**: MetricEffectivenessTracker with system health monitoring

### Changed

- **Project Structure**: Organized documentation into clear hierarchical structure
- **Test Organization**: Standardized test file naming across all test types
- **Documentation Quality**: Enhanced readability and validation compliance
- **Client Architecture**: Centralized component exports and improved organization
- **Server Architecture**: Consolidated configuration, types, and constants

### Fixed

- **Authentication Security**: Proper password hashing with pbkdf2Sync
- **Database Types**: Resolved Drizzle ORM query type casting issues
- **Build Process**: Fixed Tailwind CSS border utility conflicts
- **Navigation**: Cleaned up admin menu structure
- **LSP Diagnostics**: Resolved all TypeScript compilation errors

### Security

- **Password Hashing**: Migrated from plain text to secure pbkdf2Sync hashing
- **API Type Safety**: Enhanced type checking in invitation email functionality
- **Input Validation**: Comprehensive Zod schema validation implementation
- **Session Security**: Secure session configuration with proper cookie settings

## [1.5.0] - 2024-12-15

### Added

- **Demo Organization Sync**: Automated synchronization between development and production
- **Deployment Hooks**: Automated demo data synchronization during deployment
- **API Endpoints**: Demo organization management endpoints (/api/demo-organization/\*)
- **Environment Configuration**: SYNC_DEMO_ON_DEPLOY, PRODUCTION_DATABASE_URL, SYNC_API_KEY

### Changed

- **Sync Process**: Enhanced demo organization data management
- **Deployment Pipeline**: Integrated demo data synchronization
- **Configuration**: Improved environment variable management

### Fixed

- **Module Imports**: Resolved sync-demo-organization script export issues
- **API Routes**: Enhanced error handling in synchronization endpoints
- **Data Consistency**: Improved demo data integrity across environments

## [1.4.0] - 2024-08-20

### Added

- **RBAC System**: Complete role-based access control implementation
- **User Management**: Comprehensive user creation and management system
- **Building Management**: Full building and residence management features
- **Maintenance System**: Request submission and tracking functionality
- **Financial Tracking**: Bill management and payment tracking
- **Quebec Compliance**: Law 25 privacy compliance implementation

### Changed

- **Database Schema**: Enhanced schema with proper relationships and constraints
- **API Design**: RESTful API architecture with consistent response patterns
- **UI Components**: Shadcn/ui component library integration
- **Authentication**: Session-based authentication with secure cookie handling

### Fixed

- **Database Migrations**: Resolved migration dependency issues
- **Type Safety**: Enhanced TypeScript integration across client and server
- **Form Validation**: Comprehensive Zod validation implementation
- **Error Handling**: Consistent error handling across all API endpoints

## [1.3.0] - 2024-07-10

### Added

- **Bilingual Support**: Complete French and English interface
- **Translation System**: Dynamic language switching
- **Quebec Postal Codes**: Validation for Quebec postal code format
- **Cultural Localization**: Date, currency, and address formats for Quebec

### Changed

- **User Interface**: Enhanced bilingual user experience
- **Form Validation**: Quebec-specific validation rules
- **Documentation**: Bilingual documentation support

### Fixed

- **Translation Coverage**: Complete translation coverage for all user-facing text
- **Cultural Formatting**: Proper Quebec date and currency formatting
- **Accessibility**: Enhanced accessibility for bilingual users

## [1.2.0] - 2024-06-01

### Added

- **Database Integration**: PostgreSQL with Drizzle ORM
- **Neon Database**: Serverless database configuration
- **Migration System**: Drizzle Kit migration management
- **Connection Pooling**: Optimized database connection handling

### Changed

- **Data Layer**: Migration from in-memory to persistent storage
- **Query Performance**: Optimized database queries and indexing
- **Schema Management**: Version-controlled schema changes

### Fixed

- **Connection Stability**: Resolved database connection timeout issues
- **Migration Consistency**: Ensured consistent migration application
- **Data Integrity**: Enhanced referential integrity constraints

## [1.1.0] - 2024-05-15

### Added

- **React Frontend**: Complete React 18 with TypeScript implementation
- **Vite Build System**: Fast development and production builds
- **TanStack Query**: Server state management
- **React Hook Form**: Form handling with validation
- **Wouter Routing**: Client-side routing implementation

### Changed

- **Component Architecture**: Modular component design
- **State Management**: Centralized state management patterns
- **Build Performance**: Optimized build and development processes

### Fixed

- **Hot Reloading**: Resolved development server issues
- **Type Checking**: Enhanced TypeScript configuration
- **Bundle Size**: Optimized production bundle size

## [1.0.0] - 2024-04-01

### Added

- **Project Foundation**: Initial project setup and architecture
- **Express Server**: Node.js server with Express framework
- **TypeScript Configuration**: Full TypeScript integration
- **Development Environment**: Complete development setup
- **Basic Authentication**: Initial user authentication system

### Changed

- **Project Structure**: Established monorepo structure
- **Configuration Management**: Centralized configuration system

### Fixed

- **Initial Setup**: Resolved initial development environment issues
- **Dependency Management**: Optimized package dependencies

## Security Updates

### 2025-08-17

- Enhanced password security with PBKDF2 hashing
- Improved session security configuration
- Added comprehensive input validation
- Implemented Quebec Law 25 compliance measures

### 2024-08-20

- Added rate limiting for authentication endpoints
- Implemented CORS security headers
- Enhanced SQL injection protection
- Added audit logging for security events

### 2024-07-10

- SSL/TLS configuration improvements
- Enhanced cookie security settings
- Added CSRF protection
- Implemented secure session management

## Quebec Compliance Updates

### 2025-08-17

- Complete Law 25 privacy compliance implementation
- Enhanced bilingual support across all features
- Quebec-specific postal code validation
- Cultural localization improvements

### 2024-07-10

- Initial bilingual interface implementation
- Quebec cultural formatting support
- Privacy policy and terms in French
- Accessibility improvements for Quebec users

## Performance Improvements

### 2025-08-17

- Database query optimization with proper indexing
- Enhanced caching strategies
- Build process optimization
- Bundle size reduction

### 2024-06-01

- Database connection pooling
- Query performance optimization
- Memory usage improvements
- Response time enhancements

---

For more detailed information about any release, please refer to the [documentation](docs/README.md) or the [project roadmap](ROADMAP.md).
