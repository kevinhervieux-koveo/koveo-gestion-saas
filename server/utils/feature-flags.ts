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
