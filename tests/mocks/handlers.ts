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

  // Health check endpoints
  http.get('/health', () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),

  http.get('/healthz', () => {
    return HttpResponse.text('OK');
  }),

  http.get('/ready', () => {
    return HttpResponse.json({ status: 'ready' });
  }),

  // Common Spaces endpoints
  http.get('/api/common-spaces', () => {
    return HttpResponse.json([
      {
        id: 'space-1',
        name: 'Gym',
        description: 'Building gymnasium',
        buildingId: 'building-1',
        buildingName: 'Test Building',
        isReservable: true,
        capacity: 20,
        openingHours: [
          { day: 'monday', open: '06:00', close: '22:00' },
          { day: 'tuesday', open: '06:00', close: '22:00' },
          { day: 'wednesday', open: '06:00', close: '22:00' },
          { day: 'thursday', open: '06:00', close: '22:00' },
          { day: 'friday', open: '06:00', close: '22:00' },
          { day: 'saturday', open: '08:00', close: '20:00' },
          { day: 'sunday', open: '08:00', close: '20:00' },
        ],
        bookingRules: 'Maximum 2 hours per booking',
      },
      {
        id: 'space-2',
        name: 'Meeting Room',
        description: 'Conference room',
        buildingId: 'building-1',
        buildingName: 'Test Building',
        isReservable: false,
        capacity: 10,
        openingHours: [],
      }
    ]);
  }),

  http.get('/api/common-spaces/:spaceId/bookings', () => {
    return HttpResponse.json([
      {
        id: 'booking-1',
        commonSpaceId: 'space-1',
        userId: 'user-456',
        userName: 'Other User',
        userEmail: 'other@example.com',
        startTime: new Date('2024-01-15T10:00:00Z').toISOString(),
        endTime: new Date('2024-01-15T11:00:00Z').toISOString(),
        status: 'confirmed',
      }
    ]);
  }),

  http.post('/api/common-spaces/:spaceId/bookings', () => {
    return HttpResponse.json({
      message: 'Booking created successfully',
      booking: {
        id: 'new-booking-1',
        commonSpaceId: 'space-1',
        userId: '1',
        startTime: new Date('2024-01-20T09:00:00Z').toISOString(),
        endTime: new Date('2024-01-20T10:00:00Z').toISOString(),
        status: 'confirmed',
      }
    }, { status: 201 });
  }),

  http.get('/api/common-spaces/my-bookings', () => {
    return HttpResponse.json([
      {
        id: 'my-booking-1',
        commonSpaceId: 'space-1',
        spaceName: 'Gym',
        buildingName: 'Test Building',
        startTime: new Date('2024-01-20T14:00:00Z').toISOString(),
        endTime: new Date('2024-01-20T15:00:00Z').toISOString(),
        status: 'confirmed',
      }
    ]);
  }),

  http.get('/api/manager/buildings', () => {
    return HttpResponse.json({
      buildings: [
        {
          id: 'building-1',
          name: 'Test Building',
          address: '123 Test St',
          city: 'Test City',
          organizationId: 'org-1',
        }
      ]
    });
  }),

  http.get('/api/common-spaces/:spaceId/stats', () => {
    return HttpResponse.json({
      spaceName: 'Gym',
      period: 'Last 12 months',
      summary: {
        totalBookings: 50,
        totalHours: 75.5,
        uniqueUsers: 15,
      },
      userStats: [
        {
          userId: 'user-1',
          userName: 'John Doe',
          userEmail: 'john@example.com',
          totalHours: 12.5,
          totalBookings: 8,
        },
        {
          userId: 'user-2',
          userName: 'Jane Smith',
          userEmail: 'jane@example.com',
          totalHours: 8.0,
          totalBookings: 5,
        }
      ]
    });
  }),

  http.post('/api/common-spaces/users/:userId/restrictions', () => {
    return HttpResponse.json({
      message: 'User blocked from booking this space'
    });
  }),

  // Root and dashboard routes
  http.get('/', () => {
    return HttpResponse.html(`<!DOCTYPE html>
<html>
<head><title>Koveo Gestion</title></head>
<body><div id="root"><h1>Koveo Gestion Test</h1></div></body>
</html>`);
  }),

  http.get('/dashboard', () => {
    return HttpResponse.html(`<!DOCTYPE html>
<html>
<head><title>Koveo Gestion - Dashboard</title></head>
<body><div id="root"><h1>Dashboard</h1></div></body>
</html>`);
  }),

  // Generic error handler (keep as last)
  http.get('*', (req) => {
    console.warn(`Unhandled ${req.request.method} ${req.request.url}`);
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
];