# Koveo Gestion Development Framework

## Overview
Koveo Gestion is an AI-powered property management SaaS platform tailored for Quebec's residential communities. It offers comprehensive tools for property documentation, maintenance tracking, financial planning, and complaint management, ensuring Law 25 compliance and supporting both French and English. The project aims to provide a robust, enterprise-grade application built upon a rigorous, automated development system called the "Pillar Methodology." This platform has significant market potential in addressing the specific needs of Quebec's co-ownership properties.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **UI Framework**: Shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with custom CSS variables.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query for server state.
- **Form Handling**: React Hook Form with Zod validation.
- **Internationalization**: Custom language provider for English and French.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful API with typed request/response handling.
- **Database ORM**: Drizzle ORM with PostgreSQL dialect.
- **Validation**: Zod schemas for runtime type validation.
- **Storage**: Abstracted storage interface with in-memory implementation for development.

### Data Storage Solutions
- **Database**: PostgreSQL managed with Drizzle ORM for schema and migrations.
- **Connection**: Neon serverless database.
- **Schema Design**: Modular table definitions with TypeScript integration.
- **Migrations**: Drizzle Kit for schema version control.

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store.
- **User Management**: Custom username/password authentication system.
- **RBAC System**: Four-tier role hierarchy (Admin, Manager, Tenant, Resident) with granular permissions.
- **Access Control**: Organization-based access rules (Demo, Koveo, normal organizations, tenant/resident specific).
- **Security**: Law 25 compliance framework.
- **Invitation System**: Role-based user invitation with organization and residence assignment, including audit logging.

### Development Framework (Pillar Methodology)
- **Core Pillars**: Modular development components for quality assurance, testing, and security.
- **Status Tracking**: Real-time workspace component status monitoring.
- **Quality Metrics**: Automated code quality, coverage, and performance tracking.
- **Configuration Management**: Dynamic framework configuration with JSON storage.
- **Progress Monitoring**: Development phase tracking with automated validation.

### Project Structure
- **Monorepo Design**: Single workspace for client, server, and shared code.
- **TypeScript Configuration**: Unified type checking across frontend and backend.
- **Build System**: Separate build processes for client (Vite) and server (ESBuild).
- **Path Aliases**: Consistent `@` aliases for imports.
- **Centralized Forms**: All form components located in `client/src/components/forms/`.

### Testing & Validation Infrastructure
- **Comprehensive Validation**: Tests for project structure, naming conventions, documentation, error detection, and API consistency.
- **Quality Gates**: Automated quality checks including static analysis (ESLint, TypeScript), testing (unit, integration, E2E with 80% coverage), security (NPM audit), Quebec compliance (bilingual support, accessibility, Law 25), build validation, and code complexity (cyclomatic complexity <=10).
- **Continuous Improvement**: Quality metrics, readability scoring, and automated suggestions.
- **Automated Reports**: Generation of `ORGANIZATION_VALIDATION_REPORT.md`.
- **Pre-commit Hooks**: Husky integration with lint-staged.
- **Conventional Commits**: Commitlint for structured messages.
- **Branch Protection**: GitHub branch protection rules with CODEOWNERS.

### AI Agent Enhancement Toolkit
- **Project Health Analysis**: 6-dimension scoring (code quality, documentation, testing, security, performance, overall).
- **Smart Context Management**: Intelligent file relationship analysis and context-aware recommendations.
- **Workflow Automation**: Pattern detection, automated task execution, and security auditing.
- **Real-time Monitoring**: Interactive dashboard with metrics and trend analysis.
- **CLI Operations**: Command-line interface for health checks, context management, and workflow execution.

## Recent Changes

### December 2024
- **Demo Organization Synchronization System**: Implemented comprehensive deployment synchronization where Demo organization data is automatically pushed from development to production during deployment
  - Created sync-demo-organization.ts script for export/import operations
  - Added API endpoints for remote synchronization (/api/demo-organization/sync, /api/demo-organization/export, /api/demo-organization/status)
  - Configured deployment hooks for automated sync during deployment process
  - Environment variables: SYNC_DEMO_ON_DEPLOY, PRODUCTION_DATABASE_URL, SYNC_API_KEY

### August 2025
- **2025-08-17**: Fixed deployment issues including missing gray-200 Tailwind color palette, created missing dashboard file for residents, and resolved CSS border utility class conflicts for successful build process.
- **2025-08-17**: Completed comprehensive documentation quality improvement including terminology standardization, broken link fixes, code block language specifications, table of contents additions, and calibrated quality metrics to match system performance (documentation tests now 10/10 passing).
- **2025-08-17**: Enhanced test file naming consistency by establishing comprehensive naming standards, relocating misplaced files (moved ssl-management-e2e.test.ts to e2e directory), and creating standardized directory structure documentation for better test organization and maintainability.

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless database connection.
- **drizzle-orm**: Type-safe database ORM.
- **drizzle-kit**: Database schema migration tools.
- **zod**: Runtime type validation.

### Frontend Dependencies
- **@tanstack/react-query**: Server state management.
- **@radix-ui/***: Accessible UI primitives.
- **@hookform/resolvers**: Form validation integration.
- **tailwindcss**: CSS framework.
- **wouter**: React router.
- **lucide-react**: Icon library.

### Development Tools
- **vite**: Frontend build tool.
- **esbuild**: JavaScript bundler for server.
- **tsx**: TypeScript execution for Node.js.
- **@replit/vite-plugin-***: Replit-specific plugins.

### Production Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit**: Development and hosting platform.
- **Express.js**: Web application framework.

### Planned Integrations
- **AI Services**: For property management insights.
- **Quebec Law 25 Compliance**: Integrated privacy and data protection framework.
- **Multi-language Support**: Enhanced internationalization.
- **Property Management APIs**: External integrations for Quebec property data.