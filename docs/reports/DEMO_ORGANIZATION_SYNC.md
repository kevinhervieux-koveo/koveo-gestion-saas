# Demo Organization Synchronization

This document describes the Demo organization synchronization system that ensures development Demo data is automatically synchronized to production during deployment.

## Overview

The Demo organization serves as a showcase and testing environment. During deployment, all Demo organization data from the development environment should replace the Demo organization data in production to ensure consistency and up-to-date demo content.

## Architecture

### Scripts

1. **sync-demo-organization.ts** - Main synchronization script
   - Exports Demo organization data from development
   - Can sync directly to production (if prod DB access available)
   - Exports to JSON file for manual deployment

2. **import-demo-organization.ts** - Production import script
   - Imports Demo organization data from JSON export file
   - Used in production when direct DB access isn't available

3. **deployment-hooks.ts** - Deployment automation script
   - Runs during deployment process
   - Triggers Demo organization sync based on environment variables

### Environment Variables

Configure these environment variables to control Demo organization synchronization:

```bash
# Enable Demo organization sync during deployment
SYNC_DEMO_ON_DEPLOY=true

# Production database URL for direct sync (optional)
PRODUCTION_DATABASE_URL=postgresql://...

# Sync API credentials for remote sync (optional)
PRODUCTION_API_URL=https://your-prod-app.com
SYNC_API_KEY=your-sync-api-key

# Deployment environment
NODE_ENV=production

# Enable application warmup after deployment
WARMUP_ON_DEPLOY=true
```

## Usage

### Development Environment

#### Export Demo Data

```bash
# Export Demo organization data to JSON file
tsx scripts/sync-demo-organization.ts
```

#### Sync to Production (if direct DB access)

```bash
# Set production database URL
export PRODUCTION_DATABASE_URL="postgresql://prod-user:password@prod-host:5432/prod-db"

# Run sync
tsx scripts/sync-demo-organization.ts
```

### Production Environment

#### Import from JSON File

```bash
# Place demo-organization-export.json in root directory
tsx scripts/import-demo-organization.ts
```

#### Automated Deployment

```bash
# Run deployment hooks (includes Demo sync if enabled)
tsx scripts/deployment-hooks.ts
```

## Deployment Process

### Manual Deployment

1. **Development**:

   ```bash
   # Export Demo data
   tsx scripts/sync-demo-organization.ts

   # This creates demo-organization-export.json
   ```

2. **Production**:

   ```bash
   # Upload demo-organization-export.json to production

   # Import Demo data
   tsx scripts/import-demo-organization.ts
   ```

### Automated Deployment

Set environment variables in your deployment platform:

```bash
SYNC_DEMO_ON_DEPLOY=true
NODE_ENV=production
```

Then run deployment hooks:

```bash
tsx scripts/deployment-hooks.ts
```

### Replit Deployment

For Replit deployments, the sync can be triggered manually or through deployment scripts:

```bash
# Manual sync in development
npm run demo:sync

# Manual import in production
npm run demo:import

# Full deployment hooks
npm run deploy:hooks
```

**Note**: Package.json scripts need to be added manually:

```json
{
  "scripts": {
    "deploy:hooks": "tsx scripts/deployment-hooks.ts",
    "demo:sync": "tsx scripts/sync-demo-organization.ts",
    "demo:import": "tsx scripts/import-demo-organization.ts"
  }
}
```

## Data Synchronization Details

### What Gets Synchronized

The sync process handles all Demo organization related data:

- **Organization**: The Demo organization record
- **Users**: All users associated with Demo organization
- **Buildings**: All buildings owned by Demo organization
- **Residences**: All residences in Demo buildings
- **Bills**: All bills for Demo residences
- **Maintenance Requests**: All maintenance requests for Demo residences
- **Notifications**: All notifications for Demo users

### Synchronization Process

1. **Export Phase** (Development):
   - Query all Demo organization data
   - Build complete data tree with relationships
   - Export to structured JSON format

2. **Delete Phase** (Production):
   - Find existing Demo organization in production
   - Delete all related data in correct order (respects foreign keys)
   - Remove Demo organization record

3. **Import Phase** (Production):
   - Create new Demo organization
   - Import users (skip if already exist)
   - Create user-organization relationships
   - Import buildings, residences, bills, maintenance requests
   - Import notifications

### Data Integrity

- **Foreign Key Handling**: Deletes/inserts respect database constraints
- **User Deduplication**: Existing users are not duplicated
- **ID Mapping**: Original IDs are mapped to new production IDs
- **Timestamps**: Creation/update timestamps are refreshed

## Security Considerations

- **Database Access**: Production database credentials should be secure
- **API Keys**: Sync API keys should be rotated regularly
- **Data Privacy**: Demo data should not contain real user information
- **Access Control**: Only authorized deployment processes should sync Demo data

## Troubleshooting

### Common Issues

1. **Missing Demo Organization**:

   ```
   Error: Demo organization not found in development database
   ```

   - Ensure Demo organization exists in development
   - Check organization name is exactly "Demo"

2. **Database Connection**:

   ```
   Error: DATABASE_URL must be set
   ```

   - Verify DATABASE_URL environment variable
   - Check database connectivity

3. **Foreign Key Constraints**:

   ```
   Error: Foreign key constraint violation
   ```

   - Ensure deletion order respects relationships
   - Check for orphaned records

4. **File Not Found**:

   ```
   Error: Export file demo-organization-export.json not found
   ```

   - Run export script first
   - Verify file was created and uploaded to production

### Verification

After sync, verify the Demo organization was properly synchronized:

```sql
-- Check Demo organization exists
SELECT * FROM organizations WHERE name = 'Demo';

-- Check Demo organization data
SELECT
  (SELECT COUNT(*) FROM buildings WHERE organization_id = o.id) as buildings_count,
  (SELECT COUNT(*) FROM residences r
   JOIN buildings b ON r.building_id = b.id
   WHERE b.organization_id = o.id) as residences_count,
  (SELECT COUNT(*) FROM user_organizations WHERE organization_id = o.id) as users_count
FROM organizations o
WHERE o.name = 'Demo';
```

## Monitoring

- Monitor deployment logs for sync success/failure
- Set up alerts for sync failures
- Track sync timing and performance
- Verify Demo data integrity post-deployment

## Best Practices

1. **Development**: Keep Demo organization data realistic but anonymized
2. **Testing**: Test sync process in staging environment
3. **Backup**: Backup production data before sync (if needed)
4. **Verification**: Always verify sync completed successfully
5. **Documentation**: Keep sync logs for troubleshooting
