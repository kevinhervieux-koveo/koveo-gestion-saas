import express, { type Express } from 'express';
import request from 'supertest';
import { sanitizeInputMiddleware } from '../../../server/middleware/input-sanitization';

/**
 * Unit tests for the scoped key-probe narrowing introduced in Task #728.
 *
 * Background: the dangerous-input walker used `containsDangerousPatterns`
 * (which includes the LDAP-injection probe `[\(\)\*\\\x00]`) when checking
 * ALL object keys. French accounting labels like "Franchise Assurance (loi
 * 141)" or "TPS/TVQ (taxes)" appear as keys in `customBankFields` and
 * `categoryInflationRates` maps; they contain parentheses that the LDAP
 * probe flags, causing 400 responses.
 *
 * Fix (defence-in-depth): when the walker is iterating entries of a known
 * user-label map (`customBankFields`, `categoryInflationRates`), it now uses
 * the narrower `containsDangerousLabelMapKeyPatterns` which runs only the
 * NoSQL-operator probe. For ALL other object keys the full
 * `containsDangerousPatterns` probe (including LDAP/SQL/command) is still
 * applied, preserving existing security coverage outside the budget-label
 * surface.
 */
function buildEchoApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeInputMiddleware);
  app.post('/api/echo', (req, res) => {
    res.status(200).json({ ok: true, body: req.body });
  });
  return app;
}

describe('sanitizeInputMiddleware — scoped key probe (Task #728)', () => {
  const app = buildEchoApp();

  describe('parenthesised keys in known user-label maps are allowed', () => {
    it('allows customBankFields with parentheses and slashes in keys', async () => {
      const body = {
        customBankFields: {
          'Franchise Assurance (loi 141)': 1000,
          'TPS/TVQ (taxes)': 250,
          'Réserve (urgences)': 500,
        },
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('allows categoryInflationRates with parenthesised category names', async () => {
      const body = {
        categoryInflationRates: {
          'Entretien (général)': 3.5,
          'Électricité (kWh)': 2.1,
        },
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(200);
    });
  });

  describe('parentheses in keys OUTSIDE known label maps are still blocked', () => {
    it('rejects a top-level key that contains parentheses', async () => {
      // A key like "field(name)" at the top level is not a user label map,
      // so the full probe (including LDAP) still applies.
      const body = {
        'field(name)': 'value',
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });
  });

  describe('NoSQL operator keys are still blocked everywhere', () => {
    it('rejects a body whose top-level key is a NoSQL operator like $ne', async () => {
      const body = {
        filter: { $ne: null },
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('rejects a body whose key inside customBankFields is a NoSQL operator', async () => {
      const body = {
        customBankFields: {
          '$ne': 1000,
        },
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('rejects a body whose key is $where', async () => {
      const body = {
        query: { $where: 'this.admin === true' },
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });
  });

  describe('parentheses inside a string VALUE on a non-bypassed route are still rejected', () => {
    it('rejects a string value containing a null byte (LDAP probe)', async () => {
      // The LDAP probe runs against VALUES normally; a null byte in a value
      // is still caught regardless of field name.
      const body = {
        description: "normal text\x00injected",
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });

    it('rejects a string value containing a NoSQL operator prefix', async () => {
      const body = {
        name: '$where this.isAdmin',
      };

      const res = await request(app).post('/api/echo').send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DANGEROUS_INPUT');
    });
  });
});
