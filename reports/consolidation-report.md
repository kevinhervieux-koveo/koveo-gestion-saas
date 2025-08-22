# Code Consolidation Report

Generated on: 2025-08-22T18:59:12.336Z

## Summary

Found **1** consolidation opportunities across the codebase.

## Redundancy Patterns


### 1. DOCUMENT_CATEGORIES (constant)

**Files affected:** 8
- `client/src/lib/documents.ts`
- `client/src/pages/manager/BuildingDocuments.tsx`
- `client/src/pages/manager/ResidenceDocuments.tsx`
- `client/src/pages/residents/residence.tsx`
- `client/src/pages/residents/ResidenceDocuments.tsx`
- `client/src/pages/residents/BuildingDocuments.tsx`
- `client/src/pages/Documents.tsx`
- `server/api/documents.ts`

**Consolidation suggestion:**
Consolidate into client/src/lib/documents.ts - already created with BUILDING_DOCUMENT_CATEGORIES, RESIDENCE_DOCUMENT_CATEGORIES, and GENERAL_DOCUMENT_CATEGORIES

---


## Recommended Actions

1. **Document Categories**: Replace all DOCUMENT_CATEGORIES with imports from `client/src/lib/documents.ts`
2. **File URL Utilities**: Replace duplicate getDisplayableFileUrl functions with the consolidated version
3. **Loading States**: Migrate loading state management to use the `useLoadingState` hook
4. **Delete Handlers**: Consolidate delete operations using the `useDeleteMutation` hook

## Next Steps

1. Run `npm run analyze:consolidate` to see current status
2. Update files to use consolidated utilities
3. Remove redundant code
4. Run tests to ensure functionality is preserved
