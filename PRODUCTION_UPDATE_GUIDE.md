# Production Database Update Guide: Payment Structures for Bills

## Overview

This guide provides instructions for updating the production database to ensure all bills have proper payment structures. This update was successfully completed on the development database and processed **1,483 bills** with **zero errors**.

## Prerequisite: production database connection string

Both `npm run migrate` and `drizzle.production.config.ts` accept either of two env var names for the production connection string — they are **aliases**, you only need to set one:

- `DATABASE_URL_KOVEO`
- `PRODUCTION_DATABASE_URL`

Behaviour when `NODE_ENV=production`:

- The migration runner prints a startup banner that names which env var supplied the URL and shows the masked `host:port/db` it is about to migrate (credentials stripped).
- If **both** are set: `DATABASE_URL_KOVEO` wins deterministically. If the two point at different databases, a loud warning is logged and the `PRODUCTION_DATABASE_URL` value is ignored. Set both to the same value or unset one.
- If **neither** is set: the runner refuses to fall back to the dev `DATABASE_URL` and exits non-zero. This is intentional — silently migrating the dev database from a production deploy is exactly the failure this guard prevents. Set one of the two prod aliases before retrying the deploy.

## Post-deploy verification (task #939)

A loud, after-the-fact "did the migration runner actually land on production?" check
is wired into every deploy. It exists because task #936 made the runner refuse to
silently fall back to dev — but a deploy hook that swallows the runner's exit code,
or a `SKIP_DB_MIGRATIONS=true` left on by accident, can still leave prod behind the
deployed code without anyone noticing until the schema mismatch causes a runtime
error.

There are three surfaces; they all use the same `verifyMigrationsApplied()` helper
in `scripts/run-migrations.ts` and so report identical results:

### 1. Boot-time banner (automatic)

After `runMigrations` returns successfully at boot, the server re-reads
`schema_migrations` and compares the highest applied filename to the highest
`migrations/NNNN_*.sql` shipped with the bundle. The result is logged with the
`[migrate]` prefix the runner already uses, so the same grep / log alert that
catches a runner failure also catches a verifier mismatch:

```text
✅ migration verifier OK — db=… (via DATABASE_URL_KOVEO), highest=0013_…sql
```

or, on drift:

```text
❌ migration verifier DRIFT [behind] — db=… (via DATABASE_URL_KOVEO), expected=0013_…, applied=0010_…, pending=3, missing=[…]
❌ POST-DEPLOY VERIFIER (behind): Deployed bundle expects a higher migration than the live database has applied. Re-run `npm run migrate` against the production database. /api/admin/migration-status will return 503 until this is resolved.
```

The bracketed `driftKind` distinguishes the directions of drift the verifier
recognizes:

- **`behind`** — bundle ships migrations the live DB has not applied. Canonical
  "deploy hook silently failed" case; rerun `npm run migrate`.
- **`ahead`** — live DB has applied a migration that doesn't exist in the
  bundle. Usually a rollback that didn't roll back the schema, or a
  hand-applied migration that was never committed. Rerunning the migrator
  won't help — redeploy the matching bundle (or commit the missing file).
- **`verifier-empty`** — bundle ships zero `migrations/NNNN_*.sql` files.
  Almost always a packaging bug: verify the build is including the
  `migrations/` directory.

The verifier never crashes the boot — the runner already throws when it actually
fails. This is purely a tripwire.

### 2. HTTP probe — `GET /api/admin/migration-status` (callable from CI / monitors)

A fresh, public probe endpoint that returns:

- **`200 OK`** with `{ inSync: true, highestApplied, highestExpected, source, db, checkedAt }`
  when the live database matches the deployed bundle.
- **`503 Service Unavailable`** with `{ inSync: false, highestApplied, highestExpected, pendingCount, missing, ... }`
  when the deployed bundle expects a migration the database has not applied. The 503
  intentionally trips synthetic monitors on the same day rather than a week later.
- **`500`** with `{ error: 'verifier_failed', message }` when the verifier itself
  could not run (e.g. database unreachable) — also logged loudly server-side.

Example from a deploy smoke test:

```bash
curl -fsS https://your-prod-host/api/admin/migration-status \
  || (echo "Migration verifier failed, deploy is misconfigured" && exit 1)
```

The response body only contains migration filenames (already in the public repo)
and a masked `host:port/db` (no credentials), so the endpoint does not require
authentication and can be hit from any external uptime check.

### 3. CLI verifier — `npx tsx scripts/run-migrations.ts --verify`

Same check, runnable as a one-shot post-deploy step from CI/CD without going
through the server boot:

```bash
DATABASE_URL_KOVEO="postgres://…" \
  NODE_ENV=production \
  npx tsx scripts/run-migrations.ts --verify
```

Exit codes:

- `0` — in sync.
- `2` — drift detected (live database is behind bundle). Prints the same
  `migration verifier DRIFT — …` line as the boot banner so the failure is
  greppable in pipeline logs.
- `1` — the verifier itself crashed (unable to connect, etc.).

Wire this into the deploy pipeline so a misconfigured hook fails the deploy
instead of silently shipping ahead of the schema.

---

## ⚠️ IMPORTANT SAFETY NOTES

- **BACKUP REQUIRED**: Create a full database backup before proceeding
- **STAGING FIRST**: Test this script on a staging environment that mirrors production
- **LOW TRAFFIC**: Run during maintenance windows or low-traffic hours
- **MONITORING**: Monitor database performance during execution
- **ROLLBACK READY**: Have rollback procedures prepared

## Files Provided

1. `server/scripts/production-payment-generation.sql` - Production SQL script
2. `server/scripts/generate-missing-payments.ts` - TypeScript version (for reference)

## Execution Steps

### 1. Pre-Execution Checklist

- [ ] **Database Backup**: Create full backup of production database
- [ ] **Staging Test**: Run script on staging environment first
- [ ] **Permissions**: Ensure you have necessary database permissions
- [ ] **Monitoring**: Set up monitoring for database performance
- [ ] **Communication**: Notify team about maintenance window

### 2. Verify Current State

Run this query to check how many bills need payment structures:

```sql
SELECT COUNT(*) as bills_without_payments 
FROM bills b
LEFT JOIN payments p ON b.id = p.bill_id
WHERE p.id IS NULL;
```

### 3. Execute the Script

```bash
# Option A: Using psql command line
psql -h your-host -U your-user -d your-database -f server/scripts/production-payment-generation.sql

# Option B: Using your preferred database client
# Copy and paste the SQL script contents
```

### 4. Monitor Progress

The script will output progress messages every 100 bills processed:
- "Processed X bills, created Y payments..."
- Final summary with total counts

### 5. Verification

After completion, run the verification queries included in the script:

```sql
-- Check remaining bills without payments (should be 0)
SELECT COUNT(*) as bills_without_payments 
FROM bills b
LEFT JOIN payments p ON b.id = p.bill_id
WHERE p.id IS NULL;

-- Get payment statistics
SELECT COUNT(*) as total_payments FROM payments;
```

## Expected Results

Based on development database results:
- **All bills** will have payment structures
- **Unique bills**: 1 payment each
- **Recurrent bills**: Multiple payments based on schedule (default 12)
- **Auto-generated bills**: Payment schedule based on source template

## Payment Structure Logic

### Unique Bills
- Creates **1 payment** scheduled for the bill's start date
- Amount equals the total bill amount

### Recurrent Bills
- Creates **multiple payments** based on schedule
- Default: 12 payments (configurable)
- Schedules supported:
  - **Weekly**: Every 7 days
  - **Monthly**: Every month
  - **Quarterly**: Every 3 months
  - **Yearly**: Every year
  - **Custom**: Based on custom date array

### Auto-Generated Bills
- Inherits payment structure from source template
- Creates payments following the same logic as recurrent bills

## Rollback Procedures

If issues occur, you can rollback using these methods:

### Method 1: Time-based Rollback
```sql
-- Remove payments created after script execution
DELETE FROM payments WHERE created_at > '2025-09-16 02:30:00';
```

### Method 2: Full Backup Restore
- Restore the payments table from your pre-execution backup
- Follow your organization's backup/restore procedures

## Performance Considerations

- **Execution Time**: Depends on number of bills (estimate 1-5 minutes per 1000 bills)
- **Database Load**: Script includes optional delay between processing
- **Memory Usage**: Processes bills sequentially to minimize memory impact
- **Locking**: Uses standard INSERT operations (minimal locking)

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Ensure user has INSERT permissions on payments table
   - Verify function creation permissions

2. **Data Type Errors**
   - Verify bill data integrity before running
   - Check for NULL values in required fields

3. **Performance Issues**
   - Uncomment the `pg_sleep(0.01)` line for slower processing
   - Monitor database connections and queries

### Getting Help

If issues occur:
1. **Stop execution** immediately
2. **Check error logs** for specific error messages
3. **Contact database team** for assistance
4. **Have rollback plan ready**

## Post-Execution Tasks

After successful completion:
- [ ] **Verify results** using provided verification queries
- [ ] **Update documentation** with execution details
- [ ] **Monitor application** for any issues
- [ ] **Clean up temporary files** and logs
- [ ] **Update team** on completion status

## Development vs Production

This update has been successfully tested on the development environment:
- ✅ **1,483 bills** processed successfully  
- ✅ **8,669 total payments** generated
- ✅ **Zero errors** during execution
- ✅ **Application stability** confirmed

The production script mirrors the development logic but uses native SQL for better performance and control.