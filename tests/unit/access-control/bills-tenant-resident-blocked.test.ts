import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(),
  },
}));

import { scopeQuery } from '../../../server/db/queries/scope-query';

interface FakeQuery {
  whereCalledWith: any | null;
  where: (clause: any) => FakeQuery;
}

function makeFakeQuery(): FakeQuery {
  const q: FakeQuery = {
    whereCalledWith: null,
    where(clause: any) {
      this.whereCalledWith = clause;
      return this;
    },
  };
  return q;
}

function isFalseClause(clause: any): boolean {
  if (!clause) return false;
  // Drizzle SQL`false` produces an object with queryChunks containing 'false'.
  const serialized = JSON.stringify(clause);
  return /"false"|false/.test(serialized);
}

describe('scopeQuery: bills are blocked for tenant/resident roles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const blockedRoles = ['tenant', 'resident', 'demo_tenant', 'demo_resident'] as const;

  for (const role of blockedRoles) {
    it(`returns where(false) for role="${role}" without looking up buildings`, async () => {
      const fake = makeFakeQuery();
      const result = await scopeQuery(
        fake as any,
        { userId: `${role}-user`, role: role as any },
        'bills'
      );
      expect(result).toBe(fake);
      expect(fake.whereCalledWith).not.toBeNull();
      expect(isFalseClause(fake.whereCalledWith)).toBe(true);
    });
  }

  it('admin bypasses scoping entirely (no where clause added)', async () => {
    const fake = makeFakeQuery();
    const result = await scopeQuery(
      fake as any,
      { userId: 'admin-user', role: 'admin' },
      'bills'
    );
    expect(result).toBe(fake);
    expect(fake.whereCalledWith).toBeNull();
  });
});
