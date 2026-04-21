/**
 * Reusable typed stub for `./server/db` used by suites that run under
 * `jest.config.auth.cjs`.
 *
 * That config sets `resetMocks` / `restoreMocks` to true, which strips the
 * inner `jest.fn()` implementations off the global `./server/db` mock in
 * `jest.setup.ts` between tests. As a result, chains like
 * `db.delete(table).where(eq(...))` start returning `undefined` and cleanup
 * hooks crash. Building the chain from plain functions (not `jest.fn`) keeps
 * the behavior intact across resets.
 */

type Thenable<T> = {
  then: <R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ) => Promise<R1 | R2>;
  catch: <R = never>(
    onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null,
  ) => Promise<T | R>;
  finally: (onFinally?: (() => void) | null) => Promise<T>;
};

export type ChainableQuery<T = unknown> = Thenable<T> & {
  where: (...args: unknown[]) => ChainableQuery<T>;
  from: (...args: unknown[]) => ChainableQuery<T>;
  set: (...args: unknown[]) => ChainableQuery<T>;
  values: (...args: unknown[]) => ChainableQuery<Array<{ id: string }>>;
  returning: (...args: unknown[]) => Promise<Array<{ id: string }>>;
  orderBy: (...args: unknown[]) => ChainableQuery<T>;
  limit: (...args: unknown[]) => ChainableQuery<T>;
  offset: (...args: unknown[]) => ChainableQuery<T>;
  groupBy: (...args: unknown[]) => ChainableQuery<T>;
  having: (...args: unknown[]) => ChainableQuery<T>;
  leftJoin: (...args: unknown[]) => ChainableQuery<T>;
  innerJoin: (...args: unknown[]) => ChainableQuery<T>;
  rightJoin: (...args: unknown[]) => ChainableQuery<T>;
};

export type ChainableDb = {
  insert: (...args: unknown[]) => ChainableQuery;
  select: (...args: unknown[]) => ChainableQuery<unknown[]>;
  update: (...args: unknown[]) => ChainableQuery;
  delete: (...args: unknown[]) => ChainableQuery;
  transaction: <T>(cb: (tx: ChainableDb) => T | Promise<T>) => Promise<T>;
  query: (...args: unknown[]) => Promise<unknown[]>;
};

export type ChainableDbModule = {
  __esModule: true;
  db: ChainableDb;
  sql: (...args: unknown[]) => Promise<unknown[]>;
  pool: {
    query: (...args: unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
  default: ChainableDb;
};

const ROW: { id: string } = { id: 'mock-id' };

const makeChain = <T>(resolved: T): ChainableQuery<T> => {
  const chain = {} as ChainableQuery<T>;
  chain.where = () => makeChain(resolved);
  chain.from = () => makeChain(resolved);
  chain.set = () => makeChain(resolved);
  chain.values = () => makeChain<Array<{ id: string }>>([ROW]);
  chain.returning = () => Promise.resolve([ROW]);
  chain.orderBy = () => makeChain(resolved);
  chain.limit = () => makeChain(resolved);
  chain.offset = () => makeChain(resolved);
  chain.groupBy = () => makeChain(resolved);
  chain.having = () => makeChain(resolved);
  chain.leftJoin = () => makeChain(resolved);
  chain.innerJoin = () => makeChain(resolved);
  chain.rightJoin = () => makeChain(resolved);
  chain.then = (onFulfilled, onRejected) =>
    Promise.resolve(resolved).then(onFulfilled ?? undefined, onRejected ?? undefined);
  chain.catch = (onRejected) =>
    Promise.resolve(resolved).catch(onRejected ?? undefined);
  chain.finally = (onFinally) =>
    Promise.resolve(resolved).finally(onFinally ?? undefined);
  return chain;
};

export const createChainableDbModule = (): ChainableDbModule => {
  const db: ChainableDb = {
    insert: () => makeChain<unknown[]>([]),
    select: () => makeChain<unknown[]>([]),
    update: () => makeChain<unknown[]>([]),
    delete: () => makeChain<unknown[]>([]),
    transaction: async (cb) => cb(db),
    query: () => Promise.resolve([]),
  };

  return {
    __esModule: true,
    db,
    sql: () => Promise.resolve([]),
    pool: {
      query: () => Promise.resolve({ rows: [] }),
      end: () => Promise.resolve(),
    },
    default: db,
  };
};
