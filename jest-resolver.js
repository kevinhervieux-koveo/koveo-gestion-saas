/**
 * Custom Jest resolver to force-route problematic imports to mocks
 * Bypasses moduleNameMapper and moduleDirectories unreliability
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (request, options) => {
  // Force route drizzle-orm/pg-core to our mock
  if (request === 'drizzle-orm/pg-core' || request.startsWith('drizzle-orm/pg-core')) {
    return path.resolve(__dirname, '__mocks__/drizzle-orm/pg-core.js');
  }
  
  // Force route shared/schema paths to our mock  
  if (/(^|.*\/)(shared\/schema)(\.(ts|js))?$/.test(request)) {
    return path.resolve(__dirname, '__mocks__/shared/schema.ts');
  }
  
  // Force route drizzle-orm base to our mock
  if (request === 'drizzle-orm') {
    return path.resolve(__dirname, '__mocks__/drizzle-orm/index.js');
  }
  
  // Force route drizzle-zod to enhanced mock
  if (request === 'drizzle-zod') {
    return path.resolve(__dirname, '__mocks__/enhanced-database-mock.js');
  }
  
  // Use default resolver for everything else
  return options.defaultResolver(request, options);
};