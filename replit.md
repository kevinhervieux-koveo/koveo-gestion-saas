# Koveo Gestion Development Framework

## Overview

Koveo Gestion is an AI-powered property management SaaS platform designed specifically for Quebec's residential communities, syndicates, and co-ownership properties. The application provides comprehensive tools for property documentation, maintenance tracking, financial planning, and complaint management while ensuring Law 25 compliance and supporting both French and English languages.

This repository currently contains the foundational development framework implementing the "Pillar Methodology" - a rigorous, automated development system that serves as the operating foundation for building robust, enterprise-grade applications.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Security**: Planned Law 25 compliance framework for Quebec privacy regulations

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