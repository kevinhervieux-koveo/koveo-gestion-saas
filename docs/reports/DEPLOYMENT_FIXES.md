# Deployment Fixes Applied

## Issue Summary

The application was crashing during deployment due to missing permissions.json file, causing "Application is crashing on startup due to missing permissions.json file" errors.

## Fixes Applied

### 1. Created Build Script with File Copying

- **File**: `scripts/build-server.ts`
- **Purpose**: Custom build script that runs esbuild and copies config files to dist directory
- **Function**: Builds server and copies `config/permissions.json` to `dist/config/permissions.json`

### 2. Updated Import Logic for Production Paths

- **File**: `config/index.ts`
- **Change**: Replaced static import with dynamic file reading that checks multiple paths
- **Fallback paths**:
  - Development: `config/permissions.json`
  - Production: `dist/config/permissions.json`
  - Alternative paths: `../config/permissions.json`, `./config/permissions.json`

### 3. Fixed Permissions Validation Logic

- **File**: `config/validate-permissions.ts`
- **Change**: Updated to use same robust path resolution as main config
- **Result**: Permissions validation now works in both development and production

### 4. Complete Build Script

- **File**: `scripts/build.ts`
- **Purpose**: Complete build process for both client and server with config copying

## Usage Instructions

### For Development

Continue using existing commands:

```bash
npm run dev
```

### For Production Build

Use the new build script that includes config copying:

```bash
tsx scripts/build-server.ts
# OR for complete build:
tsx scripts/build.ts
```

### For Deployment

The application will now start correctly in production environment:

```bash
NODE_ENV=production node dist/index.js
```

## Verification

✅ **Fixed**: permissions.json file not found error
✅ **Fixed**: Application startup crash in production
✅ **Fixed**: File path resolution for both development and production
✅ **Working**: Robust fallback path system for config files

## Next Steps

The current schema validation error about unknown permissions (like `read:invitation`) is a separate content issue that should be addressed by updating the permissions schema to include all permissions currently in the permissions.json file.
