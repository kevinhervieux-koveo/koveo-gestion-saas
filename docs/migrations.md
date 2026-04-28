# Database Migrations Workflow

Koveo Gestion uses **numbered SQL migration files** under `migrations/`
as the single source of truth for the database schema. Every change to
`shared/schema.ts` (or any file under `shared/schemas/`) must ship with
a matching migration in the same commit.

## Why we no longer use `drizzle-kit push`

For years the team evolved the dev database with `drizzle-kit push`
(`npm run db:push`). The numbered migration files rotted in parallel
because nothing required them to stay current. Dev and prod drifted
apart silently, and the cleanup eventually required a 6,000-line repair
migration (Task #791).

The schema-drift guard in `scripts/check-migration-coverage.ts` catches
this kind of drift in CI by comparing the cumulative numbered migrations
to the schema generated from `shared/schema.ts`. Push-based development
is what makes that guard fail.

## The supported workflow

1. **Edit the schema.** Update `shared/schema.ts` or the appropriate
   file under `shared/schemas/`.

2. **Generate the migration.** Drizzle Kit will diff the schema against
   the existing migration chain and emit a new numbered file:

   ```bash
   npx drizzle-kit generate
   ```

   This produces `migrations/NNNN_<name>.sql` plus a `meta/` snapshot.
   For tricky changes (data backfills, conditional drops, etc.) you can
   hand-write the SQL file instead — just keep the `NNNN_*.sql` naming.

3. **Apply the migration locally.**

   ```bash
   npm run migrate
   ```

   The runner is idempotent, uses an advisory lock, records each applied
   file in `schema_migrations`, and auto-baselines pre-existing
   databases on first run. See `scripts/run-migrations.ts` for details.

4. **Commit both files together.** The schema diff and its migration
   live in the same commit so reviewers can see one without the other
   missing.

5. **Verify the drift guard.**

   ```bash
   npx tsx scripts/check-migration-coverage.ts
   ```

   Exits 0 when the cumulative migrations and the schema generated from
   `shared/schema.ts` describe an equivalent database. Run this if you
   suspect anything is off.

## What `npm run db:push` does now

`npm run db:push` no longer runs `drizzle-kit push`. It invokes
`scripts/db-push-warning.ts`, which:

- Prints a loud warning explaining why push-based development caused the
  drift cleanup,
- Refuses to run when stdin is not a TTY (so CI, post-merge hooks, and
  deployment hooks fail loudly if they ever try to push), and
- Demands a typed confirmation when invoked interactively.

If you have a genuine recovery scenario — for example bootstrapping a
brand-new dev database that you intend to wipe again immediately — the
direct push is still available as an explicit escape hatch:

```bash
npm run db:push:danger        # drizzle-kit push
npm run db:push:danger:force  # drizzle-kit push --force
```

Treat `db:push:danger` like `rm -rf`: never as part of a routine flow,
and never from a script.

## Where migrations are applied

| Environment | Trigger                            | Command                                      |
| ----------- | ---------------------------------- | -------------------------------------------- |
| Dev         | Manual (after editing schema)      | `npm run migrate`                            |
| Post-merge  | `scripts/post-merge.sh`            | `RUN_DB_MIGRATIONS=true npm run migrate`     |
| Deploy      | `.replit` `[deployment]` build step | `IS_DEPLOY_BUILD=true NODE_ENV=production npm run migrate` (pinned after `npm run build`) |
| Server boot | `server/index.ts` (prod only)      | `runMigrations({})` from `scripts/run-migrations.ts` |

All of these go through the numbered chain. None of them push.

## Required deployment secrets

Before publishing, configure the following in the Manage → Secrets panel
of the deployment:

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL_KOVEO` | Production Neon database connection string (preferred). Also accepted as `PRODUCTION_DATABASE_URL`. |

The deploy build command pins `IS_DEPLOY_BUILD=true NODE_ENV=production`
for the migrate step. If `DATABASE_URL_KOVEO` is absent the migrate step
throws a clear error and the deploy does not promote. If the value equals
`DATABASE_URL` (the dev database) the runner also refuses to continue —
this catches the operator mistake of copying the wrong URL into the secret.

## Related scripts

- `scripts/run-migrations.ts` — the migration runner.
- `scripts/check-migration-coverage.ts` — the schema-drift guard
  (run in CI / pre-commit to fail PRs that change the schema without a
  matching migration).
- `scripts/db-push-warning.ts` — the wrapper that fronts `db:push`.
- `scripts/check-pending-invitations.ts` — preflight check before
  applying a migration to an environment with real invitation data
  (`npm run db:preflight`). See `docs/deployment/safe-update-procedure.md`.
