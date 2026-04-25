# Migration 0011 — Production Database Validation Report

**Migration**: `migrations/0011_schema_drift_sync.sql`
**Validated on**: 2026-04-25
**Task**: #816 — Verify the drift-sync migration runs cleanly against the production database
**Result**: PASS — migration applies cleanly, no data lost, no orphaned constraints.

---

## Procedure

1. **Generate** the migration via `npx tsx scripts/generate-drift-migration.ts > migrations/0011_schema_drift_sync.sql`.
2. **Snapshot** the production database (`DATABASE_URL_KOVEO`, ~25 MB, 77 tables) using
   `pg_dump --no-owner --no-acl --quote-all-identifiers` (PG 17.6 client against PG 17.8 server).
3. **Restore** the snapshot into a fresh staging database `drift_validation_staging` on the
   dev Neon cluster (separate from the dev workspace DB `neondb` so no other workflows were
   disturbed).
4. **Capture** baseline schema/row inventory.
5. **Run** `scripts/run-migrations.ts` against the staging URL with `NODE_ENV=development`.
6. **Capture** post-migration schema/row inventory and check for orphaned constraints,
   `NOT VALID` constraints, and invalid indexes.
7. **Drop** the staging database.

## Issue found and fixed during validation

The first dry-run failed with:

```
ERROR: operator does not exist: text = invitation_status
HINT:  No operator matches the given name and argument types.
QUERY:  ALTER TABLE invitations ALTER COLUMN status TYPE text USING status::text
CONTEXT: PL/pgSQL function inline_code_block line 10 at SQL statement
```

**Root cause**: production has a partial unique index that was created out-of-band via
`drizzle-kit push` and is not declared in any migration or in `shared/schema.ts`:

```sql
CREATE UNIQUE INDEX invitations_pending_org_email_residence_unique
  ON public.invitations USING btree (organization_id, lower(email), COALESCE(residence_id, ''::text))
  WHERE (status = 'pending'::invitation_status);
```

Because the predicate references `'pending'::invitation_status`, the in-place
`ALTER COLUMN status TYPE text` step inside the `invitation_status` enum-rebuild block
fails — Postgres has to revalidate the index predicate against the new column type and
finds no `text = invitation_status` operator. The drift-coverage check
(`scripts/check-migration-coverage.ts`) did not catch this because it only diffs tables,
columns, enums, primary keys, and unique *constraints*; it does not introspect
non-constraint partial indexes, and the prod-only index is not present in the
in-memory comparison DB.

**Fix**: patched `scripts/generate-drift-migration.ts` so the `ENUM_RECREATE` block:
1. Detects any partial index on `invitations` whose predicate mentions
   `invitation_status`, captures its `pg_get_indexdef`, and drops it before the
   column-type alterations.
2. Re-creates the captured index after the column is restored to the rebuilt
   `invitation_status` enum.

The block is wrapped in the same `IF EXISTS … 'replaced'` guard as the rest of the
enum-rebuild logic, so on any environment that has already been migrated past the
`replaced` value it is a no-op. The other three enums recreated in this migration
(`bill_type`, `notification_type`, `user_role`) were checked and have **no** partial
indexes referencing them in production, so no analogous fix was required.

## Outcome — second run

```
[migrate] Applying 1 pending migration(s)...
[migrate]   -> 0011_schema_drift_sync.sql
[migrate] Applied 1 migration(s).
[migrate] Highest applied migration: 0011_schema_drift_sync.sql
```

Exit code 0. `schema_migrations` now records `0011_schema_drift_sync.sql` (10 → 11 rows).

### Schema-level inventory

| Metric          | Before     | After      | Notes                                              |
|-----------------|-----------:|-----------:|----------------------------------------------------|
| Tables          | 77         | 78         | +1 (`mcp_assume_user_log`, declared in schema)     |
| FK constraints  | 120        | 114        | Migration drops & re-adds FKs from schema; net -6 reflects 6 legacy FKs no longer in `shared/schema.ts` |
| Enums           | 65         | 65         | No net change — 4 enums were rebuilt in place      |
| Indexes         | 465        | 468        | +3 (schema-defined indexes added)                  |
| Database size   | 19.13 MB   | 19.67 MB   | Within expected overhead for new index/constraint additions |

### Enum cleanups verified

| Enum                | Before                                                | After                                                |
|---------------------|-------------------------------------------------------|------------------------------------------------------|
| `invitation_status` | pending, accepted, expired, cancelled, **replaced**   | pending, accepted, expired, cancelled                |
| `bill_type`         | (5 legacy: condo_fees, special_assessment, …)         | unique, recurrent                                    |
| `user_role`         | (8 incl. **board_member**)                            | admin, manager, tenant, resident, demo_manager, demo_tenant, demo_resident |
| `notification_type` | (mixed legacy + new)                                  | 15 canonical labels (bill_reminder … seasonal_reminder) |

### Row-count preservation (per table, top 25 by row count)

| Table                             | Before | After | Δ |
|-----------------------------------|-------:|------:|---|
| payments                          |  6 697 | 6 697 | 0 |
| bills                             |  1 731 | 1 731 | 0 |
| session                           |    356 |   356 | 0 |
| user_notification_preferences     |    225 |   225 | 0 |
| documents                         |    151 |   151 | 0 |
| residences                        |     75 |    75 | 0 |
| monthly_budgets                   |     48 |    48 | 0 |
| role_permissions                  |     46 |    46 | 0 |
| invitation_audit_log              |     43 |    43 | 0 |
| invitations                       |     40 |    40 | 0 |
| uniformat_codes                   |     35 |    35 | 0 |
| document_tags                     |     34 |    34 | 0 |
| user_organizations                |     24 |    24 | 0 |
| user_buildings                    |     22 |    22 | 0 |
| users                             |     20 |    20 | 0 |
| permissions                       |     19 |    19 | 0 |
| oauth_clients                     |     19 |    19 | 0 |
| user_residences                   |     18 |    18 | 0 |
| buildings                         |     16 |    16 | 0 |
| maintenance_projects              |     13 |    13 | 0 |
| oauth_tokens                      |     12 |    12 | 0 |
| demands                           |     11 |    11 | 0 |
| schema_migrations                 |     10 |    11 | +1 (records 0011) |
| general_communications            |     10 |    10 | 0 |
| common_spaces                     |      9 |     9 | 0 |

**Every other table** (smaller counts and zero-row tables) preserved its row count
exactly. The full diff returned only the `schema_migrations` change above.

### Constraint health

| Check                                     | Result    |
|-------------------------------------------|-----------|
| Orphaned FKs (relation gone)              | 0         |
| Constraints with `convalidated = false`   | 0         |
| Indexes with `indisvalid = false`         | 0         |
| Indexes with `indisready = false`         | 0         |
| Prod-only `invitations_pending_org_email_residence_unique` partial index | preserved (dropped & recreated by the patched ENUM_RECREATE block) |

## Conclusion

`migrations/0011_schema_drift_sync.sql` (regenerated after the patch to
`scripts/generate-drift-migration.ts`) **applies cleanly to a snapshot of the live
production database with zero errors, zero data loss, and zero invalid or orphaned
constraints**. It is safe to deploy.
