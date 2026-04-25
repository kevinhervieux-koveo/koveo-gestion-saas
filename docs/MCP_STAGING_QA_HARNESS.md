# MCP Staging QA Harness

## What This Is and Why It Exists

QA engineers need to test MCP tool behaviour from a **tenant's perspective** — verifying that tools like `list_residences`, `get_residence`, and related read tools return only data scoped to the correct resident identity.

Without a harness, the only way to do this is to log out of the manager-admin OAuth session and re-authenticate as a tenant user, which destroys the admin session and prevents back-to-back test runs.

The `assume_user` / `restore_acting_user` MCP tools (shipped in Task #642) solve this: a single authenticated manager-admin session can temporarily adopt a tenant's identity for one or more tool calls, then revert back — all without re-authentication. Every impersonation is recorded in `mcp_assume_user_log` for auditability.

This document is the end-to-end runbook for using that harness on the **staging deployment**.

---

## Which Environment and How to Confirm You Are on Staging

The harness is enabled **only on the staging deployment**. The `MCP_ASSUME_USER=1` environment variable is set there and absent from production.

**Hard lock**: even if `MCP_ASSUME_USER` is somehow present in a production environment, the code ignores it — `isMcpAssumeUserEnabled()` unconditionally returns `false` when `NODE_ENV === "production"`. Calling `assume_user` against the production endpoint always returns the "not enabled" error.

To confirm you are on staging (not production):

1. The staging URL pattern is your Replit dev-domain URL (e.g. `https://<repl-name>.<user>.replit.dev/mcp`).
2. Call `get_mcp_info` with your admin session — the `serverInfo.nodeEnv` field in the JSON response will be `"development"` (or absent) on staging. If it says `"production"`, you are on the production deployment.
3. Try calling `assume_user` with any userId. On staging it will either succeed or return a role/target error. On production it always returns the "not enabled" message regardless of input.

---

## Step 1 — Prerequisites

| Requirement | Details |
|-------------|---------|
| Admin user account | A user with `role = 'admin'` in the staging database. |
| MCP OAuth client | Registered via `POST /register` or pre-seeded by `seedMcpData`. The MCP-1 and MCP-2 sandbox clients are auto-seeded on non-production boot. |
| Target tenant user | A user with `role = 'tenant'` (or `'resident'`) and at least one `userResidences` row linking them to a residence. Note their `id` (UUID). |
| Network access | HTTPS access to the staging deployment URL. |

---

## Step 2 — Complete the OAuth Admin Session (Consent Flow)

### Option A — Claude.ai (recommended for interactive QA)

1. In Claude.ai, open **Settings → Integrations → Add Integration**.
2. Enter the staging MCP endpoint: `https://<staging-host>/mcp`.
3. Click **Connect**. Claude.ai will redirect to `/authorize` on staging.
4. Log in as the admin user and click **Allow**.
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

## Step 3 — Call `assume_user`

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

## Step 4 — Verify Tenant-Scoped Behaviour

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

## Step 5 — Verify the Audit Log Entry

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

## Step 6 — Clear the Override with `restore_acting_user`

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
- Task #642 — original `assume_user` / `restore_acting_user` implementation
- Task #980 — production lock and this QA harness doc
- Task #660 — admin UI for reading the `mcp_assume_user_log` audit log
