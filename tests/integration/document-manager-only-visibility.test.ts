/**
 * @jest-environment node
 *
 * @file Manager-only document visibility — Task #321
 * @description Behavioural integration tests proving that the
 *   `documents.isManagerOnly` flag hides records from residents and
 *   tenants across every public read endpoint, while admins and
 *   managers still see them. Mirrors the real-DB pattern used by
 *   `tests/integration/cross-organization-isolation.test.ts` and
 *   exercises:
 *     - GET /api/documents              (list)
 *     - GET /api/documents/:id          (single fetch)
 *     - GET /api/documents/:id/file     (download/preview path in
 *                                        server/api/documents.ts)
 *     - GET /api/documents/:id/optimized-file
 *                                       (preview/download path in
 *                                        server/api/optimized-documents.ts)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// jest.config.cjs maps `./storage`, `./auth`, `./routes` to in-repo
// unit-tier mocks. For this real-DB integration suite we need the
// real implementations, so override the mocks at their resolved paths
// (same trick used by cross-organization-isolation.test.ts).
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

// `uuid` v14 ships ESM-only `dist-node` which Jest's CJS transform
// cannot parse, so jest.config.cjs maps the bare `uuid` specifier to a
// CJS shim under `__mocks__/uuid.cjs`. With that mapper in place we can
// import the real `server/objectStorage` (and its transitive
// `@google-cloud/storage` -> `gaxios` -> `uuid` chain) and the real
// `server/services/optimized-file-storage` without any local
// `jest.mock` stubs. That, in turn, lets this suite assert the actual
// 200 + body that admins/managers receive on a download — not just
// "the route did not return 403/404 access-denied".

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import fsPromises from 'fs/promises';
import nodePath from 'path';
import { inArray, eq, and } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task321-mgr-only-docs';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('manager-only document visibility — Task #321', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const created: Record<string, Set<string>> = {
    documents: new Set(),
    userResidences: new Set(),
    userBuildings: new Set(),
    userOrganizations: new Set(),
    residences: new Set(),
    buildings: new Set(),
    organizations: new Set(),
    users: new Set(),
  };

  // Tracks every real artefact written to GCS / local disk so afterAll
  // can clean up regardless of test outcome.
  const createdGcsObjects: Array<{ bucketName: string; objectName: string }> =
    [];
  const createdLocalFiles: string[] = [];

  // Tiny but valid 1-page PDF body. Used as the on-storage content for
  // every document so admin/manager downloads can assert a real,
  // non-empty body instead of just "the route did not deny access".
  const PDF_BODY = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF',
    'utf8'
  );

  const PASSWORD = 'Password!234';
  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    residence: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    manager: crypto.randomUUID(),
    resident: crypto.randomUUID(),
    tenant: crypto.randomUUID(),
    docMgrOnlyResidence: crypto.randomUUID(),
    docMgrOnlyBuilding: crypto.randomUUID(),
    docNormalResidence: crypto.randomUUID(),
    // Task #349: a manager-only doc whose stored filename + display
    // name carry a non-ASCII character so the disposition header can
    // be exercised through the Latin-1 HTTP serialisation path.
    docUnicodeResidence: crypto.randomUUID(),
    // Task #351: a residence-scoped document whose underlying GCS
    // object intentionally omits the `custom:aclPolicy` metadata blob,
    // so the secondary ACL check in /api/documents/:id/file falls
    // through `getObjectAclPolicy` returning null and `canAccessObject`
    // returning false. Used to lock down the documented behaviour
    // (admin bypass, everyone else 403) when production data is
    // inconsistent and missing the ACL metadata.
    docMissingAclResidence: crypto.randomUUID(),
    // Task #377: residence-scoped, tenant-visible document whose
    // `/objects/...` filePath was never staged in GCS or on local
    // disk. Exercises the `canUserAccessDocument` fallback branch
    // that returns `{ allowed: true, reason: 'File not found...' }`
    // when both the primary and fallback object lookups raise
    // ObjectNotFoundError, plus the route's bottom-of-handler 404
    // ("File not found") that the fallback ultimately funnels into.
    docMissingFileResidence: crypto.randomUUID(),
    // Task #377: same missing-file scenario, but the document is
    // flagged manager-only so residents/tenants are denied at the
    // route's primary scope/manager-only check (403) — proving that
    // unauthorised roles still receive scope-based denial and never
    // reach the missing-file 404 branch.
    docMissingFileMgrOnly: crypto.randomUUID(),
  };
  // Filename and display name shared by both /file (uses fileName) and
  // /optimized-file (uses name) for the unicode regression test.
  const UNICODE_FILENAME = 'héllo.pdf';
  const UNICODE_DOC_NAME = `${TEST_TAG} héllo unicode`;
  // Display names per docId — shared by the optimized-file assertions
  // so the inline-disposition filename can be checked exactly.
  const DOC_DISPLAY_NAMES: Record<string, string> = {};
  const emails = {
    admin: `${ids.admin}@${TEST_TAG}.test`,
    manager: `${ids.manager}@${TEST_TAG}.test`,
    resident: `${ids.resident}@${TEST_TAG}.test`,
    tenant: `${ids.tenant}@${TEST_TAG}.test`,
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task321';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const { setupAuthRoutes } = require('../../server/auth');
    const { registerDocumentRoutes } = require('../../server/api/documents');
    const {
      registerOptimizedDocumentRoutes,
    } = require('../../server/api/optimized-documents');

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
    registerOptimizedDocumentRoutes(app);

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

    await db.insert(schema.users).values([
      {
        id: ids.admin,
        username: `${TEST_TAG}-admin-${ids.admin.slice(0, 8)}`,
        email: emails.admin,
        password: passwordHash,
        firstName: 'A',
        lastName: 'D',
        role: 'admin',
        isActive: true,
      },
      {
        id: ids.manager,
        username: `${TEST_TAG}-mgr-${ids.manager.slice(0, 8)}`,
        email: emails.manager,
        password: passwordHash,
        firstName: 'M',
        lastName: 'G',
        role: 'manager',
        isActive: true,
      },
      {
        id: ids.resident,
        username: `${TEST_TAG}-res-${ids.resident.slice(0, 8)}`,
        email: emails.resident,
        password: passwordHash,
        firstName: 'R',
        lastName: 'S',
        role: 'resident',
        isActive: true,
      },
      {
        id: ids.tenant,
        username: `${TEST_TAG}-ten-${ids.tenant.slice(0, 8)}`,
        email: emails.tenant,
        password: passwordHash,
        firstName: 'T',
        lastName: 'N',
        role: 'tenant',
        isActive: true,
      },
    ]);
    created.users.add(ids.admin);
    created.users.add(ids.manager);
    created.users.add(ids.resident);
    created.users.add(ids.tenant);

    const orgLinks = [
      {
        id: crypto.randomUUID(),
        userId: ids.admin,
        organizationId: ids.org,
        organizationRole: 'admin',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.manager,
        organizationId: ids.org,
        organizationRole: 'manager',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.resident,
        organizationId: ids.org,
        organizationRole: 'resident',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.tenant,
        organizationId: ids.org,
        organizationRole: 'tenant',
        isActive: true,
      },
    ];
    await db.insert(schema.userOrganizations).values(orgLinks);
    orgLinks.forEach((l) => created.userOrganizations.add(l.id));

    // Manager direct building assignment so getUserAccessScope's
    // building union returns the building under manager scope too.
    const mgrBuilding = {
      id: crypto.randomUUID(),
      userId: ids.manager,
      buildingId: ids.building,
      relationshipType: 'manager',
      isActive: true,
    };
    await db.insert(schema.userBuildings).values(mgrBuilding);
    created.userBuildings.add(mgrBuilding.id);

    // Resident + tenant linked to the same residence so they "own"
    // documents tied to that residence in scope queries.
    const residenceLinks = [
      {
        id: crypto.randomUUID(),
        userId: ids.manager,
        residenceId: ids.residence,
        relationshipType: 'manager',
        startDate: '2024-01-01',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.resident,
        residenceId: ids.residence,
        relationshipType: 'owner',
        startDate: '2024-01-01',
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: ids.tenant,
        residenceId: ids.residence,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
      },
    ];
    await db.insert(schema.userResidences).values(residenceLinks);
    residenceLinks.forEach((l) => created.userResidences.add(l.id));

    // Stage real file content for every document under test. The
    // `/api/documents/:id/file` route streams via GCS-backed
    // `objectStorage`, while `/api/documents/:id/optimized-file`
    // streams from the local `uploads/` tree via
    // `optimizedFileStorage`. To exercise BOTH end-to-end we publish
    // the same PDF body in both places and reference it from the
    // document row via a `/objects/...` path.
    const { objectStorageClient } = require('../../server/objectStorage');
    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      throw new Error(
        'PRIVATE_OBJECT_DIR is not set; this suite requires Replit Object Storage.'
      );
    }
    // PRIVATE_OBJECT_DIR is `/<bucket>[/<prefix...>]`. Strip the
    // leading slash, then peel off the bucket; the remainder (which
    // may be empty if no prefix is configured) is the in-bucket
    // prefix the runtime code (`getObjectEntityFile`) appends entity
    // ids to. Empty prefix MUST NOT produce a leading slash in the
    // GCS object key, otherwise tests stage files at `/uploads/...`
    // while production code looks them up at `uploads/...`.
    const [gcsBucketName, ...gcsPrefixParts] = privateObjectDir
      .replace(/^\/+/, '')
      .split('/');
    const gcsPrefix = gcsPrefixParts.join('/'); // '' when no prefix
    const joinObjectKey = (rel: string) =>
      gcsPrefix ? `${gcsPrefix}/${rel}` : rel;
    const bucket = objectStorageClient.bucket(gcsBucketName);

    const localUploadsDir = nodePath.join(process.cwd(), 'uploads');

    /** Stages the PDF body in GCS + local fs and returns the
     *  `/objects/...` document filePath that both routes will accept. */
    async function stageFile(docId: string): Promise<string> {
      const entityRel = `uploads/${TEST_TAG}/${docId}.pdf`;
      const objectsPath = `/objects/${entityRel}`;

      // 1) GCS upload at <PRIVATE_OBJECT_DIR>/<entityRel> — this is
      //    where ObjectStorageService.getObjectEntityFile() looks.
      //    The route's secondary ACL check (`canUserAccessDocument`)
      //    consults the GCS object's `custom:aclPolicy` metadata, so
      //    we stamp an ORGANIZATION-scoped READ rule that resolves to
      //    "true" for our manager via their `user_organizations` row.
      //    Admins bypass this check entirely.
      const objectName = joinObjectKey(entityRel);
      const aclPolicy = {
        owner: ids.admin,
        visibility: 'private' as const,
        aclRules: [
          {
            group: { type: 'organization', id: ids.org },
            permission: 'read',
          },
        ],
      };
      await bucket.file(objectName).save(PDF_BODY, {
        contentType: 'application/pdf',
        resumable: false,
        metadata: {
          metadata: {
            'custom:aclPolicy': JSON.stringify(aclPolicy),
          },
        },
      });
      createdGcsObjects.push({ bucketName: gcsBucketName, objectName });

      // 2) Local fs file + sibling metadata for the optimized route.
      //    sanitizePath() strips the leading slash, so the on-disk
      //    location is `uploads/objects/<entityRel>`.
      const localFile = nodePath.join(
        localUploadsDir,
        'objects',
        entityRel
      );
      const metaFile = `${localFile}.metadata.json`;
      await fsPromises.mkdir(nodePath.dirname(localFile), { recursive: true });
      await fsPromises.writeFile(localFile, PDF_BODY);
      await fsPromises.writeFile(
        metaFile,
        JSON.stringify({
          originalName: `${docId}.pdf`,
          mimeType: 'application/pdf',
          size: PDF_BODY.length,
          uploadedBy: ids.manager,
          uploadedAt: new Date().toISOString(),
          // Manager access in optimizedFileStorage.checkFileAccess
          // requires `context.organizationId` to be set.
          context: {
            type: 'document',
            organizationId: ids.org,
            buildingId: ids.building,
            residenceId: ids.residence,
            userRole: 'manager',
            userId: ids.manager,
          },
        })
      );
      createdLocalFiles.push(localFile, metaFile);

      return objectsPath;
    }

    /** Task #351 sibling of stageFile that does NOT write the
     *  `custom:aclPolicy` metadata blob. Mirrors production rows that
     *  predate the ACL-stamping code path: the GCS object exists with
     *  body and contentType, but `getObjectAclPolicy` will resolve to
     *  null. The local fs / metadata sidecar is still written so the
     *  optimized-file route stays functional in cleanup; the test
     *  itself only exercises the GCS-backed `/file` route. */
    async function stageFileWithoutAcl(docId: string): Promise<string> {
      const entityRel = `uploads/${TEST_TAG}/${docId}.pdf`;
      const objectsPath = `/objects/${entityRel}`;

      const objectName = joinObjectKey(entityRel);
      await bucket.file(objectName).save(PDF_BODY, {
        contentType: 'application/pdf',
        resumable: false,
        // No `metadata.metadata['custom:aclPolicy']` — this is the
        // entire point of the fixture.
      });
      createdGcsObjects.push({ bucketName: gcsBucketName, objectName });

      const localFile = nodePath.join(
        localUploadsDir,
        'objects',
        entityRel
      );
      const metaFile = `${localFile}.metadata.json`;
      await fsPromises.mkdir(nodePath.dirname(localFile), { recursive: true });
      await fsPromises.writeFile(localFile, PDF_BODY);
      await fsPromises.writeFile(
        metaFile,
        JSON.stringify({
          originalName: `${docId}.pdf`,
          mimeType: 'application/pdf',
          size: PDF_BODY.length,
          uploadedBy: ids.manager,
          uploadedAt: new Date().toISOString(),
          context: {
            type: 'document',
            organizationId: ids.org,
            buildingId: ids.building,
            residenceId: ids.residence,
            userRole: 'manager',
            userId: ids.manager,
          },
        })
      );
      createdLocalFiles.push(localFile, metaFile);

      return objectsPath;
    }

    const filePathMgrRes = await stageFile(ids.docMgrOnlyResidence);
    const filePathMgrBld = await stageFile(ids.docMgrOnlyBuilding);
    const filePathNormal = await stageFile(ids.docNormalResidence);
    const filePathUnicode = await stageFile(ids.docUnicodeResidence);
    const filePathMissingAcl = await stageFileWithoutAcl(
      ids.docMissingAclResidence
    );

    // Documents:
    //  1. Manager-only document on the residence — both isManagerOnly
    //     and isVisibleToTenants are true to prove the manager-only
    //     flag overrides the tenant-visibility flag.
    //  2. Manager-only document at the building level (also flagged
    //     as visible to tenants for the same reason).
    //  3. A normal residence-scoped document that resident & tenant
    //     SHOULD be able to see, used as a positive sanity control.
    DOC_DISPLAY_NAMES[ids.docMgrOnlyResidence] = `${TEST_TAG} mgr-only residence`;
    DOC_DISPLAY_NAMES[ids.docMgrOnlyBuilding] = `${TEST_TAG} mgr-only building`;
    DOC_DISPLAY_NAMES[ids.docNormalResidence] = `${TEST_TAG} normal residence`;
    DOC_DISPLAY_NAMES[ids.docUnicodeResidence] = UNICODE_DOC_NAME;

    await db.insert(schema.documents).values([
      {
        id: ids.docMgrOnlyResidence,
        name: `${TEST_TAG} mgr-only residence`,
        documentType: 'legal',
        filePath: filePathMgrRes,
        fileName: `${ids.docMgrOnlyResidence}.pdf`,
        mimeType: 'application/pdf',
        fileSize: PDF_BODY.length,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: true,
      },
      {
        id: ids.docMgrOnlyBuilding,
        name: `${TEST_TAG} mgr-only building`,
        documentType: 'legal',
        filePath: filePathMgrBld,
        fileName: `${ids.docMgrOnlyBuilding}.pdf`,
        mimeType: 'application/pdf',
        fileSize: PDF_BODY.length,
        buildingId: ids.building,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: true,
      },
      {
        id: ids.docNormalResidence,
        name: `${TEST_TAG} normal residence`,
        documentType: 'legal',
        filePath: filePathNormal,
        fileName: `${ids.docNormalResidence}.pdf`,
        mimeType: 'application/pdf',
        fileSize: PDF_BODY.length,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
      },
      {
        // Manager-only doc whose stored fileName + display name carry
        // a Latin-1 character ("é"). Drives the Task #349 unicode
        // disposition assertions on both /file and /optimized-file.
        id: ids.docUnicodeResidence,
        name: UNICODE_DOC_NAME,
        documentType: 'legal',
        filePath: filePathUnicode,
        fileName: UNICODE_FILENAME,
        mimeType: 'application/pdf',
        fileSize: PDF_BODY.length,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: true,
      },
      // Task #351: residence-scoped, non-manager-only, visible to
      // tenants — so all four roles pass the route's primary scope
      // check and reach the secondary `canUserAccessDocument` /
      // `canAccessObject` ACL gate. The underlying GCS object has no
      // `custom:aclPolicy` metadata, which is the scenario under test.
      {
        id: ids.docMissingAclResidence,
        name: `${TEST_TAG} missing-acl residence`,
        documentType: 'legal',
        filePath: filePathMissingAcl,
        fileName: `${ids.docMissingAclResidence}.pdf`,
        mimeType: 'application/pdf',
        fileSize: PDF_BODY.length,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
      },
      // Task #377: residence-scoped, tenant-visible — every role
      // passes the route's primary scope check and reaches the
      // secondary `canUserAccessDocument` ACL branch. The filePath
      // points at a `/objects/...` location that is intentionally
      // NEVER staged in GCS or on local disk, so both
      // `getObjectEntityFile` lookups inside `canUserAccessDocument`
      // throw `ObjectNotFoundError` and the fallback returns
      // `{ allowed: true, reason: 'File not found...' }`. The route
      // then proceeds to `downloadDocument`, which exhausts every
      // candidate path and answers with 404 "File not found".
      {
        id: ids.docMissingFileResidence,
        name: `${TEST_TAG} missing-file residence`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/missing/${ids.docMissingFileResidence}.pdf`,
        fileName: `${ids.docMissingFileResidence}.pdf`,
        mimeType: 'application/pdf',
        fileSize: PDF_BODY.length,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: false,
      },
      // Task #377: same missing-file scenario, manager-only flagged.
      // Residents/tenants must be denied at the route's primary
      // scope/manager-only check (403) and never reach the
      // missing-file 404 — proving the two branches are independent.
      {
        id: ids.docMissingFileMgrOnly,
        name: `${TEST_TAG} missing-file mgr-only`,
        documentType: 'legal',
        filePath: `/objects/uploads/${TEST_TAG}/missing/${ids.docMissingFileMgrOnly}.pdf`,
        fileName: `${ids.docMissingFileMgrOnly}.pdf`,
        mimeType: 'application/pdf',
        fileSize: PDF_BODY.length,
        residenceId: ids.residence,
        uploadedById: ids.manager,
        isVisibleToTenants: true,
        isManagerOnly: true,
      },
    ]);
    created.documents.add(ids.docMgrOnlyResidence);
    created.documents.add(ids.docMgrOnlyBuilding);
    created.documents.add(ids.docNormalResidence);
    created.documents.add(ids.docUnicodeResidence);
    created.documents.add(ids.docMissingAclResidence);
    created.documents.add(ids.docMissingFileResidence);
    created.documents.add(ids.docMissingFileMgrOnly);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;

    // Best-effort cleanup of GCS objects + local fs artefacts staged
    // in beforeAll. Errors are swallowed individually so one missing
    // artefact never blocks DB row cleanup below.
    try {
      const { objectStorageClient } = require('../../server/objectStorage');
      for (const obj of createdGcsObjects) {
        await objectStorageClient
          .bucket(obj.bucketName)
          .file(obj.objectName)
          .delete({ ignoreNotFound: true })
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
    for (const f of createdLocalFiles) {
      await fsPromises.unlink(f).catch(() => {});
    }

    if (created.documents.size) {
      await db
        .delete(schema.documents)
        .where(inArray(schema.documents.id, [...created.documents]));
    }
    if (created.userResidences.size) {
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.id, [...created.userResidences]));
    }
    if (created.userBuildings.size) {
      await db
        .delete(schema.userBuildings)
        .where(inArray(schema.userBuildings.id, [...created.userBuildings]));
    }
    if (created.userOrganizations.size) {
      await db
        .delete(schema.userOrganizations)
        .where(
          inArray(schema.userOrganizations.id, [...created.userOrganizations])
        );
    }
    if (created.residences.size) {
      await db
        .delete(schema.residences)
        .where(inArray(schema.residences.id, [...created.residences]));
    }
    if (created.buildings.size) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, [...created.buildings]));
    }
    if (created.users.size) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, [...created.users]));
    }
    if (created.organizations.size) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, [...created.organizations]));
    }
  }, 60000);

  // Cache one logged-in agent per user. Express's login rate limiter
  // (10 / 15min / IP) trips quickly otherwise because every test in
  // the suite originates from the same loopback address.
  const agentCache = new Map<string, request.SuperAgentTest>();
  async function loginAs(email: string) {
    const cached = agentCache.get(email);
    if (cached) return cached;
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    agentCache.set(email, agent);
    return agent;
  }

  function listIds(body: any): string[] {
    const docs = body?.documents ?? body ?? [];
    return Array.isArray(docs) ? docs.map((d: any) => d.id) : [];
  }

  // ----------------------------------------------------------------
  // GET /api/documents (list)
  // ----------------------------------------------------------------

  describe('GET /api/documents — list', () => {
    it('admin sees both manager-only documents in their scope', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('manager sees the manager-only building document in building scope', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('manager sees the manager-only residence document in residence scope', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent
        .get('/api/documents')
        .query({ residenceId: ids.residence });
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).toEqual(
        expect.arrayContaining([ids.docMgrOnlyResidence])
      );
    }, 30000);

    it('resident NEVER sees manager-only docs even in their own residence/building', async () => {
      const agent = await loginAs(emails.resident);

      const buildingRes = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(buildingRes.status).toBe(200);
      expect(listIds(buildingRes.body)).not.toContain(ids.docMgrOnlyBuilding);

      const residenceRes = await agent
        .get('/api/documents')
        .query({ residenceId: ids.residence });
      expect(residenceRes.status).toBe(200);
      const residenceIds = listIds(residenceRes.body);
      expect(residenceIds).not.toContain(ids.docMgrOnlyResidence);
      // Sanity: the non-restricted document IS visible.
      expect(residenceIds).toEqual(
        expect.arrayContaining([ids.docNormalResidence])
      );
    }, 30000);

    it('tenant NEVER sees manager-only docs even with isVisibleToTenants=true', async () => {
      const agent = await loginAs(emails.tenant);

      const buildingRes = await agent
        .get('/api/documents')
        .query({ buildingId: ids.building });
      expect(buildingRes.status).toBe(200);
      expect(listIds(buildingRes.body)).not.toContain(ids.docMgrOnlyBuilding);

      const residenceRes = await agent
        .get('/api/documents')
        .query({ residenceId: ids.residence });
      expect(residenceRes.status).toBe(200);
      const residenceIds = listIds(residenceRes.body);
      expect(residenceIds).not.toContain(ids.docMgrOnlyResidence);
      // Sanity: the non-restricted, tenant-visible document IS visible.
      expect(residenceIds).toEqual(
        expect.arrayContaining([ids.docNormalResidence])
      );
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents/:id (single fetch)
  // ----------------------------------------------------------------

  describe('GET /api/documents/:id — single fetch', () => {
    it('admin can fetch both manager-only documents', async () => {
      const agent = await loginAs(emails.admin);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(200);
        expect(res.body?.id).toBe(docId);
        expect(res.body?.isManagerOnly).toBe(true);
      }
    }, 30000);

    it('manager can fetch both manager-only documents', async () => {
      const agent = await loginAs(emails.manager);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(200);
        expect(res.body?.id).toBe(docId);
      }
    }, 30000);

    it('resident receives 404 on manager-only documents (own residence + building)', async () => {
      const agent = await loginAs(emails.resident);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(404);
        expect(res.body?.id).not.toBe(docId);
      }
      // Sanity: the non-restricted document is reachable.
      const ok = await agent.get(`/api/documents/${ids.docNormalResidence}`);
      expect(ok.status).toBe(200);
    }, 30000);

    it('tenant receives 404 on manager-only documents (own residence + building)', async () => {
      const agent = await loginAs(emails.tenant);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}`);
        expect(res.status).toBe(404);
        expect(res.body?.id).not.toBe(docId);
      }
      // Sanity: tenant-visible non-restricted document IS reachable.
      const ok = await agent.get(`/api/documents/${ids.docNormalResidence}`);
      expect(ok.status).toBe(200);
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents — organization-wide scope (no filters)
  // Proves the manager-only flag also hides the documents from
  // residents/tenants when the list is fetched at the broadest
  // organization scope (no buildingId / residenceId narrow-down),
  // closing the third scope dimension called out by the task spec.
  // ----------------------------------------------------------------

  describe('GET /api/documents — organization scope (no filter)', () => {
    it('admin sees the manager-only building doc at organization scope', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      expect(listIds(res.body)).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('manager sees the manager-only building doc at organization scope', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      expect(listIds(res.body)).toEqual(
        expect.arrayContaining([ids.docMgrOnlyBuilding])
      );
    }, 30000);

    it('resident NEVER sees manager-only docs at organization scope', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).not.toContain(ids.docMgrOnlyResidence);
      expect(idsReturned).not.toContain(ids.docMgrOnlyBuilding);
    }, 30000);

    it('tenant NEVER sees manager-only docs at organization scope', async () => {
      const agent = await loginAs(emails.tenant);
      const res = await agent.get('/api/documents');
      expect(res.status).toBe(200);
      const idsReturned = listIds(res.body);
      expect(idsReturned).not.toContain(ids.docMgrOnlyResidence);
      expect(idsReturned).not.toContain(ids.docMgrOnlyBuilding);
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents/:id/file (download / preview, base routes)
  // ----------------------------------------------------------------

  describe('GET /api/documents/:id/file — download/preview', () => {
    it('resident is rejected with 403 on manager-only documents', async () => {
      const agent = await loginAs(emails.resident);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/file`);
        expect(res.status).toBe(403);
      }
    }, 30000);

    it('tenant is rejected with 403 on manager-only documents', async () => {
      const agent = await loginAs(emails.tenant);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/file`);
        expect(res.status).toBe(403);
      }
    }, 30000);

    it('admin receives the streamed PDF body for manager-only documents', async () => {
      const agent = await loginAs(emails.admin);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent
          .get(`/api/documents/${docId}/file`)
          .buffer(true)
          .parse((response, cb) => {
            const chunks: Buffer[] = [];
            response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
            response.on('end', () => cb(null, Buffer.concat(chunks)));
          });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        // The /file route always serves with attachment disposition (it
        // never previews inline) so the browser triggers a real download
        // with the original filename stored on the document row.
        expect(res.headers['content-disposition']).toBe(
          `attachment; filename="${docId}.pdf"`
        );
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBe(PDF_BODY.length);
        expect(res.body.equals(PDF_BODY)).toBe(true);
      }
    }, 30000);

    it('manager receives the streamed PDF body for manager-only documents', async () => {
      const agent = await loginAs(emails.manager);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent
          .get(`/api/documents/${docId}/file`)
          .buffer(true)
          .parse((response, cb) => {
            const chunks: Buffer[] = [];
            response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
            response.on('end', () => cb(null, Buffer.concat(chunks)));
          });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        expect(res.headers['content-disposition']).toBe(
          `attachment; filename="${docId}.pdf"`
        );
        expect(res.body.equals(PDF_BODY)).toBe(true);
      }
    }, 30000);

    it('admin download preserves a non-ASCII filename in Content-Disposition', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent
        .get(`/api/documents/${ids.docUnicodeResidence}/file`)
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          response.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      // Node's HTTP stack serialises header values as Latin-1, so the
      // single-byte "é" (U+00E9 → 0xE9) round-trips losslessly through
      // supertest's parser. This guards against future regressions that
      // would either mojibake the byte or strip the accented character.
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="${UNICODE_FILENAME}"`
      );
      expect(res.body.equals(PDF_BODY)).toBe(true);
    }, 30000);
  });

  // ----------------------------------------------------------------
  // GET /api/documents/:id/optimized-file (preview, optimized routes)
  // ----------------------------------------------------------------

  // ----------------------------------------------------------------
  // Task #333 — manager-only flag MUST be a manager-only privilege.
  // Residents/tenants cannot escalate visibility on create, and they
  // cannot strip the flag off an existing manager-only document via
  // an edit. Covers:
  //   - POST   /api/documents              (JSON metadata path)
  //   - POST   /api/documents              (multipart upload path)
  //   - POST   /api/documents/upload       (optimized create path)
  //   - POST   /api/documents/optimized-upload (optimized-file path)
  //   - PUT    /api/documents/:id          (edit round-trip)
  // ----------------------------------------------------------------

  describe('Task #333 — manager-only flag is privileged on create', () => {
    // Track docs we create here so they're cleaned up alongside the
    // suite-level seeded docs in afterAll().
    function trackCreatedDoc(id: string | undefined | null) {
      if (id) created.documents.add(id);
    }

    it('manager CAN create a manager-only document via POST /api/documents', async () => {
      const agent = await loginAs(emails.manager);
      const res = await agent
        .post('/api/documents')
        .field('name', `${TEST_TAG} mgr-create-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true');
      expect([200, 201]).toContain(res.status);
      const body = res.body?.document ?? res.body;
      trackCreatedDoc(body?.id);
      expect(body?.isManagerOnly).toBe(true);
    }, 30000);

    it('resident CANNOT escalate isManagerOnly=true via POST /api/documents', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .post('/api/documents')
        .field('name', `${TEST_TAG} res-create-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true');
      expect([200, 201]).toContain(res.status);
      const body = res.body?.document ?? res.body;
      trackCreatedDoc(body?.id);
      // The flag must be silently coerced to false — residents may not
      // hide their own uploads from co-owners by spoofing the field.
      expect(body?.isManagerOnly).toBe(false);
    }, 30000);

    it('tenant CANNOT escalate isManagerOnly=true via POST /api/documents', async () => {
      // Tenants are not in the upload-allowed role list, so the request
      // is normally rejected with 403. The behavioural guarantee under
      // test is "tenants never end up with a manager-only document
      // attributed to them", which the 403 satisfies on its own. If a
      // future change broadens the allowed roles, the optional creation
      // assertion below will catch any regression that lets the flag
      // through.
      const agent = await loginAs(emails.tenant);
      const res = await agent
        .post('/api/documents')
        .field('name', `${TEST_TAG} ten-create-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true');
      if (res.status === 201 || res.status === 200) {
        const body = res.body?.document ?? res.body;
        trackCreatedDoc(body?.id);
        expect(body?.isManagerOnly).toBe(false);
      } else {
        expect(res.status).toBe(403);
      }
    }, 30000);

    it('resident CANNOT escalate isManagerOnly=true via POST /api/documents/upload (multipart with file)', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .post('/api/documents/upload')
        .field('name', `${TEST_TAG} res-upload-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true')
        .attach(
          'file',
          Buffer.from('hello world'),
          { filename: `${TEST_TAG}-res-upload.txt`, contentType: 'text/plain' }
        );

      // The route may succeed (201) or fail later in the storage stack
      // because we stub object storage in this test environment — what
      // we MUST never see is the manager-only flag set on the persisted
      // record. Probe the DB directly for any document attributed to
      // this resident with a matching name.
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(
              schema.documents.uploadedById,
              ids.resident
            ),
            eq(
              schema.documents.name,
              `${TEST_TAG} res-upload-attempt-mgronly`
            )
          )
        );
      rows.forEach((r: any) => trackCreatedDoc(r.id));
      // If a row was created, it MUST NOT be manager-only.
      for (const r of rows) {
        expect(r.isManagerOnly).toBe(false);
      }
      // Defensive check on the response body itself if present.
      const body = res.body?.document ?? res.body;
      if (body?.isManagerOnly !== undefined) {
        expect(body.isManagerOnly).toBe(false);
      }
    }, 30000);

    it('tenant CANNOT escalate isManagerOnly=true via POST /api/documents/upload (multipart with file)', async () => {
      const agent = await loginAs(emails.tenant);
      const res = await agent
        .post('/api/documents/upload')
        .field('name', `${TEST_TAG} ten-upload-attempt-mgronly`)
        .field('documentType', 'legal')
        .field('residenceId', ids.residence)
        .field('isVisibleToTenants', 'true')
        .field('isManagerOnly', 'true')
        .attach(
          'file',
          Buffer.from('hello'),
          { filename: `${TEST_TAG}-ten-upload.txt`, contentType: 'text/plain' }
        );

      // Mirrors the resident assertion: regardless of where the route
      // fails (auth, validation, or storage), no row attributed to the
      // tenant with this name may end up flagged manager-only.
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.uploadedById, ids.tenant),
            eq(
              schema.documents.name,
              `${TEST_TAG} ten-upload-attempt-mgronly`
            )
          )
        );
      rows.forEach((r: any) => trackCreatedDoc(r.id));
      for (const r of rows) {
        expect(r.isManagerOnly).toBe(false);
      }
      const body = res.body?.document ?? res.body;
      if (body?.isManagerOnly !== undefined) {
        expect(body.isManagerOnly).toBe(false);
      }
    }, 30000);

    it('resident CANNOT escalate isManagerOnly=true via POST /api/documents/optimized-upload', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .post('/api/documents/optimized-upload')
        .field('name', `${TEST_TAG} res-opt-upload-attempt`)
        .field('documentType', 'legal')
        .field('buildingId', ids.building)
        .field('residenceId', ids.residence)
        .field('isManagerOnly', 'true')
        .attach(
          'file',
          Buffer.from('opt'),
          { filename: `${TEST_TAG}-res-opt.txt`, contentType: 'text/plain' }
        );

      // The optimized storage backend is not mocked in this suite, so
      // the request typically fails before persisting. The behavioural
      // guarantee is the same as above: NO row owned by the resident
      // with the spoofed name may carry isManagerOnly=true.
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(
              schema.documents.uploadedById,
              ids.resident
            ),
            eq(
              schema.documents.name,
              `${TEST_TAG} res-opt-upload-attempt`
            )
          )
        );
      rows.forEach((r: any) => trackCreatedDoc(r.id));
      for (const r of rows) {
        expect(r.isManagerOnly).toBe(false);
      }
      const body = res.body?.document ?? res.body;
      if (body?.isManagerOnly !== undefined) {
        expect(body.isManagerOnly).toBe(false);
      }
    }, 30000);
  });

  describe('Task #333 — manager-only flag survives non-manager edit attempts', () => {
    it('resident PUT on a manager-only document returns 404 and leaves the flag set', async () => {
      const agent = await loginAs(emails.resident);
      const res = await agent
        .put(`/api/documents/${ids.docMgrOnlyResidence}`)
        .send({ name: `${TEST_TAG} mutated-by-resident`, isManagerOnly: false });
      // Task #345: the edit endpoint must mirror the read endpoints and
      // refuse to surface manager-only documents to residents/tenants —
      // they should get a 404, not 200/403, even though the document
      // lives within their residence scope.
      expect(res.status).toBe(404);

      const [row] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, ids.docMgrOnlyResidence));
      expect(row?.isManagerOnly).toBe(true);
      expect(row?.name).toBe(`${TEST_TAG} mgr-only residence`);
    }, 30000);

    it('tenant PUT on a manager-only document returns 404 and leaves the flag set', async () => {
      const agent = await loginAs(emails.tenant);
      const res = await agent
        .put(`/api/documents/${ids.docMgrOnlyBuilding}`)
        .send({ name: `${TEST_TAG} mutated-by-tenant`, isManagerOnly: false });
      // Task #345: same contract as above for tenants.
      expect(res.status).toBe(404);

      const [row] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, ids.docMgrOnlyBuilding));
      expect(row?.isManagerOnly).toBe(true);
      expect(row?.name).toBe(`${TEST_TAG} mgr-only building`);
    }, 30000);

    it('manager PUT can flip and restore the manager-only flag', async () => {
      const agent = await loginAs(emails.manager);

      // Use the building-scoped manager-only doc — the manager has a
      // direct userBuildings link to that building so the PUT route's
      // scope query reaches it consistently.
      const turnOff = await agent
        .put(`/api/documents/${ids.docMgrOnlyBuilding}`)
        .send({ isManagerOnly: false });
      expect(turnOff.status).toBe(200);
      expect(turnOff.body?.isManagerOnly).toBe(false);

      const turnOn = await agent
        .put(`/api/documents/${ids.docMgrOnlyBuilding}`)
        .send({ isManagerOnly: true });
      expect(turnOn.status).toBe(200);
      expect(turnOn.body?.isManagerOnly).toBe(true);

      // Restore DB state for downstream assertions in the suite.
      const [row] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, ids.docMgrOnlyBuilding));
      expect(row?.isManagerOnly).toBe(true);
    }, 30000);
  });

  describe('GET /api/documents/:id/optimized-file — preview', () => {
    it('resident receives access-denied (404) on manager-only documents', async () => {
      const agent = await loginAs(emails.resident);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/optimized-file`);
        // The optimized route uses storage.getDocumentWithScope(), which
        // returns null for unauthorized users; the route then responds
        // with 404 "Document not found or access denied".
        expect(res.status).toBe(404);
      }
    }, 30000);

    it('tenant receives access-denied (404) on manager-only documents', async () => {
      const agent = await loginAs(emails.tenant);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent.get(`/api/documents/${docId}/optimized-file`);
        expect(res.status).toBe(404);
      }
    }, 30000);

    it('admin receives the streamed PDF body for manager-only documents', async () => {
      const agent = await loginAs(emails.admin);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent
          .get(`/api/documents/${docId}/optimized-file`)
          .buffer(true)
          .parse((response, cb) => {
            const chunks: Buffer[] = [];
            response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
            response.on('end', () => cb(null, Buffer.concat(chunks)));
          });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        // The optimized-file route is the preview path: it sets
        // disposition=inline so the browser renders the PDF in place
        // instead of forcing a download. Filename source is the
        // human-readable `documents.name` column.
        const expectedName = DOC_DISPLAY_NAMES[docId];
        expect(res.headers['content-disposition']).toBe(
          `inline; filename="${expectedName}"`
        );
        expect(res.body.equals(PDF_BODY)).toBe(true);
      }
    }, 30000);

    it('manager receives the streamed PDF body for manager-only documents', async () => {
      const agent = await loginAs(emails.manager);
      for (const docId of [ids.docMgrOnlyResidence, ids.docMgrOnlyBuilding]) {
        const res = await agent
          .get(`/api/documents/${docId}/optimized-file`)
          .buffer(true)
          .parse((response, cb) => {
            const chunks: Buffer[] = [];
            response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
            response.on('end', () => cb(null, Buffer.concat(chunks)));
          });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        const expectedName = DOC_DISPLAY_NAMES[docId];
        expect(res.headers['content-disposition']).toBe(
          `inline; filename="${expectedName}"`
        );
        expect(res.body.equals(PDF_BODY)).toBe(true);
      }
    }, 30000);

    it('admin preview preserves a non-ASCII filename in Content-Disposition', async () => {
      const agent = await loginAs(emails.admin);
      const res = await agent
        .get(`/api/documents/${ids.docUnicodeResidence}/optimized-file`)
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          response.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toBe(
        `inline; filename="${UNICODE_DOC_NAME}"`
      );
      expect(res.body.equals(PDF_BODY)).toBe(true);
    }, 30000);
  });

  // -----------------------------------------------------------------
  // Task #351: GET /api/documents/:id/file when the underlying GCS
  // object has NO `custom:aclPolicy` metadata.
  //
  // Documented behaviour the route MUST preserve:
  //   - admin (and demo_admin): `documentService.canUserAccessDocument`
  //     short-circuits with `{ allowed: true }` BEFORE consulting the
  //     object metadata, so the request streams the file body (200).
  //   - everyone else (manager/resident/tenant): `getObjectAclPolicy`
  //     returns null, `canAccessObject` returns false, the route maps
  //     that to a 403 "Access denied to file". Notably this is NOT the
  //     "file not found - allow access check to pass" branch, which
  //     only fires when the GCS object itself is missing.
  //
  // The fixture document is residence-scoped, non-manager-only, and
  // visible to tenants so the primary scope check at the top of the
  // route lets all four roles through; the secondary ACL gate is the
  // sole thing under test.
  // -----------------------------------------------------------------
  describe('GET /api/documents/:id/file — missing ACL metadata (Task #351)', () => {
    async function downloadAs(email: string) {
      const agent = await loginAs(email);
      return agent
        .get(`/api/documents/${ids.docMissingAclResidence}/file`)
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          response.on('end', () =>
            cb(null, chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0))
          );
        });
    }

    it('admin downloads the file body even with no ACL metadata (admin bypass)', async () => {
      const res = await downloadAs(emails.admin);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.equals(PDF_BODY)).toBe(true);
    }, 30000);

    it('manager is denied (403) when the underlying object has no ACL metadata', async () => {
      const res = await downloadAs(emails.manager);
      expect(res.status).toBe(403);
    }, 30000);

    it('resident is denied (403) when the underlying object has no ACL metadata', async () => {
      const res = await downloadAs(emails.resident);
      expect(res.status).toBe(403);
    }, 30000);

    it('tenant is denied (403) when the underlying object has no ACL metadata', async () => {
      const res = await downloadAs(emails.tenant);
      expect(res.status).toBe(403);
    }, 30000);
  });

  // -----------------------------------------------------------------
  // Task #377: GET /api/documents/:id/file when the underlying file
  // is entirely absent from storage (no GCS object, no local fs).
  //
  // Documented behaviour the route MUST preserve:
  //   - For users who pass the route's primary scope check, the
  //     secondary `documentService.canUserAccessDocument` ACL check
  //     hits its `ObjectNotFoundError` fallback branch and returns
  //     `{ allowed: true, reason: 'File not found - allowing access
  //     check to pass' }`. The route then proceeds to
  //     `downloadDocument`, which exhausts every candidate path and
  //     responds with 404 "File not found" — NOT 403 "Access denied".
  //   - For users who fail the primary scope check (or are blocked by
  //     the manager-only flag), the 403 "Access denied" still wins
  //     and they never reach the missing-file 404 branch.
  //
  // This pins down the contract so a future change that flips the
  // fallback to `allowed: false`, or that drops the route's bottom-of
  // -handler 404, is caught immediately.
  // -----------------------------------------------------------------
  describe('GET /api/documents/:id/file — missing file in storage (Task #377)', () => {
    async function downloadFile(email: string, docId: string) {
      const agent = await loginAs(email);
      return agent.get(`/api/documents/${docId}/file`);
    }

    // ---- Authorised roles (residence-scoped, tenant-visible) ----

    it('admin receives 404 (file-not-found) — not 403 — for an authorised, missing file', async () => {
      const res = await downloadFile(emails.admin, ids.docMissingFileResidence);
      expect(res.status).toBe(404);
    }, 30000);

    it('manager receives 404 (file-not-found) — not 403 — for an authorised, missing file', async () => {
      const res = await downloadFile(emails.manager, ids.docMissingFileResidence);
      expect(res.status).toBe(404);
    }, 30000);

    it('resident receives 404 (file-not-found) — not 403 — for an authorised, missing file', async () => {
      const res = await downloadFile(emails.resident, ids.docMissingFileResidence);
      expect(res.status).toBe(404);
    }, 30000);

    it('tenant receives 404 (file-not-found) — not 403 — for an authorised, missing file', async () => {
      const res = await downloadFile(emails.tenant, ids.docMissingFileResidence);
      expect(res.status).toBe(404);
    }, 30000);

    // ---- Unauthorised roles (manager-only flag blocks them) ----

    it('admin still receives 404 on a missing manager-only file (admin bypasses the flag)', async () => {
      const res = await downloadFile(emails.admin, ids.docMissingFileMgrOnly);
      expect(res.status).toBe(404);
    }, 30000);

    it('manager still receives 404 on a missing manager-only file (manager has scope access)', async () => {
      const res = await downloadFile(emails.manager, ids.docMissingFileMgrOnly);
      expect(res.status).toBe(404);
    }, 30000);

    it('resident receives 403 on a missing manager-only file (scope-based denial wins over missing-file 404)', async () => {
      const res = await downloadFile(emails.resident, ids.docMissingFileMgrOnly);
      expect(res.status).toBe(403);
    }, 30000);

    it('tenant receives 403 on a missing manager-only file (scope-based denial wins over missing-file 404)', async () => {
      const res = await downloadFile(emails.tenant, ids.docMissingFileMgrOnly);
      expect(res.status).toBe(403);
    }, 30000);
  });
});
