/**
 * Task #1150 — MCP element-history write tools must keep
 * `building_elements.last_inspection_date` in sync via the shared helpers.
 *
 * Three MCP tools share the centralized helpers in
 * `server/services/inventory-inspection-date.ts`:
 *
 *   create_element_history_event  → advanceLastInspectionDateForward
 *                                   (only when eventType is an inspection type)
 *   update_element_history_event  → recomputeLastInspectionDate
 *                                   (only when eventDate or eventType change)
 *   delete_element_history_event  → recomputeLastInspectionDate (always)
 *
 * This file mocks those helpers and asserts each MCP tool calls them under
 * the right conditions. If a future change re-introduces an inline UPDATE on
 * `building_elements.last_inspection_date` that bypasses the helpers, the
 * spy assertions here will fail because the helpers will not be invoked.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ text: string }> }>;
const registeredTools = new Map<string, ToolHandler>();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: (name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      registeredTools.set(name, handler);
    },
  })),
}));

// Spies imported from the mocked helper module — the registry of calls.
const recomputeSpy = jest.fn().mockResolvedValue(undefined as never);
const advanceForwardSpy = jest.fn().mockResolvedValue(undefined as never);

jest.mock('../../../server/services/inventory-inspection-date', () => {
  const actual = jest.requireActual(
    '../../../server/services/inventory-inspection-date',
  ) as Record<string, unknown>;
  return {
    ...actual,
    recomputeLastInspectionDate: (...args: unknown[]) => recomputeSpy(...args),
    advanceLastInspectionDateForward: (...args: unknown[]) =>
      advanceForwardSpy(...args),
  };
});

// Drizzle-shaped chainable mock. Each terminal method (`limit`, `returning`,
// or awaiting the chain itself) resolves with the next item in `selectQueue`.
const selectQueue: unknown[][] = [];
const insertCalls: Array<{ values: Record<string, unknown> }> = [];
const updateCalls: Array<{ set: Record<string, unknown> }> = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> =>
    Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then =
    (cb) => result().then(cb);
  return chain;
}

const NEW_HISTORY_ID = 'hist-new-id';

jest.mock('../../../server/db', () => {
  const dbHandle: Record<string, unknown> = {};
  dbHandle.select = jest.fn(() => makeSelectChain());
  dbHandle.insert = jest.fn(() => ({
    values: (vals: Record<string, unknown>) => {
      insertCalls.push({ values: vals });
      return {
        returning: () => Promise.resolve([{ id: NEW_HISTORY_ID, ...vals }]),
      };
    },
  }));
  dbHandle.update = jest.fn(() => ({
    set: (vals: Record<string, unknown>) => {
      updateCalls.push({ set: vals });
      return {
        where: () => ({
          returning: () => Promise.resolve([{ id: NEW_HISTORY_ID, ...vals }]),
        }),
      };
    },
  }));
  dbHandle.delete = jest.fn(() => ({
    where: () => ({
      returning: () => Promise.resolve([{ id: NEW_HISTORY_ID }]),
    }),
  }));
  dbHandle.transaction = jest.fn(
    async (cb: (tx: typeof dbHandle) => Promise<unknown>) => cb(dbHandle),
  );
  return { db: dbHandle };
});

jest.mock('../../../server/services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {},
}));

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = 'mcp-org-1';
const BUILDING_ID = 'bldg-1111-2222-3333-4444';
const ELEMENT_ID = 'elem-aaaa-1111-bbbb-cccc';
const HISTORY_ID = 'hist-1111-2222-3333-4444';
const OAUTH_USER_ID = 'real-oauth-user-123';

const EXISTING_HISTORY = {
  id: HISTORY_ID,
  elementId: ELEMENT_ID,
  eventType: 'repair' as string,
  eventDate: '2024-06-15',
  workDescription: 'Original description',
  cost: '100.00',
  vendorId: null as string | null,
  vendorName: null as string | null,
  lifespanImpact: null as number | null,
  warranty: null as Record<string, unknown> | null,
  createdBy: OAUTH_USER_ID,
};

const ELEMENT_ROW = {
  id: ELEMENT_ID,
  buildingId: BUILDING_ID,
  currentLifespan: 10,
  lastInspectionDate: '2024-06-15',
};

const BUILDING_ROW = {
  id: BUILDING_ID,
  organizationId: ORG_ID,
};

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  updateCalls.length = 0;
  recomputeSpy.mockClear();
  advanceForwardSpy.mockClear();
  createMcpServer({ userId: OAUTH_USER_ID, role: 'manager' });
});

// ─── create_element_history_event ────────────────────────────────────────────

describe('create_element_history_event — lastInspectionDate forward-advance (task #1150)', () => {
  /** Pre-load SELECTs in the order the create handler issues them. */
  function queueCreateSelects() {
    // 1. getMcpOrgIds
    selectQueue.push([{ id: ORG_ID }]);
    // 2. element by id
    selectQueue.push([ELEMENT_ROW]);
    // 3. building by element.buildingId
    selectQueue.push([BUILDING_ROW]);
    // 4. lookupMcpUserById (resolveMcpUser, OAuth path)
    selectQueue.push([{ id: OAUTH_USER_ID, role: 'manager' }]);
    // 5. read-back select inside the transaction (only when needsReadBack)
    selectQueue.push([
      {
        id: ELEMENT_ID,
        currentLifespan: 10,
        lastInspectionDate: '2025-09-01',
      },
    ]);
  }

  it.each([
    ['repair', '2025-09-01'],
    ['minor_rehab', '2025-10-15'],
  ])(
    'calls advanceLastInspectionDateForward for an inspection-type event (%s)',
    async (eventType, eventDate) => {
      queueCreateSelects();

      const handler = registeredTools.get('create_element_history_event');
      expect(handler).toBeDefined();

      const res = await handler!({
        role: 'manager',
        elementId: ELEMENT_ID,
        eventType,
        eventDate,
        workDescription: 'unit test',
      });

      expect(res.content[0].text).not.toContain('not found');
      expect(res.content[0].text).not.toContain('Access denied');
      expect(advanceForwardSpy).toHaveBeenCalledTimes(1);
      expect(advanceForwardSpy).toHaveBeenCalledWith(
        expect.anything(),
        ELEMENT_ID,
        eventDate,
      );
      // The create path NEVER recomputes; only update/delete recompute.
      expect(recomputeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['construction', '2025-09-01'],
    ['major_rehab', '2025-09-01'],
    ['replacement', '2025-09-01'],
  ])(
    'does NOT call advanceLastInspectionDateForward for a non-inspection event (%s)',
    async (eventType, eventDate) => {
      queueCreateSelects();

      const handler = registeredTools.get('create_element_history_event');
      const res = await handler!({
        role: 'manager',
        elementId: ELEMENT_ID,
        eventType,
        eventDate,
        workDescription: 'unit test',
      });

      expect(res.content[0].text).not.toContain('Access denied');
      expect(advanceForwardSpy).not.toHaveBeenCalled();
      expect(recomputeSpy).not.toHaveBeenCalled();
    },
  );
});

// ─── update_element_history_event ────────────────────────────────────────────

describe('update_element_history_event — lastInspectionDate recompute (task #1150)', () => {
  /** Pre-load SELECTs in the order the update handler issues them. */
  function queueUpdateSelects() {
    // 1. getMcpOrgIds
    selectQueue.push([{ id: ORG_ID }]);
    // 2. existing elementHistory by historyId
    selectQueue.push([EXISTING_HISTORY]);
    // 3. element by existing.elementId
    selectQueue.push([ELEMENT_ROW]);
    // 4. building by element.buildingId
    selectQueue.push([BUILDING_ROW]);
    // 5. lookupMcpUserById (resolveMcpUser inside getMcpUser, OAuth path)
    selectQueue.push([{ id: OAUTH_USER_ID, role: 'manager' }]);
    // 6. read-back select inside the transaction (only when needed)
    selectQueue.push([
      {
        id: ELEMENT_ID,
        currentLifespan: 10,
        lastInspectionDate: '2025-09-01',
      },
    ]);
  }

  it('calls recomputeLastInspectionDate exactly once when eventDate changes', async () => {
    queueUpdateSelects();

    const handler = registeredTools.get('update_element_history_event');
    expect(handler).toBeDefined();

    const res = await handler!({
      role: 'manager',
      historyId: HISTORY_ID,
      eventDate: '2025-09-01',
    });

    expect(res.content[0].text).not.toContain('Access denied');
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), ELEMENT_ID);
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });

  it('calls recomputeLastInspectionDate exactly once when eventType changes', async () => {
    queueUpdateSelects();

    const handler = registeredTools.get('update_element_history_event');
    const res = await handler!({
      role: 'manager',
      historyId: HISTORY_ID,
      eventType: 'minor_rehab',
    });

    expect(res.content[0].text).not.toContain('Access denied');
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), ELEMENT_ID);
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });

  it('does NOT call recomputeLastInspectionDate when only the workDescription changes', async () => {
    queueUpdateSelects();

    const handler = registeredTools.get('update_element_history_event');
    const res = await handler!({
      role: 'manager',
      historyId: HISTORY_ID,
      workDescription: 'Edited description only',
    });

    expect(res.content[0].text).not.toContain('Access denied');
    expect(recomputeSpy).not.toHaveBeenCalled();
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });

  it('does NOT call recomputeLastInspectionDate when only the cost changes', async () => {
    queueUpdateSelects();

    const handler = registeredTools.get('update_element_history_event');
    const res = await handler!({
      role: 'manager',
      historyId: HISTORY_ID,
      cost: 250,
    });

    expect(res.content[0].text).not.toContain('Access denied');
    expect(recomputeSpy).not.toHaveBeenCalled();
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });

  it('does NOT call recomputeLastInspectionDate on a true no-op edit (same eventDate / eventType)', async () => {
    // Pre-load only what the handler needs before the no-op short-circuit:
    // orgIds, existing, element, building, getMcpUser. No transaction runs.
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([EXISTING_HISTORY]);
    selectQueue.push([ELEMENT_ROW]);
    selectQueue.push([BUILDING_ROW]);
    selectQueue.push([{ id: OAUTH_USER_ID, role: 'manager' }]);

    const handler = registeredTools.get('update_element_history_event');
    const res = await handler!({
      role: 'manager',
      historyId: HISTORY_ID,
      eventType: EXISTING_HISTORY.eventType,
      eventDate: EXISTING_HISTORY.eventDate,
    });

    expect(res.content[0].text).not.toContain('Access denied');
    expect(recomputeSpy).not.toHaveBeenCalled();
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });
});

// ─── delete_element_history_event ────────────────────────────────────────────

describe('delete_element_history_event — lastInspectionDate recompute (task #1150)', () => {
  /** Pre-load SELECTs in the order the delete handler issues them. */
  function queueDeleteSelects() {
    // 1. getMcpOrgIds
    selectQueue.push([{ id: ORG_ID }]);
    // 2. existing elementHistory by historyId
    selectQueue.push([EXISTING_HISTORY]);
    // 3. element by existing.elementId
    selectQueue.push([ELEMENT_ROW]);
    // 4. building by element.buildingId
    selectQueue.push([BUILDING_ROW]);
    // 5. read-back select inside the transaction
    selectQueue.push([
      {
        id: ELEMENT_ID,
        currentLifespan: 10,
        lastInspectionDate: null,
      },
    ]);
  }

  it('always calls recomputeLastInspectionDate after a successful delete', async () => {
    queueDeleteSelects();

    const handler = registeredTools.get('delete_element_history_event');
    expect(handler).toBeDefined();

    const res = await handler!({
      role: 'manager',
      historyId: HISTORY_ID,
    });

    expect(res.content[0].text).not.toContain('Access denied');
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), ELEMENT_ID);
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });

  it('still calls recomputeLastInspectionDate when the deleted row was a non-inspection event', async () => {
    // Override the existing row to a non-inspection event type so we prove
    // the recompute runs unconditionally on delete (the helper's job is to
    // re-derive MAX(eventDate) over the remaining inspection rows).
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ ...EXISTING_HISTORY, eventType: 'construction' }]);
    selectQueue.push([ELEMENT_ROW]);
    selectQueue.push([BUILDING_ROW]);
    selectQueue.push([
      {
        id: ELEMENT_ID,
        currentLifespan: 10,
        lastInspectionDate: '2024-06-15',
      },
    ]);

    const handler = registeredTools.get('delete_element_history_event');
    const res = await handler!({
      role: 'manager',
      historyId: HISTORY_ID,
    });

    expect(res.content[0].text).not.toContain('Access denied');
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(advanceForwardSpy).not.toHaveBeenCalled();
  });
});
