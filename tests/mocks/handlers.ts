import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.get('/api/auth/user', () => {
    return HttpResponse.json({
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      language: 'en'
    });
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      user: {
        id: '1',
        email: (body as any).email,
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        language: 'en'
      }
    });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  // Users endpoints
  http.get('/api/users', () => {
    return HttpResponse.json([
      {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        language: 'en'
      }
    ]);
  }),

  // Organizations endpoints  
  http.get('/api/organizations', () => {
    return HttpResponse.json([]);
  }),

  // Buildings endpoints
  http.get('/api/buildings', () => {
    return HttpResponse.json([]);
  }),

  // Generic error handler
  http.get('*', (req) => {
    console.warn(`Unhandled ${req.request.method} ${req.request.url}`);
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
];