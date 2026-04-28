/**
 * @jest-environment node
 *
 * Task #1639 — Onboarding versions seeder
 *
 * Verifies that seedOnboardingVersions():
 *   (a) Inserts a row for every tour that is missing from onboarding_versions
 *   (b) Bumps version + updates content_hash when a tour's hash has changed
 *   (c) Is a no-op when nothing has changed
 *   (d) Does not duplicate rows when run twice in a row
 *   (e) Is a no-op when the onboarding feature flag is off
 *   (f) Emits a summary log with accurate added/bumped/unchanged counts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Shared in-memory state used by the mocked db
// ---------------------------------------------------------------------------

type VersionRow = {
  tourId: string;
  version: number;
  contentHash: string | null;
  description: string | null;
  publishedAt?: Date;
};

let dbStore: VersionRow[] = [];
const insertedRows: VersionRow[] = [];
const updatedRows: { tourId: string; set: Partial<VersionRow> }[] = [];

// ---------------------------------------------------------------------------
// Mocks — must come before the module under test is imported
// ---------------------------------------------------------------------------

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: () => Promise.resolve(dbStore),
    })),
    insert: jest.fn(() => ({
      values: (row: VersionRow) => {
        const r = { ...row };
        return {
          // Support .onConflictDoNothing().returning() chaining.
          // Returns an array with the inserted row (as a real DB would), so the
          // seeder can check inserted.length > 0 to count accurate additions.
          onConflictDoNothing: () => ({
            returning: (_fields?: unknown) => {
              dbStore.push(r);
              insertedRows.push(r);
              return Promise.resolve([{ tourId: r.tourId }]);
            },
          }),
        };
      },
    })),
    update: jest.fn(() => ({
      set: (data: Partial<VersionRow>) => ({
        // The where clause receives the result of eq(onboardingVersions.tourId, tourId).
        // The drizzle-orm manual mock returns { type:'condition', column, value }.
        // `value` is the tourId string we are matching against.
        where: (cond: { value?: string }) => {
          const tourId = cond?.value ?? '__unknown__';
          updatedRows.push({ tourId, set: data });
          const idx = dbStore.findIndex((r) => r.tourId === tourId);
          if (idx !== -1) {
            Object.assign(dbStore[idx], data);
          }
          return Promise.resolve();
        },
      }),
    })),
  },
}));

jest.mock('../../../shared/schemas/onboarding', () => ({
  onboardingVersions: {
    tourId: { name: 'tour_id' },
    version: { name: 'version' },
    contentHash: { name: 'content_hash' },
  },
}));

const MOCK_HASH_A = 'aaaa1111aaaa';
const MOCK_HASH_B = 'bbbb2222bbbb';

jest.mock('../../../server/lib/onboarding-health-analyzer', () => ({
  computeTourContentHash: jest.fn((tour: { tourId: string }) => {
    if (tour.tourId === 'tour-a') return MOCK_HASH_A;
    return MOCK_HASH_B;
  }),
}));

jest.mock('../../../server/api/auto/onboarding-content', () => ({
  SMOKE_TOUR_DEF: [
    {
      tourId: 'tour-a',
      title: { fr: 'Tour A', en: 'Tour A' },
      description: { fr: 'desc A', en: 'desc A' },
      roles: [],
      steps: [{ id: 'step-1', anchor: '[data-onboarding="test"]', covers: [] }],
    },
    {
      tourId: 'tour-b',
      title: { fr: 'Tour B', en: 'Tour B' },
      description: { fr: 'desc B', en: 'desc B' },
      roles: ['manager'],
      steps: [{ id: 'step-2', anchor: '[data-onboarding="test2"]', covers: [] }],
    },
  ],
}));

let onboardingEnabled = true;
jest.mock('../../../server/utils/feature-flags', () => ({
  isOnboardingEnabled: jest.fn(() => onboardingEnabled),
}));

jest.mock('../../../server/utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedOnboardingVersions', () => {
  beforeEach(() => {
    dbStore = [];
    insertedRows.length = 0;
    updatedRows.length = 0;
    onboardingEnabled = true;
    jest.resetModules();
  });

  it('(a) inserts a row for every tour missing from onboarding_versions', async () => {
    const { seedOnboardingVersions } = await import(
      '../../../server/api/onboarding-versions-seed'
    );
    await seedOnboardingVersions();

    expect(insertedRows).toHaveLength(2);
    const ids = insertedRows.map((r) => r.tourId);
    expect(ids).toContain('tour-a');
    expect(ids).toContain('tour-b');
    expect(insertedRows.find((r) => r.tourId === 'tour-a')?.version).toBe(1);
    expect(insertedRows.find((r) => r.tourId === 'tour-b')?.version).toBe(1);
    expect(insertedRows.find((r) => r.tourId === 'tour-a')?.contentHash).toBe(MOCK_HASH_A);
    expect(insertedRows.find((r) => r.tourId === 'tour-b')?.contentHash).toBe(MOCK_HASH_B);
  });

  it('(b) bumps version when a tour content_hash differs', async () => {
    // Pre-seed: tour-a with a stale hash, tour-b with the correct hash
    dbStore = [
      { tourId: 'tour-a', version: 1, contentHash: 'stale-hash', description: null },
      { tourId: 'tour-b', version: 1, contentHash: MOCK_HASH_B, description: null },
    ];

    const { seedOnboardingVersions } = await import(
      '../../../server/api/onboarding-versions-seed'
    );
    await seedOnboardingVersions();

    // tour-a should have been bumped (stale hash → current hash, version 1 → 2)
    const bumpedA = updatedRows.find((u) => u.tourId === 'tour-a');
    expect(bumpedA).toBeDefined();
    expect(bumpedA?.set.version).toBe(2);
    expect(bumpedA?.set.contentHash).toBe(MOCK_HASH_A);

    // tour-b should NOT have been bumped (hash unchanged)
    const bumpedB = updatedRows.find((u) => u.tourId === 'tour-b' && u.set.version === 2);
    expect(bumpedB).toBeUndefined();

    // No inserts — both tours already existed
    expect(insertedRows).toHaveLength(0);
  });

  it('(c) is a no-op when all content hashes match', async () => {
    dbStore = [
      { tourId: 'tour-a', version: 1, contentHash: MOCK_HASH_A, description: null },
      { tourId: 'tour-b', version: 1, contentHash: MOCK_HASH_B, description: null },
    ];

    const { seedOnboardingVersions } = await import(
      '../../../server/api/onboarding-versions-seed'
    );
    await seedOnboardingVersions();

    expect(insertedRows).toHaveLength(0);
    // No updates with a version bump
    const bumps = updatedRows.filter((u) => u.set.version !== undefined);
    expect(bumps).toHaveLength(0);
  });

  it('(d) does not duplicate rows when run twice in a row on an empty DB', async () => {
    const { seedOnboardingVersions } = await import(
      '../../../server/api/onboarding-versions-seed'
    );

    // First run — should insert both tours
    await seedOnboardingVersions();
    expect(insertedRows).toHaveLength(2);
    expect(dbStore).toHaveLength(2);

    // Clear run tracking but keep the dbStore (simulates persistent DB)
    insertedRows.length = 0;
    updatedRows.length = 0;

    // Second run — hashes match now, should be a complete no-op
    await seedOnboardingVersions();
    expect(insertedRows).toHaveLength(0);
    const bumps = updatedRows.filter((u) => u.set.version !== undefined);
    expect(bumps).toHaveLength(0);
    // DB still has exactly 2 rows (no duplicates)
    expect(dbStore).toHaveLength(2);
  });

  it('(b2) bumps version when existing row has null contentHash (legacy SQL-migration row)', async () => {
    // Old migrations (0034/0035) inserted rows without a content_hash.
    // These must be treated as a mismatch and bump so users see "new content".
    dbStore = [
      { tourId: 'tour-a', version: 1, contentHash: null, description: null },
      { tourId: 'tour-b', version: 1, contentHash: null, description: null },
    ];

    const { seedOnboardingVersions } = await import(
      '../../../server/api/onboarding-versions-seed'
    );
    await seedOnboardingVersions();

    // Both tours should be bumped to version 2 with their hashes written
    const bumpedA = updatedRows.find((u) => u.tourId === 'tour-a');
    expect(bumpedA).toBeDefined();
    expect(bumpedA?.set.version).toBe(2);
    expect(bumpedA?.set.contentHash).toBe(MOCK_HASH_A);

    const bumpedB = updatedRows.find((u) => u.tourId === 'tour-b');
    expect(bumpedB).toBeDefined();
    expect(bumpedB?.set.version).toBe(2);
    expect(bumpedB?.set.contentHash).toBe(MOCK_HASH_B);

    // No inserts — both rows already existed
    expect(insertedRows).toHaveLength(0);
  });

  it('(e) is a no-op when the onboarding feature flag is off', async () => {
    onboardingEnabled = false;

    const { seedOnboardingVersions } = await import(
      '../../../server/api/onboarding-versions-seed'
    );
    await seedOnboardingVersions();

    expect(insertedRows).toHaveLength(0);
    expect(dbStore).toHaveLength(0);
  });

  it('(f) emits a one-line summary log with accurate added/bumped/unchanged counts', async () => {
    // Pre-seed: tour-a has stale hash (will be bumped), tour-b is missing (will be inserted)
    dbStore = [
      { tourId: 'tour-a', version: 1, contentHash: 'stale-hash', description: null },
    ];

    const { seedOnboardingVersions } = await import(
      '../../../server/api/onboarding-versions-seed'
    );

    const { logInfo } = await import('../../../server/utils/logger');
    const logInfoMock = logInfo as jest.MockedFunction<typeof logInfo>;
    logInfoMock.mockClear();

    await seedOnboardingVersions();

    const summaryCall = logInfoMock.mock.calls.find((args) =>
      String(args[0]).includes('[ONBOARDING SEED]'),
    );
    expect(summaryCall).toBeDefined();

    const message = String(summaryCall![0]);
    // 1 registered (tour-b inserted), 1 bumped (tour-a), 0 unchanged
    expect(message).toMatch(/registered 1 new tour/);
    expect(message).toMatch(/bumped 1 to new version/);
    expect(message).toMatch(/0 unchanged/);
  });
});
