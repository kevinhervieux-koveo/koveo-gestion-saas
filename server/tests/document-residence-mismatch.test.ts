// @ts-nocheck — mock patching follows pre-existing pattern in document-text-endpoint.test.ts
/**
 * @jest-environment node
 *
 * @file Document POST — RESIDENCE_BUILDING_MISMATCH validation (Task #1306)
 * @description Proves the contract of the inline residence/building consistency
 *   check added to POST /api/documents as part of the multi-tenant isolation
 *   hardening work. When both `buildingId` and `residenceId` are provided
 *   directly in the request body but the residence does not belong to that
 *   building, the endpoint must respond 422 with code RESIDENCE_BUILDING_MISMATCH.
 *
 *   Mock strategy: identical to document-text-endpoint.test.ts — patch only the
 *   storage methods touched by the early validation, mock the heavyweight I/O
 *   modules so the test doesn't need object storage or file-system fixtures.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { storage } from '../storage';

jest.mock('../objectStorage', () => ({
  __esModule: true,
  ObjectStorageService: jest.fn().mockImplementation(() => ({
    getObjectEntityFile: jest.fn().mockResolvedValue({ download: jest.fn() }),
  })),
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
}));

jest.mock('../services/document-service', () => ({
  __esModule: true,
  documentService: {
    normalizePath: (p: string) => p,
    canUserAccessDocument: jest.fn().mockResolvedValue({ allowed: true }),
  },
}));

jest.mock('../services/secure-file-storage', () => ({
  __esModule: true,
  secureFileStorage: {
    storeFile: jest.fn(),
    retrieveFile: jest.fn(),
  },
}));

import { registerDocumentRoutes } from '../api/documents';

const ALPHA_BUILDING = '00000000-0000-0000-0000-0000000000a1';
const BETA_BUILDING = '00000000-0000-0000-0000-0000000000b1';
const BETA_RESIDENCE = '00000000-0000-0000-0000-0000000000b3';

const storageAny = storage as any;

function buildApp(role = 'manager') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: 'test-manager', role, email: 'manager@test.local', isActive: true };
    next();
  });
  registerDocumentRoutes(app);
  return app;
}

describe('POST /api/documents — RESIDENCE_BUILDING_MISMATCH (Task #1306)', () => {
  beforeEach(() => {
    storageAny.getResidence = jest.fn();
  });

  it('returns 422 RESIDENCE_BUILDING_MISMATCH when residenceId belongs to a different building', async () => {
    storageAny.getResidence = jest.fn().mockResolvedValue({
      id: BETA_RESIDENCE,
      buildingId: BETA_BUILDING,
    });

    const res = await request(buildApp())
      .post('/api/documents')
      .send({
        buildingId: ALPHA_BUILDING,
        residenceId: BETA_RESIDENCE,
        textContent: 'Test document content',
        name: 'Test doc',
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RESIDENCE_BUILDING_MISMATCH');
  });

  it('returns 404 when residenceId does not exist', async () => {
    storageAny.getResidence = jest.fn().mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/documents')
      .send({
        buildingId: ALPHA_BUILDING,
        residenceId: BETA_RESIDENCE,
        textContent: 'Test document content',
        name: 'Test doc',
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESIDENCE_NOT_FOUND');
  });
});
