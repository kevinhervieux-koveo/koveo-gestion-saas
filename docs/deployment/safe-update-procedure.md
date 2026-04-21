# Safe Platform Update Procedure

This runbook is the mandatory checklist before applying schema changes (any
`drizzle-kit migrate` or `db:push`) to an environment that holds real
invitation data. It exists because **platform update #2 wiped the
`invitations` and `invitation_audit_log` tables**, erasing 3 pending
invitations and their audit history. Both tables had been created via
`drizzle-kit push` outside the numbered migration chain, so a destructive sync
recreated them empty.

The new migration `migrations/0006_invitations_and_audit_log.sql` anchors both
tables in the chain (`CREATE TABLE IF NOT EXISTS`, idempotent), so future
migrations are non-destructive. The preflight check below is the safety net
in case another table ever drifts outside the chain again.

## Why invitations are at risk

Tables created via `drizzle-kit push` (rather than a numbered migration file)
are not registered in `migrations/meta/_journal.json`. When the platform runs
a destructive reconciliation — for example a fresh `db:push --force` after a
schema reset — those orphan tables are dropped and recreated empty. Rows in
the numbered chain (such as `users`) survive because they are part of the
durable schema. Always confirm a new table appears in
`migrations/meta/_journal.json` before relying on it in production.

## Required steps

1. **Run the preflight check.** This counts pending invitations and aborts
   if any exist:

   ```bash
   npm run db:preflight
   ```

   Exit codes:
   - `0` — no pending rows (or table not yet created); safe to proceed
   - `1` — pending rows detected; **do not proceed**, export them first
   - `2` — could not query the database; treat as unsafe and investigate

2. **Export pending invitations** (only if the preflight reports any):

   ```bash
   psql "$DATABASE_URL" -c "\\copy (SELECT email, role, organization_id, building_id, residence_id FROM invitations WHERE status = 'pending') TO 'pending-invitations.csv' WITH CSV HEADER"
   ```

   The header row will be `email,role,organization_id,building_id,residence_id`,
   which the recreate script in step 5 understands without modification.
   Keep this CSV. Step 5 uses it to re-create the rows if anything goes
   wrong.

3. **Acknowledge the risk and proceed.** Once you have the export in hand,
   re-run the preflight with the explicit opt-in flag:

   ```bash
   npm run db:preflight -- --allow-pending-invitations
   ```

4. **Apply the migration.**

   ```bash
   npx drizzle-kit migrate
   # or, if you intentionally need a push:
   npm run db:push
   ```

5. **Verify (and re-seed if necessary).** Re-run the preflight; the count
   should match what you exported. If pending invitations were lost, restore
   them with the helper script (it writes an audit entry recording the
   reason as `"re-created after platform-update-2 data loss"`):

   ```bash
   # Optional: validate the CSV without writing anything first
   DRY_RUN=1 RECREATE_INVITED_BY_USER_ID=<admin-user-id> \
     npm run db:recreate-invitations -- pending-invitations.csv

   # Then perform the actual re-seed
   RECREATE_INVITED_BY_USER_ID=<admin-user-id> \
     npm run db:recreate-invitations -- pending-invitations.csv
   ```

   The script prints `email\trole\tinvitationId\tinviteUrl` per row so an
   admin can hand the new invite link to the affected user. Each invitation
   plus its audit-log row are written together; if the audit write fails the
   orphan invitation is rolled back automatically.

## Verification checklist

- [ ] `npm run db:preflight` returned `0` (or pending rows were exported)
- [ ] Migration applied without errors
- [ ] `SELECT COUNT(*) FROM invitations WHERE status = 'pending'` matches the
      pre-migration count
- [ ] Audit log row count is unchanged (or, after a re-seed, contains entries
      with `details->>'reason' = 're-created after platform-update-2 data loss'`)
- [ ] New tables (if any) appear in `migrations/meta/_journal.json` before
      they go to production
