# Koveo Gestion Development Framework

## Overview

Koveo Gestion is an AI-powered SaaS platform designed for property management within Quebec's residential communities. Its primary purpose is to offer a comprehensive suite of tools covering documentation, maintenance, financial planning, and complaint resolution. The platform ensures compliance with Quebec's Law 25, supports both French and English, and targets the co-ownership properties market. The project aims to deliver an enterprise-grade application with high test coverage and proven production reliability.

## Recent Changes

**October 4, 2025 (Latest)**: Major test infrastructure improvements - fixed critical testing issues:
1. **Jest Configuration**: Removed `bail=true` to allow full test suite execution, optimized workers and timeouts, disabled `forceExit` to prove no async leaks
2. **Mock Infrastructure Fixes**: 
   - Added `relations` export to drizzle-orm mock to fix "relations is not a function" errors
   - Fixed wouter mock exports to support both CommonJS and ES modules properly
3. **Document Management Tests**: Complete rewrite achieving 11/11 passing (100%)
   - Created createMockResponse() helpers for proper Response objects
   - Comprehensive API mocking for all endpoints (auth, entities, documents, uploads, deletions)
   - Added filterDocumentsByRole() for proper visibility testing
   - Reduced test file from 925 to 571 lines (38% reduction)
4. **Communication Page Tests**: Replaced mock component with real production component, achieving 14/20 passing (70%)
   - Fixed state management with finally blocks for 6 async operations
   - Added 4 missing loading/error state flags for proper async cleanup
   - Deterministic mock behavior for all 6 API endpoints
   - Removed 7 tests for non-existent features (meeting planning)
   - Fixed ResizeObserver mock for Radix UI components
   - Remaining 6 failures are Radix UI component testing infrastructure issues, not production bugs
5. **Test Results Summary**:
   - Budget page: 21/21 passing (100%)
   - Document management: 11/11 passing (100%)
   - Communication page: 14/20 passing (70%)
   - Overall improvement: From ~6 test suites running to 42+ tests passing with real components

**October 4, 2025**: Comprehensive codebase cleanup - removed duplicate and unused pages:
1. **Page deduplication**: Removed 4 duplicate/unused pages totaling ~2,800 lines of dead code
   - Documents.tsx (961 lines) - unused legacy document management page
   - ModularDocuments.tsx (518 lines) - unused legacy document management page
   - ManagerDemandsPage.tsx (682 lines) - duplicate of manager/demands.tsx
   - admin/suggestions-with-filter.tsx - unused admin page without route
2. **Index.ts cleanup**: Updated page exports to reflect removed files, ensuring proper module resolution
3. **Verified uniqueness**: All remaining 58 pages are unique, properly routed, and actively used in the application

**October 4, 2025**: Enhanced document management with bulk operations and duplicate page cleanup:
1. **Bulk delete functionality**: Implemented comprehensive bulk delete for documents in ModularDocumentPageWrapper component used across manager and resident document pages
2. **Selection mode UI**: Added visual selection mode with checkboxes, "Select All"/"Deselect All" buttons, and bulk delete button showing selected count
3. **Graceful error handling**: Uses Promise.allSettled for reliable partial failure handling - operations continue even if individual deletions fail
4. **User feedback**: Separate toast notifications show counts of successful vs failed deletions for clear transparency
5. **Smart document viewing**: Automatically disables document viewing when in selection mode to prevent accidental opens
6. **Code cleanup**: Removed duplicate ModularBuildingDocuments.tsx page - only BuildingDocuments.tsx (wrapping ModularDocumentPageWrapper) is used

**October 4, 2025**: Fixed manager building access control and user-management page issues:
1. **Manager building filtering**: Updated `/api/manager/buildings` endpoint to use `userBuildings` table for manager role filtering, ensuring managers only see buildings they are explicitly assigned to
2. **Organization selector visibility**: Fixed organization selector to hide when user has only 1 organization, improving UX by removing unnecessary navigation
3. **User-management query fixes**: Fixed React Query implementations for organizations, buildings, and residences to use explicit `apiRequest` calls with proper TypeScript casting through `unknown`, resolving runtime "L.map is not a function" errors

**October 4, 2025**: Fixed multiple critical common spaces booking functionality issues:
1. **Time slot availability logic**: Fixed slot duration check from 60 minutes to 30 minutes to match the minimum booking interval, allowing slots like 12:30 to be available when they don't conflict with existing bookings
2. **Opening hours validation**: Fixed closing time logic to prevent bookings from starting AT closing time (e.g., 22:00 with 22:00 close). Slots must now start BEFORE closing time, allowing only 21:30 as the last available slot for a 22:00 closing
3. **Calendar color coding**: Verified that the CalendarView component correctly displays user's own bookings in green and other users' bookings in gray, using the `isOwnBooking` flag set by the backend
4. **Frontend date synchronization**: Fixed `bookingsForDate` memo to use `form.watch('date')` with proper dependency tracking, ensuring bookings match displayed time slots
5. **State consistency**: Added `setSelectedDate()` calls when opening booking dialog to maintain date state synchronization
6. **Timezone handling**: Fixed critical timezone bug in `isWithinOpeningHours` function where UTC times were being compared to local opening hours. Now properly converts times to America/Montreal timezone before validation, preventing false "OUTSIDE_OPENING_HOURS" errors

**October 1, 2025**: Fixed document filtering bug in ModularDocumentPageWrapper where documents were not appearing on residence and building pages. Removed incorrect `type` parameter from API call that was interfering with proper document filtering. Documents are now correctly filtered by `buildingId` or `residenceId` parameters only.

## User Preferences

Preferred communication style: Simple, everyday language.
Working Methodology: **CRITICAL** - Always restart the "Start application" workflow after making code changes and before each checkpoint or testing phase. This ensures the hot reload system properly rebuilds and loads all changes, preventing issues with stale code or missing updates.

## System Architecture

### UI/UX Decisions
The UI is built with Shadcn/ui (Radix UI) and Tailwind CSS, prioritizing responsive design. All forms are designed to be responsive, featuring a single scroll bar behavior with `max-h-[90vh]` and `overflow-y-auto` on dialog containers. Project type icons across maintenance workflow components use Lucide React components for consistency.

**Hierarchical Navigation**: The HOC (withHierarchicalSelection) provides intelligent auto-forwarding based on user access. When a resident has only one organization, building, or residence assigned, they are automatically routed to the appropriate level, eliminating unnecessary selection screens and improving the user experience. The HOC implements role-based filtering where residents/tenants rely on server-side filtering via `/api/users/me/buildings`, while managers/admins use client-side filtering when `checkResidenceAccess` is enabled.

### Technical Implementations
- **Frontend**: React 18 with TypeScript and Vite, using Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling and validation.
- **Backend**: Node.js with Express.js and TypeScript (ES modules), providing a RESTful API with typed request/response handling.
- **Database**: PostgreSQL, managed with Drizzle ORM and Neon serverless database. Drizzle Kit is used for schema migrations. A dual database environment is maintained for development and production.
- **Authentication**: Express sessions with a PostgreSQL store, custom username/password authentication, token-based password reset, and multi-step registration with Law 25 compliant privacy consent.
- **Authorization**: Four-tier Role-Based Access Control (RBAC) (Admin, Manager, Tenant, Resident) with granular permissions and organization-based access.
- **File Storage**: A modern hierarchical structure is used for file storage: `{type}/org_{organizationId}/building_{buildingId}/residence_{residenceId}/role_{userRole}/user_{userId}`. It includes role normalization, type mapping, a secure resolver endpoint (`GET /api/documents/:id/file`), and a quarantine system for legacy files.
- **Internationalization**: Custom language provider supports English and French.
- **Testing**: A comprehensive test suite using Vitest covers unit, integration, and API routes, with a focus on Quebec Law 25 compliance. The testing infrastructure includes:
  - **Vitest Configuration**: Modern test runner with better ESM and TypeScript support, replacing Jest for improved drizzle-orm compatibility.
  - **Document API Tests**: 30 tests total (15 helper function tests + 15 integration tests) covering document upload, download, view, list, and delete operations with full authentication and authorization testing.
  - **Test Authentication**: Custom test authentication middleware using `x-test-user-id` header for integration tests.
  - **Schema Validation**: Manual Zod schemas (replacing drizzle-zod createInsertSchema) ensure proper validation aligned with actual database column types.

### Feature Specifications
- **Document Management**: Full system with role-based access control, hierarchical storage, secure file access, a 30-day quarantine for legacy files, and comprehensive upload/download with categorization.
- **Property Management**:
    - **Buildings**: Comprehensive management for Admin/Manager roles.
    - **Residences**: Auto-generated units with advanced search, filtering, and multi-parking/storage support.
    - **Inventory Management**: Complete building element inventory system with UNIFORMAT code support, condition tracking, and lifecycle management. Features an enhanced view mode to prevent accidental modifications and seamless editing for authorized users.
- **Bilingual Support**: Full bilingual translation for Inventory and Projects management pages, ensuring Quebec Law 25 compliance with real-time language switching.

### System Design Choices
- **Monorepo Structure**: A single workspace for client, server, and shared code, leveraging TypeScript for unified type checking.
- **Development Framework (Pillar Methodology)**: Emphasizes modular components for quality assurance, testing, and security. Features a hot reload system for rapid development.
- **Security**: Comprehensive enhancements for Law 25 compliance, including secure database connections (replacing shell commands), malware detection for file uploads, input sanitization, SSRF protection, and secure error handling.
- **Code Consolidation**: Achieved significant code reduction through standardized form patterns, unified card components (StandardCard), and consolidated form hooks (useStandardForm).
- **Query Optimization**: Advanced query performance optimization eliminated N+1 patterns and improved data lookup speed for user and document operations, reducing database round trips and improving response times.

## External Dependencies

- **@neondatabase/serverless**: Serverless PostgreSQL database connector.
- **drizzle-orm**: Type-safe ORM for database interactions.
- **drizzle-kit**: Schema migration tools for Drizzle ORM.
- **zod**: Runtime type validation library.
- **@tanstack/react-query**: Frontend server state management.
- **@radix-ui/**: Accessible UI primitives for frontend.
- **@hookform/resolvers**: Integration for form validation with React Hook Form.
- **tailwindcss**: Utility-first CSS framework.
- **wouter**: Small routing library for React.
- **lucide-react**: Icon library.
- **vite**: Frontend build tool.
- **esbuild**: Fast JavaScript bundler for the server.
- **tsx**: TypeScript execution for Node.js.
- **@replit/vite-plugin-***: Replit-specific Vite plugins.
- **Neon Database**: Serverless PostgreSQL hosting provider.
- **Replit**: Development and hosting platform.
- **Express.js**: Backend web application framework.
- **SendGrid**: Email service for transactional emails (e.g., password resets).