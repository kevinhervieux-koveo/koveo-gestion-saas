import { describe, it, expect, jest } from '@jest/globals';
import { resolveMcpUser } from '../../../server/mcp/server';

describe('resolveMcpUser', () => {
  describe('OAuth path (authContext.userId present)', () => {
    it('returns the real Koveo user looked up by id, ignoring the role-keyed seed lookup', async () => {
      const lookupById = jest.fn(async (id: string) => ({ id, role: 'manager' }));
      const lookupByRole = jest.fn(async () => ({ id: 'seed-id', role: 'manager' }));

      const user = await resolveMcpUser(
        { userId: 'real-user-123', role: 'manager' },
        'manager',
        { lookupById, lookupByRole },
      );

      expect(lookupById).toHaveBeenCalledWith('real-user-123');
      expect(lookupByRole).not.toHaveBeenCalled();
      expect(user).toEqual({ id: 'real-user-123', role: 'manager' });
    });

    it('still returns the OAuth user even if their DB role differs from the requested MCP role', async () => {
      // E.g. an admin acting as a manager (or vice versa). The OAuth user id is
      // authoritative for `createdBy`-style attribution.
      const lookupById = jest.fn(async (id: string) => ({ id, role: 'admin' }));
      const lookupByRole = jest.fn();

      const user = await resolveMcpUser(
        { userId: 'real-admin-1', role: 'manager' },
        'manager',
        { lookupById, lookupByRole: lookupByRole as never },
      );

      expect(user).toEqual({ id: 'real-admin-1', role: 'admin' });
      expect(lookupByRole).not.toHaveBeenCalled();
    });

    it('returns null when the OAuth-bound user no longer exists in the DB', async () => {
      const lookupById = jest.fn(async () => null);
      const lookupByRole = jest.fn();

      const user = await resolveMcpUser(
        { userId: 'deleted-user', role: 'admin' },
        'admin',
        { lookupById, lookupByRole: lookupByRole as never },
      );

      expect(user).toBeNull();
      // Important: we do NOT silently fall back to the seed account when the
      // OAuth user is missing — that would mis-attribute writes.
      expect(lookupByRole).not.toHaveBeenCalled();
    });
  });

  describe('legacy MCP_API_KEY path (no authContext)', () => {
    it('falls back to the role-keyed seed account when authContext is undefined', async () => {
      const lookupById = jest.fn();
      const lookupByRole = jest.fn(async (role: string) => ({ id: `seed-${role}`, role }));

      const user = await resolveMcpUser(undefined, 'manager', {
        lookupById: lookupById as never,
        lookupByRole,
      });

      expect(lookupById).not.toHaveBeenCalled();
      expect(lookupByRole).toHaveBeenCalledWith('manager');
      expect(user).toEqual({ id: 'seed-manager', role: 'manager' });
    });

    it('falls back to the seed account when authContext is present but has no userId', async () => {
      const lookupById = jest.fn();
      const lookupByRole = jest.fn(async (role: string) => ({ id: `seed-${role}`, role }));

      const user = await resolveMcpUser({ role: 'tenant' }, 'tenant', {
        lookupById: lookupById as never,
        lookupByRole,
      });

      expect(lookupById).not.toHaveBeenCalled();
      expect(lookupByRole).toHaveBeenCalledWith('tenant');
      expect(user).toEqual({ id: 'seed-tenant', role: 'tenant' });
    });

    it('returns null when the seed account is missing (e.g. unseeded DB)', async () => {
      const lookupByRole = jest.fn(async () => null);
      const user = await resolveMcpUser(undefined, 'admin', {
        lookupById: jest.fn() as never,
        lookupByRole,
      });
      expect(user).toBeNull();
    });
  });
});
