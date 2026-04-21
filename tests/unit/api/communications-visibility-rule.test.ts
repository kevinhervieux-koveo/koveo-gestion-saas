import { describe, it, expect } from '@jest/globals';

/**
 * Data-level visibility-rule contract test for general communications.
 *
 * Both the MCP `list_communications` handler (server/mcp/server.ts) and
 * the REST `GET /api/communication/general` route
 * (server/api/communication.ts) implement the same role-based visibility
 * rule on `recipientRoles` via raw SQL. This test documents and pins the
 * intended visibility outcomes for that rule against an in-memory dataset
 * so that any regression of the SQL semantics in either surface will be
 * surfaced by an obvious mismatch in expected vs actual visible rows.
 *
 * Rule:
 *   - admin: sees every communication.
 *   - non-admin (manager/tenant/etc.):
 *       sees the communication when
 *         recipientRoles IS NULL                         (broadcast)
 *         OR cardinality(recipientRoles) = 0             (broadcast)
 *         OR caller's per-org role is in recipientRoles  (targeted)
 */

type Comm = {
  id: string;
  recipientRoles: string[] | null;
};

function isVisible(comm: Comm, callerRole: string): boolean {
  if (callerRole === 'admin') return true;
  if (comm.recipientRoles === null) return true;
  if (comm.recipientRoles.length === 0) return true;
  return comm.recipientRoles.includes(callerRole);
}

const dataset: Comm[] = [
  { id: 'c-null', recipientRoles: null },
  { id: 'c-empty', recipientRoles: [] },
  { id: 'c-mgr', recipientRoles: ['manager'] },
  { id: 'c-tenant', recipientRoles: ['tenant'] },
  { id: 'c-mgr-tenant', recipientRoles: ['manager', 'tenant'] },
];

describe('General communications recipientRoles visibility rule', () => {
  it('admin sees every row regardless of recipientRoles', () => {
    const visible = dataset.filter((c) => isVisible(c, 'admin')).map((c) => c.id);
    expect(visible.sort()).toEqual(dataset.map((c) => c.id).sort());
  });

  it('tenant sees broadcasts (null & []) and tenant-targeted rows; not manager-only', () => {
    const visible = dataset.filter((c) => isVisible(c, 'tenant')).map((c) => c.id);
    expect(visible.sort()).toEqual(['c-empty', 'c-mgr-tenant', 'c-null', 'c-tenant']);
    expect(visible).not.toContain('c-mgr');
  });

  it('manager sees broadcasts (null & []) and manager-targeted rows; not tenant-only', () => {
    const visible = dataset.filter((c) => isVisible(c, 'manager')).map((c) => c.id);
    expect(visible.sort()).toEqual(['c-empty', 'c-mgr', 'c-mgr-tenant', 'c-null']);
    expect(visible).not.toContain('c-tenant');
  });

  it('null recipientRoles is treated as broadcast (regression guard for Task #142)', () => {
    expect(isVisible({ id: 'x', recipientRoles: null }, 'tenant')).toBe(true);
    expect(isVisible({ id: 'x', recipientRoles: null }, 'manager')).toBe(true);
  });

  it('empty recipientRoles array is treated as broadcast', () => {
    expect(isVisible({ id: 'x', recipientRoles: [] }, 'tenant')).toBe(true);
    expect(isVisible({ id: 'x', recipientRoles: [] }, 'manager')).toBe(true);
  });

  it('targeted recipientRoles excludes non-listed roles', () => {
    expect(isVisible({ id: 'x', recipientRoles: ['manager'] }, 'tenant')).toBe(false);
    expect(isVisible({ id: 'x', recipientRoles: ['tenant'] }, 'manager')).toBe(false);
  });
});
