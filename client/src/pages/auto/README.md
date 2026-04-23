# Auto-mounted Pages

This folder exists to **eliminate merge conflicts** between parallel feature
tasks that add new pages.

In the legacy pattern, every new page forced edits to `client/src/App.tsx`
(a 500-line file) — adding an import at the top, a lazy-loader binding,
and a `<Route>` line inside the `<Switch>`. Two parallel page tasks
typically collided on every one of those edits.

## The convention

For any **new** page, do **not** edit `client/src/App.tsx`. Instead, drop a
single file in this directory:

```tsx
// client/src/pages/auto/admin-widgets.tsx
import type { AutoPageRoute } from './_register';

export const route: AutoPageRoute = {
  path: '/admin/widgets',
  role: 'admin', // optional — wraps the page in <ProtectedRoute>
};

export default function AdminWidgetsPage() {
  return <div>Widgets</div>;
}
```

Vite's `import.meta.glob` discovers the file automatically. The route is
mounted inside the existing `<Switch>` after all explicit routes (so the
404 fallback still wins last). The component is loaded lazily via
`React.lazy`, so adding pages here has no boot-time cost.

That's it. **Zero edits** to `App.tsx`.

## What does NOT belong here

- Pages without an authenticated layout (login, public marketing).
- Pages that need a special layout container or a non-standard
  `<ProtectedRoute>` wrapping — wire those explicitly in `App.tsx`.
- Existing pages — leave them alone unless you have a reason to migrate.
  The convention is for new work and explicitly does not require a
  retroactive sweep.
