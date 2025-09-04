# Demo Organizations Deployment Guide

This guide explains how the comprehensive demo organizations system works and how to deploy it in production.

## Overview

The system provides two demo organizations:

- **Demo**: Full-featured demo with read/write capabilities
- **Open Demo**: Read-only copy for public demonstrations

## System Components

### 1. Core Scripts

#### `scripts/create-comprehensive-demo.ts`

Creates complete demo data covering all application aspects:

- Organizations (Demo and Open Demo)
- Buildings with varied configurations
- Residences with different types
- Users with all roles (admin, manager, tenant, resident)
- Financial data (bills, budgets, money flow)
- Operations data (maintenance, demands, notifications)
- Settings data (bugs, feature requests)
- Documents (building and residence level)

**Usage:**

```bash
tsx scripts/create-comprehensive-demo.ts
```

#### `scripts/duplicate-demo-to-open-demo.ts`

Duplicates Demo organization to Open Demo:

- Complete data replication
- User email domain changes (@demo.com → @opendemo.com)
- Preserves all relationships
- Safe cleanup of existing data

**Usage:**

```bash
tsx scripts/duplicate-demo-to-open-demo.ts
```

#### `scripts/production-demo-sync.ts`

Production-safe synchronization script:

- Detects missing organizations
- Creates demo data if needed
- Synchronizes Demo → Open Demo
- Can be run during deployment

**Usage:**

```bash
# Normal sync
tsx scripts/production-demo-sync.ts

# Check status only
tsx scripts/production-demo-sync.ts --check-only

# Force recreation
tsx scripts/production-demo-sync.ts --force-recreate

# Silent operation
tsx scripts/production-demo-sync.ts --silent
```

### 2. Services

#### `server/services/comprehensive-demo-sync-service.ts`

Low-level synchronization service:

- Full data mapping between organizations
- Handles all table relationships
- Safe cleanup and recreation

#### `server/services/demo-management-service.ts`

High-level demo management:

- Health checking
- Initialization during startup
- Scheduled maintenance
- API integration

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

The system automatically initializes during application startup:

```typescript
// In server/routes-minimal.ts
DemoManagementService.initializeDemoOrganizations();
```

This ensures demo organizations are available when the application starts.

### 2. Manual Setup

If you need to manually create demo data:

```bash
# Create comprehensive demo data
tsx scripts/create-comprehensive-demo.ts

# Duplicate to Open Demo
tsx scripts/duplicate-demo-to-open-demo.ts
```

### 3. Production Deployment

For production environments, the sync script can be run during deployment:

```bash
# In deployment script
tsx scripts/production-demo-sync.ts --silent
```

Or integrated into package.json:

```json
{
  "scripts": {
    "demo:sync": "tsx scripts/production-demo-sync.ts",
    "demo:check": "tsx scripts/production-demo-sync.ts --check-only",
    "demo:recreate": "tsx scripts/production-demo-sync.ts --force-recreate"
  }
}
```

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

If demo data becomes stale:

```bash
# Quick sync
tsx scripts/production-demo-sync.ts

# Force recreation
tsx scripts/production-demo-sync.ts --force-recreate
```

## Security Considerations

1. **Admin-only Operations**: Recreation and maintenance require admin role
2. **Health Checks**: Public endpoint for monitoring
3. **Safe Operations**: All operations are designed to be non-destructive to production data
4. **Isolated Data**: Demo organizations are completely separate from real organizations

## Troubleshooting

### Demo Organizations Missing

```bash
# Check status
tsx scripts/production-demo-sync.ts --check-only

# Recreate if needed
tsx scripts/production-demo-sync.ts --force-recreate
```

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
