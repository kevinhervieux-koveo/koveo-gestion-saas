# Koveo Gestion Development Framework

## Overview

Koveo Gestion is an AI-powered SaaS platform for property management in Quebec's residential communities. It provides tools for documentation, maintenance, financial planning, and complaint management, ensuring compliance with Law 25 and supporting both French and English. The project aims to deliver an enterprise-grade application using a rigorous, automated development system called the "Pillar Methodology," targeting significant market potential in Quebec's co-ownership properties.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript and Vite.
- **UI**: Shadcn/ui (built on Radix UI) and Tailwind CSS.
- **Routing**: Wouter.
- **State Management**: TanStack Query.
- **Form Handling**: React Hook Form with Zod validation.
- **Internationalization**: Custom language provider for English and French.
- **UI/UX Decisions**: All forms are responsive with single scroll bar behavior, using `max-h-[90vh]` and `overflow-y-auto` on dialog containers.

### Backend

- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API**: RESTful API with typed request/response handling.
- **ORM**: Drizzle ORM for PostgreSQL.
- **Validation**: Zod schemas.

### Data Storage

- **Database**: PostgreSQL via Drizzle ORM and Neon serverless database.
- **Dual Database Environment**: Development (DATABASE_URL) and Production (DATABASE_URL_KOVEO) databases are maintained in sync, requiring all schema changes to be applied to both.
- **Schema Management**: Drizzle Kit for migrations and TypeScript integration.

### Authentication and Authorization

- **Session Management**: Express sessions with PostgreSQL store.
- **User Management**: Custom username/password system, token-based password reset, multi-step registration with privacy consent (Law 25).
- **RBAC**: Four-tier role hierarchy (Admin, Manager, Tenant, Resident) with granular permissions and organization-based access.
- **Security**: Law 25 compliance framework.

### Features

- **Document Management**: Full system with role-based access control (Admin: full, Manager: organization-wide, Resident: residence/building, Tenant: view-only). Supports upload/download, categorization, and assignment.
- **Property Management**:
  - **Buildings**: Comprehensive management for Admin/Manager roles (view, create, edit, delete).
  - **Residences**: Auto-generated (max 300 units/building) with advanced search, filtering, pagination, and multi-parking/storage support.

### Development Framework (Pillar Methodology)

- **Core Principles**: Modular components for quality assurance, testing, and security.
- **Hot Reload System**: Automated development server with file watching and rapid rebuild capabilities (1-3 second rebuilds). Supports selective restarts for frontend, backend, or full stack.
- **Monitoring**: Real-time workspace status, automated quality metrics.
- **Configuration**: Dynamic framework configuration.
- **Progress Tracking**: Automated validation.

### Project Structure

- **Monorepo**: Single workspace for client, server, and shared code.
- **TypeScript**: Unified type checking.
- **Build System**: Separate builds for client (Vite) and server (ESBuild).

### Testing & Validation

- **Comprehensive Test Suite**: Robust testing infrastructure with Jest configuration covering unit tests, integration tests, and Quebec Law 25 compliance validation. Core test categories include Dashboard Components (15/15 passing), Form Validation (12/12 passing), API Routes Validation (15/15 passing), and Quebec compliance patterns.
- **Test Infrastructure**: Advanced Jest configuration with ES module support, comprehensive server mocking system, and unified database mocking for reliable test execution. Includes strategic import mocking to resolve module compatibility issues.
- **Quality Gates**: Automated checks including static analysis (ESLint, TypeScript), testing (unit, integration, E2E with targeted coverage), security (NPM audit), Quebec compliance (bilingual, Law 25), build validation, and code complexity.
- **Testing Framework**: Modular mock system architecture with `serverApiMock.js`, `schemaMock.js`, `serverDbMock.js`, and `unified-database-mock.ts` for consistent test environment isolation.
- **Developer Workflow**: Husky pre-commit hooks, lint-staged, Commitlint with reliable test execution foundation.

### AI Agent Enhancement Toolkit

- **Project Health Analysis**: 6-dimension scoring.
- **Smart Context Management**: Intelligent file relationship analysis.
- **Workflow Automation**: Pattern detection, automated task execution, security auditing.
- **Real-time Monitoring**: Interactive dashboard.
- **CLI Operations**: For health checks, context management, workflow execution.

## External Dependencies

- **@neondatabase/serverless**: PostgreSQL serverless database connection.
- **drizzle-orm**: Type-safe database ORM.
- **drizzle-kit**: Database schema migration tools.
- **zod**: Runtime type validation.
- **@tanstack/react-query**: Server state management (frontend).
- **@radix-ui/**: Accessible UI primitives (frontend).
- **@hookform/resolvers**: Form validation integration (frontend).
- **tailwindcss**: CSS framework (frontend).
- **wouter**: React router (frontend).
- **lucide-react**: Icon library (frontend).
- **vite**: Frontend build tool.
- **esbuild**: JavaScript bundler for server.
- **tsx**: TypeScript execution for Node.js.
- **@replit/vite-plugin-***: Replit-specific plugins.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit**: Development and hosting platform.
- **Express.js**: Web application framework.
- **SendGrid**: Email service integration (for password reset and invitations).