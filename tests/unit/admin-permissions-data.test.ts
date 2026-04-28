/**
 * Unit tests for the defensive coercion helpers used by
 * `/admin/permissions`. These tests reproduce the production crash
 * (truthy non-array values causing `x.filter is not a function`) and
 * verify that the helpers always hand the page a safe, well-shaped
 * view of the matrix — even when the API returns garbage.
 *
 * @see client/src/pages/admin/permissions-data.ts
 * @see client/src/pages/admin/permissions.tsx
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildPermissionsMatrixView,
  coerceRolePermissionIds,
  coerceToArray,
  coerceToObject,
} from '../../client/src/pages/admin/permissions-data';
import { ROLE_HIERARCHY } from '../../client/src/pages/admin/permissions';

interface FakePermission {
  id: string;
  name: string;
  resourceType: string;
  action: string;
}

interface FakeRolePermission {
  id: string;
  role: string;
  permissionId: string;
}

const realApiShape = {
  permissions: [
    {
      id: 'p-1',
      name: 'manage_users',
      displayName: 'Manage Users',
      description: 'Allows managing users',
      resourceType: 'users',
      action: 'manage',
      isActive: true,
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'p-2',
      name: 'view_bills',
      displayName: 'View Bills',
      description: 'Allows viewing bills',
      resourceType: 'bills',
      action: 'read',
      isActive: true,
      createdAt: '2025-01-02T00:00:00Z',
    },
  ],
  rolePermissions: [
    {
      id: 'rp-1',
      role: 'admin',
      permissionId: 'p-1',
      grantedBy: 'system',
      grantedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'rp-2',
      role: 'manager',
      permissionId: 'p-2',
      grantedBy: 'system',
      grantedAt: '2025-01-02T00:00:00Z',
    },
  ],
  permissionsByResource: {
    users: [
      {
        id: 'p-1',
        name: 'manage_users',
        displayName: 'Manage Users',
        description: '',
        resourceType: 'users',
        action: 'manage',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
    ],
    bills: [
      {
        id: 'p-2',
        name: 'view_bills',
        displayName: 'View Bills',
        description: '',
        resourceType: 'bills',
        action: 'read',
        isActive: true,
        createdAt: '2025-01-02T00:00:00Z',
      },
    ],
  },
  roleMatrix: {
    admin: ['p-1', 'p-2'],
    manager: ['p-2'],
    tenant: [],
    resident: [],
  },
};

describe('coerceToArray', () => {
  it('returns arrays untouched', () => {
    const arr = [1, 2, 3];
    expect(coerceToArray(arr)).toBe(arr);
  });

  it('flattens object values into an array', () => {
    expect(coerceToArray({ a: 1, b: 2 })).toEqual([1, 2]);
  });

  it('flattens nested arrays from object values', () => {
    expect(coerceToArray({ a: [1, 2], b: [3, 4] })).toEqual([1, 2, 3, 4]);
  });

  it('returns [] for null / undefined / primitives', () => {
    expect(coerceToArray(null)).toEqual([]);
    expect(coerceToArray(undefined)).toEqual([]);
    expect(coerceToArray(42)).toEqual([]);
    expect(coerceToArray('hello')).toEqual([]);
    expect(coerceToArray(true)).toEqual([]);
  });
});

describe('coerceToObject', () => {
  it('returns plain objects untouched', () => {
    const obj = { a: 1 };
    expect(coerceToObject(obj)).toBe(obj);
  });

  it('rejects arrays and returns {}', () => {
    expect(coerceToObject([1, 2, 3])).toEqual({});
  });

  it('returns {} for null / undefined / primitives', () => {
    expect(coerceToObject(null)).toEqual({});
    expect(coerceToObject(undefined)).toEqual({});
    expect(coerceToObject(42)).toEqual({});
    expect(coerceToObject('x')).toEqual({});
  });
});

describe('coerceRolePermissionIds', () => {
  it('returns arrays untouched', () => {
    expect(coerceRolePermissionIds(['p-1', 'p-2'])).toEqual(['p-1', 'p-2']);
  });

  it('returns [] for non-arrays', () => {
    expect(coerceRolePermissionIds(null)).toEqual([]);
    expect(coerceRolePermissionIds(undefined)).toEqual([]);
    expect(coerceRolePermissionIds({})).toEqual([]);
    expect(coerceRolePermissionIds('p-1')).toEqual([]);
  });
});

describe('buildPermissionsMatrixView', () => {
  it('returns the full empty view when fed undefined or null', () => {
    for (const input of [undefined, null]) {
      const view = buildPermissionsMatrixView<FakePermission, FakeRolePermission>(
        input as undefined
      );
      expect(view.permissions).toEqual([]);
      expect(view.rolePermissions).toEqual([]);
      expect(view.permissionsByResource).toEqual({});
      expect(view.roleMatrix).toEqual({});
    }
  });

  it('renders an empty state without throwing for the all-null shape', () => {
    // This is the exact shape called out in the task as the regression
    // we must survive without throwing.
    const view = buildPermissionsMatrixView<FakePermission, FakeRolePermission>({
      permissionsByResource: null,
      roleMatrix: null,
      permissions: null,
      rolePermissions: null,
    } as never);

    // No throws on any of the operations the page actually performs.
    expect(() => view.permissions.filter(() => true)).not.toThrow();
    expect(() => view.rolePermissions.reduce((acc) => acc, [] as never[])).not.toThrow();
    expect(() => Object.keys(view.permissionsByResource)).not.toThrow();
    expect(() => coerceRolePermissionIds(view.roleMatrix['admin'])).not.toThrow();

    // And the view is genuinely empty (zero rows everywhere).
    expect(view.permissions).toHaveLength(0);
    expect(view.rolePermissions).toHaveLength(0);
    expect(Object.keys(view.permissionsByResource)).toHaveLength(0);
    expect(Object.keys(view.roleMatrix)).toHaveLength(0);
  });

  it('passes the real API shape through and yields a non-empty filtered list', () => {
    const view = buildPermissionsMatrixView<FakePermission, FakeRolePermission>(realApiShape);

    expect(view.permissions).toHaveLength(2);
    expect(view.rolePermissions).toHaveLength(2);
    expect(Object.keys(view.permissionsByResource)).toEqual(
      expect.arrayContaining(['users', 'bills'])
    );
    expect(view.roleMatrix.admin).toEqual(['p-1', 'p-2']);

    // Reproduce the page's filteredPermissions logic and assert it
    // returns a non-empty array without throwing.
    const filtered = view.permissions.filter((p) => p.resourceType === 'bills');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('p-2');
  });

  it('has the correct shape for the real API shape', () => {
    const view = buildPermissionsMatrixView<FakePermission, FakeRolePermission>(realApiShape);
    expect(view.permissions).toHaveLength(2);
  });

  it('survives the original production crash: object where array was expected', () => {
    // This is the exact production failure mode: every "should-be-array"
    // field arrives as a truthy object, so `|| []` never fires and the
    // subsequent `.filter()` / `.reduce()` calls explode.
    const broken = {
      permissions: { 'p-1': { id: 'p-1', resourceType: 'users' } } as unknown,
      rolePermissions: { 'rp-1': { id: 'rp-1', role: 'admin' } } as unknown,
      permissionsByResource: [] as unknown, // wrong type — array instead of object
      roleMatrix: 42 as unknown, // wrong type — number
    };

    const view = buildPermissionsMatrixView<FakePermission, FakeRolePermission>(
      broken as never
    );

    expect(Array.isArray(view.permissions)).toBe(true);
    expect(Array.isArray(view.rolePermissions)).toBe(true);
    expect(view.permissionsByResource).toEqual({});
    expect(view.roleMatrix).toEqual({});

    // Object-shaped permissions get flattened to an array of one item.
    expect(view.permissions).toHaveLength(1);
    expect(() => view.permissions.filter(() => true)).not.toThrow();
    expect(() =>
      view.rolePermissions.reduce<Record<string, FakeRolePermission[]>>((acc) => acc, {})
    ).not.toThrow();
    expect(() => coerceRolePermissionIds(view.roleMatrix['admin'])).not.toThrow();
  });
});

describe('ROLE_HIERARCHY constant', () => {
  it('has length 5 (super_admin through tenant)', () => {
    expect(ROLE_HIERARCHY).toHaveLength(5);
  });

  it('starts with super_admin at index 0', () => {
    expect(ROLE_HIERARCHY[0]).toBe('super_admin');
  });

  it('contains the full canonical chain in order', () => {
    expect(Array.from(ROLE_HIERARCHY)).toEqual([
      'super_admin',
      'admin',
      'manager',
      'resident',
      'tenant',
    ]);
  });
});
