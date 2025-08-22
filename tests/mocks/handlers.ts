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
    return HttpResponse.json([
      {
        id: 'building-1',
        name: 'Test Building',
        address: '123 Test St',
        city: 'Test City',
        organizationId: 'org-1',
        isActive: true
      }
    ]);
  }),

  // Residences endpoints
  http.get('/api/residences', () => {
    return HttpResponse.json([]);
  }),

  // Budget endpoints
  http.get('/api/budgets/:buildingId', () => {
    return HttpResponse.json({
      income: [],
      expenses: [],
      bankAccount: null,
      minimumBalances: {}
    });
  }),

  http.get('/api/budgets/:buildingId/summary', () => {
    return HttpResponse.json({
      totalIncome: 0,
      totalExpenses: 0,
      netCashFlow: 0,
      specialContributions: []
    });
  }),

  http.get('/api/budgets/:buildingId/bank-account', () => {
    return HttpResponse.json({
      accountNumber: '9876543210',
      bankName: 'Test Bank',
      balance: 50000
    });
  }),

  http.post('/api/budgets/:buildingId/bank-account', () => {
    return HttpResponse.json({ success: true });
  }),

  // Generic error handler
  http.get('*', (req) => {
    console.warn(`Unhandled ${req.request.method} ${req.request.url}`);
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
];