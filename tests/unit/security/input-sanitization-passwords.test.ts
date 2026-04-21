import express, { type Express } from 'express';
import request from 'supertest';
import { sanitizeInputMiddleware } from '../../../server/middleware/input-sanitization';

/**
 * Task #158 — credential field values must be excluded from the
 * `containsDangerousPatterns` body scan, while the same characters in
 * non-credential fields must still be blocked. The actual `req.body`
 * must NOT be mutated by the middleware (the password value must
 * still be available to the downstream auth handler).
 */
function buildApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeInputMiddleware);

  // Generic echo endpoint that proves (a) we reached the handler and
  // (b) what the handler observed in `req.body` after sanitization.
  app.post('/api/echo', (req, res) => {
    res.status(200).json({ ok: true, body: req.body });
  });

  return app;
}

describe('sanitizeInputMiddleware — credential field exclusion (Task #158)', () => {
  const dangerousPasswords = [
    'Blablabla6578$',
    'has;semicolon',
    'has|pipe',
    'has`backtick`',
    'mix$;|`all',
  ];

  for (const pw of dangerousPasswords) {
    it(`accepts a "password" field containing ${JSON.stringify(pw)}`, async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/echo')
        .send({
          firstName: 'Alice',
          lastName: 'Tremblay',
          password: pw,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // The password must still reach the handler unmodified — the
      // exclusion is from the SCAN only, not a mutation of req.body.
      expect(res.body.body.password).toBe(pw);
    });
  }

  it('accepts the other documented credential aliases', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/echo').send({
      newPassword: 'Brand$new1',
      oldPassword: 'old;value2',
      confirmPassword: 'confirm|pw3',
      currentPassword: 'current`pw4',
    });

    expect(res.status).toBe(200);
    expect(res.body.body.newPassword).toBe('Brand$new1');
    expect(res.body.body.oldPassword).toBe('old;value2');
    expect(res.body.body.confirmPassword).toBe('confirm|pw3');
    expect(res.body.body.currentPassword).toBe('current`pw4');
  });

  it('still BLOCKS the same dangerous chars in a non-credential field', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({
        firstName: 'Alice;DROP$|`',
        password: 'Safe1234!',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });

  it('still BLOCKS dangerous chars when there is NO credential field at all', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({ note: 'abc;rm -rf /' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });

  it('surfaces the offending field path and a French-labelled message (Task #166)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({ firstName: 'Alice;DROP', password: 'Safe1234!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
    expect(res.body.fieldPath).toBe('firstName');
    expect(res.body.fieldLabel).toBe('Prénom');
    expect(res.body.message).toMatch(/Prénom/);
    expect(res.body.message).toMatch(/caractères non autorisés/);
  });

  it('returns the dotted path when the offending value is nested (Task #166)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({
        profile: { contact: { phone: '514-555-1234;rm' } },
        password: 'Safe1234!',
      });

    expect(res.status).toBe(400);
    expect(res.body.fieldPath).toBe('profile.contact.phone');
    expect(res.body.fieldLabel).toBe('Téléphone');
  });

  it('renders array positions with [n] in the field path (Task #166)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({ tags: ['ok', 'also-ok', 'evil;drop'] });

    expect(res.status).toBe(400);
    expect(res.body.fieldPath).toBe('tags[2]');
  });

  it('still catches dangerous patterns inside object KEYS (Task #166)', async () => {
    // Regression guard: the fieldPath walker must inspect keys as
    // well as values so NoSQL-operator payloads like `$ne`, `$where`,
    // `$gt` (caught by NOSQL_INJECTION) still trip the middleware.
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({ filter: { $ne: null } });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
    expect(res.body.fieldPath).toBe('filter.$ne');
  });

  it('falls back to the raw key when no label is registered (Task #166)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({ customField: 'bad;input' });

    expect(res.status).toBe(400);
    expect(res.body.fieldPath).toBe('customField');
    expect(res.body.fieldLabel).toBe('customField');
  });

  it('does not mutate req.body shape (only excludes from scan)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/echo')
      .send({
        firstName: 'Alice',
        password: 'Has$Dollar1',
        nested: { confirmPassword: 'Nested|Pipe2' },
      });

    expect(res.status).toBe(200);
    expect(res.body.body.firstName).toBe('Alice');
    expect(res.body.body.password).toBe('Has$Dollar1');
    // Replacer also strips credential keys nested inside objects, but
    // only from the SCAN string — the original value still arrives at
    // the handler.
    expect(res.body.body.nested.confirmPassword).toBe('Nested|Pipe2');
  });
});
