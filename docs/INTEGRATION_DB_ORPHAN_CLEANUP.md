# Integration DB Orphan Row Cleanup

## What this is for

The integration test suite syncs the Drizzle schema to the integration
database before any tests run (via `drizzle-kit push --force` in
`jest.global-setup.cjs`). When a schema change adds a new foreign key,
or strengthens an existing one (e.g. tightens `onDelete`), the push will
fail if the target table already contains rows whose FK column points
at a row that no longer exists in the referenced table.

This was first observed in Task #1155, where 16 rows in
`client_document_fingerprints` referenced organizations that had been
deleted. The push silently failed for everyone with an opaque
`violates foreign key constraint` error and the suite would not start
until those rows were removed by hand.

## How it's prevented now

Before every `drizzle-kit push` in the integration setup, the global
setup runs `scripts/clean-orphan-fk-rows.ts`:

1. The script introspects every Drizzle-modeled FK in `@shared/schema`.
2. For each FK it checks the database for orphan rows (FK columns
   non-NULL with no matching parent row).
3. It reconciles each set of orphans with the FK's declared `onDelete`:
   - **`cascade`** — orphans are deleted (the constraint says they
     should never have existed in the first place).
   - **`set null`** — the FK columns are NULLed.
   - **`restrict` / `no action` / `set default` / unspecified** — the
     script refuses to guess and exits non-zero with a clear,
     actionable error pointing at the offending table, columns, and
     sample row IDs.
4. Cleanup runs inside a transaction per FK so an unexpected failure
   leaves the table untouched.

The cleanup is gated on the same DB-URL trigger as the rest of the
global setup, and refuses to run against a production-shaped URL
unless `ALLOW_DB_PUSH_IN_TESTS=1` is set.

## Resolving an orphan-row blocker manually

If the cleanup script throws — i.e. a strict FK has orphans we can't
safely auto-resolve — the error message lists the FK, the orphan count,
and up to ten sample row IDs. Use those to make an explicit call:

1. Inspect the rows in the integration DB:
   ```sql
   SELECT id, <fk_column>
     FROM <child_table>
    WHERE id IN ('<sample id>', ...);
   ```
2. Decide what should happen to them based on product intent. Common
   choices:
   - The rows are obsolete test data — delete them:
     ```sql
     DELETE FROM <child_table> WHERE id IN (...);
     ```
   - The parent row was deleted by mistake — restore it.
   - The schema's `onDelete` is wrong — change the schema to `cascade`
     or `set null` so future pushes auto-clean (this also lets the
     cleanup script handle the situation next time).
3. Re-run the integration suite.

## Running the cleanup outside Jest

The script can be invoked directly during local debugging:

```bash
DATABASE_URL=postgres://... npx tsx scripts/clean-orphan-fk-rows.ts
```

Add `--report-only` (or `ORPHAN_CLEANUP_REPORT_ONLY=1`) to print
findings without modifying any rows. Set
`SKIP_ORPHAN_FK_CLEANUP=1` to skip the cleanup entirely — both
`jest.global-setup.cjs` and a direct `npx tsx
scripts/clean-orphan-fk-rows.ts` invocation honour this flag, so it is
the single switch to flip when triaging a failure of the cleanup
itself.

## Tests

`tests/integration/orphan-fk-cleanup.test.ts` locks the behaviour
described above against a real Postgres database:

1. A controlled cascade-FK orphan is seeded behind a fixture parent /
   child table pair, the cleanup is driven against that scoped FK list,
   and the test asserts the orphan is gone and the FK constraint then
   `VALIDATE`s.
2. A controlled `NO ACTION` (restrict-style) orphan is seeded the same
   way and the test asserts the cleanup throws a fatal error whose
   message names the offending table, columns, and at least one sample
   row id — the actionable shape that lets a developer fix it by hand.
3. The `SKIP_ORPHAN_FK_CLEANUP=1` opt-out is exercised end-to-end:
   with the env set the cleanup short-circuits and the previously
   seeded orphan is still present afterwards, so the documented
   debugging escape hatch keeps working.
4. A controlled `SET NULL` FK orphan is seeded behind a third fixture
   table (Task #1184). The cleanup runs, the orphan row is preserved
   but its FK column is `NULL` afterwards, the result reports
   `action: 'nulled'`, and the previously-`NOT VALID` constraint then
   `VALIDATE`s cleanly — the same end-to-end shape as the cascade case
   but exercising the third branch of `cleanOrphans`.
