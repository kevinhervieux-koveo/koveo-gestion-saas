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
- **User Management**: Custom username/password system.
- **RBAC**: Four-tier role hierarchy (Admin, Manager, Tenant, Resident) with granular permissions.
- **Access Control**: Organization-based access rules (Demo, Koveo, normal organizations, tenant/resident specific).
- **Security**: Law 25 compliance framework.
- **Invitation System**: Role-based user invitation with organization/residence assignment, audit logging, and simplified process without 2FA.

### Development Framework (Pillar Methodology)
- **Core Principles**: Modular components for quality assurance, testing, and security.
- **Monitoring**: Real-time workspace status, automated quality metrics (code quality, coverage, performance).
- **Configuration**: Dynamic framework configuration.
- **Progress Tracking**: Automated validation for development phases.

### Project Structure
- **Monorepo**: Single workspace for client, server, and shared code.
- **TypeScript**: Unified type checking.
- **Build System**: Separate builds for client (Vite) and server (ESBuild).
- **Conventions**: Consistent path aliases and centralized form component location.

### Testing & Validation
- **Comprehensive Validation**: Covers project structure, naming, documentation, error detection, API consistency.
- **Quality Gates**: Automated checks including static analysis (ESLint, TypeScript), testing (unit, integration, E2E with 80% coverage), security (NPM audit), Quebec compliance (bilingual support, accessibility, Law 25), build validation, and code complexity (cyclomatic complexity <=10).
- **Continuous Improvement**: Quality metrics, readability scoring, automated suggestions, and `ORGANIZATION_VALIDATION_REPORT.md` generation.
- **Developer Workflow**: Husky pre-commit hooks, lint-staged, Commitlint for conventional commits, GitHub branch protection with CODEOWNERS.

### AI Agent Enhancement Toolkit
- **Project Health Analysis**: 6-dimension scoring (code quality, documentation, testing, security, performance, overall).
- **Smart Context Management**: Intelligent file relationship analysis and context-aware recommendations.
- **Workflow Automation**: Pattern detection, automated task execution, and security auditing.
- **Real-time Monitoring**: Interactive dashboard with metrics and trend analysis.
- **CLI Operations**: Command-line interface for health checks, context management, and workflow execution.

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

### Planned Integrations (Future)
- **AI Services**: For property management insights.
- **Quebec Law 25 Compliance**: Integrated privacy and data protection framework.
- **Multi-language Support**: Enhanced internationalization.
- **Property Management APIs**: External integrations for Quebec property data.