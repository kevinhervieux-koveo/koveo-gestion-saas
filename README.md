# Koveo Gestion

> AI-powered property management SaaS platform tailored for Quebec's residential communities

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/koveo/koveo-gestion)
[![Test Coverage](https://img.shields.io/badge/coverage-90%25-green)](https://github.com/koveo/koveo-gestion)
[![License](https://img.shields.io/badge/license-Proprietary-blue)](LICENSE)
[![Quebec Compliance](https://img.shields.io/badge/Law%2025-compliant-blue)](docs/QUEBEC_COMPLIANCE_EXAMPLES.md)
[![Documentation](https://img.shields.io/badge/docs-comprehensive-blue)](docs/README.md)

## Overview

Koveo Gestion is a comprehensive property management platform designed specifically for Quebec's co-ownership properties. Built with enterprise-grade architecture, it provides robust tools for property documentation, maintenance tracking, financial planning, and complaint management while ensuring full compliance with Law 25.

### Key Features

- **🏢 Property Management**: Complete building and residence management system
- **👥 User Management**: Advanced RBAC with four-tier role hierarchy
- **💰 Financial Tracking**: Budget management and billing systems
- **🔧 Maintenance**: Request tracking and scheduling system
- **📊 Analytics**: Comprehensive reporting and dashboards
- **🌍 Bilingual**: Full French and English support
- **🔒 Law 25 Compliant**: Quebec privacy and data protection

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/koveo/koveo-gestion.git
cd koveo-gestion

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Initialize database
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

### Demo Access

```bash
# Admin user
Email: admin@koveo.com
Password: admin123

# Manager user
Email: manager@koveo.com
Password: manager123
```

## Architecture

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Shadcn/ui built on Radix UI
- **State Management**: TanStack Query
- **Authentication**: Custom session-based auth with RBAC

### Project Structure

```
koveo-gestion/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Application pages
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utility libraries
├── server/              # Express.js backend
│   ├── routes/          # API route handlers
│   ├── middleware/      # Express middleware
│   └── utils/           # Server utilities
├── shared/              # Shared code between client/server
│   ├── schema.ts        # Database schema definitions
│   └── types.ts         # TypeScript type definitions
├── docs/                # Comprehensive documentation
└── tests/               # Test suites (unit, integration, e2e)
```

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Database
npm run db:generate     # Generate database migrations
npm run db:push         # Push schema changes to local dev database
npm run db:studio       # Open Drizzle Studio
npx tsx scripts/run-migrations.ts             # Apply pending SQL migrations
npx tsx scripts/run-migrations.ts --status    # Show applied / pending
npx tsx scripts/run-migrations.ts --baseline  # Force-baseline existing DB

# Testing
npm test                # Run all tests
npm run test:unit       # Run unit tests
npm run test:e2e        # Run end-to-end tests
npm run test:coverage   # Generate coverage report

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript checks
npm run format          # Format code with Prettier
```

### Database Migrations

Schema changes are tracked as numbered SQL files under `migrations/`
(e.g. `0008_org_code_and_bill_source.sql`). A custom runner at
`scripts/run-migrations.ts` applies any unapplied files in lexical
order and records each one in a `schema_migrations` table.

**On deploy / publish:** the runner is wired into the deploy *build*
phase. The build command in `.replit` is
`npm run build && npm run migrate`, where `npm run migrate` invokes
`npx tsx scripts/run-migrations.ts` against the production database.
A non-zero exit from the migrate step fails the build itself, so the
deploy aborts before `npm run start` is ever invoked and the previous
revision keeps serving traffic. The failing filename is printed as
`[migrate] FAILED applying <filename>` in the deploy build logs.

As a defense-in-depth belt-and-braces measure, the production server
*also* invokes the runner at startup before any HTTP routes are
registered, so even an out-of-band boot (e.g. a manual `npm run start`)
will not serve traffic against an out-of-date schema. There is no
half-applied state because each file runs in its own transaction. The
runner uses a Postgres advisory lock so multiple booting Autoscale
instances cannot race each other. The startup logs include
`Highest applied migration: <filename>` so it is obvious from the
deploy logs whether prod is in sync.

**On a database that pre-existed this runner** (e.g. our current
production, which was historically managed via `db:push`), the very
first run sees an empty `schema_migrations` table plus an existing
`users` table and auto-baselines: every numbered file currently in
`migrations/` is recorded as already applied without re-executing it.
This prevents the first post-deploy run from trying to recreate
existing tables.

**Adding a new migration:**

1. Create the next numbered file in `migrations/`, e.g.
   `migrations/0009_add_widgets_table.sql`.
2. Write the change as idempotent SQL where possible
   (`CREATE TABLE IF NOT EXISTS …`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`,
   `DO $$ BEGIN IF NOT EXISTS (...) THEN ... END IF; END $$;` for
   constraints).
3. Run it locally against your dev DB:
   `npx tsx scripts/run-migrations.ts`.
4. Update `shared/schema.ts` to match.
5. Commit both the SQL file and the schema change. The next deploy
   will apply the SQL automatically.

**Recovering from a failed deploy-time migration:**

- The deploy will have aborted before serving the new code, so the old
  app is still running against the old schema.
- Inspect the failure in the deploy logs (`[migrate] FAILED applying
  …`), fix the SQL (either the same file if it never recorded, or by
  adding a follow-up numbered file), and redeploy. The runner will
  pick up only the still-unapplied files.
- To inspect state ad-hoc:
  `npx tsx scripts/run-migrations.ts --status`.

`SKIP_DB_MIGRATIONS=true` disables the startup runner (used by tests).
`RUN_DB_MIGRATIONS=true` opts in for non-production environments.

### Development Workflow

1. **Feature Development**: Create feature branches from `main`
2. **Code Quality**: All code must pass linting, type checking, and tests
3. **Documentation**: Update relevant documentation for new features
4. **Testing**: Maintain 80%+ test coverage
5. **Review**: All changes require code review

## User Roles & Permissions

The platform implements a comprehensive RBAC system with four main roles:

### Admin

- Full system access and configuration
- User management and organization setup
- System monitoring and maintenance

### Manager

- Building and property management
- Financial oversight and reporting
- Maintenance coordination

### Tenant

- Unit management and resident coordination
- Maintenance requests and approvals
- Financial reporting for units

### Resident

- Personal profile and unit information
- Maintenance request submission
- Bill viewing and notifications

For detailed permissions, see [RBAC Documentation](docs/RBAC_SYSTEM.md).

## API Documentation

The platform provides a comprehensive REST API for all operations.

### Authentication

```bash
# Login
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

### Key Endpoints

- **Users**: `/api/users` - User management
- **Buildings**: `/api/buildings` - Building operations
- **Residences**: `/api/residences` - Unit management
- **Maintenance**: `/api/maintenance` - Request handling
- **Bills**: `/api/bills` - Financial operations

For complete API documentation, see [API Reference](docs/API_DOCUMENTATION.md).

## Testing

The project maintains a robust testing infrastructure with comprehensive coverage across multiple dimensions:

```bash
# Test Structure
__tests__/
├── unit/           # Component and function tests
├── integration/    # API and database tests  
├── e2e/           # End-to-end user flows
├── mobile/        # Mobile responsiveness tests
├── organization/   # Quebec compliance tests
└── mocks/         # Testing infrastructure
    ├── unified-database-mock.ts    # Database testing framework
    ├── serverApiMock.js           # Server route mocking
    ├── schemaMock.js              # Schema validation mocking
    └── serverDbMock.js            # Database operation mocking
```

### Test Infrastructure

- **Jest Configuration**: Advanced setup with ES module support and strategic server mocking
- **Core Test Success**: Dashboard Components (15/15), Form Validation (12/12), API Routes (15/15)
- **Quebec Compliance**: Bilingual form validation and Law 25 compliance testing
- **Mock Architecture**: Comprehensive server import mocking for reliable test isolation

### Quality Metrics

- **Test Reliability**: Stable execution foundation with Jest ES module support (September 2025)
- **Core Test Success**: Dashboard Components (15/15), Form Validation (12/12), API Routes (15/15)
- **Code Quality**: A+ grade via ESLint analysis with TypeScript strict mode
- **Security**: Regular vulnerability scanning with Quebec Law 25 compliance
- **Performance**: Sub-200ms average response times
- **Test Coverage**: 90%+ across critical application paths

## Deployment

### Production Deployment

The application is optimized for deployment on Replit with automatic:

- Database optimization and indexing
- SSL certificate management
- Performance monitoring
- Background job processing

### Environment Variables

Key configuration options:

```bash
DATABASE_URL=postgresql://...          # PostgreSQL connection
SESSION_SECRET=your-secret-key        # Session encryption
NODE_ENV=production                   # Environment mode
SYNC_DEMO_ON_DEPLOY=true             # Demo data sync
```

### Boot-time memory tuning

The server is tuned to start cleanly on a 0.5 vCPU / 2 GiB Reserved VM by
deferring every non-critical subsystem off the boot path. The following
flags control what runs at startup; defaults are chosen so a fresh
production deploy stays under the memory ceiling:

```bash
# Skip the entire advanced query-optimization stack (baseline metrics,
# materialized views refresh, scope-cache warmup for every active user,
# reference-cache warmup, verification passes). Caches populate lazily
# on first request. Recommended ON for memory-constrained deployments.
SKIP_QUERY_OPTIMIZATION=true

# Enable the MCP (Model Context Protocol) server: OAuth provider,
# transports, tool registration, hourly sweep. Default OFF in production
# because it is not used by the user-facing app and costs noticeable
# boot memory. Default ON in dev/test.
ENABLE_MCP_SERVER=true
```

When `SKIP_QUERY_OPTIMIZATION` is *not* set, cache warmup
(`warmupCaches` / `warmupScopeCaches`) is automatically deferred to
~30 seconds after the HTTP port is bound, so it never competes with
route registration for memory. The Gemini AI client is also lazy: it
is built the first time an AI feature is actually invoked, never at
module-import time, so deployments that don't use AI features pay no
boot cost for it.

A boot-footprint summary line is logged right after `Server listening on
http://0.0.0.0:5000` so production logs make it obvious which subsystems
were skipped vs deferred.

## Quebec Compliance

Koveo Gestion is built specifically for Quebec's regulatory environment:

### Law 25 Compliance

- **Privacy by Design**: Data protection built into architecture
- **Consent Management**: Explicit user consent tracking
- **Data Minimization**: Only collect necessary information
- **Breach Notification**: Automated compliance reporting

### Bilingual Support

- **Interface**: Complete French and English translations
- **Documentation**: Bilingual user guides and help
- **Legal**: Quebec-specific terms and conditions

See [Quebec Compliance Guide](docs/QUEBEC_COMPLIANCE_EXAMPLES.md) for detailed implementation.

## Contributing

### Development Guidelines

1. **Code Style**: Follow ESLint and Prettier configurations
2. **Commits**: Use conventional commit messages
3. **Testing**: Include tests for new features
4. **Documentation**: Update docs for user-facing changes

### Reporting Issues

Please report bugs and feature requests via GitHub Issues with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- System information

## Support

- **Documentation**: Comprehensive guides in `/docs`
- **Examples**: Implementation examples in codebase
- **Community**: Developer discussions and Q&A

## Roadmap

### Current Focus (Q1 2025)

- Enhanced mobile responsiveness
- Advanced reporting features
- API performance optimization

### Upcoming (Q2-Q3 2025)

- Multi-tenant architecture
- Advanced analytics dashboard
- Third-party integrations

See [Detailed Roadmap](ROADMAP.md) for complete development timeline.

## License

This project is proprietary software owned by Koveo Inc. All rights reserved.

---

**Koveo Gestion** - Empowering Quebec's property management with intelligent, compliant solutions.
