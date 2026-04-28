# Production Database Schema Sync Guide

**Generated:** November 5, 2025  
**Status:** Schema validated and synced to development database

---

## Required deployment secret

Before publishing, configure the following in the **Manage → Secrets** panel of the deployment (not in `.env` — that file is for local dev only):

| Secret name | Purpose |
|-------------|---------|
| `DATABASE_URL_KOVEO` | Production Neon database connection string. Also accepted as `PRODUCTION_DATABASE_URL`. |

The deploy build command pins `IS_DEPLOY_BUILD=true NODE_ENV=production` for the `npm run migrate` step. If `DATABASE_URL_KOVEO` is missing the migrate step throws a clear error and the deploy does not promote. If the value is byte-equal to `DATABASE_URL` (the dev database) the runner also refuses — this catches the operator mistake of copying the wrong URL into the production secret.

Verifying the deploy succeeded:

```
# In the publish log, the first migrate line should read:
PRODUCTION migration runner — env var DATABASE_URL_KOVEO → <prod-host>/<proddb> (about to migrate)
```

If you see `Using DATABASE_URL (...) — NODE_ENV is not production.` instead, the secret is missing or the build command does not include `NODE_ENV=production`.

---

## Verification Summary

### Development Database State (Verified)
```
Tables: 66
Enums: 57
Foreign Keys: 107
```

### Schema Push Verification
```bash
npm run db:push
# Output: [✓] Changes applied
```

Log file: `db_push_verification.log`

## Schema Export
- **File:** `schema_export_dev_20251105.sql`
- **Size:** 168 KB
- **Lines:** 6,157
- **Type:** Complete PostgreSQL schema dump (no data)

---

## RECOMMENDED APPROACH: Use Drizzle Kit Push

### Prerequisites
1. Backup production database before proceeding
2. Ensure `DATABASE_URL_KOVEO` environment variable is set to production database connection string
3. Test on staging environment first

### Steps

#### 1. Verify Production Connection
```bash
# Set production database URL
export DATABASE_URL_KOVEO="postgresql://user:pass@host:port/dbname"

# Verify connection
psql $DATABASE_URL_KOVEO -c "SELECT version();"
```

#### 2. Run Drizzle Kit Push for Production
```bash
# Use production configuration
npx drizzle-kit push --config=drizzle.production.config.ts
```

This command will:
- Compare current production schema with `shared/schema.ts`
- Generate safe migration statements
- Show you a diff of changes before applying
- Apply changes with proper transaction handling

#### 3. Verify Production Schema After Push
```sql
-- Check table count
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: 66

-- Check enum count
SELECT COUNT(DISTINCT typname) as enum_count 
FROM pg_type 
WHERE typtype = 'e';
-- Expected: 57

-- Check foreign key count
SELECT COUNT(*) as fk_count 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY';
-- Expected: 107
```

---

## ALTERNATIVE APPROACH: Manual SQL Migration

If you prefer manual control or cannot use `drizzle-kit push`:

### Option A: Use Complete Schema Export

```bash
# Review the schema export first
less schema_export_dev_20251105.sql

# Apply to production (with backup!)
psql $DATABASE_URL_KOVEO < schema_export_dev_20251105.sql
```

**WARNING:** This will attempt to create all objects. Existing objects will cause errors (which can be ignored if using `IF NOT EXISTS` clauses).

### Option B: Generate Differential Migration

Use Drizzle Kit to generate SQL migrations:

```bash
# Generate migration SQL
npx drizzle-kit generate --config=drizzle.production.config.ts

# Review generated migration in migrations/ folder
# Apply manually to production
```

---

## Critical Schema Components

### Core Domain
- **Users & Auth:** users, organizations, user_organizations, invitations, password_reset_tokens, sessions
- **Permissions:** permissions, roles, role_permissions, user_permissions

### Property Domain
- **Buildings:** buildings, residences, user_residences, user_buildings
- **Contacts:** contacts
- **Common Spaces:** common_spaces, bookings, user_booking_restrictions, user_time_limits

### Financial Domain
- **Billing:** bills, payments, invoices
- **Budgets:** budgets, monthly_budgets, capital_investments
- **Cache:** financial_cache

### Operations Domain
- **Maintenance:** maintenance_requests
- **Communication:** notifications, demands, demand_comments
- **Feedback:** bugs, feature_requests, feature_request_upvotes

### Documents Domain
- documents

### Development Domain
- features, actionable_items, improvement_suggestions
- development_pillars, workspace_status
- quality_metrics, framework_configuration

### Monitoring Domain
- quality_issues, metric_predictions

### Infrastructure Domain
- ssl_certificates

---

## Post-Migration Verification

### 1. Check Schema Integrity
```sql
-- Verify all critical tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'users', 'organizations', 'buildings', 'residences', 
    'bills', 'payments', 'documents', 'maintenance_requests'
  )
ORDER BY table_name;
-- Expected: 8 rows

-- Verify foreign key constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name
LIMIT 20;
```

### 2. Check Enum Types
```sql
-- List all enums with their values
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
    'user_role', 'bill_status', 'bill_category', 
    'payment_status', 'invitation_status', 'building_type'
)
GROUP BY t.typname
ORDER BY t.typname;
```

### 3. Check Indexes
```sql
-- Verify important indexes exist
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'buildings', 'bills', 'payments')
ORDER BY tablename, indexname;
```

### 4. Test Application Queries
```sql
-- Test a basic join query
SELECT 
    u.username,
    o.name as organization_name,
    COUNT(DISTINCT ur.residence_id) as residence_count
FROM users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
LEFT JOIN organizations o ON uo.organization_id = o.id
LEFT JOIN user_residences ur ON u.id = ur.user_id
WHERE u.is_active = true
GROUP BY u.id, u.username, o.name
LIMIT 5;
```

---

## Rollback Plan

If migration fails:

### 1. Restore from Backup
```bash
# Restore production database from backup
pg_restore -d $DATABASE_URL_KOVEO /path/to/backup.dump
```

### 2. Verify Restoration
```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Check critical tables
SELECT * FROM users LIMIT 1;
SELECT * FROM buildings LIMIT 1;
```

---

## Support Files

- **Schema Export:** `schema_export_dev_20251105.sql` (complete schema, 6,157 lines)
- **Push Verification:** `db_push_verification.log` (dev database sync confirmation)
- **Drizzle Config:** `drizzle.production.config.ts` (production database configuration)

---

## Contact & Support

For production database issues:
1. Check application logs for specific errors
2. Review migration output for failed statements
3. Verify environment variables are correctly set
4. Ensure production database credentials are valid

**IMPORTANT:** Always test schema changes on staging environment before production deployment.
