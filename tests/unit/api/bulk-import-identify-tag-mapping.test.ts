/**
 * Task #1105 — At identification time the bulk-import flow now resolves
 * the AI's free-form tag-name suggestions (e.g. `"insurance"`,
 * `"INVOICE"`) to real `document_tags` UUIDs and persists those UUIDs
 * (instead of the strings) into the staged item's
 * `identification.tags`. The same UUIDs are also stashed in
 * `identification.aiSuggestedTagIds` so the wizard's TagPicker keeps
 * rendering the AI sparkle on each one even after the admin tweaks the
 * selection through the standard set-tags endpoint.
 *
 * The contract pinned by these tests:
 *   - Names that match a `document_tags` row by case-insensitive
 *     equality (and are accessible to the session's organisation) are
 *     replaced with the row's UUID.
 *   - Names that don't match anything are dropped — only valid UUIDs end
 *     up in `identification.tags`.
 *   - `tags` and `aiSuggestedTagIds` carry the same UUID list.
 *   - Scope-mismatched tags are skipped (a `building` tag is dropped
 *     when the item is residence-scoped, and vice-versa); `any`-scoped
 *     tags are always kept.
 *   - When the AI returns no tags or no name matches a real tag, both
 *     fields end up empty (and never carry free-form strings).
 *
 * The test exercises the real `processItemForStep` code path via the
 * per-item retry endpoint POST /items/:id/identify (fire-and-forget),
 * waiting for the in-flight marker to clear before asserting on the
 * stored row.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () =>
  require('../../manual-mocks/drizzle-orm/pg-core'),
);

type Item = Record<string, unknown> & { id: string; sessionId: string };
type Session = Record<string, unknown> & {
  id: string;
  buildingId: string | null;
  organizationId: string;
};
type TagRow = {
  id: string;
  organizationId: string | null;
  name: string;
  scope: 'building' | 'residence' | 'any';
  isSystem: boolean;
};

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();
const tagStore: TagRow[] = [];

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const base: Session = {
    id,
    buildingId: 'building-1',
    organizationId: 'org-1',
    progress: {},
    ...overrides,
  };
  sessionStore.set(id, base);
  return base;
}

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-1',
    originalName: `${id}.pdf`,
    stagedPath: `/staging/${id}.pdf`,
    mimeType: 'application/pdf',
    status: 'branched',
    sortingDecision: null,
    branchDecision: { branch: 'building_documents' } as Record<string, unknown>,
    identification: null,
    linkDecisions: null,
    screening: null,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

function seedTag(row: TagRow): void {
  tagStore.push(row);
}

// The condition object built by the manual-mock `eq()` exposes the
// scalar value through `.value`. For nested `and()`/`or()` we walk the
// tree to find the *first* `eq` against the relevant column id so we
// can route the select to the right store.
function findEqValue(cond: any, columnHint?: string): unknown {
  if (!cond) return undefined;
  if (cond.type === 'and' || cond.type === 'or') {
    for (const c of cond.conditions ?? []) {
      const v = findEqValue(c, columnHint);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  if (cond.operator === 'eq' && 'value' in cond) {
    if (!columnHint) return cond.value;
    if (cond.column?.name === columnHint) return cond.value;
  }
  return undefined;
}

function findInArrayValues(cond: any): string[] | undefined {
  if (!cond) return undefined;
  if (cond.type === 'and' || cond.type === 'or') {
    for (const c of cond.conditions ?? []) {
      const v = findInArrayValues(c);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  if (cond.operator === 'in' && Array.isArray(cond.values)) {
    return cond.values as string[];
  }
  return undefined;
}

function makeWhereThenable(updated: Item | null) {
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(updated ? [updated] : []);
  return p;
}

const mockDb: any = {
  select: jest.fn((cols?: any) => ({
    from: jest.fn((table: any) => {
      // The pg-core mock spreads schema columns onto the table object,
      // so any table that defines a `name` column has its real
      // `table.name` field shadowed by that column. Read `_.name` first
      // (always set to the SQL table name by the mock's pgTable) and
      // fall back to `table.name` for tables without a `name` column.
      const tableName: string =
        (typeof table?._?.name === 'string' && table._.name) ||
        (typeof table?.name === 'string' && table.name) ||
        '';
      return {
        where: jest.fn((cond: any) => {
          if (tableName === 'bulk_import_sessions') {
            const id = findEqValue(cond) as string | undefined;
            const row = id ? sessionStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          if (tableName === 'document_tags') {
            // Two queries land here:
            //   (A) resolveTagNamesToIds — has an `inArray(lower(name),
            //       lowerNames)` clause AND the org `or(…)` branch.
            //   (B) loadAvailableTagsForOrganization — just the org
            //       `or(…)` branch (no inArray), used to seed the AI
            //       prompt with the org's full tag catalogue.
            const lowerNames = findInArrayValues(cond);
            const orgId = findEqValue(cond, 'organization_id') as
              | string
              | undefined;
            const matchesOrg = (t: TagRow): boolean => {
              if (t.isSystem) return true;
              if (t.organizationId === null) return true;
              if (orgId && t.organizationId === orgId) return true;
              return false;
            };
            if (lowerNames === undefined) {
              // Catalogue load (B) — return every visible tag.
              const matches = tagStore.filter(matchesOrg);
              return Promise.resolve(
                matches.map((m) => ({
                  id: m.id,
                  name: m.name,
                  scope: m.scope,
                })),
              );
            }
            const lowerSet = new Set(lowerNames.map((n) => n.toLowerCase()));
            const matches = tagStore.filter((t) => {
              if (!lowerSet.has(t.name.toLowerCase())) return false;
              return matchesOrg(t);
            });
            // Project to the columns the helper selects.
            return Promise.resolve(
              matches.map((m) => ({ id: m.id, name: m.name, scope: m.scope })),
            );
          }
          if (tableName === 'bulk_import_items') {
            const id = findEqValue(cond) as string | undefined;
            if (id && itemStore.has(id)) {
              if (cols === undefined) return Promise.resolve([itemStore.get(id)!]);
              return Promise.resolve([{ id }]);
            }
            if (id) {
              const matches = Array.from(itemStore.values())
                .filter((it) => it.sessionId === id)
                .map((it) => ({ id: it.id }));
              if (matches.length > 0) return Promise.resolve(matches);
            }
            return Promise.resolve([]);
          }
          // residences and other tables — return empty.
          return Promise.resolve([]);
        }),
      };
    }),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item> | any) => ({
      where: jest.fn((cond: any) => {
        const id = findEqValue(cond) as string | undefined;
        if (!id) return makeWhereThenable(null);
        if (sessionStore.has(id)) {
          const merged: Session = {
            ...sessionStore.get(id)!,
            ...(updates as Partial<Session>),
          };
          sessionStore.set(id, merged);
          return makeWhereThenable(null);
        }
        if (!itemStore.has(id)) return makeWhereThenable(null);
        const merged: Item = {
          ...itemStore.get(id)!,
          ...(updates as Partial<Item>),
        } as Item;
        itemStore.set(id, merged);
        return makeWhereThenable(merged);
      }),
    })),
  })),
  insert: jest.fn(() => ({ values: jest.fn(() => Promise.resolve()) })),
  delete: jest.fn(() => ({ where: jest.fn(() => Promise.resolve()) })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

const canAccessMock = jest.fn().mockResolvedValue(true);
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: (...args: any[]) => canAccessMock(...args),
}));

const analyzerIdentify = jest.fn();
jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    screen: jest.fn(),
    suggestBranch: jest.fn(),
    suggestMergeOrSplit: jest.fn(),
    identify: (...args: any[]) => (analyzerIdentify as any)(...args),
    suggestLinks: jest.fn(),
  },
  isBulkImportAiAvailable: () => true,
  BRANCH_SUB_CATEGORIES: {
    building_documents: ['other'],
    residence_documents: ['lease', 'other'],
    bill: ['other'],
    demand: ['other'],
    maintenance: ['other'],
    other: ['other'],
  },
}));

jest.mock('../../../server/services/bulk-import-rotation', () => ({
  rotateAndRewriteStagedFile: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../server/services/document-service', () => ({
  documentService: {},
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

import {
  registerBulkImportRoutes,
  inFlightPerItemRetry,
  __resetFiscalYearStartMonthCacheForTests,
} from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

async function waitForRetryToSettle(
  itemId: string,
  maxMs = 4000,
): Promise<void> {
  const key = `${itemId}:identification`;
  const start = Date.now();
  while (inFlightPerItemRetry.has(key)) {
    if (Date.now() - start > maxMs) {
      throw new Error(
        `[test] per-item retry ${key} did not settle within ${maxMs}ms`,
      );
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  tagStore.length = 0;
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  analyzerIdentify.mockReset();
  jest.clearAllMocks();
  inFlightPerItemRetry.clear();
  __resetFiscalYearStartMonthCacheForTests();
});

const URL_IDENTIFY = (id: string) =>
  `/api/admin/bulk-import/items/${id}/identify`;

describe('Identification step — AI tag-name → UUID mapping (Task #1105)', () => {
  it('replaces matched AI names with real UUIDs and drops unmatched names', async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-1', {
      branchDecision: { branch: 'building_documents' } as Record<string, unknown>,
    });
    seedTag({
      id: 'uuid-insurance',
      organizationId: null,
      name: 'Insurance',
      scope: 'any',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-invoice',
      organizationId: 'org-1',
      name: 'INVOICE',
      scope: 'any',
      isSystem: false,
    });

    analyzerIdentify.mockResolvedValueOnce({
      name: 'AI Name',
      description: 'AI Description',
      tags: ['insurance', 'invoice', 'unknown-tag'],
      confidence: 0.9,
    });

    await request(buildApp()).post(URL_IDENTIFY('it-1')).expect(200);
    await waitForRetryToSettle('it-1');

    const stored = itemStore.get('it-1')!;
    const ident = stored.identification as Record<string, unknown>;
    // Free-form names are gone, only the matched UUIDs remain.
    expect(ident.tags).toEqual(['uuid-insurance', 'uuid-invoice']);
    // AI-suggest stash mirrors the matched UUIDs so the picker can
    // keep rendering the sparkle even after the admin tweaks `tags`.
    expect(ident.aiSuggestedTagIds).toEqual(['uuid-insurance', 'uuid-invoice']);
    // Sibling AI fields the analyzer wrote survive the merge.
    expect(ident.name).toBe('AI Name');
    expect(ident.description).toBe('AI Description');
  });

  it('drops scope-mismatched tags (building tag for a residence-scoped item)', async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-res', {
      branchDecision: {
        branch: 'residence_documents',
      } as Record<string, unknown>,
    });
    seedTag({
      id: 'uuid-bldg',
      organizationId: null,
      name: 'Procès-verbaux',
      scope: 'building',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-lease',
      organizationId: null,
      name: 'Lease',
      scope: 'residence',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-misc',
      organizationId: null,
      name: 'Misc',
      scope: 'any',
      isSystem: true,
    });

    analyzerIdentify.mockResolvedValueOnce({
      name: 'AI',
      description: '',
      tags: ['Procès-verbaux', 'lease', 'misc'],
      confidence: 0.5,
    });

    await request(buildApp()).post(URL_IDENTIFY('it-res')).expect(200);
    await waitForRetryToSettle('it-res');

    const stored = itemStore.get('it-res')!;
    const ident = stored.identification as Record<string, unknown>;
    // Building-scoped tag is excluded because the item is residence-scoped.
    // `any`-scoped + `residence`-scoped tags survive.
    expect(ident.tags).toEqual(['uuid-lease', 'uuid-misc']);
    expect(ident.aiSuggestedTagIds).toEqual(['uuid-lease', 'uuid-misc']);
  });

  it('persists empty arrays when the AI returned no tags', async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-empty');

    analyzerIdentify.mockResolvedValueOnce({
      name: 'AI',
      description: '',
      tags: [],
      confidence: 0.5,
    });

    await request(buildApp()).post(URL_IDENTIFY('it-empty')).expect(200);
    await waitForRetryToSettle('it-empty');

    const stored = itemStore.get('it-empty')!;
    const ident = stored.identification as Record<string, unknown>;
    expect(ident.tags).toEqual([]);
    expect(ident.aiSuggestedTagIds).toEqual([]);
  });

  it('persists empty arrays when no AI name matches a real tag', async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-no-match');
    // No tags seeded — every AI name will be unknown.

    analyzerIdentify.mockResolvedValueOnce({
      name: 'AI',
      description: '',
      tags: ['nope', 'also-nope'],
      confidence: 0.5,
    });

    await request(buildApp()).post(URL_IDENTIFY('it-no-match')).expect(200);
    await waitForRetryToSettle('it-no-match');

    const stored = itemStore.get('it-no-match')!;
    const ident = stored.identification as Record<string, unknown>;
    // No free-form strings ever leak into `tags`.
    expect(ident.tags).toEqual([]);
    expect(ident.aiSuggestedTagIds).toEqual([]);
  });

  it("passes the org's tag catalogue into bulkImportAnalyzer.identify so the AI prompt can be constrained to real tag names", async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-prompt', {
      branchDecision: { branch: 'building_documents' } as Record<string, unknown>,
    });
    seedTag({
      id: 'uuid-bldg',
      organizationId: null,
      name: 'Procès-verbaux',
      scope: 'building',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-any',
      organizationId: null,
      name: "Police d'assurance du syndicat",
      scope: 'any',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-res',
      organizationId: null,
      name: 'Bail',
      scope: 'residence',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-org',
      organizationId: 'org-1',
      name: 'Custom Tag',
      scope: 'any',
      isSystem: false,
    });

    analyzerIdentify.mockResolvedValueOnce({
      name: 'AI',
      description: '',
      tags: [],
      confidence: 0.5,
    });

    await request(buildApp()).post(URL_IDENTIFY('it-prompt')).expect(200);
    await waitForRetryToSettle('it-prompt');

    expect(analyzerIdentify).toHaveBeenCalledTimes(1);
    const callArg = analyzerIdentify.mock.calls[0]![0] as {
      availableTags?: { name: string }[] | null;
    };
    const passedNames = (callArg.availableTags ?? []).map((t) => t.name).sort();
    // Building-branch items get the building/any/org tags but NOT residence-only tags.
    expect(passedNames).toEqual(
      ["Custom Tag", "Police d'assurance du syndicat", 'Procès-verbaux'].sort(),
    );
  });

  it("filters the available-tags catalogue by branch scope (residence_documents drops building-only tags)", async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-prompt-res', {
      branchDecision: {
        branch: 'residence_documents',
      } as Record<string, unknown>,
    });
    seedTag({
      id: 'uuid-bldg',
      organizationId: null,
      name: 'Procès-verbaux',
      scope: 'building',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-res',
      organizationId: null,
      name: 'Bail',
      scope: 'residence',
      isSystem: true,
    });
    seedTag({
      id: 'uuid-any',
      organizationId: null,
      name: 'Misc',
      scope: 'any',
      isSystem: true,
    });

    analyzerIdentify.mockResolvedValueOnce({
      name: 'AI',
      description: '',
      tags: [],
      confidence: 0.5,
    });

    await request(buildApp()).post(URL_IDENTIFY('it-prompt-res')).expect(200);
    await waitForRetryToSettle('it-prompt-res');

    expect(analyzerIdentify).toHaveBeenCalledTimes(1);
    const callArg = analyzerIdentify.mock.calls[0]![0] as {
      availableTags?: { name: string }[] | null;
    };
    const passedNames = (callArg.availableTags ?? []).map((t) => t.name).sort();
    // Residence-branch items get residence/any tags only — building-only is hidden.
    expect(passedNames).toEqual(['Bail', 'Misc']);
  });

  it('skips tags from other organizations even when the name matches', async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-cross-org');
    seedTag({
      id: 'uuid-other-org',
      organizationId: 'org-99', // belongs to a different organisation
      name: 'Insurance',
      scope: 'any',
      isSystem: false,
    });

    analyzerIdentify.mockResolvedValueOnce({
      name: 'AI',
      description: '',
      tags: ['Insurance'],
      confidence: 0.5,
    });

    await request(buildApp()).post(URL_IDENTIFY('it-cross-org')).expect(200);
    await waitForRetryToSettle('it-cross-org');

    const stored = itemStore.get('it-cross-org')!;
    const ident = stored.identification as Record<string, unknown>;
    // The cross-org tag is invisible to this session — must be dropped,
    // not surfaced as a suggestion.
    expect(ident.tags).toEqual([]);
    expect(ident.aiSuggestedTagIds).toEqual([]);
  });
});
