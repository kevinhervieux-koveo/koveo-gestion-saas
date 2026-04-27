import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { sanitizeInputMiddleware } from '../../../server/middleware/input-sanitization';

/**
 * Build an Express app that mounts:
 *   - sanitizeInputMiddleware
 *   - the two free-text Link Family endpoints whose route handlers run
 *     their own Zod validation (matching the production behavior in
 *     server/api/document-link-families.ts)
 *   - sibling shadow routes that look like they should inherit the
 *     bypass but must not (e.g. `/api/document-link-families-evil`)
 *   - bypassed paths on unintended verbs to confirm method pinning
 *
 * The store is a simple in-memory map so we can assert that values are
 * persisted unchanged (no HTML-escaping, no probe rejection).
 */
function buildApp(): { app: Express; store: Map<string, { name: string; description: string | null }> } {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeInputMiddleware);

  const store = new Map<string, { name: string; description: string | null }>();
  // Seed one row so the PATCH route has something to update
  store.set('seed-id', { name: 'Seed family', description: 'seed desc' });

  // Mirror server/api/document-link-families.ts schemas
  const familyInputSchema = z.object({
    name: z.string().min(1, 'Family name is required').max(150),
    description: z.string().optional().nullable(),
  });
  const familyCreateSchema = familyInputSchema.extend({
    isSystem: z.boolean().optional().default(false),
  });
  const familyUpdateSchema = familyInputSchema.partial();

  app.post('/api/document-link-families', (req, res) => {
    const parsed = familyCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid family', errors: parsed.error.errors });
    }
    const id = `id-${store.size + 1}`;
    store.set(id, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    return res.status(201).json({ id, ...store.get(id) });
  });

  app.patch('/api/document-link-families/:id', (req, res) => {
    const existing = store.get(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Not found' });
    }
    const parsed = familyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid family', errors: parsed.error.errors });
    }
    if (parsed.data.name !== undefined) existing.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      existing.description = parsed.data.description ?? null;
    store.set(req.params.id, existing);
    return res.status(200).json({ id: req.params.id, ...existing });
  });

  // Sibling / shadow routes that must NOT inherit the bypass
  app.post('/api/document-link-families-evil', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.patch('/api/document-link-families-evil/:id', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.post('/api/document-link-families/extra/segment', (_req, res) =>
    res.status(200).json({ ok: true }),
  );

  // Wrong-method handlers — must NOT inherit the bypass (only POST on
  // the collection and PATCH on the item are pinned in the allow-list).
  app.put('/api/document-link-families/:id', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.post('/api/document-link-families/:id', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.patch('/api/document-link-families', (_req, res) =>
    res.status(200).json({ ok: true }),
  );

  return { app, store };
}

describe('sanitizeInputMiddleware free-text endpoint bypass (Task #1407)', () => {
  describe('POST /api/document-link-families accepts free-text punctuation', () => {
    const cases = [
      {
        label: 'parentheses, comma, ampersand',
        description: 'Financial documents (budgets, statements) & forecasts',
      },
      {
        label: 'semicolons, asterisks, pipes',
        description: 'Maintenance reports; inspections * follow-up | priority',
      },
      {
        label: 'shell metachars and backticks',
        description: 'Use $rate or `code` to compute',
      },
      {
        label: 'accented French characters',
        description: "Documents financiers liés (récents, à jour) — détaillés",
      },
      {
        label: 'forward slash and hyphen',
        description: 'Year-end / fiscal report - 2025-2026',
      },
    ];

    it.each(cases)(
      'persists description with $label unchanged',
      async ({ description }) => {
        const { app, store } = buildApp();
        const res = await request(app).post('/api/document-link-families').send({
          name: 'Test family',
          description,
        });
        expect(res.status).toBe(201);
        expect(res.body.description).toBe(description);
        // also confirm what is stored is byte-identical (no html escaping etc)
        const persisted = Array.from(store.values()).find(
          (v) => v.name === 'Test family',
        );
        expect(persisted?.description).toBe(description);
      },
    );

    it('persists name with parentheses and ampersand unchanged', async () => {
      const { app, store } = buildApp();
      const name = 'Budgets & Statements (annual)';
      const res = await request(app).post('/api/document-link-families').send({
        name,
        description: 'plain',
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(name);
      const persisted = Array.from(store.values()).find(
        (v) => v.description === 'plain',
      );
      expect(persisted?.name).toBe(name);
    });

    it('still rejects empty name via the route Zod validator', async () => {
      const { app } = buildApp();
      const res = await request(app).post('/api/document-link-families').send({
        name: '',
        description: 'anything',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid family');
      // The 400 must come from the route's Zod validator, NOT from the
      // global DANGEROUS_INPUT middleware (which would have a `code`).
      expect(res.body.code).toBeUndefined();
    });

    it('still rejects oversized name via the route Zod validator', async () => {
      const { app } = buildApp();
      const res = await request(app).post('/api/document-link-families').send({
        name: 'x'.repeat(151),
        description: 'plain',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid family');
      expect(res.body.code).toBeUndefined();
    });
  });

  describe('PATCH /api/document-link-families/:id accepts free-text punctuation', () => {
    it('updates description with parentheses & ampersand unchanged', async () => {
      const { app, store } = buildApp();
      const description = 'Maintenance reports, inspections, and follow-up documents (yearly) & quarterly';
      const res = await request(app)
        .patch('/api/document-link-families/seed-id')
        .send({ description });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe(description);
      expect(store.get('seed-id')?.description).toBe(description);
    });

    it('updates name with French accents and punctuation unchanged', async () => {
      const { app, store } = buildApp();
      const name = "Documents liés (récents, à jour)";
      const res = await request(app)
        .patch('/api/document-link-families/seed-id')
        .send({ name });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(name);
      expect(store.get('seed-id')?.name).toBe(name);
    });

    it('still rejects empty name via the route Zod validator', async () => {
      const { app } = buildApp();
      const res = await request(app)
        .patch('/api/document-link-families/seed-id')
        .send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid family');
      expect(res.body.code).toBeUndefined();
    });
  });

  describe('bypass is narrow and does not leak to siblings or wrong methods', () => {
    const DANGEROUS_BODY = { name: "1; DROP TABLE users; --", description: '$ne' };

    it('blocks POST /api/document-link-families-evil (sibling)', async () => {
      const { app } = buildApp();
      const res = await request(app)
        .post('/api/document-link-families-evil')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('blocks PATCH /api/document-link-families-evil/:id (sibling)', async () => {
      const { app } = buildApp();
      const res = await request(app)
        .patch('/api/document-link-families-evil/abc')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('blocks POST /api/document-link-families/extra/segment (deeper path)', async () => {
      const { app } = buildApp();
      const res = await request(app)
        .post('/api/document-link-families/extra/segment')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('blocks PUT /api/document-link-families/:id (wrong verb)', async () => {
      const { app } = buildApp();
      const res = await request(app)
        .put('/api/document-link-families/seed-id')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('blocks POST /api/document-link-families/:id (wrong verb on item)', async () => {
      const { app } = buildApp();
      const res = await request(app)
        .post('/api/document-link-families/seed-id')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('blocks PATCH /api/document-link-families (wrong verb on collection)', async () => {
      const { app } = buildApp();
      const res = await request(app)
        .patch('/api/document-link-families')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });
  });
});
