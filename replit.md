# Koveo Gestion Development Framework

## Overview
Koveo Gestion is an AI-powered SaaS platform for property management, specifically designed for Quebec's residential communities. It offers comprehensive tools for documentation, maintenance, financial planning, and complaint management, ensuring compliance with Law 25 and supporting both French and English. The project aims to deliver a robust, enterprise-grade application using a rigorous, automated development system called the "Pillar Methodology," with significant market potential in Quebec's co-ownership properties.

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
- **Schema Management**: Drizzle Kit for migrations and TypeScript integration.

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL store.
- **User Management**: Custom username/password system, password reset system (token-based, email integration with SendGrid, 1-hour expiry, SHA-256 hashing), multi-step registration wizard (invitation token validation, password creation, Quebec Law 25 privacy consent).
- **RBAC**: Four-tier role hierarchy (Admin, Manager, Tenant, Resident) with granular permissions and organization-based access rules.
- **Security**: Law 25 compliance framework.

### Features
- **Document Management**: Full system with role-based access control (Admin: full, Manager: organization-wide, Resident: residence/building, Tenant: view-only). Supports upload/download, categorization, assignment. Document navigation uses SPA.
- **Property Management**:
    - **Buildings**: Comprehensive management for Admin/Manager roles (view, create, edit, delete). Koveo organization users have global access.
    - **Residences**: Auto-generated (max 300 units/building) with advanced search, filtering, pagination, and multi-parking/storage support. Role-based access.

### Development Framework (Pillar Methodology)
- **Core Principles**: Modular components for quality assurance, testing, and security.
- **Monitoring**: Real-time workspace status, automated quality metrics.
- **Configuration**: Dynamic framework configuration.
- **Progress Tracking**: Automated validation.

### Project Structure
- **Monorepo**: Single workspace for client, server, and shared code.
- **TypeScript**: Unified type checking.
- **Build System**: Separate builds for client (Vite) and server (ESBuild).

### Testing & Validation
- **Comprehensive Test Suite**: Covers Demands Schema, RBAC, Quebec Law 25 Compliance, React Components, and Payment Plan. Achieves 100% pass rate.
- **Quality Gates**: Automated checks including static analysis (ESLint, TypeScript), testing (unit, integration, E2E with 80% coverage), security (NPM audit), Quebec compliance (bilingual, Law 25), build validation, and code complexity.
- **Developer Workflow**: Husky pre-commit hooks, lint-staged, Commitlint.

### AI Agent Enhancement Toolkit
- **Project Health Analysis**: 6-dimension scoring.
- **Smart Context Management**: Intelligent file relationship analysis.
- **Workflow Automation**: Pattern detection, automated task execution, security auditing.
- **Real-time Monitoring**: Interactive dashboard.
- **CLI Operations**: For health checks, context management, workflow execution.

## External Dependencies

### Core Framework
- **@neondatabase/serverless**: PostgreSQL serverless database connection.
- **drizzle-orm**: Type-safe database ORM.
- **drizzle-kit**: Database schema migration tools.
- **zod**: Runtime type validation.

### Frontend
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
- **SendGrid**: Email service integration (for password reset and invitations).
```