// Mock for shared schema
module.exports = {
  organizations: {},
  users: {},
  buildings: {},
  documents: {},
  demands: {},
  residences: {},
  bills: {},
  insertOrganizationSchema: {
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
    omit: jest.fn().mockReturnThis(),
  },
  insertUserSchema: {
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
    omit: jest.fn().mockReturnThis(),
  },
  insertBuildingSchema: {
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
    omit: jest.fn().mockReturnThis(),
  },
  insertDocumentSchema: {
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
    omit: jest.fn().mockReturnThis(),
  },
  insertDemandSchema: {
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
    omit: jest.fn().mockReturnThis(),
  },
  insertResidenceSchema: {
    parse: jest.fn(),
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} }),
    omit: jest.fn().mockReturnThis(),
  },
  // Default export
  __esModule: true,
  default: {}
};