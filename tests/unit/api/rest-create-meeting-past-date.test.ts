import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

let insertCallCount = 0;
const mockDb: any = {
  select: jest.fn().mockImplementation(() => ({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ organizationId: 'org-1' }]),
      }),
    }),
  })),
  insert: jest.fn().mockImplementation(() => {
    insertCallCount++;
    return {
      values: () => ({
        returning: () => Promise.resolve([{ id: 'meeting-1' }]),
      }),
    };
  }),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

let currentTestUser: any = null;
jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = currentTestUser;
    next();
  },
}));

jest.mock('../../../server/services/consolidated-communication-service', () => ({
  communicationService: {
    sendMeetingInvitation: jest.fn().mockResolvedValue(undefined),
  },
}));

import { registerCommunicationRoutes } from '../../../server/api/communication';

function buildApp(user: any): Express {
  currentTestUser = user;
  const app = express();
  app.use(express.json());
  registerCommunicationRoutes(app);
  return app;
}

describe('POST /api/communication/meetings — past scheduledDate guard', () => {
  beforeEach(() => {
    insertCallCount = 0;
  });

  it('returns 400 with code PAST_SCHEDULED_DATE when scheduledDate is in the past', async () => {
    const app = buildApp({ id: 'u-manager', role: 'manager' });

    const response = await request(app)
      .post('/api/communication/meetings')
      .send({
        organizationId: 'org-1',
        title: 'Backdated meeting',
        location: 'Salle 1',
        scheduledDate: new Date('1995-01-01T10:00:00Z'),
        duration: 60,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'scheduledDate must be in the future',
      code: 'PAST_SCHEDULED_DATE',
    });
    expect(insertCallCount).toBe(0);
  });
});
