# Koveo Gestion Documentation

> Last updated: September 09, 2025 with comprehensive documentation review and current project status

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Component Documentation](#component-documentation)
- [Architecture Guide](#architecture-guide)
- [Development Guidelines](#development-guidelines)
- [Quality System](#quality-system)
- [Deployment Guide](#deployment-guide)

## Project Overview

Koveo Gestion is an AI-powered property management SaaS platform designed specifically for Quebec's residential communities. Built with React, TypeScript, and PostgreSQL, it provides comprehensive tools for property documentation, maintenance tracking, financial planning, and complaint management while ensuring Law 25 compliance.

## Getting Started

### Prerequisites

- Node.js 20+ (Latest LTS recommended)
- PostgreSQL 14+ (Neon serverless supported)
- npm package manager (package-lock.json included)

### Installation

```bash
npm install
npm run db:push
npm run dev
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `EMAIL_*`: Email service configuration

## API Documentation

### Complete API Reference

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for comprehensive endpoint documentation including:

- Authentication endpoints
- User and organization management
- Financial and maintenance systems
- Document management
- Notification system

### Quick Start Examples

**Authentication:**

```typescript
// Login
POST /api/auth/login
{
  "username": "user@example.com",
  "password": "password123"
}

// Get current user
GET /api/auth/user
```

**User Management:**

```typescript
// Create user
POST /api/users
{
  "email": "newuser@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "tenant",
  "organizationId": "org-id"
}
```

## Component Documentation

### UI Components

See [COMPONENT_DOCUMENTATION.md](./COMPONENT_DOCUMENTATION.md) for detailed component usage including:

- Form components with validation
- Layout and navigation components
- Data display components
- Admin interface components

### Component Architecture

All components follow these patterns:

- **Forms**: Zod validation + React Hook Form
- **Data Fetching**: TanStack Query
- **Styling**: Tailwind CSS + Shadcn/ui
- **Type Safety**: Full TypeScript integration

## Architecture Guide

### System Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   React + Vite  │◄──►│   Express + TS  │◄──►│   PostgreSQL    │
│   TanStack Query│    │   Drizzle ORM   │    │   + Migrations  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Technologies

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL with Neon serverless
- **Authentication**: Session-based with RBAC
- **Testing**: Jest, Testing Library

### Project Structure

```text
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Route components
│   │   └── lib/         # Utilities and hooks
├── server/          # Express backend
│   ├── api/         # API route modules
│   ├── services/    # Business logic
│   └── routes.ts    # Main route definitions
├── shared/          # Shared types and schemas
└── docs/           # Documentation
```

## Development Guidelines

### Code Quality Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Comprehensive rule set
- **Prettier**: Automatic code formatting
- **Testing**: 80%+ code coverage requirement

### Development Workflow

1. Create feature branch from `main`
2. Implement changes with tests
3. Run quality checks: `npm run lint && npm run test`
4. Submit pull request with documentation updates

### Database Changes

```bash
# Update schema in shared/schema.ts
# Push changes to database
npm run db:push

# Generate migrations (production)
npm run db:generate
npm run db:migrate
```

## Quality System

### Automated Quality Checks

- **Static Analysis**: ESLint, TypeScript compiler
- **Testing**: Unit, integration, and E2E tests
- **Security**: NPM audit, dependency scanning
- **Performance**: Bundle size analysis
- **Compliance**: Quebec Law 25 requirements

### Quality Metrics

- Code coverage: 80%+ required
- Cyclomatic complexity: ≤10 per function
- Build success: Zero errors/warnings
- Documentation: All public APIs documented

### Pre-commit Hooks

- Code formatting (Prettier)
- Lint fixes (ESLint)
- Type checking (TypeScript)
- Test execution

## Deployment Guide

### Environment Requirements

- **Production**: Replit deployment platform
- **Database**: Neon PostgreSQL serverless
- **SSL**: Automatic certificate management
- **Monitoring**: Built-in health checks

### Deployment Process

1. Code review and approval
2. Automated testing pipeline
3. Build verification
4. Production deployment
5. Health check validation

### Environment Variables

See [Deployment Guide](./guides/DEPLOYMENT_GUIDE.md) for complete environment configuration.

## Documentation Standards

### Documentation Types

1. **API Documentation**: Complete endpoint reference
2. **Component Documentation**: Usage examples and props
3. **Architecture Documentation**: System design and patterns
4. **User Documentation**: Feature guides and tutorials

### Contributing to Documentation

- Update documentation with code changes
- Include code examples for new features
- Maintain table of contents for long documents
- Use consistent terminology across all docs

### Documentation Quality

- All code blocks must specify language
- Internal links must be valid
- Examples must be tested and working
- Maintain bilingual support (English/French)

## Support and Resources

### Internal Resources

- [Quality System Overview](QUALITY_SYSTEM_OVERVIEW.md)
- [Code Review Guide](CODE_REVIEW_GUIDE.md)
- [Testing Strategy](./guides/TESTING_STRATEGY.md)

### External Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Drizzle ORM Guide](https://orm.drizzle.team/)
- [TanStack Query](https://tanstack.com/query/latest)

## License and Compliance

This project maintains compliance with Quebec Law 25 and includes:

- Privacy-first data handling
- Bilingual interface support
- Accessibility standards (WCAG 2.1)
- Data protection frameworks

---

Last Updated: 2025-09-09
Version: 2.1.0
