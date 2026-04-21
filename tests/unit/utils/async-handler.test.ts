/**
 * @file Unit tests for the asyncHandler wrapper combined with the global
 * `secureErrorHandler` middleware. These two pieces together define the
 * response contract that migrated routes (e.g. in `server/api/residences.ts`,
 * `server/api/demands.ts`) rely on. Regressing any of these branches would
 * silently change response status codes or JSON shapes that the frontend
 * already depends on, so we lock the behavior in here.
 */

import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { z, ZodError } from 'zod';

import { asyncHandler } from '../../../server/utils/async-handler';
import { secureErrorHandler } from '../../../server/middleware/error-security';

function buildApp(handler: express.RequestHandler): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/test', handler);
  app.use(secureErrorHandler);
  return app;
}

describe('asyncHandler + secureErrorHandler', () => {
  it('passes through a successful response unchanged', async () => {
    const app = buildApp(
      asyncHandler(async (_req, res) => {
        res.json({ ok: true, value: 42 });
      }, { errorMessage: 'Failed to do thing' })
    );

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, value: 42 });
  });

  it('maps a thrown ZodError to 400 with field-level details', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const app = buildApp(
      asyncHandler(async (_req, _res) => {
        // Force a real ZodError so the error has the same shape that
        // production validation would throw.
        schema.parse({ name: 123, age: 'oops' });
      }, { errorMessage: 'Failed to validate thing' })
    );

    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
    // Each ZodIssue has a `path` array; make sure they survived serialization.
    expect(res.body.errors[0]).toHaveProperty('path');
  });

  it('honors an error carrying statusCode and uses the error message', async () => {
    const app = buildApp(
      asyncHandler(async (_req, _res) => {
        const err: any = new Error('Residence not found');
        err.statusCode = 404;
        throw err;
      }, { errorMessage: 'Failed to fetch residence' })
    );

    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Residence not found' });
  });

  it('falls back to 500 with the configured errorMessage for a generic Error', async () => {
    const app = buildApp(
      asyncHandler(async (_req, _res) => {
        throw new Error('db connection refused: secret-host:5432');
      }, { errorMessage: 'Failed to fetch residences' })
    );

    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    // The configured generic message is returned (NOT the raw error message)
    // so internal details never leak to the frontend.
    expect(res.body).toEqual({ message: 'Failed to fetch residences' });
  });

  it('also handles a ZodError surfaced via name (custom subclass)', async () => {
    const app = buildApp(
      asyncHandler(async (_req, _res) => {
        // Simulate an error whose `name` is "ZodError" but that isn't an
        // instanceof check (e.g. duplicated zod copies in node_modules).
        const err: any = new Error('bad input');
        err.name = 'ZodError';
        err.errors = [{ path: ['email'], message: 'Required' }];
        throw err;
      }, { errorMessage: 'Failed to create thing' })
    );

    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toEqual([{ path: ['email'], message: 'Required' }]);
  });
});
