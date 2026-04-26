/**
 * Task #1231 — linking run-all loop crash safety.
 *
 * Verifies the per-item try/catch contract added in Task #1231 that prevents
 * the Express process from going down when `suggestLinks` throws (huge
 * prompt, network failure, rate-limit, etc.).
 *
 * Pattern: standalone simulation with local helper mirrors, matching the
 * approach used by every other run-all test in this codebase
 * (bulk-import-run-all-concurrency.test.ts etc.).  The helpers reproduce the
 * exact production try/catch shape from `processItemForStep`'s linking branch
 * and the `runAllForStep` worker loop.
 */

import { describe, it, expect, jest } from '@jest/globals';

// ─── Types ─────────────────────────────────────────────────────────────────

type ItemStatus = 'identified' | 'linked';

interface FakeItem {
  id: string;
  originalName: string;
  status: ItemStatus;
  linkDecisions: Record<string, unknown> | null;
}

interface LinkResult {
  relatedItemIds: string[];
  reason: string;
  confidence: number;
  fallbackReason?: string;
}

// ─── Production-mirroring helpers ─────────────────────────────────────────

/**
 * Mirrors `processItemForStep` for the linking branch, including the
 * per-item try/catch added in Task #1231.
 *
 * Candidates are shaped as `{ id, name }` only — no extra fields —
 * matching the `.map((c) => ({ id: c.id, name: c.originalName }))` trim
 * added in Task #1231 to prevent huge `screening` JSONB from inflating the
 * Claude prompt.
 */
async function processLinkingItem(
  item: FakeItem,
  allItems: FakeItem[],
  suggestLinks: (input: { originalName: string; candidates: { id: string; name: string }[] }) => Promise<LinkResult>,
  db: Map<string, FakeItem>,
): Promise<FakeItem> {
  try {
    const result = await suggestLinks({
      originalName: item.originalName,
      candidates: allItems
        .filter((c) => c.id !== item.id)
        .map((c) => ({ id: c.id, name: c.originalName })),
    });
    const updated: FakeItem = {
      ...item,
      linkDecisions: result as unknown as Record<string, unknown>,
      status: 'linked',
    };
    db.set(item.id, updated);
    return updated;
  } catch (_linkErr) {
    const fallback: FakeItem = {
      ...item,
      linkDecisions: { relatedItemIds: [], reason: 'error', confidence: 0, fallbackReason: 'api_error' },
      status: 'linked',
    };
    db.set(item.id, fallback);
    return fallback;
  }
}

/**
 * Mirrors the `runAllForStep` worker loop (simplified — no heartbeat,
 * no timeout, no stagger) to verify the crash-safety contract.
 */
async function runLinkingLoop(
  items: FakeItem[],
  suggestLinks: (input: { originalName: string; candidates: { id: string; name: string }[] }) => Promise<LinkResult>,
  db: Map<string, FakeItem>,
  concurrency = 2,
): Promise<void> {
  const eligible = items.filter((i) => i.status === 'identified');
  const queue = [...eligible];
  const errors: Error[] = [];

  async function worker(): Promise<void> {
    while (true) {
      const item = queue.shift();
      if (!item) break;
      try {
        await processLinkingItem(item, items, suggestLinks, db);
      } catch (workerErr) {
        errors.push(workerErr as Error);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  if (errors.length > 0) {
    throw new AggregateError(errors, 'worker errors');
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('linking processItemForStep crash safety — standalone simulation (Task #1231)', () => {
  it('settles every item to linked status when suggestLinks throws for all items', async () => {
    const items: FakeItem[] = [
      { id: 'a', originalName: 'file-a.pdf', status: 'identified', linkDecisions: null },
      { id: 'b', originalName: 'file-b.pdf', status: 'identified', linkDecisions: null },
      { id: 'c', originalName: 'file-c.pdf', status: 'identified', linkDecisions: null },
    ];
    const db = new Map(items.map((i) => [i.id, { ...i }]));

    const suggestLinks = jest.fn<() => Promise<LinkResult>>().mockRejectedValue(
      new Error('AI call exploded — huge prompt or network failure'),
    );

    await runLinkingLoop(items, suggestLinks, db);

    for (const [, item] of db) {
      expect(item.status).toBe('linked');
      expect(item.linkDecisions).not.toBeNull();
      expect((item.linkDecisions as Record<string, unknown>).fallbackReason).toBe('api_error');
    }
  });

  it('settles items with real results when suggestLinks succeeds', async () => {
    const items: FakeItem[] = [
      { id: 'x', originalName: 'doc-x.pdf', status: 'identified', linkDecisions: null },
      { id: 'y', originalName: 'doc-y.pdf', status: 'identified', linkDecisions: null },
    ];
    const db = new Map(items.map((i) => [i.id, { ...i }]));

    const suggestLinks = jest.fn<() => Promise<LinkResult>>().mockResolvedValue({
      relatedItemIds: [],
      reason: 'no related docs',
      confidence: 0.9,
    });

    await runLinkingLoop(items, suggestLinks, db);

    for (const [, item] of db) {
      expect(item.status).toBe('linked');
      const ld = item.linkDecisions as Record<string, unknown>;
      expect(ld.fallbackReason).toBeUndefined();
      expect(ld.confidence).toBe(0.9);
    }
  });

  it('handles a mix: some items throw, others succeed — all settle to linked', async () => {
    const items: FakeItem[] = [
      { id: '1', originalName: 'good.pdf',  status: 'identified', linkDecisions: null },
      { id: '2', originalName: 'bad.pdf',   status: 'identified', linkDecisions: null },
      { id: '3', originalName: 'good2.pdf', status: 'identified', linkDecisions: null },
    ];
    const db = new Map(items.map((i) => [i.id, { ...i }]));

    const suggestLinks = jest.fn<(input: { originalName: string; candidates: { id: string; name: string }[] }) => Promise<LinkResult>>()
      .mockImplementation(async ({ originalName }) => {
        if (originalName === 'bad.pdf') throw new Error('prompt too large');
        return { relatedItemIds: [], reason: 'ok', confidence: 0.8 };
      });

    await runLinkingLoop(items, suggestLinks, db);

    const settled = [...db.values()];
    expect(settled.every((i) => i.status === 'linked')).toBe(true);

    const badItem = db.get('2')!;
    expect((badItem.linkDecisions as Record<string, unknown>).fallbackReason).toBe('api_error');

    const goodItem = db.get('1')!;
    expect((goodItem.linkDecisions as Record<string, unknown>).fallbackReason).toBeUndefined();
  });

  it('does not process items that are already in a post-linking status', async () => {
    const items: FakeItem[] = [
      { id: 'done', originalName: 'already.pdf', status: 'linked',
        linkDecisions: { relatedItemIds: [], reason: 'prior', confidence: 0.5 } },
      { id: 'todo', originalName: 'new.pdf', status: 'identified', linkDecisions: null },
    ];
    const db = new Map(items.map((i) => [i.id, { ...i }]));

    const suggestLinks = jest.fn<() => Promise<LinkResult>>().mockResolvedValue({
      relatedItemIds: [],
      reason: 'ok',
      confidence: 0.7,
    });

    await runLinkingLoop(items, suggestLinks, db);

    expect(suggestLinks).toHaveBeenCalledTimes(1);
    const doneItem = db.get('done')!;
    expect((doneItem.linkDecisions as Record<string, unknown>).reason).toBe('prior');
  });

  it('candidates passed to suggestLinks contain only id and name (no extra fields)', async () => {
    // 'p' is eligible; 'q' is already linked so it is skipped for processing
    // but IS passed as allItems — the production code trims each candidate to
    // { id, name } only, stripping the `screening` JSONB that previously
    // inflated prompts.
    const items: FakeItem[] = [
      { id: 'p', originalName: 'primary.pdf', status: 'identified', linkDecisions: null },
      { id: 'q', originalName: 'sibling.pdf', status: 'linked',
        linkDecisions: { relatedItemIds: [], reason: 'prior', confidence: 0.5 } },
    ];
    const db = new Map(items.map((i) => [i.id, { ...i }]));

    let capturedCandidates: unknown[] = [];
    const suggestLinks = jest.fn<(input: { originalName: string; candidates: { id: string; name: string }[] }) => Promise<LinkResult>>()
      .mockImplementation(async ({ candidates }) => {
        capturedCandidates = candidates;
        return { relatedItemIds: [], reason: 'checked', confidence: 0.5 };
      });

    // Pass BOTH items so q is in allItems for candidate building;
    // only p is eligible (identified) so suggestLinks is called once.
    await runLinkingLoop(items, suggestLinks, db, 1);

    expect(suggestLinks).toHaveBeenCalledTimes(1);
    expect(capturedCandidates).toEqual([{ id: 'q', name: 'sibling.pdf' }]);
    for (const candidate of capturedCandidates as Record<string, unknown>[]) {
      expect(Object.keys(candidate).sort()).toEqual(['id', 'name']);
    }
  });

  it('loop completes without throwing even when every item throws — no unhandled rejection', async () => {
    const items: FakeItem[] = Array.from({ length: 8 }, (_, i) => ({
      id: `item-${i}`,
      originalName: `doc-${i}.pdf`,
      status: 'identified' as ItemStatus,
      linkDecisions: null,
    }));
    const db = new Map(items.map((i) => [i.id, { ...i }]));

    const suggestLinks = jest.fn<() => Promise<LinkResult>>().mockRejectedValue(
      new Error('server crash in AI'),
    );

    await expect(runLinkingLoop(items, suggestLinks, db, 3)).resolves.toBeUndefined();

    for (const [, item] of db) {
      expect(item.status).toBe('linked');
    }
  });
});
