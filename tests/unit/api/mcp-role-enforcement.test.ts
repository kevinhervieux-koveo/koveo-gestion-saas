import { describe, it, expect, jest } from '@jest/globals';
import {
  wrapHandlerWithRoleEnforcement,
  authorizeDeleteInMcpScope,
  allowedRolesFor,
} from '../../../server/mcp/server';

describe('MCP role enforcement wrapper', () => {
  describe('with OAuth-bound enforced role', () => {
    it('returns an Authorization mismatch response when caller-supplied role escalates beyond the OAuth ceiling', async () => {
      const handler = jest.fn(async () => ({ content: [{ type: 'text' as const, text: 'should-not-run' }] }));
      const wrapped = wrapHandlerWithRoleEnforcement(handler, 'tenant');

      const result = (await wrapped({ role: 'manager', buildingId: 'b1' })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(handler).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Authorization mismatch');
      expect(result.content[0].text).toContain('"tenant"');
      expect(result.content[0].text).toContain('"manager"');
      expect(result.content[0].text).toContain('re-authorize');
    });

    it('allows manager session to downgrade to tenant and forwards the downgraded role to the handler', async () => {
      const handler = jest.fn(async (a: Record<string, unknown>) => ({
        content: [{ type: 'text' as const, text: `ran with role=${a.role as string}` }],
      }));
      const wrapped = wrapHandlerWithRoleEnforcement(handler, 'manager');

      const result = (await wrapped({ role: 'tenant', buildingId: 'b1' })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(handler).toHaveBeenCalledTimes(1);
      // Tenant restrictions must apply, so the handler must see role="tenant".
      expect(handler.mock.calls[0][0]).toEqual({ role: 'tenant', buildingId: 'b1' });
      expect(result.content[0].text).toBe('ran with role=tenant');
    });

    it('allows admin session to downgrade to manager or tenant', async () => {
      for (const downgradeTo of ['manager', 'tenant'] as const) {
        const handler = jest.fn(async (a: Record<string, unknown>) => ({
          content: [{ type: 'text' as const, text: a.role as string }],
        }));
        const wrapped = wrapHandlerWithRoleEnforcement(handler, 'admin');

        const result = (await wrapped({ role: downgradeTo })) as {
          content: Array<{ type: string; text: string }>;
        };

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toEqual({ role: downgradeTo });
        expect(result.content[0].text).toBe(downgradeTo);
      }
    });

    it('rejects manager session attempting to escalate to admin', async () => {
      const handler = jest.fn(async () => ({ content: [{ type: 'text' as const, text: 'escalated' }] }));
      const wrapped = wrapHandlerWithRoleEnforcement(handler, 'manager');

      const result = (await wrapped({ role: 'admin' })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(handler).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Authorization mismatch');
      expect(result.content[0].text).toContain('"manager"');
      expect(result.content[0].text).toContain('"admin"');
    });

    it('rejects tenant session attempting to escalate (to manager or admin)', async () => {
      for (const escalateTo of ['manager', 'admin'] as const) {
        const handler = jest.fn(async () => ({ content: [{ type: 'text' as const, text: 'escalated' }] }));
        const wrapped = wrapHandlerWithRoleEnforcement(handler, 'tenant');

        const result = (await wrapped({ role: escalateTo })) as {
          content: Array<{ type: string; text: string }>;
        };

        expect(handler).not.toHaveBeenCalled();
        expect(result.content[0].text).toContain('Authorization mismatch');
      }
    });

    it('forwards the call when caller-supplied role matches the enforced role', async () => {
      const handler = jest.fn(async (a: Record<string, unknown>) => ({
        content: [{ type: 'text' as const, text: `ran with role=${a.role as string}` }],
      }));
      const wrapped = wrapHandlerWithRoleEnforcement(handler, 'manager');

      const result = (await wrapped({ role: 'manager', x: 1 })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toEqual({ role: 'manager', x: 1 });
      expect(result.content[0].text).toBe('ran with role=manager');
    });

    it('injects the enforced role when no role argument was supplied', async () => {
      const handler = jest.fn(async (a: Record<string, unknown>) => ({
        content: [{ type: 'text' as const, text: `role=${a.role as string}` }],
      }));
      const wrapped = wrapHandlerWithRoleEnforcement(handler, 'admin');

      const result = (await wrapped({ y: 2 })) as { content: Array<{ type: string; text: string }> };

      expect(handler).toHaveBeenCalledTimes(1);
      // The wrapper injects the enforced role into the args object.
      expect(handler.mock.calls[0][0]).toEqual({ y: 2, role: 'admin' });
      expect(result.content[0].text).toBe('role=admin');
    });

    it('overrides matching role with the enforced role (defense in depth)', async () => {
      const handler = jest.fn(async (a: Record<string, unknown>) => a);
      const wrapped = wrapHandlerWithRoleEnforcement(handler, 'manager');

      await wrapped({ role: 'manager', x: 1 });

      // Even when the supplied role matches, the wrapper passes the trusted
      // enforced role through (so handler closures always see one source).
      expect(handler.mock.calls[0][0]).toEqual({ role: 'manager', x: 1 });
    });
  });

  describe('allowedRolesFor', () => {
    it('admin may act as admin, manager, or tenant', () => {
      expect(allowedRolesFor('admin')).toEqual(['admin', 'manager', 'tenant']);
    });

    it('manager may act as manager or tenant', () => {
      expect(allowedRolesFor('manager')).toEqual(['manager', 'tenant']);
    });

    it('tenant is locked to tenant', () => {
      expect(allowedRolesFor('tenant')).toEqual(['tenant']);
    });
  });

  describe('authorizeDeleteInMcpScope', () => {
    const orgInScope = 'mcp-org-1';
    const orgOutOfScope = 'other-org-1';
    const mcpOrgIds = [orgInScope, 'mcp-org-2'];

    describe('delete_building authorization', () => {
      it('denies tenants regardless of scope', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'tenant',
          entityKind: 'building',
          entityId: 'b1',
          entity: { exists: true, organizationId: orgInScope },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toBe('Access denied: tenants cannot delete buildings');
        }
      });

      it('allows manager when building is in MCP scope', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'manager',
          entityKind: 'building',
          entityId: 'b1',
          entity: { exists: true, organizationId: orgInScope },
          mcpOrgIds,
        });
        expect(result.ok).toBe(true);
      });

      it('allows admin when building is in MCP scope', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'admin',
          entityKind: 'building',
          entityId: 'b1',
          entity: { exists: true, organizationId: orgInScope },
          mcpOrgIds,
        });
        expect(result.ok).toBe(true);
      });

      it('denies admin/manager when building is out of MCP scope', () => {
        for (const role of ['admin', 'manager'] as const) {
          const result = authorizeDeleteInMcpScope({
            role,
            entityKind: 'building',
            entityId: 'b1',
            entity: { exists: true, organizationId: orgOutOfScope },
            mcpOrgIds,
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.response.content[0].text).toBe(
              'Access denied: building is not in an MCP-scoped organization',
            );
          }
        }
      });

      it('returns "not found" when the building does not exist', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'manager',
          entityKind: 'building',
          entityId: 'missing-id',
          entity: { exists: false },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toContain('Building not found: missing-id');
        }
      });
    });

    describe('delete_bill authorization', () => {
      it('denies tenants regardless of scope', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'tenant',
          entityKind: 'bill',
          entityId: 'bill-1',
          entity: { exists: true, organizationId: orgInScope },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toBe('Access denied: tenants cannot delete bills');
        }
      });

      it('allows admin/manager when the bill belongs to a building in MCP scope', () => {
        for (const role of ['admin', 'manager'] as const) {
          const result = authorizeDeleteInMcpScope({
            role,
            entityKind: 'bill',
            entityId: 'bill-1',
            entity: { exists: true, organizationId: orgInScope },
            mcpOrgIds,
          });
          expect(result.ok).toBe(true);
        }
      });

      it('denies admin/manager when the bill belongs to a building outside MCP scope', () => {
        for (const role of ['admin', 'manager'] as const) {
          const result = authorizeDeleteInMcpScope({
            role,
            entityKind: 'bill',
            entityId: 'bill-1',
            entity: { exists: true, organizationId: orgOutOfScope },
            mcpOrgIds,
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.response.content[0].text).toBe(
              'Access denied: bill is not attached to an MCP-scoped building',
            );
          }
        }
      });

      it('treats a bill whose building was not found as out-of-scope', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'manager',
          entityKind: 'bill',
          entityId: 'bill-1',
          entity: { exists: true, organizationId: undefined },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toBe(
            'Access denied: bill is not attached to an MCP-scoped building',
          );
        }
      });

      it('returns "not found" when the bill does not exist', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'manager',
          entityKind: 'bill',
          entityId: 'missing-bill',
          entity: { exists: false },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toContain('Bill not found: missing-bill');
        }
      });
    });

    describe('delete_residence authorization', () => {
      it('denies tenants regardless of scope', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'tenant',
          entityKind: 'residence',
          entityId: 'res-1',
          entity: { exists: true, organizationId: orgInScope },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toBe('Access denied: tenants cannot delete residences');
        }
      });

      it('allows admin/manager when the residence belongs to a building in MCP scope', () => {
        for (const role of ['admin', 'manager'] as const) {
          const result = authorizeDeleteInMcpScope({
            role,
            entityKind: 'residence',
            entityId: 'res-1',
            entity: { exists: true, organizationId: orgInScope },
            mcpOrgIds,
          });
          expect(result.ok).toBe(true);
        }
      });

      it('denies admin/manager when the residence belongs to a building outside MCP scope', () => {
        for (const role of ['admin', 'manager'] as const) {
          const result = authorizeDeleteInMcpScope({
            role,
            entityKind: 'residence',
            entityId: 'res-1',
            entity: { exists: true, organizationId: orgOutOfScope },
            mcpOrgIds,
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.response.content[0].text).toBe(
              'Access denied: residence is not in an MCP-scoped organization',
            );
          }
        }
      });

      it('treats a residence whose building was not found as out-of-scope', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'manager',
          entityKind: 'residence',
          entityId: 'res-1',
          entity: { exists: true, organizationId: undefined },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toBe(
            'Access denied: residence is not in an MCP-scoped organization',
          );
        }
      });

      it('returns "not found" when the residence does not exist', () => {
        const result = authorizeDeleteInMcpScope({
          role: 'manager',
          entityKind: 'residence',
          entityId: 'missing-res',
          entity: { exists: false },
          mcpOrgIds,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.content[0].text).toContain('Residence not found: missing-res');
        }
      });
    });
  });

  describe('without an OAuth-enforced role (legacy MCP_API_KEY path)', () => {
    it('returns the handler unchanged so the caller-supplied role is honored', async () => {
      const handler = jest.fn(async (a: Record<string, unknown>) => ({
        content: [{ type: 'text' as const, text: `role=${a.role as string}` }],
      }));
      const wrapped = wrapHandlerWithRoleEnforcement(handler, undefined);

      // The unwrapped handler is returned as-is.
      expect(wrapped).toBe(handler);

      const result = (await wrapped({ role: 'tenant' })) as { content: Array<{ type: string; text: string }> };
      expect(handler).toHaveBeenCalledWith({ role: 'tenant' });
      expect(result.content[0].text).toBe('role=tenant');
    });
  });
});
