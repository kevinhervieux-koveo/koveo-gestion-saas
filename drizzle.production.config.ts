import { defineConfig } from 'drizzle-kit';

/**
 * Mirror the alias logic in `scripts/run-migrations.ts` →
 * `resolveDatabaseUrl()`: accept either `DATABASE_URL_KOVEO` or
 * `PRODUCTION_DATABASE_URL` so manual `drizzle-kit` invocations using
 * this config behave the same way as `npm run migrate`.
 *
 * If both are set, prefer `DATABASE_URL_KOVEO` deterministically and
 * print a warning when the alias points at a different database.
 */
function resolveProductionDatabaseUrl(): string {
  const koveo = process.env.DATABASE_URL_KOVEO;
  const alias = process.env.PRODUCTION_DATABASE_URL;
  if (koveo && alias) {
    if (koveo !== alias) {
      console.warn(
        '[drizzle.production] WARNING: DATABASE_URL_KOVEO and ' +
          'PRODUCTION_DATABASE_URL are both set but point at DIFFERENT ' +
          'databases. Using DATABASE_URL_KOVEO and ignoring ' +
          'PRODUCTION_DATABASE_URL. Set both to the same value or unset one.',
      );
    }
    return koveo;
  }
  if (koveo) return koveo;
  if (alias) return alias;
  throw new Error(
    'No production database URL configured. Set DATABASE_URL_KOVEO or ' +
      'PRODUCTION_DATABASE_URL — they are aliases.',
  );
}

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolveProductionDatabaseUrl(),
  },
  strict: false,
});
