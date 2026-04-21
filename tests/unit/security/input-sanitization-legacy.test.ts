import express, { type Express } from 'express';
import request from 'supertest';
import {
  sanitizeInputMiddleware,
  buildLegacyBypassFromApp,
} from '../../../server/middleware/input-sanitization';

/**
 * Build an Express app that mounts:
 *   - sanitizeInputMiddleware
 *   - a representative slice of the real legacy routes (so the
 *     auto-built bypass map covers them)
 *   - sibling shadow routes (`/api/bills-evil`, etc.) that look like
 *     they should inherit the bypass but must not
 *   - bypassed paths on unintended verbs to confirm method pinning
 *
 * Then call `buildLegacyBypassFromApp(app)` exactly like server/index.ts
 * does after `registerRoutes` completes.
 */
function buildApp(): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(sanitizeInputMiddleware);

  // --- Real legacy routes (exact paths/methods mirror server/api/*) ---
  app.post('/api/upload', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/documents/upload', (_req, res) => res.status(200).json({ ok: true }));

  // bills
  app.get('/api/bills', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/bills', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/api/bills/:id', (_req, res) => res.status(200).json({ ok: true }));
  app.put('/api/bills/:id', (_req, res) => res.status(200).json({ ok: true }));
  app.delete('/api/bills/:id', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/api/bills/:id/payments', (_req, res) => res.status(200).json({ ok: true }));

  // invoices
  app.get('/api/invoices/:id', (_req, res) => res.status(200).json({ ok: true }));

  // budgets — mounted via app.use(prefix, router) to exercise the
  // sub-router walker in buildLegacyBypassFromApp.
  const budgetsRouter = express.Router();
  budgetsRouter.get('/:buildingId/summary', (_req, res) => res.status(200).json({ ok: true }));
  budgetsRouter.post('/:buildingId/forecast', (_req, res) => res.status(200).json({ ok: true }));
  budgetsRouter.put('/:buildingId/unplanned-bills', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.use('/api/budgets', budgetsRouter);

  // maintenance
  app.get('/api/maintenance/projects/:id/steps', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.post('/api/maintenance/buildings/:buildingId/generate-auto-projects', (_req, res) =>
    res.status(200).json({ ok: true }),
  );

  // performance/web-vitals
  app.post('/api/performance/web-vitals', (_req, res) => res.status(200).json({ ok: true }));

  // demands
  app.post('/api/demands', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/api/demands/:id/comments', (_req, res) => res.status(200).json({ ok: true }));

  // --- Sibling / shadow routes that must NOT inherit the bypass ---
  app.post('/api/upload-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/documents/upload-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/bills-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/invoices-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/budgets-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/maintenance-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/demands-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/performance/web-vitals-evil', (_req, res) => res.status(200).json({ ok: true }));

  // Snapshot the bypass map BEFORE registering the wrong-verb test
  // handlers below. The map must reflect only the verbs the production
  // routers mount; otherwise the wrong-method assertions are vacuous.
  buildLegacyBypassFromApp(app);

  // --- Bypassed paths on unintended verbs (registered AFTER the
  // bypass snapshot, so they are NOT in the allow-list) ---
  app.delete('/api/upload', (_req, res) => res.status(200).json({ ok: true }));
  app.patch('/api/bills/:id', (_req, res) => res.status(200).json({ ok: true }));

  return app;
}

const DANGEROUS_BODY = { q: "1; DROP TABLE users; --" };

describe('sanitizeInputMiddleware legacy bypass (Task #107)', () => {
  const app = buildApp();

  describe('bypass still works for the real mounted routes', () => {
    it('bypasses POST /api/upload', async () => {
      const res = await request(app).post('/api/upload').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('bypasses POST /api/documents/upload', async () => {
      const res = await request(app).post('/api/documents/upload').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses GET /api/bills', async () => {
      const res = await request(app).get('/api/bills').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses GET /api/bills/:id', async () => {
      const res = await request(app).get('/api/bills/abc-123').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses GET /api/bills/:id/payments', async () => {
      const res = await request(app).get('/api/bills/abc-123/payments').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses GET /api/invoices/:id', async () => {
      const res = await request(app).get('/api/invoices/abc-123').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    // Budgets routes are mounted via app.use(prefix, router); this
    // exercises the sub-router walker.
    it('bypasses GET /api/budgets/:buildingId/summary (sub-router)', async () => {
      const res = await request(app).get('/api/budgets/building-1/summary').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses POST /api/budgets/:buildingId/forecast (sub-router)', async () => {
      const res = await request(app).post('/api/budgets/building-1/forecast').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses PUT /api/budgets/:buildingId/unplanned-bills (sub-router)', async () => {
      const res = await request(app)
        .put('/api/budgets/building-1/unplanned-bills')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses GET /api/maintenance/projects/:id/steps', async () => {
      const res = await request(app)
        .get('/api/maintenance/projects/proj-1/steps')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses POST /api/maintenance/buildings/:buildingId/generate-auto-projects', async () => {
      const res = await request(app)
        .post('/api/maintenance/buildings/b1/generate-auto-projects')
        .send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses POST /api/performance/web-vitals', async () => {
      const res = await request(app).post('/api/performance/web-vitals').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses POST /api/demands', async () => {
      const res = await request(app).post('/api/demands').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });

    it('bypasses GET /api/demands/:id/comments', async () => {
      const res = await request(app).get('/api/demands/abc-123/comments').send(DANGEROUS_BODY);
      expect(res.status).toBe(200);
    });
  });

  describe('sibling / shadow paths must be sanitized', () => {
    it.each([
      '/api/upload-evil',
      '/api/documents/upload-evil',
      '/api/bills-evil',
      '/api/invoices-evil',
      '/api/budgets-evil',
      '/api/maintenance-evil',
      '/api/demands-evil',
      '/api/performance/web-vitals-evil',
    ])('blocks dangerous payload on POST %s', async (path) => {
      const res = await request(app).post(path).send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });
  });

  describe('wrong-method requests on bypassed paths must be sanitized', () => {
    it('blocks DELETE /api/upload (only POST is mounted in production)', async () => {
      const res = await request(app).delete('/api/upload').send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('blocks PATCH /api/bills/:id (only GET/PUT/DELETE mounted in production)', async () => {
      const res = await request(app).patch('/api/bills/abc-123').send(DANGEROUS_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });
  });
});
