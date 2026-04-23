/**
 * Unit test for the schema-drift guard
 * (`scripts/check-migration-coverage.ts`).
 *
 * Only exercises the pure helpers (`splitSqlStatements`, `diff`,
 * `hasDrift`, `formatReport`). The PGlite-backed end-to-end path is
 * exercised by running `npx tsx scripts/check-migration-coverage.ts`
 * directly in CI / pre-commit, which avoids the
 * "dynamic import callback was invoked without --experimental-vm-modules"
 * incompatibility between PGlite and Jest's CJS runtime.
 */
import {
  diff,
  formatReport,
  hasDrift,
  splitSqlStatements,
  type SchemaSnapshot,
} from '../../scripts/check-migration-coverage';

function emptySnapshot(): SchemaSnapshot {
  return {
    tables: new Map(),
    enums: new Map(),
    primaryKeys: new Map(),
    uniques: new Map(),
  };
}

function snapshotOf(spec: {
  tables?: Record<
    string,
    Record<string, { dataType: string; isNullable?: boolean }>
  >;
  enums?: Record<string, string[]>;
  primaryKeys?: Record<string, string[]>;
  uniques?: Record<string, string[]>;
}): SchemaSnapshot {
  const snap = emptySnapshot();
  for (const [t, cols] of Object.entries(spec.tables ?? {})) {
    const cmap = new Map<
      string,
      { dataType: string; udtName: string; isNullable: boolean }
    >();
    for (const [c, info] of Object.entries(cols)) {
      cmap.set(c, {
        dataType: info.dataType,
        udtName: info.dataType,
        isNullable: info.isNullable ?? true,
      });
    }
    snap.tables.set(t, cmap);
  }
  for (const [e, vs] of Object.entries(spec.enums ?? {})) {
    snap.enums.set(e, vs);
  }
  for (const [t, cols] of Object.entries(spec.primaryKeys ?? {})) {
    snap.primaryKeys.set(t, cols);
  }
  for (const [t, uniques] of Object.entries(spec.uniques ?? {})) {
    snap.uniques.set(t, new Set(uniques));
  }
  return snap;
}

describe('check-migration-coverage', () => {
  describe('splitSqlStatements', () => {
    it('honours --> statement-breakpoint markers', () => {
      const sql = `CREATE TABLE a (id int);--> statement-breakpoint
CREATE TABLE b (id int);`;
      expect(splitSqlStatements(sql)).toEqual([
        'CREATE TABLE a (id int)',
        'CREATE TABLE b (id int)',
      ]);
    });

    it('does not split on semicolons inside dollar-quoted blocks', () => {
      const sql = `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1) THEN
    RAISE NOTICE 'hi';
  END IF;
END $$;
CREATE TABLE z (id int);`;
      const stmts = splitSqlStatements(sql);
      expect(stmts).toHaveLength(2);
      expect(stmts[0]).toContain('DO $$');
      expect(stmts[0]).toContain("RAISE NOTICE 'hi';");
      expect(stmts[1]).toBe('CREATE TABLE z (id int)');
    });

    it('does not split on semicolons inside single-quoted strings', () => {
      const sql = `INSERT INTO t (s) VALUES ('a;b;c'); SELECT 1;`;
      expect(splitSqlStatements(sql)).toEqual([
        "INSERT INTO t (s) VALUES ('a;b;c')",
        'SELECT 1',
      ]);
    });

    it('does not treat semicolons inside line/block comments as statement separators', () => {
      const sql = `SELECT 1; -- one; two; three
SELECT 2; /* a; b; c */
SELECT 3;`;
      expect(splitSqlStatements(sql)).toHaveLength(3);
    });
  });

  describe('diff + hasDrift', () => {
    it('returns no drift when both snapshots are identical', () => {
      const s = snapshotOf({
        tables: { widgets: { id: { dataType: 'uuid', isNullable: false } } },
        enums: { color: ['red', 'blue'] },
        primaryKeys: { widgets: ['id'] },
      });
      const r = diff(s, s);
      expect(hasDrift(r)).toBe(false);
    });

    it('reports a column missing from migrations', () => {
      const fromSchema = snapshotOf({
        tables: {
          widgets: {
            id: { dataType: 'uuid', isNullable: false },
            color: { dataType: 'text' },
          },
        },
      });
      const fromMigrations = snapshotOf({
        tables: {
          widgets: { id: { dataType: 'uuid', isNullable: false } },
        },
      });
      const r = diff(fromSchema, fromMigrations);
      expect(hasDrift(r)).toBe(true);
      expect(r.missingColumns).toEqual([
        { table: 'widgets', column: 'color', type: 'text' },
      ]);
    });

    it('reports a table missing from migrations and one missing from schema', () => {
      const fromSchema = snapshotOf({
        tables: { only_in_schema: { id: { dataType: 'uuid' } } },
      });
      const fromMigrations = snapshotOf({
        tables: { only_in_migrations: { id: { dataType: 'uuid' } } },
      });
      const r = diff(fromSchema, fromMigrations);
      expect(r.missingTables).toEqual(['only_in_schema']);
      expect(r.extraTables).toEqual(['only_in_migrations']);
      expect(hasDrift(r)).toBe(true);
    });

    it('reports column type and nullability mismatches', () => {
      const fromSchema = snapshotOf({
        tables: {
          widgets: { name: { dataType: 'varchar', isNullable: false } },
        },
      });
      const fromMigrations = snapshotOf({
        tables: { widgets: { name: { dataType: 'text', isNullable: true } } },
      });
      const r = diff(fromSchema, fromMigrations);
      expect(r.columnTypeMismatches).toEqual([
        {
          table: 'widgets',
          column: 'name',
          schemaType: 'varchar',
          migrationType: 'text',
        },
      ]);
      expect(r.columnNullabilityMismatches).toEqual([
        {
          table: 'widgets',
          column: 'name',
          schemaNullable: false,
          migrationNullable: true,
        },
      ]);
    });

    it('reports enum value drift in both directions', () => {
      const fromSchema = snapshotOf({
        enums: { color: ['red', 'green', 'blue'] },
      });
      const fromMigrations = snapshotOf({
        enums: { color: ['red', 'blue', 'yellow'] },
      });
      const r = diff(fromSchema, fromMigrations);
      expect(r.enumValueMismatches).toEqual([
        {
          enumName: 'color',
          missingValues: ['green'],
          extraValues: ['yellow'],
        },
      ]);
    });

    it('reports unique constraints missing from migrations', () => {
      const fromSchema = snapshotOf({
        tables: { widgets: { slug: { dataType: 'text' } } },
        uniques: { widgets: ['slug'] },
      });
      const fromMigrations = snapshotOf({
        tables: { widgets: { slug: { dataType: 'text' } } },
      });
      const r = diff(fromSchema, fromMigrations);
      expect(r.missingUniques).toEqual([
        { table: 'widgets', columns: 'slug' },
      ]);
    });

    it('formatReport produces a non-empty, actionable string when drift exists', () => {
      const fromSchema = snapshotOf({
        tables: { only_in_schema: { id: { dataType: 'uuid' } } },
      });
      const fromMigrations = snapshotOf({});
      const r = diff(fromSchema, fromMigrations);
      const text = formatReport(r);
      expect(text).toContain('only_in_schema');
      expect(text).toContain('missing from migrations');
    });
  });
});
