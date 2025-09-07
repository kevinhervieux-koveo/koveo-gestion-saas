/**
 * Mock for supertest to prevent actual server requests during tests
 */

const mockResponse = {
  status: 200,
  headers: {},
  body: { success: true, data: [] },
  text: JSON.stringify({ success: true, data: [] }),
  type: 'application/json'
};

const createMockRequest = (method, path) => {
  const mockRequest = {
    _method: method,
    _path: path,
    _headers: {},
    _fields: {},
    _files: {},
    _attachments: [],
    
    // Chainable methods
    send: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    accept: jest.fn().mockReturnThis(),
    auth: jest.fn().mockReturnThis(),
    attach: jest.fn().mockImplementation((field, file, filename) => {
      mockRequest._attachments.push({ field, file, filename });
      return mockRequest;
    }),
    field: jest.fn().mockImplementation((name, value) => {
      mockRequest._fields[name] = value;
      return mockRequest;
    }),
    
    // Promise-like interface
    then: jest.fn().mockImplementation((resolve) => {
      return Promise.resolve(mockResponse).then(resolve);
    }),
    catch: jest.fn().mockImplementation((reject) => {
      return Promise.resolve(mockResponse).catch(reject);
    }),
    
    // Expectations
    expect: jest.fn().mockImplementation((statusCode) => {
      const expectObj = {
        status: statusCode,
        then: jest.fn().mockImplementation((resolve) => {
          const responseWithStatus = { ...mockResponse, status: statusCode };
          return Promise.resolve(responseWithStatus).then(resolve);
        }),
        catch: jest.fn().mockImplementation((reject) => {
          const responseWithStatus = { ...mockResponse, status: statusCode };
          return Promise.resolve(responseWithStatus).catch(reject);
        })
      };
      return expectObj;
    }),
    
    // End method for manual resolution
    end: jest.fn().mockImplementation((callback) => {
      if (callback) {
        callback(null, mockResponse);
      }
      return Promise.resolve(mockResponse);
    })
  };
  
  return mockRequest;
};

const mockApp = {
  get: jest.fn().mockImplementation((path) => createMockRequest('GET', path)),
  post: jest.fn().mockImplementation((path) => createMockRequest('POST', path)),
  put: jest.fn().mockImplementation((path) => createMockRequest('PUT', path)),
  patch: jest.fn().mockImplementation((path) => createMockRequest('PATCH', path)),
  delete: jest.fn().mockImplementation((path) => createMockRequest('DELETE', path)),
  options: jest.fn().mockImplementation((path) => createMockRequest('OPTIONS', path)),
  head: jest.fn().mockImplementation((path) => createMockRequest('HEAD', path)),
  
  // Express app methods
  use: jest.fn(),
  listen: jest.fn().mockImplementation((port, callback) => {
    if (callback) callback();
    return { close: jest.fn() };
  }),
  set: jest.fn(),
  get: jest.fn(),
  locals: {},
  
  // For middleware testing
  request: {},
  response: {}
};

const mockSupertest = jest.fn().mockImplementation((app) => {
  // Return an object with HTTP method functions
  return {
    get: (path) => createMockRequest('GET', path),
    post: (path) => createMockRequest('POST', path),
    put: (path) => createMockRequest('PUT', path),
    patch: (path) => createMockRequest('PATCH', path),
    delete: (path) => createMockRequest('DELETE', path),
    options: (path) => createMockRequest('OPTIONS', path),
    head: (path) => createMockRequest('HEAD', path)
  };
});

// Mock agent for session persistence
mockSupertest.agent = jest.fn().mockImplementation((app) => {
  const agent = mockSupertest(app);
  agent.jar = {}; // Cookie jar simulation
  return agent;
});

module.exports = {
  default: mockSupertest,
  __esModule: true,
  supertest: mockSupertest,
  mockApp
};