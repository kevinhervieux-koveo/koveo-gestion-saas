# Koveo Gestion Development Framework

## Overview
Koveo Gestion is an AI-powered SaaS platform for property management, specifically designed for Quebec's residential communities. It offers comprehensive tools for documentation, maintenance, financial planning, and complaint management, ensuring compliance with Law 25 and supporting both French and English. The project aims to deliver a robust, enterprise-grade application using a rigorous, automated development system called the "Pillar Methodology," with significant market potential in Quebec's co-ownership properties.

## Recent Changes (August 2025)
- **Password Reset System Completed**: Full password reset functionality with secure token-based authentication, email integration, and comprehensive frontend pages
- **Registration System Completed**: Multi-step registration wizard with invitation token validation, password creation, and Quebec Law 25 privacy consent fully implemented and tested
- **Database Schema Enhanced**: Added password_reset_tokens table with security features (token expiration, one-time use, SHA-256 hashing)
- **Email Service Integration**: SendGrid integration for password reset emails with French/English templates
- **Frontend Pages Added**: Forgot password and reset password pages with proper styling and error handling
- **Security Features**: Password reset tokens expire after 1 hour, secure token generation, and proper validation
- **Database Schema Fixed**: Added missing username field to users table and updated user creation logic
- **Privacy Consent Enhanced**: Collapsible "Collecte et traitement des données" section with master checkbox functionality
- **Contact Information Updated**: Phone number displays correct "514-712-8441" from PHONE_CONTACT secret

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
- **Invitation System**: Role-based user invitation with organization/residence assignment, audit logging, SendGrid email integration, automatic replacement of existing invitations, and simplified process without 2FA. Complete multi-step registration wizard with token validation, password creation, and Quebec Law 25 privacy consent with collapsible data collection section and master checkbox functionality.
- **Buildings Management**: Comprehensive building management system with role-based access control where Admin and Manager roles can view all buildings in their organization, while Resident and Tenant roles are restricted from accessing Manager and Admin features. Features include real-time search functionality for building names and addresses, admin-only building creation with organization assignment, and edit/delete capabilities (Admin and Manager can edit all building information, only Admin can delete buildings). Special privilege: Koveo organization users have global access to view buildings from all organizations.
- **Residences Management**: Complete residences management system with automatic generation of residences when buildings are created (max 300 units per building). Features include advanced search by unit number or assigned person name, filtering by building and floor, pagination with 10 residences per page, and comprehensive edit functionality. Each residence supports multiple parking spots and storage spaces as arrays. Role-based access ensures users can only see residences in buildings they have access to. No create/delete buttons exist since residences are auto-generated from building data.

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