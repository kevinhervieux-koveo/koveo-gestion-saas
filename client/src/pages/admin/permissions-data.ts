/**
 * Defensive helpers for the `/admin/permissions` page.
 *
 * The `/api/permissions-matrix` endpoint is supposed to return four
 * fields (`permissions`, `rolePermissions`, `permissionsByResource`,
 * `roleMatrix`), but in practice the server has at times returned
 * non-array / non-object truthy values for them (e.g. `{}` for an array
 * field). The bare `|| []` / `|| {}` fallbacks the page used to rely on
 * only fire on falsy values, so any truthy-but-wrong-shape value would
 * slip through and cause `x.filter is not a function` /
 * `x.reduce is not a function` to throw during render, leaving the page
 * stuck on its loading spinner.
 *
 * These helpers force the four fields back into the shape the rest of
 * the component expects, regardless of what the API returns.
 */

export interface PermissionsMatrixApiShape<TPermission, TRolePermission> {
  permissions?: unknown;
  rolePermissions?: unknown;
  permissionsByResource?: unknown;
  roleMatrix?: unknown;
}

export interface PermissionsMatrixView<TPermission, TRolePermission> {
  permissions: TPermission[];
  rolePermissions: TRolePermission[];
  permissionsByResource: Record<string, TPermission[]>;
  roleMatrix: Record<string, string[]>;
}

/**
 * Coerce any input value to a plain array.
 *
 * - Real arrays are returned as-is.
 * - Plain objects (and other iterables exposed via `Object.values`)
 *   have their values flattened into a single array. This handles the
 *   case where the server accidentally serialised what should be an
 *   array as an object keyed by id or by group.
 * - Anything else (null, undefined, primitives) becomes an empty array.
 */
export function coerceToArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === 'object') {
    const flattened: T[] = [];
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        for (const item of v as unknown[]) flattened.push(item as T);
      } else if (v !== undefined && v !== null) {
        flattened.push(v as T);
      }
    }
    return flattened;
  }
  return [];
}

/**
 * Coerce any input value to a plain object (Record).
 *
 * Arrays and primitives are rejected — only "plain object" values are
 * accepted; everything else becomes an empty object so callers can
 * safely call `Object.keys`, `Object.values`, or index into it.
 */
export function coerceToObject<T = unknown>(value: unknown): Record<string, T> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, T>;
  }
  return {};
}

/**
 * Coerce a single role's permission-id list out of a (possibly broken)
 * `roleMatrix`. Used at every read site where we previously trusted
 * `roleMatrix[role]` to already be an array.
 */
export function coerceRolePermissionIds(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Normalise the raw `/api/permissions-matrix` response into the shape
 * the page wants to consume. Safe to call with `undefined`, `null`, or
 * any partially-broken response.
 */
export function buildPermissionsMatrixView<TPermission, TRolePermission>(
  raw: PermissionsMatrixApiShape<TPermission, TRolePermission> | null | undefined
): PermissionsMatrixView<TPermission, TRolePermission> {
  const source = raw ?? {};
  return {
    permissions: coerceToArray<TPermission>(source.permissions),
    rolePermissions: coerceToArray<TRolePermission>(source.rolePermissions),
    permissionsByResource: coerceToObject<TPermission[]>(source.permissionsByResource),
    roleMatrix: coerceToObject<string[]>(source.roleMatrix),
  };
}
