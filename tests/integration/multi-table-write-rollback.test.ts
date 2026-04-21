/**
 * @jest-environment node
 *
 * Atomicity coverage for the multi-table write flows wrapped in
 * `db.transaction(...)` by Task #161. Mirrors the real-DB pattern from
 * `tests/integration/user-residences-end-residency.test.ts`.
 *
 * Strategy: seed real rows, replay the production-shaped statement
 * sequence inside `db.transaction`, throw mid-sequence, then assert
 * the database is in its pre-transaction state.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task161-tx-rollback';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('multi-table write rollback — Task #161', () => {
  let db: Db;
  let schema: Schema;

  const created: Record<string, Set<string>> = {
    demandComments: new Set(),
    demands: new Set(),
    userResidences: new Set(),
    userOrganizations: new Set(),
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  beforeAll(() => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.demandComments.size) {
      await db
        .delete(schema.demandComments)
        .where(inArray(schema.demandComments.id, [...created.demandComments]));
    }
    if (created.demands.size) {
      await db.delete(schema.demands).where(inArray(schema.demands.id, [...created.demands]));
    }
    if (created.userResidences.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidences]));
    }
    if (created.userOrganizations.size) {
      await db
        .delete(schema.userOrganizations)
        .where(inArray(schema.userOrganizations.id, [...created.userOrganizations]));
    }
    if (created.residences.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...created.residences]));
    }
    if (created.buildings.size) {
      await db.delete(schema.buildings).where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizations]));
    }
    if (created.users.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.users]));
    }
  }, 60000);

  async function seedOrgBuildingResidence() {
    const orgId = crypto.randomUUID();
    const buildingId = crypto.randomUUID();
    const residenceId = crypto.randomUUID();
    await db.insert(schema.organizations).values({
      id: orgId,
      name: `${TEST_TAG} org ${orgId.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 T',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizations.add(orgId);
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG} bldg`,
      address: '1 T',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    created.buildings.add(buildingId);
    await db.insert(schema.residences).values({
      id: residenceId,
      buildingId,
      unitNumber: '101',
      isActive: true,
    });
    created.residences.add(residenceId);
    return { orgId, buildingId, residenceId };
  }

  async function seedUser(): Promise<string> {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      username: `${TEST_TAG}-${userId.slice(0, 8)}`,
      email: `${userId}@task161.test`,
      password: 'x',
      firstName: 'T',
      lastName: 'U',
      role: 'tenant',
      isActive: true,
    });
    created.users.add(userId);
    return userId;
  }

  it('demand deletion rolls back: comments survive when demand-delete throws', async () => {
    const { residenceId, buildingId } = await seedOrgBuildingResidence();
    const submitterId = await seedUser();
    const demandId = crypto.randomUUID();
    const commentId = crypto.randomUUID();

    await db.insert(schema.demands).values({
      id: demandId,
      type: 'maintenance',
      description: `${TEST_TAG} body`,
      submitterId,
      residenceId,
      buildingId,
      status: 'submitted',
    });
    created.demands.add(demandId);
    await db.insert(schema.demandComments).values({
      id: commentId,
      demandId,
      commenterId: submitterId,
      commentText: `${TEST_TAG} comment`,
    });
    created.demandComments.add(commentId);

    await expect(
      db.transaction(async (tx) => {
        await tx.delete(schema.demandComments).where(eq(schema.demandComments.demandId, demandId));
        throw new Error('injected failure between comment delete and demand delete');
      })
    ).rejects.toThrow('injected failure');

    const remainingComments = await db
      .select({ id: schema.demandComments.id })
      .from(schema.demandComments)
      .where(eq(schema.demandComments.id, commentId));
    const remainingDemand = await db
      .select({ id: schema.demands.id })
      .from(schema.demands)
      .where(eq(schema.demands.id, demandId));
    expect(remainingComments).toHaveLength(1);
    expect(remainingDemand).toHaveLength(1);
  }, 30000);

  it('user-deletion sequence rolls back: org link survives when later step throws', async () => {
    const { orgId } = await seedOrgBuildingResidence();
    const userId = await seedUser();
    const userOrgId = crypto.randomUUID();
    await db.insert(schema.userOrganizations).values({
      id: userOrgId,
      userId,
      organizationId: orgId,
      organizationRole: 'tenant',
      isActive: true,
    });
    created.userOrganizations.add(userOrgId);

    await expect(
      db.transaction(async (tx) => {
        await tx
          .delete(schema.userOrganizations)
          .where(eq(schema.userOrganizations.userId, userId));
        throw new Error('injected failure mid user-deletion');
      })
    ).rejects.toThrow('injected failure');

    const remainingLink = await db
      .select({ id: schema.userOrganizations.id })
      .from(schema.userOrganizations)
      .where(eq(schema.userOrganizations.id, userOrgId));
    const remainingUser = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(remainingLink).toHaveLength(1);
    expect(remainingUser).toHaveLength(1);
  }, 30000);

  it('admin user-deletion sequence rolls back: residence link survives when later step throws', async () => {
    const { residenceId } = await seedOrgBuildingResidence();
    const targetUserId = await seedUser();
    const userResId = crypto.randomUUID();
    await db.insert(schema.userResidences).values({
      id: userResId,
      userId: targetUserId,
      residenceId,
      relationshipType: 'tenant',
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });
    created.userResidences.add(userResId);

    await expect(
      db.transaction(async (tx) => {
        await tx
          .delete(schema.userResidences)
          .where(eq(schema.userResidences.userId, targetUserId));
        throw new Error('injected failure mid admin user-deletion');
      })
    ).rejects.toThrow('injected failure');

    const remainingLink = await db
      .select({ id: schema.userResidences.id })
      .from(schema.userResidences)
      .where(eq(schema.userResidences.id, userResId));
    const remainingUser = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId));
    expect(remainingLink).toHaveLength(1);
    expect(remainingUser).toHaveLength(1);
  }, 30000);
});
