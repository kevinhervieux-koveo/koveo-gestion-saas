# Bulk Import Staging — Ops Runbook

> Audience: operators / SREs deploying or tuning Koveo Gestion in production.

The admin **Bulk Document Import** wizard streams every uploaded file onto
local disk under a per-session staging directory before anything is committed
to the `documents` table. By default that staging tree lives next to the app
bundle, which is fine for development and small deployments but can become a
bottleneck (or fill the system disk) when admins import large batches.

The `BULK_IMPORT_STAGING_ROOT` environment variable (added in Task #1080) lets
you move the entire staging tree onto a different volume — a faster disk, a
dedicated data volume, or a tmpfs mount — without changing any code.

## What `BULK_IMPORT_STAGING_ROOT` controls

When set, this env var is used as the root directory for **all** bulk-import
on-disk activity:

- The multer destination for the upload route (`POST /api/admin/bulk-import/upload`).
- The per-session staging directory (`<root>/<sessionId>/...`) that holds
  every uploaded file until the admin accepts or discards it.
- The path-traversal guards that ensure session IDs cannot escape the root.
- The background janitor that sweeps orphan session directories and stale
  temp files.

All of these go through a single getter (`getBulkImportStagingRoot()` in
`server/api/bulk-import.ts`), so one env var moves the whole tree atomically.

## Default fallback

If `BULK_IMPORT_STAGING_ROOT` is **unset or empty**, the server falls back to:

```
<process.cwd()>/.staging/bulk-import
```

This default keeps a fresh dev workspace working with zero configuration. In
production it usually resolves to a path on the same disk as the app bundle,
which is what you typically want to override.

## When to set it

Set `BULK_IMPORT_STAGING_ROOT` whenever the default location is the wrong
place to put potentially large, short-lived files. Common reasons:

| Reason | What to point at |
| --- | --- |
| The app disk is small and large imports risk filling it. | A larger data volume mounted separately from the app bundle. |
| Imports feel slow because the app disk is slow (network-attached, throttled, etc.). | A faster local SSD or NVMe volume. |
| You want staging to evaporate on reboot and never hit persistent storage. | A tmpfs mount sized for your largest expected batch. |
| You run multiple app replicas and want each one to use its own scratch space. | A node-local path (e.g. `/var/lib/koveo/bulk-import`) — staging is intentionally **not** shared between replicas. |

## How to configure it

1. **Pick a path** that the Node.js process can read, write, and create
   subdirectories under. The directory does not need to exist beforehand;
   the upload route will create it on demand. It should not be shared with
   any other application's data — the janitor is allowed to delete anything
   it does not recognize as a live session.
2. **Make sure it has enough room** for a worst-case batch. A rough rule of
   thumb is "the largest single import an admin will run, times two" so
   rotated/rewritten copies (PDF rotation, etc.) have headroom.
3. **Set the env var** in your deployment environment. For Replit
   Deployments and similar platforms, add it to the deployment secrets /
   environment alongside `DATABASE_URL`. An example is included (commented
   out) in `.env.deployment.example`:

   ```bash
   BULK_IMPORT_STAGING_ROOT=/mnt/fast-ssd/koveo/bulk-import
   ```

4. **Restart the app** so the new value takes effect. The getter reads the
   env var on every call, so a process restart is enough — no rebuild
   required.
5. **Verify** by starting a small bulk-import session and confirming a
   `<sessionId>/` directory appears under your new root. If the upload
   succeeds but the directory does not show up there, the env var was not
   visible to the Node.js process — re-check how your platform injects
   environment variables.

## Operational notes

- **Do not put it on a network filesystem you cannot trust to fsync.** The
  upload route streams files directly to this path; flaky NFS mounts will
  surface as upload failures and orphaned temp files.
- **Do not share the root across replicas.** Each replica's janitor
  reconciles the staging tree against `bulk_import_sessions` and will
  cheerfully delete files it does not recognize. Use a node-local path.
- **Resizing later is fine.** Because the staging tree is short-lived, you
  can change the root and restart between batches; in-flight sessions on
  the old root will be cleaned up by the next janitor pass once their rows
  expire, or you can drain by waiting for active sessions to finish before
  restarting.
- **Tmpfs caveat.** A tmpfs root is the fastest option but means staged
  files vanish on reboot. That is safe (nothing is committed until the
  admin links the item) but admins with an in-flight session at the time
  of a restart will need to re-upload.

## Related code

- `server/api/bulk-import.ts` — `getBulkImportStagingRoot()` and
  `DEFAULT_STAGING_ROOT`, plus every caller (upload route, `stagingDirFor`,
  `safeRmSession`, `sweepStagingOrphans`).
