import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL_KOVEO) {
  throw new Error('DATABASE_URL_KOVEO is required for production database operations');
}

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_KOVEO,
  },
});