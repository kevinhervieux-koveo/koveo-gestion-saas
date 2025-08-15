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