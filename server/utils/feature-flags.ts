/**
 * Lightweight feature-flag helpers.
 *
 * The codebase doesn't (yet) have a dedicated feature-flag system, so we
 * read directly from process.env here. Truthy values: "1", "true", "on",
 * "yes" (case-insensitive). Anything else (including unset) is falsy.
 *
 * Add new flags by exporting a small helper from this module rather than
 * scattering env reads across the codebase.
 */

function readBoolEnv(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

/**
 * BILL_NUMBER_V2 — when on, all three bill creation paths (MCP tool,
 * recurring/auto generator, REST API) emit numbers in the unified
 * {ORG_CODE}-{YYYYMM}-{CAT}-{SEQ4} format. When off, each path falls back
 * to its legacy generator. See Task #255.
 */
export function isBillNumberV2Enabled(): boolean {
  return readBoolEnv('BILL_NUMBER_V2');
}

/**
 * MCP_ASSUME_USER — when on (staging / dev only), the admin-only `assume_user`
 * and `restore_acting_user` MCP tools are active. When off, both tools are
 * unavailable: `assume_user` is registered but returns a clear "feature not
 * enabled" error if invoked, and `restore_acting_user` does the same.
 *
 * **Production lock**: this function ALWAYS returns `false` when
 * `NODE_ENV === "production"`, regardless of the env var value. This is a
 * hard code-level guard so that no stray env var or operator mistake can
 * expose the impersonation surface on live tenant data. If the var is set
 * in a production environment, `registerMcpRoutes` emits a one-shot startup
 * warning so the operator knows the override was ignored.
 *
 * Gating the tools behind a flag lets us ship the impersonation surface dark
 * and only flip it on in QA / staging where tenant-perspective testing is
 * needed. See Task #642 (original tool) and Task #980 (prod lock + docs).
 */
export function isMcpAssumeUserEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return readBoolEnv('MCP_ASSUME_USER');
}
