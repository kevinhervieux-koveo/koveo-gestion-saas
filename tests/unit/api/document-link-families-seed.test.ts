/**
 * @jest-environment node
 *
 * Task #1456 — Quebec condo system link families seed
 *
 * Verifies that seedKoveoDocumentLinkFamilies():
 *   - Inserts all 26 entries on a completely empty DB
 *   - Inserts zero entries on a second run (idempotent)
 *   - Does not throw on either run
 *   - The seed list has exactly 26 entries with unique names
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));

// ---------------------------------------------------------------------------
// In-memory store used by the mock db
// ---------------------------------------------------------------------------

let storedSystemFamilies: { name: string }[] = [];
const insertedBatches: { name: string; isSystem: boolean }[][] = [];

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: () => ({
        where: () => Promise.resolve(storedSystemFamilies),
      }),
    })),
    insert: jest.fn(() => ({
      values: (rows: { name: string; isSystem: boolean }[]) => {
        insertedBatches.push(Array.isArray(rows) ? rows : [rows]);
        for (const r of Array.isArray(rows) ? rows : [rows]) {
          storedSystemFamilies.push({ name: r.name });
        }
        return Promise.resolve();
      },
    })),
  },
}));

jest.mock('../../../shared/schemas/documents', () => ({
  documentLinkFamilies: {
    name: 'document_link_families',
    isSystem: {},
  },
}));

jest.mock('../../../server/utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KOVEO_DEFAULT_LINK_FAMILIES seed list', () => {
  it('contains exactly 26 entries', async () => {
    const { KOVEO_DEFAULT_LINK_FAMILIES } = await import(
      '../../../server/api/document-link-families-seed'
    );
    expect(KOVEO_DEFAULT_LINK_FAMILIES).toHaveLength(26);
  });

  it('all entries have unique names', async () => {
    const { KOVEO_DEFAULT_LINK_FAMILIES } = await import(
      '../../../server/api/document-link-families-seed'
    );
    const names = KOVEO_DEFAULT_LINK_FAMILIES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry has a non-empty name and description', async () => {
    const { KOVEO_DEFAULT_LINK_FAMILIES } = await import(
      '../../../server/api/document-link-families-seed'
    );
    for (const family of KOVEO_DEFAULT_LINK_FAMILIES) {
      expect(family.name.trim().length).toBeGreaterThan(0);
      expect(family.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('seedKoveoDocumentLinkFamilies idempotency', () => {
  beforeEach(() => {
    storedSystemFamilies = [];
    insertedBatches.length = 0;
  });

  it('inserts all 26 entries on an empty DB and does not throw', async () => {
    const { seedKoveoDocumentLinkFamilies } = await import(
      '../../../server/api/document-link-families-seed'
    );
    await expect(seedKoveoDocumentLinkFamilies()).resolves.toBeUndefined();
    const totalInserted = insertedBatches.flat().length;
    expect(totalInserted).toBe(26);
  });

  it('inserts zero entries on the second run and does not throw', async () => {
    const { seedKoveoDocumentLinkFamilies } = await import(
      '../../../server/api/document-link-families-seed'
    );
    await seedKoveoDocumentLinkFamilies();
    const firstCount = insertedBatches.flat().length;
    expect(firstCount).toBe(26);

    insertedBatches.length = 0;

    await expect(seedKoveoDocumentLinkFamilies()).resolves.toBeUndefined();
    expect(insertedBatches.flat().length).toBe(0);
  });
});
