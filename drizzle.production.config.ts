import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned');
}

export default defineConfig({
  out: './migrations',
  schema: [
    './shared/schemas/core.ts',
    './shared/schemas/property.ts', 
    './shared/schemas/documents.ts',
    './shared/schemas/financial.ts',
    './shared/schemas/operations.ts'
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: false
});