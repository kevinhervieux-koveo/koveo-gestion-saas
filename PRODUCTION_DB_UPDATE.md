# Production Database Update Documentation

## Overview
This document outlines the schema changes that have been validated and applied to the development database, along with SQL commands needed to update the production database.

## Changes Made

### 1. Bill Category Enum Update
**Issue**: The database contained bill category values that were not defined in the TypeScript enum, causing schema validation errors.

**Solution**: Added missing bill categories to the `bill_category` enum to match existing database values.

#### Added Categories:
- `cleaning`
- `landscaping`
- `reserves`
- `salary`
- `security`
- `technology`

### 2. Schema Files Updated
- `shared/schemas/financial.ts` - Updated `billCategoryEnum` and `BILL_CATEGORIES` constant

## SQL Commands for Production Database Update

### Step 1: Verify Current Enum Values
```sql
-- Check current bill_category enum values
SELECT unnest(enum_range(NULL::bill_category)) AS category;
```

### Step 2: Add Missing Enum Values (if needed)
```sql
-- Add missing enum values to bill_category
-- Note: These commands must be run one at a time

ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'cleaning';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'landscaping';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'reserves';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'salary';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'security';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'technology';
```

### Step 3: Verify the Update
```sql
-- Verify all enum values are present
SELECT unnest(enum_range(NULL::bill_category)) AS category
ORDER BY category;

-- Expected result should include all 19 categories:
-- administration, cleaning, construction, consulting, equipment_rental,
-- insurance, landscaping, legal_services, maintenance, professional_services,
-- repairs, reserves, salary, security, supplies, taxes, technology, utilities, other
```

### Step 4: Validate Data Integrity
```sql
-- Check if all existing bills use valid categories
SELECT DISTINCT category 
FROM bills 
ORDER BY category;

-- This should return no rows (all categories should be valid)
SELECT category, COUNT(*) 
FROM bills 
WHERE category NOT IN (
  SELECT unnest(enum_range(NULL::bill_category))
)
GROUP BY category;
```

## Alternative: Use Drizzle Kit Push (Recommended)

If you have access to run Drizzle commands against production:

```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Push schema changes
npm run db:push -- --force
```

**Note**: The `--force` flag is used because we're adding enum values, which is a safe, non-destructive operation.

## Rollback Plan

If you need to rollback (though adding enum values is generally safe):

```sql
-- PostgreSQL does not support removing enum values directly
-- If rollback is absolutely necessary, you would need to:
-- 1. Create a new enum type with the old values
-- 2. Alter the column to use the new type
-- 3. Drop the old enum type
-- This is complex and should only be done if absolutely necessary
```

## Verification Checklist

- [ ] Backup production database before making changes
- [ ] Verify current enum values in production
- [ ] Add missing enum values using ALTER TYPE commands
- [ ] Verify all enum values are present
- [ ] Run data integrity check to ensure no invalid categories exist
- [ ] Test application functionality with updated schema
- [ ] Monitor for any errors or issues

## Notes

1. **Adding enum values is safe**: Adding new values to an enum does not affect existing data
2. **Order matters**: PostgreSQL enum values are ordered. New values are added at the end
3. **No downtime required**: These changes can be applied with zero downtime
4. **Backward compatible**: Applications using the old enum definition will continue to work

## Contact

For questions or issues with this update, please contact the development team.
