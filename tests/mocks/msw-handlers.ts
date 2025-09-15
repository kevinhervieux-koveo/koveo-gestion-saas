/**
 * MSW (Mock Service Worker) handlers for API mocking in tests
 * These handlers intercept network requests and provide mock responses
 */

import { http, HttpResponse } from 'msw';

// API route handlers for common endpoints
export const handlers = [
  // Authentication endpoints
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      success: true,
      user: { id: 'mock-user-id', email: 'test@example.com', role: 'manager' }
    });
  }),

  http.post('/api/auth/register', () => {
    return HttpResponse.json({
      success: true,
      user: { id: 'mock-user-id', email: 'test@example.com', role: 'manager' }
    });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      user: { id: 'mock-user-id', email: 'test@example.com', role: 'manager' }
    });
  }),

  // Invitation endpoints
  http.get('/api/invitations/validate/:token', () => {
    return HttpResponse.json({
      valid: true,
      invitation: {
        id: 'mock-invite-id',
        email: 'test-registration@example.com',
        role: 'manager',
        organizationId: 'mock-org-id',
        status: 'pending'
      }
    });
  }),

  http.post('/api/invitations', () => {
    return HttpResponse.json({
      success: true,
      invitation: { id: 'mock-invite-id', email: 'test@example.com' }
    });
  }),

  // User management endpoints
  http.get('/api/users', () => {
    return HttpResponse.json({ users: [] });
  }),

  http.post('/api/users', () => {
    return HttpResponse.json({
      success: true,
      user: { id: 'mock-user-id', email: 'test@example.com' }
    });
  }),

  // Building and property endpoints
  http.get('/api/buildings', () => {
    return HttpResponse.json({ buildings: [] });
  }),

  http.post('/api/buildings', () => {
    return HttpResponse.json({
      success: true,
      building: { id: 'mock-building-id', name: 'Test Building' }
    });
  }),

  http.get('/api/residences', () => {
    return HttpResponse.json({ residences: [] });
  }),

  http.post('/api/residences', () => {
    return HttpResponse.json({
      success: true,
      residence: { id: 'mock-residence-id', unit: 'A101' }
    });
  }),

  // Document endpoints
  http.get('/api/documents', () => {
    return HttpResponse.json({ documents: [] });
  }),

  http.post('/api/documents', () => {
    return HttpResponse.json({
      success: true,
      document: { id: 'mock-doc-id', name: 'test.pdf' }
    });
  }),

  // Financial endpoints
  http.get('/api/bills', () => {
    return HttpResponse.json({ bills: [] });
  }),

  http.post('/api/bills', () => {
    return HttpResponse.json({
      success: true,
      bill: { id: 'mock-bill-id', amount: 100.00 }
    });
  }),

  // Maintenance endpoints
  http.get('/api/maintenance-requests', () => {
    return HttpResponse.json({ requests: [] });
  }),

  http.post('/api/maintenance-requests', () => {
    return HttpResponse.json({
      success: true,
      request: { id: 'mock-request-id', description: 'Test request' }
    });
  }),

  // Catch-all handler for unmatched API requests
  http.all('/api/*', ({ request }) => {
    console.warn(`Unhandled API request: ${request.method} ${request.url}`);
    return HttpResponse.json({ success: true, data: [] }, { status: 200 });
  }),

  // Block external network requests during tests
  http.all('*', ({ request }) => {
    const url = new URL(request.url);
    
    // Allow localhost and test URLs
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.includes('test')) {
      return;
    }
    
    // Block external requests
    console.warn(`Blocked external request: ${request.method} ${request.url}`);
    return HttpResponse.error();
  }),
];