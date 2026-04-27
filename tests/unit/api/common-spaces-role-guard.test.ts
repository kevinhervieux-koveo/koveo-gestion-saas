/**
 * @jest-environment node
 *
 * Unit tests for the requireRole guard on the common-spaces endpoints.
 *
 * Task #1538 — Let super_admin into /manager/common-spaces-stats.
 *
 * Verifies that the updated requireRole(['super_admin', 'admin', 'manager'])
 * call on GET /api/common-spaces/:spaceId/stats:
 *   - accepts super_admin (must NOT return 403)
 *   - accepts admin        (must NOT return 403)
 *   - accepts manager      (must NOT return 403)
 *   - rejects tenant       (must return 403 INSUFFICIENT_PERMISSIONS)
 *   - rejects resident     (must return 403 INSUFFICIENT_PERMISSIONS)
 *
 * The test exercises the middleware directly with mock Express objects so that
 * no database connection is needed.
 */

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve([])) })),
      })),
    })),
  },
  pool: {},
  sql: jest.fn(),
}));

import { requireRole } from '../../../server/middleware/auth-middleware';

function makeReqWithRole(role: string) {
  return {
    session: {
      user: {
        id: 'u-test',
        email: 'test@example.com',
        role,
      },
    },
    headers: {},
  } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager'];
const middleware = requireRole(ALLOWED_ROLES);

describe('requireRole([super_admin, admin, manager]) — common-spaces guard', () => {
  it('allows super_admin through', () => {
    const req = makeReqWithRole('super_admin');
    const res = makeRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows admin through', () => {
    const req = makeReqWithRole('admin');
    const res = makeRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows manager through', () => {
    const req = makeReqWithRole('manager');
    const res = makeRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects tenant with 403 INSUFFICIENT_PERMISSIONS', () => {
    const req = makeReqWithRole('tenant');
    const res = makeRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INSUFFICIENT_PERMISSIONS' })
    );
  });

  it('rejects resident with 403 INSUFFICIENT_PERMISSIONS', () => {
    const req = makeReqWithRole('resident');
    const res = makeRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INSUFFICIENT_PERMISSIONS' })
    );
  });
});
