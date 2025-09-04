// Mock database for Jest tests
const mockQuery = jest.fn(() => Promise.resolve({ rows: [] }));

const mockSql = jest.fn(() => Promise.resolve({ rows: [] }));
mockSql.begin = jest.fn(() => Promise.resolve());
mockSql.commit = jest.fn(() => Promise.resolve());
mockSql.rollback = jest.fn(() => Promise.resolve());

const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve([])),
      limit: jest.fn(() => Promise.resolve([])),
      orderBy: jest.fn(() => Promise.resolve([])),
    })),
  })),
  insert: jest.fn(() => ({
    into: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([])),
      })),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve([])),
    })),
  })),
  delete: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve([])),
    })),
  })),
};

// Mock schema object
const mockSchemaObject = {
  users: {
    id: 'id',
    email: 'email',
    role: 'role',
  },
  organizations: {
    id: 'id',
    name: 'name',
  },
  invitations: {
    id: 'id',
    email: 'email',
    token: 'token',
  },
  buildings: {
    id: 'id',
    name: 'name',
  },
  residences: {
    id: 'id',
    buildingId: 'buildingId',
  },
  documents: {
    id: 'id',
    name: 'name',
  },
  demands: {
    id: 'id',
    title: 'title',
  },
};

module.exports = {
  mockDb,
  mockSql,
  mockQuery,
  mockSchemaObject,
};