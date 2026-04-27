/**
 * Regression test — Task #1439
 *
 * Verifies that a failure inside `ensureTriggerOnlyMigrations()` (e.g. a
 * Postgres lock-wait timeout on `demands`) does NOT bubble out of the
 * function, does NOT prevent the frontend from starting, and DOES emit
 * structured PG error fields (code, message) in the log — rather than
 * echoing the SQL file body.
 *
 * All DB I/O is injected via the `opts.pool` / `opts.readFile` / `opts.logger`
 * seams, so no real database connection is required.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ensureTriggerOnlyMigrations } from '../ensure-trigger-migrations';

type QueryFn = (sql?: string) => Promise<void>;

function makeMockClient(ddlError?: Error): {
  query: jest.Mock<QueryFn>;
  release: jest.Mock<() => void>;
} {
  const release = jest.fn<() => void>();
  const query = jest.fn<QueryFn>().mockImplementation(async (sql?: string) => {
    const s = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
    if (
      s === 'BEGIN' ||
      s.startsWith('SET LOCAL') ||
      s === 'COMMIT' ||
      s === 'ROLLBACK'
    ) {
      return;
    }
    if (ddlError) throw ddlError;
  });
  return { query, release };
}

function makeMockPool(ddlError?: Error) {
  const client = makeMockClient(ddlError);
  return {
    pool: {
      connect: jest.fn<() => Promise<typeof client>>().mockResolvedValue(client),
    },
    client,
  };
}

const FAKE_DDL = `CREATE OR REPLACE FUNCTION _test_fn() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;`;

describe('ensureTriggerOnlyMigrations — non-fatal regression', () => {
  let logs: Array<[string, string | undefined]>;
  let logger: (msg: string, level?: 'info' | 'error') => void;

  beforeEach(() => {
    logs = [];
    logger = (msg, level) => logs.push([msg, level]);
  });

  it('does not throw when one SQL file execution fails', async () => {
    const pgErr = Object.assign(new Error('could not obtain lock'), {
      code: '55P03',
      severity: 'ERROR',
      routine: 'LockAcquire',
    });
    const { pool } = makeMockPool(pgErr);

    const result = await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    expect(result.failed).toEqual(['0010_demands_residence_building_check.sql']);
    expect(result.ok).toEqual([]);
  });

  it('logs the structured PG error fields — not the SQL body — on failure', async () => {
    const pgErr = Object.assign(new Error('lock wait timeout'), {
      code: '55P03',
      severity: 'ERROR',
      detail: 'Process 12345 waits for ShareLock on transaction 67890',
      table: 'demands',
      routine: 'LockAcquire',
    });
    const { pool } = makeMockPool(pgErr);

    await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    const errorLines = logs
      .filter(([, level]) => level === 'error')
      .map(([msg]) => msg);

    const failureLine = errorLines.find((line) =>
      line.includes('0010_demands_residence_building_check.sql'),
    );
    expect(failureLine).toBeDefined();
    expect(failureLine).toContain('code=55P03');
    expect(failureLine).toContain('lock contention');
    expect(failureLine).not.toContain(FAKE_DDL);

    const tableField = errorLines.find(
      (line) =>
        line.includes('0010_demands_residence_building_check.sql') &&
        line.includes('table='),
    );
    expect(tableField).toContain('"demands"');
  });

  it('classifies a query_canceled error as lock contention', async () => {
    const pgErr = Object.assign(new Error('canceling statement due to statement timeout'), {
      code: '57014',
      severity: 'ERROR',
      routine: 'ProcessInterrupts',
    });
    const { pool } = makeMockPool(pgErr);

    await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    const failureLine = logs
      .filter(([, l]) => l === 'error')
      .map(([msg]) => msg)
      .find((l) => l.includes('0010_demands_residence_building_check.sql'));

    expect(failureLine).toContain('lock contention');
  });

  it('continues processing remaining files after one fails', async () => {
    let callCount = 0;
    const client = {
      query: jest.fn<QueryFn>().mockImplementation(async (sql?: string) => {
        const s = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
        if (
          s === 'BEGIN' ||
          s.startsWith('SET LOCAL') ||
          s === 'COMMIT' ||
          s === 'ROLLBACK'
        ) {
          return;
        }
        callCount++;
        if (callCount === 1) {
          throw Object.assign(new Error('lock timeout'), { code: '55P03' });
        }
      }),
      release: jest.fn<() => void>(),
    };
    const pool = {
      connect: jest.fn<() => Promise<typeof client>>().mockResolvedValue(client),
    };

    const result = await ensureTriggerOnlyMigrations(
      [
        '0010_demands_residence_building_check.sql',
        '0011_residences_demand_building_check.sql',
      ],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    expect(result.failed).toEqual(['0010_demands_residence_building_check.sql']);
    expect(result.ok).toEqual(['0011_residences_demand_building_check.sql']);
  });

  it('emits a summary line naming every failed file', async () => {
    const pgErr = Object.assign(new Error('execution error'), { code: 'XX000' });
    const { pool } = makeMockPool(pgErr);

    await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    const summaryLine = logs
      .filter(([, l]) => l === 'error')
      .map(([msg]) => msg)
      .find((l) => l.includes('trigger-only re-application'));

    expect(summaryLine).toBeDefined();
    expect(summaryLine).toContain('0 ok');
    expect(summaryLine).toContain('1 failed');
    expect(summaryLine).toContain('0010_demands_residence_building_check.sql');
  });

  it('succeeds cleanly when all files execute without error', async () => {
    const { pool } = makeMockPool();

    const result = await ensureTriggerOnlyMigrations(
      [
        '0010_demands_residence_building_check.sql',
        '0011_residences_demand_building_check.sql',
      ],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    expect(result.ok).toEqual([
      '0010_demands_residence_building_check.sql',
      '0011_residences_demand_building_check.sql',
    ]);
    expect(result.failed).toEqual([]);

    const summaryLine = logs.map(([msg]) => msg).find((l) => l.includes('trigger-only re-application'));
    expect(summaryLine).toContain('2 ok');
    expect(summaryLine).toContain('0 failed');
  });

  it('marks a file as failed (not ok) when the readFile call throws', async () => {
    const { pool } = makeMockPool();

    const result = await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => { throw new Error('ENOENT: no such file or directory'); },
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    expect(result.failed).toEqual(['0010_demands_residence_building_check.sql']);
    expect(result.ok).toEqual([]);
  });

  it('issues SET LOCAL lock_timeout and SET LOCAL statement_timeout before the DDL', async () => {
    const queryCalls: string[] = [];
    const client = {
      query: jest.fn<QueryFn>().mockImplementation(async (sql?: string) => {
        if (typeof sql === 'string') queryCalls.push(sql.trim());
      }),
      release: jest.fn<() => void>(),
    };
    const pool = {
      connect: jest.fn<() => Promise<typeof client>>().mockResolvedValue(client),
    };

    await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    const lockTimeoutIdx = queryCalls.findIndex((q) =>
      q.toLowerCase().includes('lock_timeout'),
    );
    const stmtTimeoutIdx = queryCalls.findIndex((q) =>
      q.toLowerCase().includes('statement_timeout'),
    );
    const ddlIdx = queryCalls.findIndex((q) => q === FAKE_DDL);

    expect(lockTimeoutIdx).toBeGreaterThan(-1);
    expect(stmtTimeoutIdx).toBeGreaterThan(-1);
    expect(ddlIdx).toBeGreaterThan(-1);
    expect(lockTimeoutIdx).toBeLessThan(ddlIdx);
    expect(stmtTimeoutIdx).toBeLessThan(ddlIdx);
  });

  it('does not throw when pool.connect() itself rejects (connection failure)', async () => {
    const connectErr = new Error('connection refused');
    const pool = {
      connect: jest.fn<() => Promise<never>>().mockRejectedValue(connectErr),
    };

    const result = await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    expect(result.failed).toEqual(['0010_demands_residence_building_check.sql']);
    expect(result.ok).toEqual([]);
    const errLogs = logs.filter(([, level]) => level === 'error');
    expect(errLogs.length).toBeGreaterThan(0);
  });

  it('extracts PG error fields from error.cause when the top-level error wraps a PG cause', async () => {
    const pgCause = Object.assign(new Error('duplicate key value'), {
      code: '23505',
      severity: 'ERROR',
      table: 'demands',
      constraint: 'demands_pkey',
      routine: 'ExecConstraints',
    });
    const wrapperErr = Object.assign(new Error('query failed'), {
      cause: pgCause,
    });
    const { pool } = makeMockPool(wrapperErr);

    await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    const errLogs = logs.filter(([, level]) => level === 'error');
    const failedLine = errLogs.find(([msg]) => msg.includes('FAILED'));
    expect(failedLine).toBeDefined();
    expect(failedLine![0]).toContain('23505');
    expect(failedLine![0]).toContain('demands');
    expect(failedLine![0]).not.toContain(FAKE_DDL);
  });

  it('startup resilience: caller can call setFrontendReady(true) immediately after a trigger failure', async () => {
    let frontendReady = false;
    const setFrontendReady = (v: boolean) => { frontendReady = v; };

    const connectErr = new Error('pool exhausted');
    const pool = {
      connect: jest.fn<() => Promise<never>>().mockRejectedValue(connectErr),
    };

    const result = await ensureTriggerOnlyMigrations(
      ['0010_demands_residence_building_check.sql'],
      {
        pool: pool as any,
        readFile: () => FAKE_DDL,
        migrationsDir: '/fake/migrations',
        logger,
      },
    );

    expect(result.failed).toEqual(['0010_demands_residence_building_check.sql']);

    setFrontendReady(true);
    expect(frontendReady).toBe(true);
  });
});
