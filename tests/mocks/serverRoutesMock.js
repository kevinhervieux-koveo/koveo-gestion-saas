// Mock for server routes
module.exports = {
  registerRoutes: jest.fn().mockImplementation((app) => {
    // Mock route registration - add basic test routes
    app.get('/api/test', (req, res) => res.json({ message: 'test route working' }));
    app.get('/api/organizations', (req, res) => res.json([]));
    app.get('/api/users', (req, res) => res.json([]));
    app.get('/api/buildings', (req, res) => res.json([]));
    app.get('/api/documents', (req, res) => res.json([]));
    app.post('/api/organizations', (req, res) => res.status(201).json(req.body));
    app.post('/api/users', (req, res) => res.status(201).json(req.body));
    app.post('/api/buildings', (req, res) => res.status(201).json(req.body));
    app.post('/api/documents', (req, res) => res.status(201).json(req.body));
  }),
  // Default export
  __esModule: true,
  default: {
    registerRoutes: jest.fn(),
  }
};