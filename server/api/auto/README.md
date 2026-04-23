# Auto-discovered API Modules

This folder exists to **eliminate merge conflicts** between parallel feature
tasks.

In the legacy pattern, every new API module forced an edit to
`server/routes.ts` (a 700+ line file): one line added to the imports block at
the top and one line added to the `registerXxxRoutes(app)` block in the body.
When two tasks landed in parallel, both edited the exact same regions and git
flagged a conflict — even though the additions were logically independent.

## The convention

For any **new** API module, do **not** edit `server/routes.ts`. Instead:

1. Create your module file here, e.g. `server/api/auto/<feature>.ts`.
2. Default-export a `RouteRegistrar`:

   ```ts
   // server/api/auto/widgets.ts
   import type { Express } from 'express';

   export default function register(app: Express) {
     app.get('/api/widgets', (_req, res) => res.json({ ok: true }));
   }
   ```

3. Add **one alphabetically-sorted entry** to `server/api/auto/index.ts`:

   ```ts
   // Eager (registrar runs at boot):
   widgets: { load: () => import('./widgets') },

   // OR lazy (the module is not even imported until the first matching
   // request hits — same behavior as the explicit `lazyMount(...)` calls
   // in server/routes.ts):
   widgets: {
     load: () => import('./widgets'),
     lazy: { matcher: '/api/widgets' },
   },
   ```

The `lazy.matcher` lives in the registry — NOT inside the module file —
so that for lazy entries the module file is genuinely not imported at
boot. Putting `matcher` inside the module would force `loader()` to run
just to read it, defeating the lazy contract.

That's it. No edit to `server/routes.ts`. The aggregator file is small,
each entry is one line, and entries are alphabetically sorted — so
parallel additions almost never collide and, when they do, git's recursive
merge resolves them automatically.

## Why an aggregator and not pure filesystem scan?

The production server is bundled by `esbuild --bundle`. esbuild only
includes files reachable through static `import` / `import('literal')`
graphs. A runtime `fs.readdirSync` would work in dev (via `tsx`) but the
files would be missing from `dist/index.js`. The aggregator gives us a
single static graph entry per module that esbuild can follow at build
time, while still keeping `server/routes.ts` untouched per feature.

## What does NOT belong here

- Modules that need to mount **before** session middleware (e.g. MCP/OAuth):
  keep those wired explicitly in `server/routes.ts`.
- Cross-cutting middleware or non-route side effects.
- Existing modules that already have a `register*Routes` named export and an
  explicit call in `server/routes.ts`. Migrating them is optional and out of
  scope for the convention — leave them alone unless you have a reason to
  move them.
