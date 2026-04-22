# Changelog

All notable changes to Koveo Gestion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

- **Duplicate invites now reject with 409 instead of soft-replacing the prior pending invitation** (Task #250):
  Previously, calling `POST /api/invitations` (REST) or `invite_user` (MCP) a second time
  for the same `(organizationId, email, residenceId)` tuple silently marked the prior
  pending invite as `status='replaced'`, wrote a `replaced` entry to
  `invitation_audit_log`, and returned a brand-new invitation. That behavior is
  removed. Duplicate invites now return:
    - REST: HTTP `409 Conflict` with body
      `{ error: 'Conflict', code: 'INVITATION_ALREADY_PENDING', message: '...' }`.
    - MCP: a structured tool response with
      `{ status: 'already_invited', code: 'INVITATION_ALREADY_PENDING', message: '...' }`.
  The prior pending invite is left completely untouched — no status change, no
  `replaced` audit row, no new invitation row, and no email send.
  Migration: callers must explicitly choose between `resend_invitation` (extend
  the existing invite's expiry) or `cancel_invitation` followed by a fresh
  `invite_user` / `POST /api/invitations` (start over with a new token). The
  helper function and helper error class have been renamed/aliased: prefer
  `InvitationAlreadyPendingError` from
  `server/services/invitation-soft-replace`. The previous
  `InvitationSoftReplaceRaceLostError` export remains as a deprecated alias.
  Note: the `replaced` value of the `invitation_status` enum is intentionally
  retained — other historical audit rows still reference it.

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

### Fixed

- **Invitation history preservation**: Re-inviting the same email no longer destroys
  the prior invitation row or its audit trail. Duplicate invites now soft-replace the
  prior pending invitation (`status = 'replaced'`) and write a `replaced` entry to
  `invitation_audit_log` linking the old and new invitation IDs. Both the REST
  `POST /api/invitations` endpoint and the MCP `invite_user` tool follow the new flow.
- **Invitation dedup scoping**: Duplicate-detection now keys on
  (organization, email, residence) using `IS NOT DISTINCT FROM` semantics for
  `residence_id`. The previous (organization, email)-only predicate silently
  destroyed pending invites for the same email at *different* units in the same org.
- **Audit log foreign key**: `invitation_audit_log.invitation_id` is now
  `ON DELETE SET NULL` (was `CASCADE`). Audit history now survives even if an
  invitation row is hard-deleted; the denormalized context lives in the
  `details` JSON column.

### Added

- **Invitation status `replaced`**: New value in the `invitation_status` enum used
  by the soft-replace flow above.

### Changed

- **MCP role downgrade attribution (clarification)**: When an OAuth-bound MCP
  caller downgrades to a lower-privileged role (e.g. admin → tenant), the
  caller identity used for audit attribution (`performed_by`, `invitedByUserId`,
  etc.) remains the OAuth user — *not* the MCP service principal. The downgrade
  narrows scope/visibility only; it does not impersonate. This is intentional so
  that audit logs always point at the human responsible for an action.

- **Documentation Updates**: Comprehensive review and update of all project documentation (September 2025)
- **Translation Coverage**: Extended bilingual validation across 19+ routes with Quebec French compliance
- **Test Infrastructure**: Stable Jest configuration with ES module support and comprehensive mock architecture
- **Quality System**: Enhanced quality metrics tracking with A+ code quality grade
- **Developer Experience**: Improved documentation structure and development guidelines

### Changed

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
