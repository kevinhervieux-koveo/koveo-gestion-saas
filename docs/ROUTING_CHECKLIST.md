# Routing Management Checklist

## Quick Reference for Common Tasks

### ✅ Adding a New Page

```bash
# 1. Create page component
# client/src/pages/[role]/[page-name].tsx

# 2. Add lazy loader in App.tsx
# 3. Add route in Router component
# 4. Update sidebar navigation
# 5. Test the route
./validate-routes.sh
```typescript

### ❌ Removing a Page (CRITICAL)

```bash
# 1. Remove from App.tsx (route + lazy loader)
# 2. Remove from sidebar.tsx
# 3. Delete the page file
# 4. CRITICAL: Clear ALL caches
rm -rf client/dist .vite node_modules/.vite

# 5. Rebuild
npm run build

# 6. Validate removal
./validate-routes.sh
```typescript

### 🔄 Moving/Renaming a Route

```bash
# 1. Create new route first
# 2. Add temporary redirect
# 3. Update all references
# 4. Test both routes work
# 5. Remove old route (follow removal steps)
# 6. Clear caches and rebuild
```typescript

## Command Reference

### Validation Commands
```bash
# Run route validation
./validate-routes.sh

# Check for specific route in build
grep -r "/admin/dashboard" client/dist/

# List all routes in App.tsx
grep -r "Route path=" client/src/App.tsx

# Find navigation items
grep -r "path:" client/src/components/layout/sidebar.tsx
```typescript

### Cache Management
```bash
# Complete cache clear (use when removing routes)
rm -rf client/dist .vite node_modules/.vite

# Rebuild with fresh cache
npm run build

# Force clean build
rm -rf client/dist .vite node_modules/.vite && npm run build
```typescript

### Testing Routes
```bash
# Run routing tests (when package.json is updated)
npm run test:routing

# Manual test procedure
1. Clear browser cache
2. Navigate to route directly via URL
3. Test navigation from sidebar
4. Check browser console for errors
5. Verify correct component loads
```typescript

## Common Issues & Solutions

### Issue: Removed route still accessible
```bash
# Solution: Complete cache clear
rm -rf client/dist .vite node_modules/.vite
npm run build
./validate-routes.sh
```typescript

### Issue: New route shows 404
```bash
# Check:
1. Route added to App.tsx
2. Component has default export
3. Path spelling matches exactly
4. Build completed successfully
```typescript

### Issue: Navigation doesn't work
```bash
# Check:
1. Sidebar path matches route path
2. User role has permission
3. Authentication state is correct
4. No JavaScript errors in console
```typescript

## File Locations

- **Routes Definition**: `client/src/App.tsx`
- **Navigation Menu**: `client/src/components/layout/sidebar.tsx`
- **Page Components**: `client/src/pages/`
- **Route Tests**: `tests/routing/`
- **Validation Script**: `scripts/validate-routes.ts`
- **Build Output**: `client/dist/`

## Scripts to Add to package.json

When you can modify package.json, add these scripts:

```json
"validate:routes": "tsx scripts/validate-routes.ts",
"test:routing": "jest --testPathPattern=tests/routing",
"clean:cache": "rm -rf client/dist .vite node_modules/.vite",
"rebuild:clean": "npm run clean:cache && npm run build"
```typescript

## Emergency Procedures

### If routes are completely broken:
1. Check recent commits for changes
2. Clear all caches: `rm -rf client/dist .vite node_modules/.vite`
3. Rebuild: `npm run build`
4. Test basic routes work
5. Run validation: `./validate-routes.sh`
6. If still broken, check App.tsx for syntax errors

### Before Deployment:
1. Run `./validate-routes.sh`
2. Test all role-based routes manually
3. Clear production cache if routes were removed
4. Monitor for 404 errors after deployment

## Remember

⚠️ **ALWAYS clear build cache when removing routes** - This is the #1 cause of routing issues
⚠️ **Test after changes** - Use the validation script
⚠️ **Document route changes** - Update this checklist if needed

