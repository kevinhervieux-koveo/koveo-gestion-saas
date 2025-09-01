# Production Deployment Guide - Document Upload Fix

## Issue Summary
The production environment (https://koveo-gestion.com) was experiencing 500 errors when users tried to upload documents or fetch existing documents. The root cause was type mismatches in the `OptimizedDatabaseStorage` class that were causing runtime failures.

## Solution Applied
We switched from the broken `OptimizedDatabaseStorage` to the simpler, working `DatabaseStorage` implementation. This resolves all type mismatches and allows document operations to function correctly.

## Changes Made

### 1. Storage Implementation Switch
**File:** `server/storage.ts`
- Changed from `OptimizedDatabaseStorage` to `DatabaseStorage`
- Added missing type imports in `server/db-storage.ts`

### 2. Type Fixes
**File:** `server/db-storage.ts`
- Added missing imports for Document, Contact, Permission, and other types
- Fixed type compatibility issues

## Deployment Steps

### Step 1: Build the Application
```bash
npm run build
```

### Step 2: Push Database Schema Changes
```bash
npm run db:push
```
This ensures the production database schema matches the application's expectations.

### Step 3: Deploy to Production
Deploy the built files to your production environment. The key files are:
- `dist/server/index.js` - Server application
- `dist/public/` - Client application

### Step 4: Verify Environment Variables
Ensure these environment variables are set in production:
- `DATABASE_URL` - Your production Neon database URL
- `NODE_ENV=production`
- `PORT` (usually 5000)

## Testing After Deployment

1. **Test Document Upload:**
   - Log in as a user with appropriate permissions (admin, manager, or resident)
   - Navigate to a residence's documents page
   - Try uploading a document
   - Verify the upload completes without errors

2. **Test Document Retrieval:**
   - Navigate to the documents page
   - Verify existing documents load correctly
   - Test downloading a document

3. **Monitor Logs:**
   - Check production logs for any errors
   - Look for successful document creation logs

## Rollback Plan

If issues persist after deployment:

1. Revert the storage implementation change:
   ```typescript
   // In server/storage.ts, change back to:
   export const storage = new OptimizedDatabaseStorage();
   ```

2. Rebuild and redeploy:
   ```bash
   npm run build
   ```

## Known Limitations

- The OptimizedDatabaseStorage has 42 type errors that need to be fixed in a future update
- For now, DatabaseStorage provides all necessary functionality without the optimization features
- Performance impact should be minimal for current usage levels

## Support

If you encounter issues:
1. Check the server logs for detailed error messages
2. Verify database connectivity with the production DATABASE_URL
3. Ensure all environment variables are properly set

## Technical Details

The main issue was in the `OptimizedDatabaseStorage` class which had:
- Incorrect type definitions for database operations
- Missing properties in insert/update operations
- Type mismatches between schema definitions and implementation

The `DatabaseStorage` class is simpler but correctly implements all required operations with proper type safety.