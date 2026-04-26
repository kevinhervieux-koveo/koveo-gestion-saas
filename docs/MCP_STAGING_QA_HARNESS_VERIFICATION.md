# MCP Staging QA Harness — End-to-End Verification Report

## Summary

| Check | Method | Result |
|-------|--------|--------|
| `MCP_ASSUME_USER=1` set on staging | Env-var config read | ✅ Confirmed |
| `MCP_ASSUME_USER` absent on production | Env-var config read | ✅ Confirmed |
| Admin OAuth session can call `assume_user` on staging | Live HTTP call | ✅ Verified |
| `actingRole` switches to assumed user's role | Live HTTP call | ✅ Verified |
| `impersonationActive` true on cross-request follow-up | Live HTTP call (new request, same session) | ✅ Verified |
| `restore_acting_user` reverts cleanly | Live HTTP call | ✅ Verified |
| Audit rows in `mcp_assume_user_log` with correct shape | Live DB query | ✅ Verified (2 rows) |
| Production endpoint is live and reachable | Live HTTP call | ✅ Confirmed |
| `assume_user` against production with valid admin token | Not performed — production credentials not accessible in this context | ⚠️ Evidence via code + unit tests only |
| Production `mcp_assume_user_log` has no success rows from our test | Replit-managed prod DB not available; PRODUCTION_DATABASE_URL secret not readable | ⚠️ Evidence via code analysis only |
| `tests/unit/api/mcp-assume-user.test.ts` | Unit test run | ✅ PASS |
| `tests/unit/utils/feature-flags.test.ts` | Unit test run | ✅ PASS |

**Net status:** Staging end-to-end verification is complete. Production lock is
verified at the code level and via unit tests. A live authenticated production
`assume_user` call was not performed because no production admin OAuth token is
available in this verification context.

---

## When This Check Ran

**Date:** 2026-04-26T12:47:02.962Z

---

## Environment Architecture

| Environment | URL | NODE_ENV | MCP_ASSUME_USER |
|-------------|-----|----------|-----------------|
| **Staging** | Replit development container (`localhost:5000`) | `development` | `1` |
| **Production** | `https://koveo-gestion.com` | `production` | *(not set)* |

Both environments share the MCP OAuth issuer URL (`https://koveo-gestion.com/`) via the
`MCP_OAUTH_ISSUER` shared env var. The staging server runs locally in the Replit dev
container; the production server is the live deployment.

---

## Step 1 — Environment Variable Rollout

**Staging (development):**
```
MCP_ASSUME_USER=1   ← set in "development" environment scope
NODE_ENV=development
```

**Production:**
```
MCP_ASSUME_USER     ← NOT SET in "production" environment scope
NODE_ENV=production
ENABLE_MCP_SERVER=true
```

`MCP_ASSUME_USER` is correctly absent from production. The code-level hard-lock in
`isMcpAssumeUserEnabled()` (`server/utils/feature-flags.ts`) independently guarantees
`assume_user` is blocked on production even if the variable were ever accidentally added.

---

## Step 2 — End-to-End Harness Run Against Staging

A verification script was executed against the live staging server using the real Neon
PostgreSQL database. The script used `hashSecret()` from `server/mcp/oauth-provider.ts`
to produce a correctly-hashed bearer token, mirroring the pattern in
`tests/integration/mcp/assume-user-http-e2e.test.ts`.

### Test user IDs

- **Admin user (performed_by):** `26bac758-d59f-4b13-9469-b8f9d55c9ffc`
- **Tenant user (assumed_user_id):** `b862647f-a91f-47d1-b453-fc9fa697bf9a`
- **MCP session ID:** `8bf059df-c92f-46a9-b876-6900bd9894bc`
- **OAuth client:** `verify-client-ad56c4765d2e`

*(Test-only UUIDs, seeded and deleted within this verification run. No PII.)*

### Pre-impersonation `get_mcp_info`

```json
{
  "oauthBoundRole": "admin",
  "actingRole": "admin",
  "assumedUserId": null,
  "impersonationActive": false
}
```

### Raw `assume_user` response

```json
{
  "ok": true,
  "oauthBoundRole": "admin",
  "assumedUserId": "b862647f-a91f-47d1-b453-fc9fa697bf9a",
  "assumedUserRole": "tenant",
  "actingRole": "tenant",
  "previousActingRole": "admin",
  "previousAssumedUserId": null,
  "message": "Now acting as user \"b862647f-a91f-47d1-b453-fc9fa697bf9a\" (db role \"tenant\", mapped to MCP role \"tenant\"). Subsequent tool calls will be scoped to this user. Call restore_acting_user to revert."
}
```

### Cross-request post-impersonation `get_mcp_info` (separate HTTP request, same session)

```json
{
  "actingRole": "tenant",
  "assumedUserId": "b862647f-a91f-47d1-b453-fc9fa697bf9a",
  "impersonationActive": true
}
```

Session-level state persisted across HTTP requests.

### Raw `restore_acting_user` response

```json
{
  "ok": true,
  "oauthBoundRole": "admin",
  "assumedUserId": null,
  "actingRole": "admin",
  "previousAssumedUserId": "b862647f-a91f-47d1-b453-fc9fa697bf9a",
  "previousActingRole": "tenant",
  "noChange": false,
  "message": "Cleared impersonation of user \"b862647f-a91f-47d1-b453-fc9fa697bf9a\" and restored acting role to OAuth-bound role \"admin\"."
}
```

### Post-restore `get_mcp_info`

```json
{
  "actingRole": "admin",
  "assumedUserId": null,
  "impersonationActive": false
}
```

---

## Step 3 — Audit Log Verification on Staging

```sql
SELECT id, performed_by, assumed_user_id, action,
       details->>'outcome' AS outcome, created_at
FROM mcp_assume_user_log
WHERE performed_by = '26bac758-d59f-4b13-9469-b8f9d55c9ffc'
ORDER BY created_at ASC;
```

**Result — 2 rows:**

| action | assumed_user_id | performed_by | outcome | created_at |
|--------|----------------|--------------|---------|------------|
| `assume` | `b862647f-a91f-47d1-b453-fc9fa697bf9a` | `26bac758-d59f-4b13-9469-b8f9d55c9ffc` | `success` | 2026-04-26T12:47:03.834Z |
| `restore` | `b862647f-a91f-47d1-b453-fc9fa697bf9a` | `26bac758-d59f-4b13-9469-b8f9d55c9ffc` | `success` | 2026-04-26T12:47:04.091Z |

Server logs confirm actual INSERT statements executed with the documented `details` JSON shape.

---

## Step 4 — Production Lock Verification

### What was verified live

**Production endpoint is live:**

```
GET https://koveo-gestion.com/.well-known/oauth-authorization-server
→ HTTP 200
→ {"issuer":"https://koveo-gestion.com/","token_endpoint":"..."}
```

**Production MCP endpoint rejects unauthenticated calls correctly:**

```
POST https://koveo-gestion.com/mcp  (Authorization: Bearer fake_invalid_token_for_verification)
→ HTTP 401
→ WWW-Authenticate: Bearer realm="mcp", resource_metadata="https://koveo-gestion.com/.well-known/oauth-protected-resource/mcp"
→ {"error":"invalid_token","error_description":"Valid OAuth token or API key required"}
```

### What was not performed live (and why)

A direct `assume_user` call to `https://koveo-gestion.com/mcp` with a valid production
admin OAuth token was not performed because no production admin OAuth credentials are
available in this verification context. Embedding production credentials in verification
scripts would itself be a security concern.

### Code-level evidence of the production lock

`server/utils/feature-flags.ts`:

```typescript
export function isMcpAssumeUserEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;  // hard lock — first thing checked
  return readBoolEnv('MCP_ASSUME_USER');
}
```

The `assume_user` handler checks this flag before any other logic:

```typescript
// server/mcp/server.ts (lines ~4706-4728)
if (!isMcpAssumeUserEnabled()) {
  await writeAssumeUserAudit({ action: "assume", assumedUserIdForRow: null,
    outcome: "feature_disabled", extraDetails: { attemptedUserId: userId } });
  return { content: [{ type: "text",
    text: "assume_user is not enabled on this server. Note: MCP_ASSUME_USER is " +
          "hard-locked OFF in production (NODE_ENV=production) regardless of the " +
          "env var — this is a code-level safety guard. ..." }] };
}
```

So when called against production (where `NODE_ENV=production`), `assume_user` always
returns the "not enabled" text regardless of authentication level, role, or any other input.

### Unit tests proving the production lock

`tests/unit/utils/feature-flags.test.ts` — all PASS:

| Test | Result |
|------|--------|
| `MCP_ASSUME_USER=1, NODE_ENV=production → returns false` | ✅ PASS |
| `MCP_ASSUME_USER=true, NODE_ENV=production → returns false` | ✅ PASS |
| `MCP_ASSUME_USER=on, NODE_ENV=production → returns false` | ✅ PASS |
| `MCP_ASSUME_USER unset, NODE_ENV=production → returns false` | ✅ PASS |
| `MCP_ASSUME_USER=1, NODE_ENV=development → returns true` | ✅ PASS |

`tests/unit/api/mcp-assume-user.test.ts` additionally proves the feature-flag gating:

- "assume_user refuses when MCP_ASSUME_USER is disabled but still audits the attempt" — PASS
- "restore_acting_user refuses when MCP_ASSUME_USER is disabled but still audits the attempt" — PASS

### Expected production response (from source code, matching documented shape)

When a production call reaches `assume_user` (any auth level):

```
assume_user is not enabled on this server. Note: MCP_ASSUME_USER is hard-locked OFF in production
(NODE_ENV=production) regardless of the env var — this is a code-level safety guard. To use
impersonation, target the staging deployment where MCP_ASSUME_USER=1 is set.
See docs/MCP_STAGING_QA_HARNESS.md for the full QA harness guide. On non-production servers,
set MCP_ASSUME_USER to a truthy value (e.g. "1", "true") and restart the server.
```

---

## Step 5 — Gap Analysis

**No gaps found that require code or configuration changes.**

Minor documentation note: `docs/MCP_STAGING_QA_HARNESS.md` step 2 recommends running
the MCP Inspector against "the staging endpoint" but does not call out that production
admin credentials would be needed to verify the production lock live. This is a known
limitation of the runbook — a QA engineer running the harness would need production
admin access to fully demonstrate Step 4 of this verification. No change to the runbook
was made since this is an operational constraint, not a doc inaccuracy.

---

## Unit Test Suite Results

Full unit test run: **216 suites, 3,622 tests, 0 failures, 9 skipped.**

| Test file | Result |
|-----------|--------|
| `tests/unit/api/mcp-assume-user.test.ts` | ✅ PASS |
| `tests/unit/utils/feature-flags.test.ts` | ✅ PASS |

---

## Related Documentation

- [MCP Staging QA Harness](./MCP_STAGING_QA_HARNESS.md) — runbook for QA engineers
- `server/utils/feature-flags.ts` — `isMcpAssumeUserEnabled()` implementation
- `server/mcp/server.ts` — `assume_user` and `restore_acting_user` tool handlers
- `tests/integration/mcp/assume-user-http-e2e.test.ts` — automated E2E coverage
- Task #642 — original tool implementation
- Task #980 — production lock and QA harness documentation
