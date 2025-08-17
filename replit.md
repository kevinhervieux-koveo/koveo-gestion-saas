# Koveo Gestion Development Framework

## Overview

Koveo Gestion is an AI-powered property management SaaS platform designed specifically for Quebec's residential communities, syndicates, and co-ownership properties. The application provides comprehensive tools for property documentation, maintenance tracking, financial planning, and complaint management while ensuring Law 25 compliance and supporting both French and English languages.

This repository currently contains the foundational development framework implementing the "Pillar Methodology" - a rigorous, automated development system that serves as the operating foundation for building robust, enterprise-grade applications.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Navigation Consolidation (Latest)
- **Date**: August 17, 2025
- **Status**: ✅ Completed
- **Details**: Successfully consolidated all sidebar navigation references into centralized configuration
  - Created `/config/navigation.ts` as single source of truth
  - Eliminated duplicate navigation definitions scattered across components
  - Enhanced sidebar component efficiency with extracted configuration logic
  - Added comprehensive documentation for navigation configuration
  - Fixed TypeScript errors and improved type safety

### Koveo Organization Access Control (Latest)
- **Date**: August 17, 2025  
- **Status**: ✅ Completed
- **Details**: Fixed organization access restrictions for Koveo users
  - Updated RBAC logic to grant Koveo organization users access to all organizations
  - Enhanced server-side invitation validation to recognize Koveo user privileges
  - Improved frontend organization filtering for Koveo users in invitation dialog
  - Applied role-based access controls while preserving Koveo admin privileges
  - User in Koveo organization can now invite users to any organization

### Test Suite Improvements (Latest)
- **Date**: August 17, 2025
- **Status**: ✅ Major Improvements Completed
- **Details**: Systematically fixed critical test infrastructure issues
  - Fixed database mocking for Drizzle ORM in notification service tests
  - Resolved duplicate sidebar component conflict
  - Added missing server directory structure (middleware, utils, controllers)
  - Installed missing supertest dependency for API testing
  - Updated Jest configuration to remove deprecation warnings
  - Notification Service tests now passing (SSL alerts working correctly)
  - Project Structure tests largely improved (server directories resolved)

### Current Development Status
- **Navigation System**: Fully consolidated and optimized
- **User Management**: Enhanced with proper Koveo organization privileges
- **RBAC System**: Functioning with correct organization access controls
- **Test Infrastructure**: Major improvements completed, core test suites stabilized
- **Database Operations**: Optimized with proper indexing and materialized views
- **Critical Issues**: Some TypeScript errors remain but test infrastructure is now robust

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Framework**: Shadcn/ui components with Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS with custom CSS variables for theming and design tokens
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Internationalization**: Custom language provider supporting English and French

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules for modern JavaScript features
- **API Design**: RESTful API structure with typed request/response handling
- **Database ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **Validation**: Zod schemas for runtime type validation and API contract enforcement
- **Storage**: Abstracted storage interface with in-memory implementation for development

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for schema management and migrations
- **Connection**: Neon serverless database for cloud-hosted PostgreSQL
- **Schema Design**: Modular table definitions with TypeScript integration
- **Migrations**: Drizzle Kit for database schema migrations and version control

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store
- **User Management**: Custom user system with username/password authentication
- **RBAC System**: Four-tier role hierarchy (Admin, Manager, Tenant, Resident) with granular permissions
- **Access Control**: Organization-based access rules with Demo (public), Koveo (full access), normal orgs (limited), tenant/resident (residence-only)
- **Security**: Law 25 compliance framework for Quebec privacy regulations
- **Invitation System**: Enhanced role-based user invitation with organization assignment control, residence requirements for tenants/residents, and audit logging

### Development Framework (Pillar Methodology)
- **Core Pillars**: Modular development components for quality assurance, testing, and security
- **Status Tracking**: Real-time workspace component status monitoring
- **Quality Metrics**: Automated code quality, coverage, and performance tracking
- **Configuration Management**: Dynamic framework configuration with JSON storage
- **Progress Monitoring**: Development phase tracking with automated validation

### Project Structure
- **Monorepo Design**: Single workspace with client, server, and shared code
- **TypeScript Configuration**: Unified type checking across frontend and backend
- **Build System**: Separate build processes for client (Vite) and server (ESBuild)
- **Path Aliases**: Consistent import paths with @ aliases for clean code organization
- **Centralized Forms**: All form components located in `client/src/components/forms/` for reusability and maintainability

### Testing & Validation Infrastructure
- **Organization Tests**: Comprehensive validation of project structure, naming conventions, and file organization
- **Documentation Validation**: Automated detection of redundancies, broken links, and formatting issues
- **Error Detection**: Tests for import errors, TypeScript issues, security problems, and API consistency
- **Continuous Improvement**: Quality metrics, readability scoring, and automated suggestion generation
- **Test Suites**: 48 tests across 4 major suites with 62.5% initial pass rate
- **Validation Reports**: Automated generation of ORGANIZATION_VALIDATION_REPORT.md with actionable insights

### AI Agent Enhancement Toolkit
- **Project Health Analysis**: 6-dimension scoring system (code quality, documentation, testing, security, performance, overall)
- **Smart Context Management**: Intelligent file relationship analysis, working set management, and context-aware recommendations
- **Workflow Automation**: Pattern detection, automated task execution, pre-commit validation, and security auditing
- **Real-time Monitoring**: Interactive dashboard with metrics collection, trend analysis, and performance tracking
- **CLI Operations**: Command-line interface with health checks, context management, workflow execution, and analysis tools
- **Export Capabilities**: Comprehensive analysis export, dashboard generation, and metrics tracking

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless database connection
- **drizzle-orm**: Type-safe database ORM and query builder
- **drizzle-kit**: Database schema migration and management tools
- **zod**: Runtime type validation and schema definition

### Frontend Dependencies
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Accessible UI primitive components
- **@hookform/resolvers**: Form validation integration with React Hook Form
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight React router
- **lucide-react**: Icon library

### Development Tools
- **vite**: Fast frontend build tool and development server
- **esbuild**: Fast JavaScript bundler for server builds
- **tsx**: TypeScript execution for Node.js development
- **@replit/vite-plugin-***: Replit-specific development plugins

### Production Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit**: Development and hosting platform
- **Express.js**: Web application framework for Node.js

### Planned Integrations
- **AI Services**: Integration for property management insights and recommendations
- **Quebec Law 25 Compliance**: Privacy and data protection framework
- **Multi-language Support**: Enhanced internationalization beyond current EN/FR support
- **Property Management APIs**: External integrations for Quebec property data

## Recent Changes

### August 17, 2025 - Enhanced AI Agent Toolkit & Workflow Automation
- ✅ **AI Agent Toolkit**: Created comprehensive project health analysis, code quality assessment, and quick health checks
- ✅ **Smart Context Manager**: Built intelligent workspace management with file relationship analysis and smart recommendations
- ✅ **Intelligent Workflow Assistant**: Developed automated workflow detection, pattern recognition, and project insights generation
- ✅ **Real-time Dashboard**: Created interactive HTML dashboard with metrics, trends, and performance monitoring
- ✅ **CLI Interface**: Built comprehensive command-line tool for all AI agent operations with interactive features
- ✅ **Tool Integration**: Seamlessly integrated all tools with singleton patterns and unified interfaces

### August 17, 2025 - Organization Validation & Documentation Improvement System
- ✅ **Organization Validation Tests**: Created comprehensive test suite to validate project structure, documentation, and code organization
- ✅ **Documentation Redundancy Detection**: Implemented automated system to identify duplicate content and redundant information
- ✅ **Error Detection Framework**: Built tests to catch import errors, TypeScript issues, security problems, and inconsistencies
- ✅ **Continuous Improvement System**: Created documentation quality metrics, readability scoring, and improvement tracking
- ✅ **Validation Report**: Generated comprehensive ORGANIZATION_VALIDATION_REPORT.md with 62.5% initial pass rate
- ✅ **Test Coverage**: 48 total tests across 4 suites covering structure, documentation, errors, and improvements

### August 17, 2025 - Page Organization & Dependency Management Complete
- ✅ **Complete Dependency Resolution**: Installed all missing packages including React ecosystem, Replit plugins, server dependencies
- ✅ **Page Organization Cleanup**: Removed orphaned `pillars.tsx` from root directory, eliminated 7 of 9 duplicate page groups
- ✅ **Comprehensive Test Suite**: Created page organization tests, dependency validation tests, and system health checks
- ✅ **Documentation Enhancement**: Added complete PAGE_ORGANIZATION_GUIDE.md with standards and best practices
- ✅ **Server Stability**: Resolved all import errors, server now runs successfully with full database optimizations
- ✅ **Test Infrastructure**: All core tests passing including route validation, page organization, and dependency checks

### August 16, 2025 - RBAC Permissions System Enhancement & Route Cleanup
- ✅ **RBAC Permission Matrix**: Updated tenant role permissions to match resident role permissions exactly
- ✅ **Admin Permissions Interface**: Replaced "All Permissions" tab with comprehensive role-based permissions matrix table
- ✅ **Navigation Cleanup**: Removed "Role Permissions" tab completely from admin interface
- ✅ **User Management**: Updated "User Permissions" tab to display all users with proper role filtering
- ✅ **Route Validation**: Removed all remaining `/admin/user-management` references from codebase
- ✅ **Test Coverage**: Created comprehensive test suite `tests/routing/removed-routes.test.tsx` to prevent future route regressions
- ✅ **File Cleanup**: Updated navigation tests, route validation scripts, and sidebar components
- ✅ **Permission Statistics**: Added visual permission count cards showing Admin (148), Manager (70), Tenant (9), Resident (9) permissions

### August 16, 2025 - Page Routing Management Documentation & Testing
- ✅ **Comprehensive Routing Documentation**: Created `docs/PAGE_ROUTING_GUIDE.md` with complete page management guidelines
- ✅ **Route Validation Tests**: Created `tests/routing/route-validation.test.tsx` for comprehensive route testing
- ✅ **Navigation Integration Tests**: Created `tests/routing/navigation.test.tsx` for sidebar navigation validation
- ✅ **Build Validation Script**: Created `scripts/validate-routes.ts` to check for removed routes in build output
- ✅ **Resolved Admin Dashboard Issue**: Fixed persistent /admin/dashboard route that was cached in build files
- ✅ **Cache Management Procedures**: Documented complete cache clearing procedures for route changes
- ✅ **Route Categories Documentation**: Organized all routes by role with clear access patterns
- ✅ **Migration Guide**: Added route migration procedures for safe route transitions
- ✅ **Troubleshooting Commands**: Documented grep commands and build verification procedures
- ✅ **Best Practices**: Established 10 routing best practices for future development

### August 16, 2025 - Mandatory Code Review & Automated Quality System Established
- ✅ **GitHub Actions CI/CD**: Complete quality validation pipeline with 6 mandatory quality gates
- ✅ **Static Analysis Gate**: ESLint, TypeScript type checking, and Prettier formatting enforced
- ✅ **Testing Gate**: Unit, integration, and E2E tests with 80% coverage requirement
- ✅ **Security Gate**: NPM audit with zero critical/high vulnerability tolerance
- ✅ **Quebec Compliance Gate**: Bilingual support (≥80%), accessibility (WCAG 2.1 AA), and Law 25 privacy validation
- ✅ **Build Validation Gate**: Client and server builds must succeed before merge
- ✅ **Code Complexity Gate**: Cyclomatic complexity ≤10 enforced with automated flagging
- ✅ **Pre-commit Hooks**: Husky integration with lint-staged for local quality enforcement
- ✅ **Conventional Commits**: Commitlint configuration enforcing structured commit messages
- ✅ **Branch Protection Rules**: Comprehensive GitHub branch protection with CODEOWNERS integration
- ✅ **Mandatory Code Review**: PR template with quality checklist and specialized review teams
- ✅ **Quality Documentation**: Complete code review guide and branch protection setup instructions
- ✅ **Type Safety Preservation**: All existing TypeScript patterns maintained with enhanced validation

### August 16, 2025 - Automatic Roadmap Synchronization Implementation
- ✅ **Automatic Feature Categorization**: New feature requests automatically get "submitted" status and appear in roadmap
- ✅ **Dev-Prod Synchronization**: Automatic sync of roadmap changes from development to production environment
- ✅ **Enhanced Feature Creation**: Auto-assigns default values (submitted status, public roadmap visibility, medium priority)
- ✅ **Sync API Endpoints**: Created `/api/features/sync`, `/api/features/bulk-sync`, and `/api/features/trigger-sync`
- ✅ **Manual Sync Trigger**: Added "Sync to Production" button in roadmap UI for manual synchronization
- ✅ **Database Schema Enhancement**: Added `syncedAt` timestamp field to track synchronization status
- ✅ **Environment-Aware UI**: Dynamic sync status indicator showing development vs production mode
- ✅ **Real-time Status Updates**: All feature status and strategic path changes automatically sync between environments
- ✅ **Security**: Sync endpoints protected with authorization tokens and source verification
- ✅ **Error Handling**: Comprehensive error handling and user feedback for sync operations

### August 15, 2025 - Forms Architecture Centralized
- ✅ **Centralized Forms Directory**: Created `client/src/components/forms/` directory for all form components
- ✅ **Form Reorganization**: Moved `FeaturePlanningDialog` to `FeatureForm` in centralized forms directory
- ✅ **Form Index Export**: Created index file for clean form imports across the application
- ✅ **Improved Maintainability**: All future forms will be organized in the same directory for easy reuse

### August 15, 2025 - Pillar Automation Engine Complete
- ✅ **Roadmap & Work Breakdown (Pillar 4)**: Created comprehensive `ROADMAP.md` with phased development approach
- ✅ **Continuous Improvement (Pillar 5)**: Implemented automated quality gate system with complexity and coverage analysis
- ✅ **Quality Gate Script**: Created `scripts/run-quality-check.ts` with automated complexity (max 10) and coverage (min 90%) validation
- ✅ **Code Complexity Analysis**: Integrated `complexity-report` tool for cyclomatic complexity measurement
- ✅ **Automated Validation Pipeline**: Complete quality gate system with color-coded console output and exit codes
- ✅ **Framework Completion**: All 5 pillars of the Pillar Methodology successfully established and operational

### August 15, 2025 - Anti-Workaround & Documentation Pillars Established
- ✅ **Architectural Guidelines**: Created `SYSTEM_PROMPT_GUIDELINES.md` with SOLID principles and anti-pattern prevention
- ✅ **Anti-Workaround Protocol**: Proactive identification of workarounds with explicit confirmation requirements
- ✅ **JSDoc Enforcement**: ESLint rules requiring complete JSDoc documentation for all exported functions/classes/types
- ✅ **Documentation Tools**: Installed JSDoc, TypeDoc, and eslint-plugin-jsdoc for comprehensive documentation
- ✅ **API Documentation**: Created placeholder `openapi.json` in `/client/public/` for future API documentation
- ✅ **Documentation Generation**: `docs` script for automated TypeScript documentation generation
- ✅ **Strict Validation**: 141+ JSDoc-related errors actively detected to enforce documentation standards

### August 15, 2025 - Validation & Quality Assurance Pillar Established  
- ✅ **Core Testing Infrastructure**: Jest testing framework with TypeScript support
- ✅ **Directory Structure**: Created `/tests/unit` and `/tests/integration` directories
- ✅ **Static Analysis**: ESLint v9 with strict TypeScript and React rules
- ✅ **Code Formatting**: Prettier configuration with project-wide formatting standards
- ✅ **Validation Pipeline**: `validate` command for sequential linting, formatting, and testing
- ✅ **Test Suite**: 9 passing tests covering language functionality, utilities, and API integration
- ✅ **Quality Metrics**: Code coverage tracking with 80% thresholds
- ✅ **Development Scripts**: Complete suite of `lint`, `format`, `test`, and `validate` commands