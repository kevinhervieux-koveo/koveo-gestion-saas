/**
 * Custom Jest resolver to force-route problematic imports to mocks.
 *
 * NOTE: Task #274 removed the package-wide drizzle-orm auto-mocks
 * (`__mocks__/drizzle-orm/*` no longer exists). Suites that need
 * stubbed drizzle behavior opt in inline via
 * `jest.mock('drizzle-orm', () => require('<rel>/tests/manual-mocks/drizzle-orm'))`
 * (and `drizzle-orm/pg-core` analogously). This resolver is intentionally
 * not wired into `jest.config.cjs`; it remains as a thin pass-through in
 * case a future setup needs to re-introduce module routing.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (request, options) => {
  // Force route shared/schema paths to our mock
  if (/(^|.*\/)(shared\/schema)(\.(ts|js))?$/.test(request)) {
    return path.resolve(__dirname, '__mocks__/shared/schema.ts');
  }

  // Force route drizzle-zod to enhanced mock
  if (request === 'drizzle-zod') {
    return path.resolve(__dirname, '__mocks__/enhanced-database-mock.js');
  }

  // Use default resolver for everything else
  return options.defaultResolver(request, options);
};
