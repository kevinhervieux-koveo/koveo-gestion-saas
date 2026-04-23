/**
 * @jest-environment node
 *
 * Task #380: persisted `documents.fileName` from the upload route
 * must equal `normalizeFilename(file.originalname)` so historical
 * unsafe filenames cannot crash downstream Content-Disposition headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

jest.mock('../../__mocks__/server/storage', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/storage.ts'));
});
jest.mock('../../__mocks__/server/auth', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/auth.ts'));
});
jest.mock('../../__mocks__/server/routes', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/routes.ts'));
});
jest.mock('../../server/config/index', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/config/index.ts'));
});

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import nodePath from 'path';
import { eq, inArray } from 'drizzle-orm';

import { normalizeFilename } from '../../server/utils/filenameNormalization';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task380-upload-norm';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const TRICKY_ORIGINAL = "Bill #42 [DRAFT] (final) +rev; Q&A 'v2'.pdf";

const PDF_BODY = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF',
  'utf8'
);

describeIfDb('upload filename normalization — Task #380', () => {
  let app: express.Application;
  let db: any;
  let schema: any;
  let documentsTable: any;

  const created: Record<string, Set<string>> = {
    documents: new Set(),
    userResidences: new Set(),
    userOrganizations: new Set(),
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  const PASSWORD = 'Password!234';
  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    residence: crypto.randomUUID(),
    manager: crypto.randomUUID(),
  };
  const managerEmail = `${ids.manager}@${TEST_TAG}.test`;

  const fixturesDir = nodePath.join(process.cwd(), 'server/tests/fixtures');
  const fixturePath = nodePath.join(fixturesDir, `${TEST_TAG}-tricky.pdf`);

  let authCookie: string[];
  let uploadedDocId: string;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task380';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    documentsTable = schema.documents;
    const { setupAuthRoutes } = require('../../server/auth');
    const { registerDocumentRoutes } = require('../../server/api/documents');

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(
      session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { secure: false, httpOnly: true, sameSite: 'lax', path: '/' },
        name: 'koveo.sid',
      })
    );
    setupAuthRoutes(app);
    registerDocumentRoutes(app);

    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    fs.writeFileSync(fixturePath, PDF_BODY);

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    await db.insert(schema.organizations).values({
      id: ids.org,
      name: `${TEST_TAG} Org ${ids.org.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    created.organizations.add(ids.org);

    await db.insert(schema.buildings).values({
      id: ids.building,
      organizationId: ids.org,
      name: `${TEST_TAG} bldg`,
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    created.buildings.add(ids.building);

    await db.insert(schema.residences).values({
      id: ids.residence,
      buildingId: ids.building,
      unitNumber: '101',
      isActive: true,
    });
    created.residences.add(ids.residence);

    await db.insert(schema.users).values({
      id: ids.manager,
      username: `${TEST_TAG}-mgr-${ids.manager.slice(0, 8)}`,
      email: managerEmail,
      password: passwordHash,
      firstName: 'M',
      lastName: 'G',
      role: 'manager',
      isActive: true,
    });
    created.users.add(ids.manager);

    const orgLink = {
      id: crypto.randomUUID(),
      userId: ids.manager,
      organizationId: ids.org,
      organizationRole: 'manager',
      isActive: true,
    };
    await db.insert(schema.userOrganizations).values(orgLink);
    created.userOrganizations.add(orgLink.id);

    const resLink = {
      id: crypto.randomUUID(),
      userId: ids.manager,
      residenceId: ids.residence,
      relationshipType: 'manager',
      startDate: '2024-01-01',
      isActive: true,
    };
    await db.insert(schema.userResidences).values(resLink);
    created.userResidences.add(resLink.id);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: managerEmail,
      password: PASSWORD,
    });
    expect(loginRes.status).toBe(200);
    const cookieHeader = loginRes.headers['set-cookie'];
    authCookie = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    expect(authCookie.length).toBeGreaterThan(0);
  }, 30_000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    if (created.documents.size > 0) {
      await db
        .delete(documentsTable)
        .where(inArray(documentsTable.id, Array.from(created.documents)));
    }
    if (created.userResidences.size > 0) {
      await db
        .delete(schema.userResidences)
        .where(
          inArray(schema.userResidences.id, Array.from(created.userResidences))
        );
    }
    if (created.userOrganizations.size > 0) {
      await db
        .delete(schema.userOrganizations)
        .where(
          inArray(
            schema.userOrganizations.id,
            Array.from(created.userOrganizations)
          )
        );
    }
    if (created.users.size > 0) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, Array.from(created.users)));
    }
    if (created.residences.size > 0) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, Array.from(created.residences)));
    }
    if (created.buildings.size > 0) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, Array.from(created.buildings)));
    }
    if (created.organizations.size > 0) {
      await db
        .delete(schema.organizations)
        .where(
          inArray(schema.organizations.id, Array.from(created.organizations))
        );
    }

    if (fs.existsSync(fixturePath)) {
      try {
        fs.unlinkSync(fixturePath);
      } catch {
        /* best-effort */
      }
    }
  }, 30_000);

  it('persists fileName equal to normalizeFilename(originalname) when uploading an ASCII tricky filename', async () => {
    const expected = normalizeFilename(TRICKY_ORIGINAL);

    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Cookie', authCookie)
      .field('name', `${TEST_TAG} tricky upload`)
      .field('description', 'Task #380 regression')
      .field('documentType', 'other')
      .field('residenceId', ids.residence)
      .field('isVisibleToTenants', 'false')
      .attach('file', fixturePath, {
        filename: TRICKY_ORIGINAL,
        contentType: 'application/pdf',
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body?.document?.id).toBeDefined();
    uploadedDocId = uploadRes.body.document.id;
    created.documents.add(uploadedDocId);

    const rows = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, uploadedDocId));
    expect(rows).toHaveLength(1);
    expect(rows[0].fileName).toBe(expected);
    expect(rows[0].fileName).toMatch(/^[a-z0-9._-]+$/);
  });

  it('persists a safe normalized fileName when uploading an emoji + CJK + accented filename', async () => {
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Cookie', authCookie)
      .field('name', `${TEST_TAG} unicode upload`)
      .field('description', 'Task #380 unicode regression')
      .field('documentType', 'other')
      .field('residenceId', ids.residence)
      .field('isVisibleToTenants', 'false')
      .attach('file', fixturePath, {
        filename: "récépissé 中文 🧪 d'avril.pdf",
        contentType: 'application/pdf',
      });

    expect(uploadRes.status).toBe(201);
    const docId: string = uploadRes.body?.document?.id;
    expect(docId).toBeDefined();
    created.documents.add(docId);

    const rows = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, docId));
    expect(rows).toHaveLength(1);
    const persisted: string = rows[0].fileName;

    // The exact bytes multer sees depend on form-data's Latin-1
    // serialization of the part header, so we cannot assert strict
    // equality with normalizeFilename(originalLiteral). What the
    // upload site MUST guarantee is that whatever it received was
    // routed through the shared helper before persistence:
    //   - the result is in the safe ASCII charset, AND
    //   - it is idempotent under the helper (i.e. the helper produced it).
    expect(persisted).toMatch(/^[a-z0-9._-]+$/);
    expect(normalizeFilename(persisted)).toBe(persisted);
    expect(persisted.endsWith('.pdf')).toBe(true);
    expect(persisted).not.toMatch(/[\u0080-\uFFFF'\s"]/);
  });

  it('serves the uploaded document through /api/documents/:id/file with a Content-Disposition Node accepts', async () => {
    expect(uploadedDocId).toBeDefined();

    const downloadRes = await request(app)
      .get(`/api/documents/${uploadedDocId}/file`)
      .set('Cookie', authCookie);

    expect(downloadRes.status).toBe(200);

    const cd = downloadRes.headers['content-disposition'];
    expect(typeof cd).toBe('string');
    for (const ch of String(cd)) {
      const code = ch.codePointAt(0) ?? 0;
      expect(code).toBeGreaterThanOrEqual(0x20);
      expect(code).toBeLessThanOrEqual(0x7e);
    }
    expect(cd).toContain(`filename="${normalizeFilename(TRICKY_ORIGINAL)}"`);
  });
});
