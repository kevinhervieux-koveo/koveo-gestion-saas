# MCP Staging QA Harness

## What This Is and Why It Exists

QA engineers need to test MCP tool behaviour from a **tenant's perspective** — verifying that tools like `list_residences`, `get_residence`, and related read tools return only data scoped to the correct resident identity.

Without a harness, the only way to do this is to log out of the manager-admin OAuth session and re-authenticate as a tenant user, which destroys the admin session and prevents back-to-back test runs.

The `assume_user` / `restore_acting_user` MCP tools (shipped in Task #642) solve this: a single authenticated manager-admin session can temporarily adopt a tenant's identity for one or more tool calls, then revert back — all without re-authentication. Every impersonation is recorded in `mcp_assume_user_log` for auditability.

This document is the end-to-end runbook for using that harness on the **staging deployment**.

---

## Environment Architecture

| Environment | URL | NODE_ENV | MCP_ASSUME_USER |
|-------------|-----|----------|-----------------|
| **Staging** | Replit dev container — see "Finding the staging URL" below | `development` | `1` (set in Replit development scope) |
| **Production** | `https://koveo-gestion.com` | `production` | *(not set — and code-locked off)* |

### Finding the staging URL

The staging server runs inside the Replit development container. Its public URL is runtime-managed by Replit as `REPLIT_DEV_DOMAIN` and changes each time the Replit workspace is restarted in a new session. To get the current URL:

1. Open the Replit workspace for this project.
2. Click **Run** (or confirm the "Start application" workflow is running).
3. The webview pane shows the app at `https://<repl-name>.<user>.replit.dev`. The MCP endpoint is at that same host at path `/mcp`.

Alternatively, look at the URL bar in the Replit webview — that is the staging base URL.

**Example:** `https://koveo-mcp.kevin-hervieux.replit.dev/mcp`

### Confirmed env-var state (as of 2026-04-28)

```
# Development (staging) environment
MCP_ASSUME_USER=1          ← set in Replit "development" environment scope
NODE_ENV=development

# Production environment
MCP_ASSUME_USER            ← NOT SET
NODE_ENV=production
ENABLE_MCP_SERVER=true
MCP_OAUTH_ISSUER=https://koveo-gestion.com   ← shared scope (both envs)
```

The code-level hard-lock in `isMcpAssumeUserEnabled()` (`server/utils/feature-flags.ts`) independently guarantees `assume_user` is blocked on production even if `MCP_ASSUME_USER` were accidentally added there.

---

## Seeded QA Tenant Accounts

These accounts are auto-seeded on every non-production boot by `server/mcp/seed-mcp-data.ts`. They are the canonical accounts for MCP tenant-POV QA.

### Account credentials

| Account | Email | Password | Role | Org scope |
|---------|-------|----------|------|-----------|
| MCP Admin | `mcp-admin@koveo-mcp.test` | `McpTest2024!` | `super_admin` | MCP-1, MCP-2 |
| MCP Manager | `mcp-manager@koveo-mcp.test` | `McpTest2024!` | `manager` | MCP-1, MCP-2 (all 3 buildings) |
| MCP Tenant | `mcp-tenant@koveo-mcp.test` | `McpTest2024!` | `tenant` | MCP-1, MCP-2 |

### Tenant residence links

`mcp-tenant@koveo-mcp.test` is linked to **3 residences** (one per building), each with `relationshipType = 'tenant'` and `startDate = 2024-01-01`:

| Building | Unit number | Floor | Org |
|----------|-------------|-------|-----|
| Résidence du Parc (MCP-1) | 101 | 1 | MCP-1 |
| Les Terrasses MCP (MCP-1) | 101 | 1 | MCP-1 |
| Condo Vieux-Québec (MCP-2) | 101 | 1 | MCP-2 |

### MCP role mapping note

The staging DB stores `mcp-admin@koveo-mcp.test` with `role = 'super_admin'`. MCP maps this to `"admin"` in all response fields (`oauthBoundRole`, `actingRole`, etc.). So when you call `get_mcp_info` as that user you will see `"actingRole": "admin"`, not `"actingRole": "super_admin"`. This is expected — MCP collapses `super_admin` and `admin` DB roles into the `"admin"` MCP role for tool-permission purposes.

### About the kevhervieux+* Gmail accounts

The task brief (Pass #28 QA report) referenced three Gmail addresses:
- `kevhervieux+mcp1-resident@gmail.com`
- `kevhervieux+mcp2-tenant@gmail.com`
- `kevhervieux+mcp1-tenant-unit102@gmail.com`

**These accounts are not currently seeded** in the staging database. They are real Google OAuth identities that would need to be created manually in the staging DB (with an appropriate `role`, `userOrganizations`, and `userResidences` row) before they can be used. Until that work is done, use the `mcp-tenant@koveo-mcp.test` seed account for all tenant-POV MCP tests.

---

## Which Environment and How to Confirm You Are on Staging

The harness is enabled **only on the staging deployment**. The `MCP_ASSUME_USER=1` environment variable is set there and absent from production.

**Hard lock**: even if `MCP_ASSUME_USER` is somehow present in a production environment, the code ignores it — `isMcpAssumeUserEnabled()` unconditionally returns `false` when `NODE_ENV === "production"`. Calling `assume_user` against the production endpoint always returns the "not enabled" error.

To confirm you are on staging (not production):

1. The staging URL follows the Replit dev-domain pattern (e.g. `https://<repl-name>.<user>.replit.dev`). The production URL is always `https://koveo-gestion.com`.
2. Call `get_mcp_info` with your admin session — the `serverInfo.nodeEnv` field in the JSON response will be `"development"` on staging. If it says `"production"`, you are on the production deployment.
3. Try calling `assume_user` with any userId. On staging it will either succeed or return a role/target error. On production it always returns the "not enabled" message regardless of input.

---

## Step 1 — Prerequisites

| Requirement | Details |
|-------------|---------|
| Admin user account | Use `mcp-admin@koveo-mcp.test` / `McpTest2024!` — auto-seeded on staging. |
| MCP OAuth client | The MCP-1 and MCP-2 sandbox clients are auto-seeded on non-production boot. No manual registration needed. |
| Target tenant user | Use `mcp-tenant@koveo-mcp.test` — has `role = 'tenant'` and 3 `userResidences` rows. Note the UUID from the DB or from `get_mcp_info` after `assume_user`. |
| Network access | HTTPS access to the staging deployment URL (see "Finding the staging URL" above). |

---

## Step 2 — Complete the OAuth Admin Session (Consent Flow)

### Option A — Claude.ai (recommended for interactive QA)

1. In Claude.ai, open **Settings → Integrations → Add Integration**.
2. Enter the staging MCP endpoint: `https://<staging-host>/mcp`.
3. Click **Connect**. Claude.ai will redirect to `/authorize` on staging.
4. Log in as `mcp-admin@koveo-mcp.test` and click **Allow**.
5. Claude.ai now holds an access token bound to the admin's role. All subsequent tool calls on this connection run as that admin.

### Option B — MCP Inspector (recommended for scripted / CI QA)

```bash
npx @modelcontextprotocol/inspector https://<staging-host>/mcp
```

The inspector opens a browser window at `/authorize`. Log in as admin and approve. The inspector stores the access token and can replay tool calls against it.

### Option C — Raw HTTP (curl / fetch)

For fully automated scenarios, insert an access token directly into `oauth_tokens` in the staging database (use `hashSecret()` from `server/mcp/oauth-provider.ts` to hash the token before storage). The `verifyAccessToken` middleware reads the same surface a real OAuth flow would produce.

See `tests/integration/mcp/assume-user-http-e2e.test.ts` for a working example of this seeding pattern.

---

## Step 3 — Parallel Chrome Profile Setup for Browser-Based Tenant Testing

The QA browser is typically logged in as `kevin.hervieux@koveo-gestion.com` (super_admin). To test tenant pages (W13 org picker, MOB-T01–T10, Q2/Q5/Q6) from a genuine tenant browser session, use a **separate Chrome profile** so both sessions run simultaneously without logging each other out.

### Creating a parallel Chrome profile

1. In Chrome, click your profile avatar in the top-right corner → **Add** → **Add new profile**.
2. Name it "Tenant QA" (no Google account sign-in required).
3. A new Chrome window opens isolated from your main session (separate cookies, separate localStorage).
4. In the new window, navigate to the staging app URL and sign in as `mcp-tenant@koveo-mcp.test` with password `McpTest2024!`.

The tenant window is now fully isolated. You can have both the admin window and tenant window open side by side.

### What to verify in the tenant browser session

| Test case | What to check |
|-----------|--------------|
| W13 — Org picker on resident pages | Sign-in as tenant → navigate to resident dashboard → confirm org picker shows only MCP-1 / MCP-2, not all orgs |
| MOB-T01–T10 — Mobile tenant suite | Use Chrome DevTools → Toggle device toolbar → test on 390×844 (iPhone 14 viewport) |
| Q2 — Tenant isolation | Confirm `/api/residences` returns only the tenant's own residences |
| Q5 — Cross-org isolation | Switch org context to MCP-2 → confirm MCP-1 data is not visible |
| Q6 — Role-based UI gating | Confirm admin/manager UI controls are hidden or disabled for the tenant |

---

## Step 4 — Call `assume_user`

Use `assume_user` for **MCP tool-level** tenant-POV tests. Pair it with the parallel Chrome profile method (Step 3) for **browser-level** tenant tests.

To find the tenant's UUID before calling `assume_user`: look it up in the staging DB or call a tool that returns user info. The `mcp-tenant@koveo-mcp.test` UUID is stable after the first seed run.

### From Claude.ai

In the Claude.ai chat, say:

> Call the `assume_user` tool with `userId` set to `"<target-tenant-uuid>"`.

Claude.ai will invoke the tool and show you the JSON response:

```json
{
  "ok": true,
  "oauthBoundRole": "admin",
  "assumedUserId": "<target-tenant-uuid>",
  "assumedUserRole": "tenant",
  "actingRole": "tenant",
  "previousActingRole": "admin",
  "previousAssumedUserId": null,
  "message": "Now acting as user \"<target-tenant-uuid>\" ..."
}
```

All subsequent tool calls on this Claude.ai conversation will be scoped to that tenant's identity until you call `restore_acting_user`.

### From MCP Inspector

In the inspector's **Tools** panel, select `assume_user` and fill in:

```json
{ "userId": "<target-tenant-uuid>" }
```

Click **Run**. Check the response for `"ok": true`.

### Via Raw JSON-RPC (curl)

```bash
# 1. Initialize a session
curl -s -X POST https://<staging-host>/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"qa-harness","version":"1.0"}}}' \
  -D - | grep -E "mcp-session-id|^$" | head -5
# Note the Mcp-Session-Id header value

# 2. Call assume_user
curl -s -X POST https://<staging-host>/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -H "Mcp-Session-Id: <session-id>" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"assume_user","arguments":{"userId":"<target-tenant-uuid>"}}}'
```

---

## Step 5 — Verify Tenant-Scoped Behaviour

After a successful `assume_user`, run a business tool to confirm scoping:

```json
// In Claude.ai or Inspector: call get_mcp_info
// Expected: actingRole = "tenant", impersonationActive = true
{
  "oauthBoundRole": "admin",
  "actingRole": "tenant",
  "currentRole": "tenant",
  "assumedUserId": "<target-tenant-uuid>",
  "impersonationActive": true,
  "downgradeActive": true
}
```

Then call `list_residences` with the `buildingId` that contains the tenant's unit. The response should contain only the tenant's linked residence(s) — exactly what the real tenant would see.

---

## Step 6 — Verify the Audit Log Entry

Every call to `assume_user` and `restore_acting_user` writes a row to `mcp_assume_user_log`. Confirm the row exists:

```sql
SELECT id, performed_by, assumed_user_id, action, details->>'outcome' AS outcome,
       created_at
FROM mcp_assume_user_log
WHERE performed_by = '<your-admin-uuid>'
ORDER BY created_at DESC
LIMIT 5;
```

A successful `assume_user` call produces a row with:
- `action = 'assume'`
- `assumed_user_id = '<target-tenant-uuid>'`
- `details->>'outcome' = 'success'`
- `performed_by = '<admin-uuid>'`

---

## Step 7 — Clear the Override with `restore_acting_user`

Call `restore_acting_user` with no arguments to revert to the OAuth-bound admin identity:

```json
// Expected response
{
  "ok": true,
  "assumedUserId": null,
  "actingRole": "admin",
  "previousAssumedUserId": "<target-tenant-uuid>",
  "previousActingRole": "tenant",
  "noChange": false,
  "message": "Acting role restored..."
}
```

A follow-up `get_mcp_info` call should show `"impersonationActive": false` and `"actingRole": "admin"`.

The restore also writes an audit row (`action = 'restore'`).

---

## The Production Lock — How to Verify It

Calling `assume_user` against the **production** endpoint always returns the "not enabled" error, even with a valid admin token:

```json
// Production response (regardless of MCP_ASSUME_USER env var)
{
  "content": [{
    "type": "text",
    "text": "assume_user is not enabled on this server. Note: MCP_ASSUME_USER is hard-locked OFF in production (NODE_ENV=production) regardless of the env var ..."
  }]
}
```

This is enforced at the code level in `isMcpAssumeUserEnabled()` (`server/utils/feature-flags.ts`): the function returns `false` unconditionally when `NODE_ENV === "production"`, before even reading the environment variable. No operator action can change this without a code change and a redeployment.

If `MCP_ASSUME_USER` is set in the production environment, the server logs a startup warning explaining that the flag is being ignored.

---

## Next QA Pass Prep Checklist

Use this checklist at the start of each QA pass that includes tenant-POV test cases (W13, MOB-T01–T10, Q2/Q5/Q6).

### Before the session

- [ ] Confirm the Replit "Start application" workflow is running and the webview loads at the staging URL.
- [ ] Confirm staging is NOT production: check that the URL ends in `.replit.dev` (not `koveo-gestion.com`).
- [ ] Open a second Chrome profile named "Tenant QA" and sign in as `mcp-tenant@koveo-mcp.test` / `McpTest2024!`.
- [ ] In Claude.ai (or MCP Inspector), connect to the staging `/mcp` endpoint and authenticate as `mcp-admin@koveo-mcp.test`.
- [ ] Run `get_mcp_info` to confirm `actingRole = "admin"` and `impersonationActive = false`.
- [ ] Confirm `MCP_ASSUME_USER=1` is active: call `assume_user` with any UUID — on staging it should return a target-not-found or success error, not the "hard-locked" message.

### For MCP tool tests (assume_user workflow)

1. Look up the UUID for `mcp-tenant@koveo-mcp.test` in the staging DB.
2. Call `assume_user({ userId: "<tenant-uuid>" })` — confirm `"ok": true` and `"actingRole": "tenant"`.
3. Execute the tool under test — confirm results are scoped to the tenant's residences only.
4. Call `restore_acting_user({})` — confirm `"actingRole": "admin"` is restored.
5. Verify audit rows appear in `mcp_assume_user_log`.

### For browser-based tenant tests (Chrome profile workflow)

1. In the "Tenant QA" Chrome profile, navigate to the page under test.
2. Verify the tenant sees only their own data (W13: only MCP-1/MCP-2 in the org picker).
3. For mobile tests (MOB-T01–T10): open DevTools → Toggle device toolbar → set to 390×844 viewport.
4. For isolation tests (Q2, Q5, Q6): cross-check what the tenant sees against what the admin sees in the main window.

### After the session

- [ ] Call `restore_acting_user` if any MCP session was left in impersonation state.
- [ ] Close or reset the "Tenant QA" Chrome profile if it will not be used again that day.

---

## Summary of Tool Call Shapes

| Tool | Arguments | When to use |
|------|-----------|-------------|
| `assume_user` | `{ "userId": "<uuid>" }` | Adopt a tenant's identity for the session |
| `restore_acting_user` | `{}` | Revert to the OAuth-bound admin identity |
| `get_mcp_info` | `{}` | Inspect current session identity state |

---

## Related Documentation

- [RBAC System](./RBAC_SYSTEM.md) — role hierarchy and permission model
- [Development Workflow](./references/DEVELOPMENT_WORKFLOW.md) — general development process
- [End-to-End Verification Report](./MCP_STAGING_QA_HARNESS_VERIFICATION.md) — smoke-test results from 2026-04-26
- Task #642 — original `assume_user` / `restore_acting_user` implementation
- Task #980 — production lock and this QA harness doc
- Task #660 — admin UI for reading the `mcp_assume_user_log` audit log
- `server/mcp/seed-mcp-data.ts` — source of truth for seeded tenant accounts
