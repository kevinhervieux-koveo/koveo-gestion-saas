/**
 * Task #1233 — Server-side integration tests for the per-item linking-decision
 * endpoint and the batch variant.
 *
 * POST /api/admin/bulk-import/items/:id/set-linking-decision
 *   Validates self-link guard, session membership, cycle detection, and the
 *   happy path (link two unrelated items, break a middle item out of a chain).
 *
 * POST /api/admin/bulk-import/sessions/:id/batch-set-linking-decisions
 *   Validates the atomic batch path including cycle rejection.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

type LinkDecisions = {
  beforeItemId: string | null;
  afterItemId: string | null;
  manualOverride?: boolean;
};

type Item = {
  id: string;
  sessionId: string;
  status: string;
  linkDecisions: LinkDecisions | null;
  updatedAt?: Date;
  [key: string]: unknown;
};

const itemStore = new Map<string, Item>();

function seedItem(id: string, sessionId: string, linkDecisions: LinkDecisions | null = null, status = 'linked'): Item {
  const item: Item = { id, sessionId, status, linkDecisions };
  itemStore.set(id, item);
  return item;
}

function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function condColumnName(cond: any): string | undefined {
  return cond?.column?.name ?? cond?.column?.sqlName;
}

function makeReturning(item: Item | null) {
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(item ? [item] : []);
  return p;
}

const mockDb: any = {
  select: jest.fn((projection?: any) => ({
    from: jest.fn(() => ({
      where: jest.fn((cond: any) => {
        const colName = condColumnName(cond);
        const value = condValue(cond) as string | undefined;
        if (colName === 'session_id') {
          const sessionItems = Array.from(itemStore.values()).filter(
            (i) => i.sessionId === value,
          );
          return Promise.resolve(sessionItems);
        }
        const item = value ? itemStore.get(value) : undefined;
        return Promise.resolve(item ? [item] : []);
      }),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const value = condValue(cond) as string | undefined;
        if (!value || !itemStore.has(value)) return makeReturning(null);
        const existing = itemStore.get(value)!;
        const merged: Item = { ...existing, ...updates };
        itemStore.set(value, merged);
        return makeReturning(merged);
      }),
    })),
  })),
  transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
    const txDb: any = {
      update: jest.fn(() => ({
        set: jest.fn((updates: Partial<Item>) => ({
          where: jest.fn((cond: any) => {
            const value = condValue(cond) as string | undefined;
            if (!value || !itemStore.has(value)) return makeReturning(null);
            const existing = itemStore.get(value)!;
            const merged: Item = { ...existing, ...updates };
            itemStore.set(value, merged);
            const p: any = Promise.resolve();
            p.returning = () => Promise.resolve([{ id: merged.id }]);
            return p;
          }),
        })),
      })),
    };
    return fn(txDb);
  }),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    suggestBranch: jest.fn(),
    screen: jest.fn(),
    suggestMergeOrSplit: jest.fn(),
    identify: jest.fn(),
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
  rotateAndRewriteStagedFile: jest.fn(),
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

import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

const ITEM_URL = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-linking-decision`;

const BATCH_URL = (sessionId: string) =>
  `/api/admin/bulk-import/sessions/${sessionId}/batch-set-linking-decisions`;

const SESSION = 'sess-link-1';

beforeEach(() => {
  itemStore.clear();
  jest.clearAllMocks();
});

describe('POST /api/admin/bulk-import/items/:id/set-linking-decision (Task #1233)', () => {
  it('links two unrelated items: sets afterItemId and stamps manualOverride', async () => {
    // Pre-seed doc-b with the matching back-pointer so that adding
    // doc-a.after = doc-b leaves the chain bidirectionally consistent
    // (Task #1254 — the per-item endpoint refuses half-updates).
    seedItem('doc-a', SESSION, null);
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null });

    const res = await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(200);

    const ld = res.body.linkDecisions as LinkDecisions;
    expect(ld.afterItemId).toBe('doc-b');
    expect(ld.beforeItemId).toBeNull();
    expect(ld.manualOverride).toBe(true);
    expect(itemStore.get('doc-a')!.linkDecisions?.afterItemId).toBe('doc-b');
  });

  it('clears both pointers when the neighbors no longer reference the item', async () => {
    // doc-b has stale pointers but its former neighbors have already
    // been detached.  Clearing doc-b restores a fully consistent state.
    seedItem('doc-a', SESSION, { beforeItemId: null, afterItemId: null });
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: 'doc-c', manualOverride: true });
    seedItem('doc-c', SESSION, { beforeItemId: null, afterItemId: null });

    const res = await request(buildApp())
      .post(ITEM_URL('doc-b'))
      .send({ beforeItemId: null, afterItemId: null })
      .expect(200);

    const ld = res.body.linkDecisions as LinkDecisions;
    expect(ld.beforeItemId).toBeNull();
    expect(ld.afterItemId).toBeNull();
    expect(ld.manualOverride).toBe(true);
  });

  it('returns 400 with cycle error when the change would create a circular chain', async () => {
    seedItem('doc-a', SESSION, { beforeItemId: null, afterItemId: 'doc-b', manualOverride: true });
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null, manualOverride: true });

    const res = await request(buildApp())
      .post(ITEM_URL('doc-b'))
      .send({ beforeItemId: 'doc-a', afterItemId: 'doc-a' })
      .expect(400);

    expect(res.body.error).toMatch(/cycle/i);
    expect(itemStore.get('doc-b')!.linkDecisions?.afterItemId).toBeNull();
  });

  it('returns 400 for a self-link (afterItemId === itemId)', async () => {
    seedItem('doc-a', SESSION, null);

    const res = await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-a' })
      .expect(400);

    expect(res.body.error).toMatch(/self-link/i);
  });

  it('returns 400 when afterItemId is not in the same session', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('other-item', 'different-session', null);

    const res = await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'other-item' })
      .expect(400);

    expect(res.body.error).toMatch(/session/i);
  });

  it('returns 404 for an unknown item id', async () => {
    const res = await request(buildApp())
      .post(ITEM_URL('does-not-exist'))
      .send({ beforeItemId: null, afterItemId: null })
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });

  /**
   * Task #1254 — bidirectional consistency rejection on the per-item
   * endpoint.  A buggy/malicious client must not be able to persist a
   * row whose new pointer targets a neighbor that does not point back.
   */
  it('Task #1254: rejects setting afterItemId when the target does not point back', async () => {
    seedItem('doc-a', SESSION, null);
    // doc-b's beforeItemId is null, so setting doc-a.after = doc-b
    // would leave doc-a.after = doc-b without doc-b.before = doc-a.
    seedItem('doc-b', SESSION, { beforeItemId: null, afterItemId: null });

    const snapshotA = JSON.parse(JSON.stringify(itemStore.get('doc-a')!));
    const snapshotB = JSON.parse(JSON.stringify(itemStore.get('doc-b')!));

    const res = await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(400);

    expect(res.body.error).toMatch(/bidirectional inconsistency/i);
    expect(res.body.error).toContain('doc-a');
    expect(res.body.error).toContain('doc-b');
    // Critically: no row was mutated.
    expect(itemStore.get('doc-a')!.linkDecisions).toEqual(snapshotA.linkDecisions);
    expect(itemStore.get('doc-b')!.linkDecisions).toEqual(snapshotB.linkDecisions);
  });

  it('Task #1254: rejects clearing a middle item that would orphan its neighbors', async () => {
    // Properly-linked chain doc-a → doc-b → doc-c.
    seedItem('doc-a', SESSION, { beforeItemId: null, afterItemId: 'doc-b', manualOverride: true });
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: 'doc-c', manualOverride: true });
    seedItem('doc-c', SESSION, { beforeItemId: 'doc-b', afterItemId: null, manualOverride: true });

    const snapshots = ['doc-a', 'doc-b', 'doc-c'].map((id) =>
      JSON.parse(JSON.stringify(itemStore.get(id)!)),
    );

    // Per-item endpoint cannot atomically rewire doc-a and doc-c, so
    // clearing doc-b would leave doc-a.after = doc-b (and doc-c.before
    // = doc-b) dangling.  The endpoint must refuse the change.
    const res = await request(buildApp())
      .post(ITEM_URL('doc-b'))
      .send({ beforeItemId: null, afterItemId: null })
      .expect(400);

    expect(res.body.error).toMatch(/bidirectional inconsistency/i);
    // No row touched.
    ['doc-a', 'doc-b', 'doc-c'].forEach((id, i) => {
      expect(itemStore.get(id)!.linkDecisions).toEqual(snapshots[i].linkDecisions);
    });
  });

  it('Task #1254: rejects setting beforeItemId when the target does not point back', async () => {
    seedItem('doc-a', SESSION, { beforeItemId: null, afterItemId: null });
    seedItem('doc-b', SESSION, null);

    const snapshotA = JSON.parse(JSON.stringify(itemStore.get('doc-a')!));

    // Setting doc-b.before = doc-a, but doc-a.after stays null.
    const res = await request(buildApp())
      .post(ITEM_URL('doc-b'))
      .send({ beforeItemId: 'doc-a', afterItemId: null })
      .expect(400);

    expect(res.body.error).toMatch(/bidirectional inconsistency/i);
    expect(itemStore.get('doc-a')!.linkDecisions).toEqual(snapshotA.linkDecisions);
    expect(itemStore.get('doc-b')!.linkDecisions).toBeNull();
  });
});

describe('POST /api/admin/bulk-import/sessions/:id/batch-set-linking-decisions (Task #1233)', () => {
  it('atomically links three items in a chain', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('doc-b', SESSION, null);
    seedItem('doc-c', SESSION, null);

    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: 'doc-c' },
          { itemId: 'doc-c', beforeItemId: 'doc-b', afterItemId: null },
        ],
      })
      .expect(200);

    expect(res.body.updated).toContain('doc-a');
    expect(res.body.updated).toContain('doc-b');
    expect(res.body.updated).toContain('doc-c');
    expect(itemStore.get('doc-a')!.linkDecisions?.afterItemId).toBe('doc-b');
    expect(itemStore.get('doc-c')!.linkDecisions?.beforeItemId).toBe('doc-b');
  });

  it('rejects a batch with a cycle and leaves the store untouched', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('doc-b', SESSION, null);

    const snapshotA = { ...itemStore.get('doc-a')! };
    const snapshotB = { ...itemStore.get('doc-b')! };

    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: 'doc-b', afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: 'doc-a' },
        ],
      })
      .expect(400);

    expect(res.body.error).toMatch(/cycle/i);
    expect(itemStore.get('doc-a')!.linkDecisions).toEqual(snapshotA.linkDecisions);
    expect(itemStore.get('doc-b')!.linkDecisions).toEqual(snapshotB.linkDecisions);
  });

  it('returns 400 when an itemId does not belong to the session', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('outsider', 'other-session', null);

    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'outsider' },
        ],
      })
      .expect(400);

    expect(res.body.error).toMatch(/session/i);
  });

  it('returns 404 when the session has no items', async () => {
    const res = await request(buildApp())
      .post(BATCH_URL('empty-session'))
      .send({
        decisions: [
          { itemId: 'ghost', beforeItemId: null, afterItemId: null },
        ],
      })
      .expect(404);

    expect(res.body.error).toMatch(/session not found/i);
  });

  /**
   * Task #1254 — bidirectional consistency rejection on the batch
   * endpoint.  The batch contract is that the client sends matched
   * dual-side updates; if it doesn't, the server must refuse and roll
   * back the entire transaction so storage stays consistent.
   */
  it('Task #1254: rejects a batch that sets afterItemId on one row without the matching back-pointer', async () => {
    seedItem('doc-a', SESSION, null);
    seedItem('doc-b', SESSION, null);
    seedItem('doc-c', SESSION, null);

    const snapshots = ['doc-a', 'doc-b', 'doc-c'].map((id) =>
      JSON.parse(JSON.stringify(itemStore.get(id)!)),
    );

    // Half-update: doc-a.after = doc-b is set but doc-b.before is left
    // untouched (null).  The batch must be refused atomically.
    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
        ],
      })
      .expect(400);

    expect(res.body.error).toMatch(/bidirectional inconsistency/i);
    expect(res.body.error).toContain('doc-a');
    expect(res.body.error).toContain('doc-b');
    // No row was mutated — the all-or-nothing contract holds.
    ['doc-a', 'doc-b', 'doc-c'].forEach((id, i) => {
      expect(itemStore.get(id)!.linkDecisions).toEqual(snapshots[i].linkDecisions);
    });
  });

  it('Task #1254: rejects a batch that orphans a former neighbor (source-chain not stitched)', async () => {
    // Source chain doc-a → doc-b → doc-c.
    seedItem('doc-a', SESSION, { beforeItemId: null, afterItemId: 'doc-b', manualOverride: true });
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: 'doc-c', manualOverride: true });
    seedItem('doc-c', SESSION, { beforeItemId: 'doc-b', afterItemId: null, manualOverride: true });
    // Standalone target.
    seedItem('doc-x', SESSION, null);

    const snapshots = ['doc-a', 'doc-b', 'doc-c', 'doc-x'].map((id) =>
      JSON.parse(JSON.stringify(itemStore.get(id)!)),
    );

    // Buggy client moves doc-b after doc-x but forgets to stitch
    // doc-a and doc-c back together.  After the proposed change:
    //   doc-a.after = doc-b (stale) but doc-b.before = doc-x.
    //   doc-c.before = doc-b (stale) but doc-b.after = null.
    // The endpoint must refuse before any row is touched.
    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-x', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-x', afterItemId: null },
        ],
      })
      .expect(400);

    expect(res.body.error).toMatch(/bidirectional inconsistency/i);
    ['doc-a', 'doc-b', 'doc-c', 'doc-x'].forEach((id, i) => {
      expect(itemStore.get(id)!.linkDecisions).toEqual(snapshots[i].linkDecisions);
    });
  });
});

/**
 * Task #1251 — End-to-end coverage for the dual-side updates the new
 * client helpers `computeLinkingDropChanges` and
 * `computeLinkingMakeStandaloneChanges` emit.
 *
 * The batch endpoint is the contract surface the wizard actually hits
 * when the admin drags rows around or detaches them. Each scenario
 * below mirrors the LinkingChange[] payload one of those helpers would
 * produce, then asserts the on-disk row state so a server regression
 * cannot silently persist a malformed chain (cycles, dangling
 * pointers, neighbor-out-of-sync) and force the client to recover.
 */
describe('Task #1251 — set-linking-decision dual-side updates and shape integrity', () => {
  /**
   * Helper: assert a row's persisted (beforeItemId, afterItemId) tuple
   * and the manualOverride stamp set by the endpoint.
   */
  function expectChain(
    id: string,
    before: string | null,
    after: string | null,
  ): void {
    const ld = itemStore.get(id)!.linkDecisions;
    expect(ld).not.toBeNull();
    expect(ld!.beforeItemId).toBe(before);
    expect(ld!.afterItemId).toBe(after);
    expect(ld!.manualOverride).toBe(true);
  }

  it('(a) clean intra-chain reorder: moving B after C in A→B→C→D yields A→C→B→D atomically', async () => {
    // Seed chain A→B→C→D.
    seedItem('a', SESSION, { beforeItemId: null, afterItemId: 'b', manualOverride: true });
    seedItem('b', SESSION, { beforeItemId: 'a', afterItemId: 'c', manualOverride: true });
    seedItem('c', SESSION, { beforeItemId: 'b', afterItemId: 'd', manualOverride: true });
    seedItem('d', SESSION, { beforeItemId: 'c', afterItemId: null, manualOverride: true });

    // Payload mirrors what computeLinkingDropChanges('b', 'c', 'after', ...)
    // would produce for the chain above: every row whose effective
    // before/after actually changes is included, on both sides of the
    // splice (A's after, C's before/after, B's before/after, D's before).
    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'a', beforeItemId: null, afterItemId: 'c' },
          { itemId: 'c', beforeItemId: 'a', afterItemId: 'b' },
          { itemId: 'b', beforeItemId: 'c', afterItemId: 'd' },
          { itemId: 'd', beforeItemId: 'b', afterItemId: null },
        ],
      })
      .expect(200);

    expect(res.body.updated).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']));
    // Final on-disk shape is A→C→B→D with no dangling or duplicate pointers.
    expectChain('a', null, 'c');
    expectChain('c', 'a', 'b');
    expectChain('b', 'c', 'd');
    expectChain('d', 'b', null);
  });

  it('(b) cross-chain move: moving B from A→B→C into X→Y→Z heals the source neighbors', async () => {
    // Source chain A→B→C.
    seedItem('a', SESSION, { beforeItemId: null, afterItemId: 'b', manualOverride: true });
    seedItem('b', SESSION, { beforeItemId: 'a', afterItemId: 'c', manualOverride: true });
    seedItem('c', SESSION, { beforeItemId: 'b', afterItemId: null, manualOverride: true });
    // Target chain X→Y→Z.
    seedItem('x', SESSION, { beforeItemId: null, afterItemId: 'y', manualOverride: true });
    seedItem('y', SESSION, { beforeItemId: 'x', afterItemId: 'z', manualOverride: true });
    seedItem('z', SESSION, { beforeItemId: 'y', afterItemId: null, manualOverride: true });

    // Payload mirrors computeLinkingDropChanges('b', 'y', 'after', ...).
    // Crucially, it includes A and C — the source neighbors that must be
    // stitched together so the source chain doesn't keep dangling
    // pointers to B once B has moved into the target chain.
    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'y', beforeItemId: 'x', afterItemId: 'b' },
          { itemId: 'b', beforeItemId: 'y', afterItemId: 'z' },
          { itemId: 'z', beforeItemId: 'b', afterItemId: null },
          { itemId: 'a', beforeItemId: null, afterItemId: 'c' },
          { itemId: 'c', beforeItemId: 'a', afterItemId: null },
        ],
      })
      .expect(200);

    expect(res.body.updated).toEqual(
      expect.arrayContaining(['a', 'b', 'c', 'y', 'z']),
    );
    // Source chain healed to A→C with no leftover reference to B.
    expectChain('a', null, 'c');
    expectChain('c', 'a', null);
    // Target chain became X→Y→B→Z with B stitched in at both sides.
    const xLd = itemStore.get('x')!.linkDecisions!;
    expect(xLd.afterItemId).toBe('y');
    expectChain('y', 'x', 'b');
    expectChain('b', 'y', 'z');
    expectChain('z', 'b', null);
  });

  it('(c) make-standalone: detaching B from A→B→C nulls both pointers and reconnects A↔C atomically', async () => {
    seedItem('a', SESSION, { beforeItemId: null, afterItemId: 'b', manualOverride: true });
    seedItem('b', SESSION, { beforeItemId: 'a', afterItemId: 'c', manualOverride: true });
    seedItem('c', SESSION, { beforeItemId: 'b', afterItemId: null, manualOverride: true });

    // Payload mirrors computeLinkingMakeStandaloneChanges('b', ...).
    // Both pointers on B are cleared in the same request that re-wires
    // A.after and C.before so A→C survives intact.
    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'a', beforeItemId: null, afterItemId: 'c' },
          { itemId: 'c', beforeItemId: 'a', afterItemId: null },
          { itemId: 'b', beforeItemId: null, afterItemId: null },
        ],
      })
      .expect(200);

    expect(res.body.updated).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    // B is fully standalone — both sides nulled in the same atomic write.
    expectChain('b', null, null);
    // Former neighbors reconnect into a 2-item chain A→C.
    expectChain('a', null, 'c');
    expectChain('c', 'a', null);
  });

  it('(d) cycle attempt across three rows is rejected and no row is mutated', async () => {
    // Three independent items; nothing wired up yet.
    seedItem('a', SESSION, null);
    seedItem('b', SESSION, null);
    seedItem('c', SESSION, null);

    // A malicious / buggy client tries to persist A→B→C→A. The server
    // must walk the proposed forward-link graph, detect that A is
    // reachable from itself, and refuse the entire batch.
    const res = await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'a', beforeItemId: 'c', afterItemId: 'b' },
          { itemId: 'b', beforeItemId: 'a', afterItemId: 'c' },
          { itemId: 'c', beforeItemId: 'b', afterItemId: 'a' },
        ],
      })
      .expect(400);

    expect(res.body.error).toMatch(/cycle/i);
    // Critically, none of the rows were touched — the transaction is
    // all-or-nothing and the contract with the client helpers is that
    // a rejected payload leaves storage exactly as it was.
    expect(itemStore.get('a')!.linkDecisions).toBeNull();
    expect(itemStore.get('b')!.linkDecisions).toBeNull();
    expect(itemStore.get('c')!.linkDecisions).toBeNull();
  });
});

/**
 * Task #1282 — Status promotion tests.
 *
 * Both manual-linking endpoints must promote a row's status to 'linked'
 * when the current status is 'identified' or 'linked', and must leave
 * terminal / early-step statuses untouched.
 */
describe('Task #1282 — set-linking-decision status promotion', () => {
  // ---------------------------------------------------------------------------
  // Single-item endpoint
  // ---------------------------------------------------------------------------

  it('promotes an "identified" item to "linked" on the single-item endpoint', async () => {
    // doc-a is identified; doc-b already has the back-pointer so the graph is
    // bidirectionally consistent and the call passes validation.
    seedItem('doc-a', SESSION, null, 'identified');
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null }, 'identified');

    await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('linked');
  });

  it('keeps an already-"linked" item as "linked" on the single-item endpoint (idempotent)', async () => {
    seedItem('doc-a', SESSION, null, 'linked');
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null }, 'linked');

    await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('linked');
  });

  it('does NOT downgrade a "committed" item on the single-item endpoint', async () => {
    seedItem('doc-a', SESSION, null, 'committed');
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null }, 'committed');

    await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('committed');
  });

  it('does NOT downgrade a "duplicate" item on the single-item endpoint', async () => {
    seedItem('doc-a', SESSION, null, 'duplicate');
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null }, 'duplicate');

    await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('duplicate');
  });

  it('does NOT fast-forward an early-step ("sorted") item on the single-item endpoint', async () => {
    seedItem('doc-a', SESSION, null, 'sorted');
    seedItem('doc-b', SESSION, { beforeItemId: 'doc-a', afterItemId: null }, 'sorted');

    await request(buildApp())
      .post(ITEM_URL('doc-a'))
      .send({ beforeItemId: null, afterItemId: 'doc-b' })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('sorted');
  });

  // ---------------------------------------------------------------------------
  // Batch endpoint
  // ---------------------------------------------------------------------------

  it('promotes "identified" items to "linked" via the batch endpoint', async () => {
    seedItem('doc-a', SESSION, null, 'identified');
    seedItem('doc-b', SESSION, null, 'identified');
    seedItem('doc-c', SESSION, null, 'identified');

    await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: 'doc-c' },
          { itemId: 'doc-c', beforeItemId: 'doc-b', afterItemId: null },
        ],
      })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('linked');
    expect(itemStore.get('doc-b')!.status).toBe('linked');
    expect(itemStore.get('doc-c')!.status).toBe('linked');
  });

  it('does NOT downgrade "committed" items via the batch endpoint', async () => {
    seedItem('doc-a', SESSION, null, 'committed');
    seedItem('doc-b', SESSION, null, 'committed');

    await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: null },
        ],
      })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('committed');
    expect(itemStore.get('doc-b')!.status).toBe('committed');
  });

  it('does NOT fast-forward early-step items via the batch endpoint', async () => {
    seedItem('doc-a', SESSION, null, 'sorted');
    seedItem('doc-b', SESSION, null, 'sorted');

    await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: null },
        ],
      })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('sorted');
    expect(itemStore.get('doc-b')!.status).toBe('sorted');
  });

  it('keeps already-"linked" items as "linked" via the batch endpoint (idempotent)', async () => {
    seedItem('doc-a', SESSION, null, 'linked');
    seedItem('doc-b', SESSION, null, 'linked');

    await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: null },
        ],
      })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('linked');
    expect(itemStore.get('doc-b')!.status).toBe('linked');
  });

  it('does NOT downgrade "duplicate" items via the batch endpoint', async () => {
    seedItem('doc-a', SESSION, null, 'duplicate');
    seedItem('doc-b', SESSION, null, 'duplicate');

    await request(buildApp())
      .post(BATCH_URL(SESSION))
      .send({
        decisions: [
          { itemId: 'doc-a', beforeItemId: null, afterItemId: 'doc-b' },
          { itemId: 'doc-b', beforeItemId: 'doc-a', afterItemId: null },
        ],
      })
      .expect(200);

    expect(itemStore.get('doc-a')!.status).toBe('duplicate');
    expect(itemStore.get('doc-b')!.status).toBe('duplicate');
  });
});
