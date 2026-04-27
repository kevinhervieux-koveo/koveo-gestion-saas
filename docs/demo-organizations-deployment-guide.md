# Demo Organizations Deployment Guide

This guide explains how the comprehensive demo organizations system works and how to deploy it in production.

## Overview

The system provides two demo organizations:

- **Demo**: Full-featured demo with read/write capabilities
- **Open Demo**: Read-only copy for public demonstrations

## System Components

### 1. Seed and Setup Scripts

The standalone "create / duplicate / sync" script trio that originally
shipped with this milestone has been retired. Demo data is now seeded by:

- `scripts/create-demo-environment.ts` — creates the Demo and Open Demo
  organizations, buildings, residences, and users in one pass.
- `scripts/setup-marketing-demo-data.ts` — loads the polished
  marketing-grade content (financial data, operations data, documents)
  on top of the base demo environment.
- `scripts/production-demo-setup.sql` — the SQL companion used by the
  deployment pipeline when seeding a fresh production database.

**Usage:**

```bash
tsx scripts/create-demo-environment.ts
tsx scripts/setup-marketing-demo-data.ts
```

### 2. Services

#### `server/services/demo-management-service.ts`

High-level demo management:

- Health checking
- Initialization during startup
- Scheduled maintenance
- API integration
- Synchronisation between Demo and Open Demo (the previous low-level
  comprehensive demo sync service has been folded into this single
  service)

### 3. API Endpoints

#### `server/api/demo-management.ts`

Provides REST API for demo management:

- `GET /api/demo/health` - Health check (public)
- `GET /api/demo/status` - Detailed status (authenticated)
- `POST /api/demo/ensure` - Ensure demos exist (admin only)
- `POST /api/demo/recreate` - Force recreation (admin only)
- `POST /api/demo/maintenance` - Run maintenance (admin only)

## Data Coverage

The comprehensive demo system covers ALL application menus:

### Residents Menu

- **My Residence**: Residence data with user assignments
- **My Building**: Building information with amenities
- **My Demands**: Maintenance requests and complaints

### Manager Menu

- **Buildings**: Multiple building types and configurations
- **Residences**: Various unit types and layouts
- **Budget**: Annual and monthly budget data
- **Bills**: Bills with different statuses and categories
- **Demands**: Maintenance requests with priorities
- **User Management**: Users with different roles

### Settings Menu

- **Settings**: User preferences and configuration
- **Bug Reports**: Sample bug reports for testing
- **Idea Box**: Feature requests with upvotes

## Deployment Instructions

### 1. Initial Setup

The system automatically initializes during application startup from
`server/routes.ts`, which calls
`DemoManagementService.initializeDemoOrganizations()` once the database
connection is ready. This ensures demo organizations are available when
the application starts.

### 2. Manual Setup

If you need to manually create demo data:

```bash
# Create the demo environment (organizations, buildings, residences, users)
tsx scripts/create-demo-environment.ts

# Load the marketing-grade content on top
tsx scripts/setup-marketing-demo-data.ts
```

### 3. Production Deployment

For production environments, demo synchronisation is exposed through the
REST API documented below (`POST /api/demo/ensure` and
`POST /api/demo/maintenance`). The health endpoint is unauthenticated and
safe to call from a deployment hook or external monitor.

### 4. Health Monitoring

Monitor demo organization health:

```bash
curl https://your-app.com/api/demo/health
```

Response:

```json
{
  "success": true,
  "data": {
    "healthy": true,
    "status": {
      "demoExists": true,
      "openDemoExists": true,
      "demoHasData": true,
      "openDemoHasData": true,
      "lastSyncNeeded": false
    },
    "message": "Demo organizations are healthy",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Maintenance

### Scheduled Maintenance

The system includes scheduled maintenance capabilities:

```typescript
// Run maintenance via API
POST / api / demo / maintenance;

// Or programmatically
await DemoManagementService.scheduledMaintenance();
```

### Manual Sync

If demo data becomes stale, call the admin-only REST endpoints described
above:

- `POST /api/demo/ensure` for a quick sync
- `POST /api/demo/recreate` to rebuild demo data from scratch

## Security Considerations

1. **Admin-only Operations**: Recreation and maintenance require admin role
2. **Health Checks**: Public endpoint for monitoring
3. **Safe Operations**: All operations are designed to be non-destructive to production data
4. **Isolated Data**: Demo organizations are completely separate from real organizations

## Troubleshooting

### Demo Organizations Missing

Call the health endpoint to check status, and use the admin
`POST /api/demo/recreate` endpoint to rebuild the demo data if needed.

### Sync Issues

1. Check database connectivity
2. Verify Demo organization exists and has data
3. Check logs for specific error messages
4. Use health check endpoint for diagnosis

### Performance

- Demo creation takes 30-60 seconds for complete data
- Sync operations are optimized for production use
- Health checks are lightweight and fast

## Development

### Local Development

```bash
# Create demo data locally
npm run demo:sync

# Check status
npm run demo:check
```

### Testing

The comprehensive demo system provides realistic test data for:

- UI testing across all menu items
- Role-based access testing
- Feature demonstration
- Performance testing with realistic data volumes

## Integration

The demo system is fully integrated into the application:

1. **Startup**: Automatic initialization
2. **API**: REST endpoints for management
3. **Monitoring**: Health checks and status reporting
4. **Maintenance**: Scheduled and on-demand sync

This ensures demo organizations are always available and properly maintained in production environments.
