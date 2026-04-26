// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * @file resolveTagNamesToIds integration tests — Task #1112
 * @description Verifies that the `resolveTagNamesToIds` helper correctly maps
 *   AI-returned tag name strings to real document-tag UUIDs before the bulk-
 *   import route persists the identification result.
 *
 *   Requires a real Postgres connection via `_INTEGRATION_DB_URL`.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('resolveTagNamesToIds (Task #1112)', () => {
  let db: typeof import('../db').db;
  let schema: typeof import('@shared/schema');
  let resolveTagNamesToIds: typeof import('../api/bulk-import').resolveTagNamesToIds;
  let drizzleOrm: typeof import('drizzle-orm');

  const insertedTagIds: string[] = [];

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';

    db = require('../db').db;
    schema = require('@shared/schema');
    resolveTagNamesToIds = require('../api/bulk-import').resolveTagNamesToIds;
    drizzleOrm = require('drizzle-orm');
  });

  afterAll(async () => {
    if (!REAL_DB_URL || insertedTagIds.length === 0) return;
    const { inArray } = drizzleOrm;
    await db
      .delete(schema.documentTags)
      .where(inArray(schema.documentTags.id, insertedTagIds));
  });

  async function insertTag(opts: {
    name: string;
    organizationId?: string | null;
    isSystem?: boolean;
  }) {
    const { eq } = drizzleOrm;
    const [row] = await db
      .insert(schema.documentTags)
      .values({
        name: opts.name,
        organizationId: opts.organizationId ?? null,
        isSystem: opts.isSystem ?? false,
        scope: 'any',
        importance: 'normal',
      })
      .returning();
    insertedTagIds.push(row.id);
    return row;
  }

  it('returns UUIDs for all matching names', async () => {
    const orgId = `test-org-${Date.now()}-a`;
    const tag1 = await insertTag({ name: `Procès-verbal-${Date.now()}-a`, organizationId: orgId });
    const tag2 = await insertTag({ name: `Finance-${Date.now()}-a`, organizationId: orgId });

    const result = await resolveTagNamesToIds(
      [tag1.name, tag2.name],
      orgId,
    );

    expect(result).toHaveLength(2);
    expect(result).toContain(tag1.id);
    expect(result).toContain(tag2.id);
  });

  it('drops names that have no matching tag and keeps matched ones', async () => {
    const orgId = `test-org-${Date.now()}-b`;
    const tag = await insertTag({ name: `Finance-${Date.now()}-b`, organizationId: orgId });

    const result = await resolveTagNamesToIds(
      [tag.name, 'totally-unmatched-name-xyzzy'],
      orgId,
    );

    expect(result).toHaveLength(1);
    expect(result).toContain(tag.id);
  });

  it('returns an empty array when the AI tags list is empty', async () => {
    const result = await resolveTagNamesToIds([], 'some-org-id');
    expect(result).toEqual([]);
  });

  it('matches case-insensitively', async () => {
    const orgId = `test-org-${Date.now()}-c`;
    const tag = await insertTag({ name: `Procès-Verbal-${Date.now()}-c`, organizationId: orgId });

    const result = await resolveTagNamesToIds(
      [tag.name.toLowerCase()],
      orgId,
    );

    expect(result).toHaveLength(1);
    expect(result).toContain(tag.id);
  });

  it('resolves system tags (isSystem=true) regardless of org', async () => {
    const systemTag = await insertTag({
      name: `SysTag-${Date.now()}-d`,
      organizationId: null,
      isSystem: true,
    });

    const result = await resolveTagNamesToIds(
      [systemTag.name],
      'completely-different-org',
    );

    expect(result).toHaveLength(1);
    expect(result).toContain(systemTag.id);
  });

  it('does not return tags belonging to a different organization', async () => {
    const orgIdA = `test-org-${Date.now()}-e-A`;
    const orgIdB = `test-org-${Date.now()}-e-B`;
    const tagA = await insertTag({ name: `TagOrgA-${Date.now()}-e`, organizationId: orgIdA });

    const result = await resolveTagNamesToIds(
      [tagA.name],
      orgIdB,
    );

    expect(result).toHaveLength(0);
  });
});
