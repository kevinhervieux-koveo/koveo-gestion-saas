# Barrel Import Bundle Audit — 2026-04-16

Context: After fixing `App.tsx` to import `ProtectedRoute` directly from
`@/components/common/ProtectedRoute` (instead of through the
`@/components/common` barrel, which had been pulling ~550 KB of vendor
chunks into the initial page load), this audit checked whether any
other barrel (`index.ts`) files were similarly inflating the initial
bundle.

## Method

1. Enumerated every `index.ts` / `index.tsx` under `client/src/`.
2. For each barrel, searched the codebase for imports of that barrel
   path (both `@/...` alias and relative forms).
3. Cross-referenced importers against `client/src/App.tsx`'s
   synchronously-imported graph (sidebar, AuthErrorBoundary,
   ProtectedRoute, Help components, hooks, utils, ui/toaster, etc.).
4. Ran `npx vite build` and inspected `dist/public/index.html` to
   confirm the `modulepreload` list contained only essential vendor
   chunks.

## Barrels reviewed

| Barrel | Imported by | In eager graph? |
| --- | --- | --- |
| `@/components/common` | (none) | No |
| `@/components` | (none) | No |
| `@/components/forms` | (none) | No |
| `@/components/forms/feature-form` | only `components/forms/index.ts` | No |
| `@/components/ssl` | (none) | No |
| `@/components/buildings` | (none) | No |
| `@/components/invoices` | (none) | No |
| `@/components/invoice-management` | `pages/manager/invoices.tsx` (lazy) | No |
| `@/components/document-management` | several form/page modules — all reachable only through lazy pages | No |
| `@/components/maintenance` | (none) | No |
| `@/components/maintenance/inventory` | (none) | No |
| `@/components/maintenance/projects` | (none) | No |
| `@/components/maintenance/projects/workflow` | (none) | No |
| `@/components/maintenance/suggestions` | (none) | No |
| `@/components/maintenance/vendors` | (none) | No |
| `@/components/maintenance/auto-projects` | `pages/manager/maintenance/projects/ProjectsPage.tsx` (lazy) | No |
| `@/lib/filter-sort` | (none) | No |
| `@/pages` | (none) | No |

## Verification

After `npx vite build`, the fresh `dist/public/index.html` preloads
only the essential vendor chunks:

```
vendor-react
vendor-router
vendor-query
vendor-ui
vendor-utils
vendor-icons
```

The previously bloating chunks (`vendor-cmdk`, `vendor-forms`,
`vendor-date-fns`, `vendor-datepicker`) no longer appear in the
initial preload list.

## Conclusion

No further code changes are required: every eagerly-loaded import path
already goes directly to the specific source module rather than
through a barrel. A follow-up task (#53) was filed to remove the
dormant barrel files defensively so a future import cannot
reintroduce the bloat.
