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
- **Watch for the disk-usage signal (Task #1088).** Every staging-janitor
  pass (once at startup and then every 15 minutes) probes the volume that
  holds the resolved staging root and emits a log line:

  - At healthy levels, an `INFO` line:

    ```
    [bulk-import] staging disk usage
      stagingRoot=<resolved path>
      freeBytes=<bytes>  totalBytes=<bytes>  freePercent=<%>
    ```

  - When free space drops below **either** 1 GiB **or** 10 % of the
    volume, a `WARN` line:

    ```
    [bulk-import] staging disk free space is LOW —
      expand the volume or repoint BULK_IMPORT_STAGING_ROOT at a larger disk
    ```

  Either threshold can fire — small disks are caught by the percentage
  rule and large disks are caught by the absolute rule, so neither
  shape gets a false sense of security. Wire your alerting on the
  `WARN` line (the literal phrase `staging disk free space is LOW` is
  stable and safe to grep). Two reasonable responses to the alert:

  1. Expand the underlying volume in place (preferred when staging
     already lives on its own disk), or
  2. Set `BULK_IMPORT_STAGING_ROOT` to a path on a larger volume and
     restart the app — the next pass will probe the new volume and
     the warning will clear.

  **Log-level note.** The recurring healthy `INFO` line is only
  visible when the app is configured at INFO or below. In production
  the logger defaults to `WARN` (see `server/utils/logger.ts`), so by
  default ops will only see the `WARN` low-space line and not the
  routine gauge. To turn on the recurring gauge in a production
  deployment, set `LOG_LEVEL=INFO` in the deployment environment. The
  `WARN` low-space line fires at the default level either way, so
  alert rules need no extra configuration.

## Related code

- `server/api/bulk-import.ts` — `getBulkImportStagingRoot()` and
  `DEFAULT_STAGING_ROOT`, plus every caller (upload route, `stagingDirFor`,
  `safeRmSession`, `sweepStagingOrphans`). The disk-usage signal lives
  alongside the janitor: `getStagingDiskUsage()` does the `statfs` probe
  and `runStagingJanitorOnce()` emits the `INFO` / `WARN` log lines on
  every pass. Thresholds are exported as `STAGING_LOW_FREE_BYTES` and
  `STAGING_LOW_FREE_RATIO` so any future tweak is one place.
