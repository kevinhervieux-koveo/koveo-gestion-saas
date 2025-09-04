# Project Structure Guide

## Overview

This guide provides a comprehensive overview of the Koveo Gestion project structure, including organization principles, naming conventions, and best practices for maintaining a clean, scalable codebase.

## Directory Structure

```
koveo-gestion/
├── client/                     # Frontend React application
│   ├── public/                 # Static assets
│   └── src/
│       ├── components/         # Reusable UI components
│       │   ├── ui/            # Base UI components (shadcn/ui)
│       │   ├── forms/         # Form components
│       │   └── index.ts       # Component exports
│       ├── pages/             # Page components organized by role
│       │   ├── admin/         # Admin-only pages
│       │   ├── manager/       # Manager pages
│       │   ├── residents/     # Resident pages
│       │   ├── auth/          # Authentication pages
│       │   ├── settings/      # Settings pages
│       │   └── index.ts       # Page exports
│       ├── hooks/             # Custom React hooks
│       ├── lib/               # Utility libraries
│       ├── utils/             # Utility functions
│       └── config/            # Client configuration
├── server/                     # Backend Express application
│   ├── api/                   # API route handlers
│   ├── auth/                  # Authentication & authorization
│   ├── config/                # Server configuration
│   ├── constants/             # Server constants
│   ├── controllers/           # Request controllers
│   ├── db/                    # Database operations
│   │   └── queries/           # Organized query modules
│   ├── jobs/                  # Background jobs
│   ├── middleware/            # Express middleware
│   ├── services/              # Business logic services
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Server utilities
├── shared/                     # Shared code between client/server
│   └── schema.ts              # Database schema & types
├── config/                     # Configuration files
├── docs/                       # Documentation
│   ├── guides/                # Implementation guides
│   ├── references/            # Reference documentation
│   └── reports/               # Generated reports
├── tests/                      # Test files
├── tools/                      # Development tools
└── scripts/                    # Build and deployment scripts
```

## Organization Principles

### 1. Separation of Concerns

- **Client**: All frontend code in `client/`
- **Server**: All backend code in `server/`
- **Shared**: Common types and schemas in `shared/`

### 2. Feature-Based Organization

- API routes organized by domain (`users`, `organizations`, `buildings`)
- Page components organized by user role (`admin`, `manager`, `residents`)
- Database queries grouped by entity type

### 3. Consistent Naming Conventions

- **Files**: kebab-case (`user-management.tsx`)
- **Directories**: kebab-case (`api-routes/`)
- **Components**: PascalCase (`UserManagement`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: SCREAMING_SNAKE_CASE (`HTTP_STATUS`)

### 4. Index File Exports

- Each major directory has an `index.ts` for clean imports
- Re-export patterns for commonly used modules
- Centralized access to related functionality

## Client Structure Details

### Components Organization

```
client/src/components/
├── ui/                    # Base UI components (buttons, inputs, etc.)
├── forms/                 # Form-specific components
│   ├── building-form.tsx
│   ├── organization-form.tsx
│   └── index.ts          # Form exports
├── layout/                # Layout components (header, sidebar, footer)
├── features/              # Feature-specific components
└── index.ts              # All component exports
```

### Pages Organization

```
client/src/pages/
├── admin/                 # Admin role pages
│   ├── dashboard.tsx
│   ├── users.tsx
│   ├── organizations.tsx
│   └── index.ts
├── manager/               # Manager role pages
├── residents/             # Resident role pages
├── auth/                  # Authentication pages
├── settings/              # Settings pages
└── index.ts              # All page exports
```

## Server Structure Details

### API Organization

```
server/api/
├── users.ts              # User-related endpoints
├── organizations.ts      # Organization endpoints
├── buildings.ts          # Building endpoints
├── auth.ts               # Authentication endpoints
└── index.ts              # API route exports
```

### Configuration Management

```
server/config/
├── index.ts              # Main configuration
├── database.ts           # Database configuration
├── email.ts              # Email service configuration
└── security.ts           # Security settings
```

### Type Definitions

```
server/types/
├── index.ts              # Main type exports
├── api.ts                # API-specific types
├── auth.ts               # Authentication types
└── database.ts           # Database-specific types
```

## Best Practices

### 1. Import Organization

```typescript
// External imports first
import React from 'react';
import { Router } from 'wouter';

// Internal imports with path aliases
import { Button } from '@/components/ui';
import { UserForm } from '@/components/forms';
import { getUserById } from '@shared/schema';
```

### 2. Component Structure

```typescript
// Component definition
interface ComponentProps {
  // Props interface
}

export function Component({ prop }: ComponentProps) {
  // Component implementation
}

// Default export for pages, named export for components
export default Component; // For pages
export { Component }; // For reusable components
```

### 3. File Naming

- Use descriptive, specific names
- Avoid generic names like `utils.ts` or `helpers.ts`
- Include the entity or feature in the name
- Examples: `user-validation.ts`, `building-queries.ts`

### 4. Directory Organization

- Group related files together
- Use subdirectories for complex features
- Maintain consistent depth (avoid deep nesting)
- Include README files for complex directories

## Configuration Standards

### Environment Variables

- Use TypeScript schema validation
- Provide sensible defaults
- Document all required variables
- Group by functionality (database, email, security)

### Type Safety

- Define interfaces for all data structures
- Use strict TypeScript configuration
- Validate data at boundaries (API, database)
- Share types between client and server

## Documentation Standards

### Code Documentation

- JSDoc comments for all public functions
- Interface documentation with examples
- Complex logic explanation
- Quebec compliance notes where applicable

### File Documentation

- README files for major directories
- Architecture decision records (ADRs)
- API documentation with examples
- Database schema documentation

## Maintenance Guidelines

### Regular Cleanup

- Remove unused files and dependencies
- Update outdated documentation
- Refactor inconsistent naming
- Consolidate duplicate functionality

### Quality Checks

- Run linting and formatting tools
- Validate import organization
- Check for circular dependencies
- Monitor bundle size and performance

### Consistency Monitoring

- Automated checks for naming conventions
- File organization validation
- Documentation coverage tracking
- Import pattern analysis

This structure ensures maintainability, scalability, and consistency across the Koveo Gestion codebase while supporting Quebec-specific requirements and modern development practices.
