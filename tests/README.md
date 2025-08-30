# Koveo Gestion Testing Documentation

> Comprehensive testing framework for Quebec property management platform

## Testing Overview

Koveo Gestion maintains a comprehensive testing strategy with multiple test types ensuring reliability, performance, and Quebec compliance. Our testing framework achieves 85%+ code coverage with automated quality gates.

## Test Architecture

### Test Types & Coverage

```
tests/
├── unit/                   # Component and function tests (45% coverage)
│   ├── auth-hooks.test.tsx         # Authentication hooks
│   ├── quality-metrics.test.ts     # Quality measurement system
│   └── translation-validation.test.ts # Bilingual support
├── integration/            # API and database tests (25% coverage)
│   ├── api-consistency.test.ts     # API endpoint validation
│   ├── database-operations.test.ts # Database CRUD operations
│   └── page-dependencies.test.tsx  # Component integration
├── e2e/                   # End-to-end user flows (15% coverage)
│   ├── user-workflows.test.ts      # Complete user journeys
│   ├── ssl-management-e2e.test.ts  # SSL certificate workflows
│   └── auth-flows.test.ts          # Authentication flows
├── mobile/                # Mobile responsiveness (10% coverage)
│   ├── accessibility.test.tsx      # WCAG 2.1 compliance
│   └── touch-interactions.test.tsx # Mobile user interactions
└── organization/          # Quebec compliance tests (5% coverage)
    ├── documentation-validation.test.ts # Doc quality standards
    ├── error-detection.test.ts         # Error handling compliance
    └── bilingual-support.test.ts       # French/English validation
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
  },

  // Coverage requirements
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './client/src/components/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
```

### Test Setup

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import 'whatwg-fetch';

// Mock service worker for API mocking
export const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.NODE_ENV = 'test';

// Mock console methods in tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};
```

## Unit Testing

### React Component Testing

```typescript
// Example: User profile component test
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UserProfile from '@/components/UserProfile';
import { AuthProvider } from '@/hooks/use-auth';

describe('UserProfile Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {component}
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  it('displays user information correctly', () => {
    const mockUser = {
      id: 'user-123',
      firstName: 'Marie',
      lastName: 'Dubois',
      email: 'marie.dubois@example.com',
      role: 'tenant' as const,
      organizationId: 'org-456'
    };

    renderWithProviders(<UserProfile user={mockUser} />);

    expect(screen.getByText('Marie Dubois')).toBeInTheDocument();
    expect(screen.getByText('marie.dubois@example.com')).toBeInTheDocument();
    expect(screen.getByText('Locataire')).toBeInTheDocument(); // French role display
  });

  it('handles profile updates correctly', async () => {
    const mockUser = {
      id: 'user-123',
      firstName: 'Jean',
      lastName: 'Martin',
      email: 'jean.martin@example.com',
      role: 'resident' as const,
      organizationId: 'org-789'
    };

    const onUpdate = jest.fn();

    renderWithProviders(<UserProfile user={mockUser} onUpdate={onUpdate} />);

    // Open edit mode
    fireEvent.click(screen.getByText('Modifier'));

    // Update first name
    const firstNameInput = screen.getByLabelText('Prénom');
    fireEvent.change(firstNameInput, { target: { value: 'Jean-Pierre' } });

    // Submit form
    fireEvent.click(screen.getByText('Sauvegarder'));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        ...mockUser,
        firstName: 'Jean-Pierre'
      });
    });
  });

  it('validates Quebec postal code format', async () => {
    const mockUser = {
      id: 'user-123',
      firstName: 'Sylvie',
      lastName: 'Tremblay',
      email: 'sylvie.tremblay@example.com',
      role: 'resident' as const,
      organizationId: 'org-101'
    };

    renderWithProviders(<UserProfile user={mockUser} />);

    fireEvent.click(screen.getByText('Modifier'));

    // Enter invalid postal code
    const postalCodeInput = screen.getByLabelText('Code postal');
    fireEvent.change(postalCodeInput, { target: { value: '12345' } });

    fireEvent.click(screen.getByText('Sauvegarder'));

    await waitFor(() => {
      expect(screen.getByText('Format de code postal québécois requis (ex: H1A 1A1)')).toBeInTheDocument();
    });
  });
});
```

### API Function Testing

```typescript
// Example: User service test
import { UserService } from '@/lib/api/users';
import { db } from '@server/db';

// Mock database
jest.mock('@server/db');
const mockDb = db as jest.Mocked<typeof db>;

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('creates user with encrypted sensitive data', async () => {
      const userData = {
        email: 'nouveau@example.com',
        firstName: 'Marie-Claire',
        lastName: 'Bouchard',
        role: 'tenant' as const,
        organizationId: 'org-123',
        address: '123 Rue Sainte-Catherine, Montréal, QC H2X 1L3',
      };

      const mockCreatedUser = {
        id: 'user-456',
        ...userData,
        passwordHash: 'encrypted-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockCreatedUser]),
        }),
      } as any);

      const result = await UserService.createUser(userData);

      expect(result).toEqual(mockCreatedUser);
      expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Object));
    });

    it('validates Quebec postal code during creation', async () => {
      const invalidUserData = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'resident' as const,
        organizationId: 'org-123',
        postalCode: 'INVALID',
      };

      await expect(UserService.createUser(invalidUserData)).rejects.toThrow(
        'Invalid Quebec postal code format'
      );
    });
  });

  describe('getUsersByOrganization', () => {
    it('returns users with proper RBAC filtering', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'Pierre',
          lastName: 'Tremblay',
          role: 'manager',
        },
        {
          id: 'user-2',
          firstName: 'Lucie',
          lastName: 'Gagnon',
          role: 'resident',
        },
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockUsers),
          }),
        }),
      } as any);

      const result = await UserService.getUsersByOrganization('org-123');

      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(2);
    });
  });
});
```

## Integration Testing

### API Integration Tests

```typescript
// Example: Authentication API integration test
import request from 'supertest';
import { app } from '@server/index';
import { db } from '@server/db';

describe('Authentication API Integration', () => {
  beforeAll(async () => {
    // Setup test database
    await db.migrate.latest();
    await db.seed.run();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('POST /api/auth/login', () => {
    it('authenticates valid Quebec user credentials', async () => {
      const credentials = {
        username: 'marie.dubois@koveo.com',
        password: 'MotDePasse123!',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: 'marie.dubois@koveo.com',
          firstName: 'Marie',
          lastName: 'Dubois',
          role: 'manager',
        },
      });

      // Verify session cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('rejects invalid credentials', async () => {
      const invalidCredentials = {
        username: 'marie.dubois@koveo.com',
        password: 'WrongPassword',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid credentials',
      });
    });

    it('handles Quebec-specific user data correctly', async () => {
      const quebecUser = {
        username: 'jean.tremblay@koveo.com',
        password: 'QuebecTest123!',
      };

      const response = await request(app).post('/api/auth/login').send(quebecUser).expect(200);

      expect(response.body.user).toMatchObject({
        firstName: 'Jean',
        lastName: 'Tremblay',
        locale: 'fr-CA',
        timezone: 'America/Montreal',
      });
    });
  });

  describe('Building Management Integration', () => {
    let authToken: string;

    beforeEach(async () => {
      // Authenticate as manager
      const loginResponse = await request(app).post('/api/auth/login').send({
        username: 'manager@koveo.com',
        password: 'manager123',
      });

      authToken = loginResponse.body.token;
    });

    it('creates building with Quebec compliance validation', async () => {
      const buildingData = {
        name: 'Les Jardins du Plateau',
        address: '123 Rue Saint-Denis',
        city: 'Montréal',
        province: 'QC',
        postalCode: 'H2X 1L3',
        buildingType: 'condo',
        totalUnits: 24,
        yearBuilt: 1985,
      };

      const response = await request(app)
        .post('/api/buildings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(buildingData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Les Jardins du Plateau',
        address: '123 Rue Saint-Denis',
        city: 'Montréal',
        province: 'QC',
        postalCode: 'H2X 1L3',
      });

      expect(response.body.id).toBeDefined();
    });
  });
});
```

### Database Integration Tests

```typescript
// Example: Database operations integration test
import { db } from '@server/db';
import { users, buildings, residences } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Database Operations Integration', () => {
  beforeEach(async () => {
    // Clean database before each test
    await db.delete(residences);
    await db.delete(buildings);
    await db.delete(users);
  });

  describe('User-Building-Residence Relationships', () => {
    it('maintains referential integrity across tables', async () => {
      // Create organization and user
      const [user] = await db
        .insert(users)
        .values({
          email: 'test@koveo.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'manager',
          organizationId: 'org-123',
        })
        .returning();

      // Create building
      const [building] = await db
        .insert(buildings)
        .values({
          name: 'Test Building',
          address: '123 Test Street',
          city: 'Montréal',
          organizationId: 'org-123',
          managerId: user.id,
        })
        .returning();

      // Create residence
      const [residence] = await db
        .insert(residences)
        .values({
          buildingId: building.id,
          unitNumber: '101',
          floor: 1,
          squareFootage: 800,
        })
        .returning();

      // Verify relationships
      const result = await db
        .select({
          userName: users.firstName,
          buildingName: buildings.name,
          unitNumber: residences.unitNumber,
        })
        .from(users)
        .innerJoin(buildings, eq(buildings.managerId, users.id))
        .innerJoin(residences, eq(residences.buildingId, buildings.id));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userName: 'Test',
        buildingName: 'Test Building',
        unitNumber: '101',
      });
    });

    it('enforces Quebec business rules', async () => {
      // Test that buildings must have valid Quebec postal codes
      await expect(
        db.insert(buildings).values({
          name: 'Invalid Building',
          address: '123 Test Street',
          city: 'Montréal',
          postalCode: 'INVALID', // Should fail validation
          organizationId: 'org-123',
        })
      ).rejects.toThrow();

      // Test that condo buildings require syndic information
      const [condoBuilding] = await db
        .insert(buildings)
        .values({
          name: 'Condo Test',
          address: '456 Test Avenue',
          city: 'Québec',
          postalCode: 'G1A 1A1',
          buildingType: 'condo',
          organizationId: 'org-123',
          syndicInfo: {
            name: 'Syndicat Test',
            registrationNumber: 'SYN-123-QC',
          },
        })
        .returning();

      expect(condoBuilding.syndicInfo).toBeDefined();
    });
  });
});
```

## End-to-End Testing

### User Workflow Tests

```typescript
// Example: Complete user journey E2E test
import { test, expect } from '@playwright/test';

test.describe('Quebec Property Manager Workflow', () => {
  test('manager can create building and manage tenants', async ({ page }) => {
    // Login as manager
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'manager@koveo.com');
    await page.fill('[data-testid="password"]', 'manager123');
    await page.click('[data-testid="login-button"]');

    // Verify dashboard loads
    await expect(page.locator('h1')).toContainText('Tableau de bord');

    // Navigate to buildings
    await page.click('[data-testid="nav-buildings"]');
    await expect(page).toHaveURL('/buildings');

    // Create new building
    await page.click('[data-testid="add-building-button"]');

    await page.fill('[data-testid="building-name"]', 'Résidence du Vieux-Port');
    await page.fill('[data-testid="building-address"]', '789 Rue de la Commune');
    await page.fill('[data-testid="building-city"]', 'Montréal');
    await page.selectOption('[data-testid="building-province"]', 'QC');
    await page.fill('[data-testid="building-postal-code"]', 'H2Y 1A1');
    await page.selectOption('[data-testid="building-type"]', 'apartment');
    await page.fill('[data-testid="total-units"]', '12');

    await page.click('[data-testid="save-building"]');

    // Verify building was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Immeuble créé avec succès'
    );

    // Add residence to building
    await page.click('[data-testid="add-residence"]');
    await page.fill('[data-testid="unit-number"]', '3A');
    await page.fill('[data-testid="floor"]', '3');
    await page.fill('[data-testid="square-footage"]', '950');

    await page.click('[data-testid="save-residence"]');

    // Verify bilingual interface
    await page.click('[data-testid="language-toggle"]');
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Switch back to French
    await page.click('[data-testid="language-toggle"]');
    await expect(page.locator('h1')).toContainText('Tableau de bord');
  });

  test('resident can submit and track maintenance request', async ({ page }) => {
    // Login as resident
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'resident@koveo.com');
    await page.fill('[data-testid="password"]', 'resident123');
    await page.click('[data-testid="login-button"]');

    // Navigate to maintenance
    await page.click('[data-testid="nav-maintenance"]');

    // Create maintenance request
    await page.click('[data-testid="new-request"]');

    await page.fill('[data-testid="request-title"]', 'Problème de chauffage');
    await page.fill(
      '[data-testid="request-description"]',
      'Le chauffage ne fonctionne pas dans la chambre principale. Température très froide.'
    );
    await page.selectOption('[data-testid="priority"]', 'high');
    await page.selectOption('[data-testid="category"]', 'heating');

    await page.click('[data-testid="submit-request"]');

    // Verify request was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Demande soumise avec succès'
    );

    // Check request appears in list
    await expect(page.locator('[data-testid="request-list"]')).toContainText(
      'Problème de chauffage'
    );

    // Verify request status
    const requestRow = page.locator('[data-testid="request-row"]').first();
    await expect(requestRow.locator('[data-testid="status"]')).toContainText('Soumise');
  });
});
```

## Mobile & Accessibility Testing

### Mobile Responsiveness Tests

```typescript
// Example: Mobile touch interaction test
import { render, screen, fireEvent } from '@testing-library/react';
import { within } from '@testing-library/dom';
import MobileNavigation from '@/components/MobileNavigation';

describe('Mobile Navigation', () => {
  beforeEach(() => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 375 });
    Object.defineProperty(window, 'innerHeight', { value: 667 });
  });

  it('handles touch gestures correctly', async () => {
    render(<MobileNavigation />);

    const hamburgerButton = screen.getByTestId('mobile-menu-toggle');

    // Test touch start/end events
    fireEvent.touchStart(hamburgerButton);
    fireEvent.touchEnd(hamburgerButton);

    // Menu should be open
    const mobileMenu = screen.getByTestId('mobile-menu');
    expect(mobileMenu).toBeVisible();

    // Test swipe to close
    fireEvent.touchStart(mobileMenu, {
      touches: [{ clientX: 200, clientY: 100 }]
    });

    fireEvent.touchMove(mobileMenu, {
      touches: [{ clientX: 50, clientY: 100 }]
    });

    fireEvent.touchEnd(mobileMenu);

    // Menu should close after swipe
    expect(mobileMenu).not.toBeVisible();
  });

  it('provides accessible touch targets', () => {
    render(<MobileNavigation />);

    const touchTargets = screen.getAllByRole('button');

    touchTargets.forEach(target => {
      const { width, height } = target.getBoundingClientRect();

      // Ensure minimum 44px touch target (iOS guideline)
      expect(width).toBeGreaterThanOrEqual(44);
      expect(height).toBeGreaterThanOrEqual(44);
    });
  });
});
```

### Accessibility Tests

```typescript
// Example: WCAG 2.1 compliance test
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BuildingForm from '@/components/forms/BuildingForm';

expect.extend(toHaveNoViolations);

describe('Building Form Accessibility', () => {
  it('meets WCAG 2.1 AA standards', async () => {
    const { container } = render(<BuildingForm />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('provides proper French and English labels', () => {
    render(<BuildingForm locale="fr" />);

    // Check for proper French labels
    expect(screen.getByLabelText('Nom de l\'immeuble')).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse')).toBeInTheDocument();
    expect(screen.getByLabelText('Code postal')).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    render(<BuildingForm />);

    const firstInput = screen.getByLabelText('Building Name');
    firstInput.focus();
    expect(firstInput).toHaveFocus();

    // Tab through form fields
    fireEvent.keyDown(firstInput, { key: 'Tab' });

    const addressInput = screen.getByLabelText('Address');
    expect(addressInput).toHaveFocus();
  });

  it('announces form errors to screen readers', async () => {
    render(<BuildingForm />);

    // Submit empty form
    const submitButton = screen.getByRole('button', { name: /save|sauvegarder/i });
    fireEvent.click(submitButton);

    // Check for aria-describedby attributes on error fields
    const nameInput = screen.getByLabelText(/building name|nom de l'immeuble/i);
    expect(nameInput).toHaveAttribute('aria-describedby');

    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toBeInTheDocument();
  });
});
```

## Quebec Compliance Testing

### Bilingual Support Tests

```typescript
// Example: Quebec bilingual compliance test
describe('Quebec Bilingual Compliance', () => {
  it('provides complete French translations', async () => {
    const { t } = useTranslation('fr');

    // Test core application strings
    const coreStrings = [
      'navigation.dashboard',
      'navigation.buildings',
      'navigation.maintenance',
      'navigation.bills',
      'forms.save',
      'forms.cancel',
      'errors.required_field',
      'success.data_saved',
    ];

    coreStrings.forEach((key) => {
      const translation = t(key);
      expect(translation).not.toBe(key); // Should not return key if translation exists
      expect(translation).toBeTruthy();
    });
  });

  it('handles Quebec-specific date formats', () => {
    const testDate = new Date('2024-03-15');

    const frenchFormat = formatDate(testDate, 'fr-CA');
    expect(frenchFormat).toBe('15 mars 2024');

    const englishFormat = formatDate(testDate, 'en-CA');
    expect(englishFormat).toBe('March 15, 2024');
  });

  it('validates Quebec postal codes correctly', () => {
    const validPostalCodes = ['H1A 1A1', 'G1A 1A1', 'J0A 1A0', 'K1A 1A1'];

    const invalidPostalCodes = ['90210', 'SW1A 1AA', 'H1A1A1', '123-456'];

    validPostalCodes.forEach((code) => {
      expect(validateQuebecPostalCode(code)).toBe(true);
    });

    invalidPostalCodes.forEach((code) => {
      expect(validateQuebecPostalCode(code)).toBe(false);
    });
  });
});
```

### Law 25 Compliance Tests

```typescript
// Example: Privacy compliance test
describe('Law 25 Privacy Compliance', () => {
  it('requires explicit consent for data collection', async () => {
    render(<UserRegistrationForm />);

    // Try to submit without privacy consent
    await fillRegistrationForm({
      firstName: 'Marie',
      lastName: 'Dubois',
      email: 'marie.dubois@example.com'
    });

    const submitButton = screen.getByRole('button', { name: /register|s'inscrire/i });
    fireEvent.click(submitButton);

    // Should show privacy consent error
    expect(screen.getByText(/consentement requis|consent required/i)).toBeInTheDocument();

    // Provide consent
    const consentCheckbox = screen.getByLabelText(/privacy policy|politique de confidentialité/i);
    fireEvent.click(consentCheckbox);

    fireEvent.click(submitButton);

    // Should now succeed
    await waitFor(() => {
      expect(screen.queryByText(/consentement requis|consent required/i)).not.toBeInTheDocument();
    });
  });

  it('implements data portability rights', async () => {
    const userId = 'user-123';

    const response = await request(app)
      .get(`/api/users/${userId}/export`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      user: expect.any(Object),
      buildings: expect.any(Array),
      residences: expect.any(Array),
      maintenanceRequests: expect.any(Array),
      exportDate: expect.any(String),
      format: 'JSON'
    });
  });

  it('handles data deletion requests', async () => {
    const userId = 'user-to-delete';

    // Request data deletion
    await request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify user data is deleted
    const userCheck = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
```

## Performance Testing

### Load Testing

```typescript
// Example: API performance test
describe('API Performance', () => {
  it('handles concurrent user requests efficiently', async () => {
    const concurrentRequests = 50;
    const startTime = Date.now();

    const requests = Array.from({ length: concurrentRequests }, (_, index) =>
      request(app).get('/api/buildings').set('Authorization', `Bearer ${testToken}`).expect(200)
    );

    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should handle 50 concurrent requests in under 2 seconds
    expect(totalTime).toBeLessThan(2000);

    // All responses should be valid
    responses.forEach((response) => {
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  it('maintains response times under load', async () => {
    const measurementCount = 100;
    const responseTimes: number[] = [];

    for (let i = 0; i < measurementCount; i++) {
      const start = Date.now();

      await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      responseTimes.push(Date.now() - start);
    }

    const averageTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
    const p95Time = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

    expect(averageTime).toBeLessThan(200); // Average under 200ms
    expect(p95Time).toBeLessThan(500); // 95th percentile under 500ms
  });
});
```

## Running Tests

### Test Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:mobile       # Mobile responsiveness tests
npm run test:quebec       # Quebec compliance tests

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- auth-hooks.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="authentication"

# Debug tests
npm run test:debug
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run Quebec compliance tests
        run: npm run test:quebec

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    id: 'admin-123',
    email: 'admin@koveo.com',
    firstName: 'Administrateur',
    lastName: 'Système',
    role: 'admin' as const,
    organizationId: 'org-demo',
  },

  manager: {
    id: 'manager-456',
    email: 'gestionnaire@koveo.com',
    firstName: 'Marie',
    lastName: 'Dubois',
    role: 'manager' as const,
    organizationId: 'org-demo',
  },

  tenant: {
    id: 'tenant-789',
    email: 'locataire@koveo.com',
    firstName: 'Jean',
    lastName: 'Tremblay',
    role: 'tenant' as const,
    organizationId: 'org-demo',
  },
};

export const testBuildings = {
  condoMontreal: {
    id: 'building-001',
    name: 'Les Condos du Plateau',
    address: '123 Rue Saint-Denis',
    city: 'Montréal',
    province: 'QC',
    postalCode: 'H2X 1L3',
    buildingType: 'condo' as const,
    totalUnits: 24,
  },
};
```

## Quality Gates

### Test Quality Requirements

- **Coverage**: Minimum 85% line coverage, 80% branch coverage
- **Performance**: API responses under 200ms average
- **Accessibility**: WCAG 2.1 AA compliance
- **Quebec Compliance**: 100% bilingual coverage
- **Mobile**: Touch target minimum 44px
- **Security**: No high-severity vulnerabilities

### Automated Quality Checks

```typescript
// Quality validation in CI/CD
const qualityChecks = {
  coverage: {
    minimum: 85,
    current: await getCoveragePercentage(),
  },

  accessibility: {
    violations: await runAxeTests(),
    maxViolations: 0,
  },

  performance: {
    averageResponseTime: await measureAPIPerformance(),
    maxResponseTime: 200,
  },

  quebecCompliance: {
    translationCoverage: await checkTranslations(),
    minimumCoverage: 100,
  },
};

// Fail build if quality gates not met
Object.entries(qualityChecks).forEach(([check, metrics]) => {
  if (!meetsQualityGate(metrics)) {
    throw new Error(`Quality gate failed: ${check}`);
  }
});
```

This comprehensive testing framework ensures Koveo Gestion maintains high quality, performance, and compliance with Quebec regulations while providing excellent user experience across all platforms and languages.
