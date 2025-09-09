# Testing Strategy Guide

> Updated: September 09, 2025
> Comprehensive testing approach for Koveo Gestion's Quebec property management platform

## Testing Philosophy

Koveo Gestion implements a comprehensive testing strategy that ensures reliability, performance, and Quebec compliance. Our approach combines multiple testing methodologies to deliver a robust, user-friendly platform that meets Quebec's regulatory requirements.

## Testing Pyramid Structure

```
                    /\
                   /  \
              E2E Tests (5%)
            /_____________\
           /               \
      Integration Tests (25%)
     /____________________\
    /                      \
   Unit Tests (70%)
  /________________________\
```

### Test Distribution Rationale

- **Unit Tests (70%)**: Fast, reliable foundation testing individual components and functions
- **Integration Tests (25%)**: Validate system interactions and API contracts
- **End-to-End Tests (5%)**: Critical user journeys and Quebec compliance workflows

### Current Test Status (September 09, 2025)

- **Dashboard Components**: 15/15 passing ✅
- **Form Validation**: 12/12 passing ✅  
- **API Routes Validation**: 15/15 passing ✅
- **Quebec Compliance Patterns**: Bilingual testing working ✅
- **ES Module Compatibility**: Fully resolved with Jest configuration ✅
- **Test Infrastructure**: Stable foundation with comprehensive mocking ✅
- **Component Coverage**: 73+ components documented and tested ✅
- **Mock Architecture**: Advanced server mocking system operational ✅

## Testing Categories

### 1. Unit Testing

**Scope**: Individual functions, components, and modules
**Framework**: Jest with React Testing Library and advanced ES module support
**Configuration**: `jest.config.simple.cjs` with strategic server mocking
**Coverage Target**: Reliable execution foundation for core systems
**Current Status**: Major test categories stabilized with modular mock architecture (September 2025)

**Component Testing Example**:

```typescript
describe('BuildingForm Component', () => {
  it('validates Quebec postal codes correctly', async () => {
    render(<BuildingForm />);

    const postalCodeInput = screen.getByLabelText(/code postal/i);
    fireEvent.change(postalCodeInput, { target: { value: 'INVALID' } });

    const submitButton = screen.getByRole('button', { name: /sauvegarder/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/format de code postal québécois requis/i))
      .toBeInTheDocument();
  });

  it('supports bilingual interface', () => {
    const { rerender } = render(<BuildingForm locale="en" />);
    expect(screen.getByLabelText('Building Name')).toBeInTheDocument();

    rerender(<BuildingForm locale="fr" />);
    expect(screen.getByLabelText('Nom de l\'immeuble')).toBeInTheDocument();
  });
});
```

**Business Logic Testing**:

```typescript
describe('MaintenanceRequestService', () => {
  it('calculates priority based on Quebec housing standards', () => {
    const heatingIssue = {
      category: 'heating',
      severity: 'major',
      temperature: -10, // Celsius, winter condition
    };

    const priority = MaintenanceRequestService.calculatePriority(heatingIssue);

    // Quebec housing law requires urgent response to heating issues in winter
    expect(priority).toBe('urgent');
  });
});
```

### 2. Integration Testing

**Scope**: API endpoints, database interactions, service integrations
**Framework**: Supertest with Jest
**Coverage Target**: All API endpoints, critical data flows

**API Integration Testing**:

```typescript
describe('User Management API', () => {
  it('enforces Quebec RBAC permissions', async () => {
    const managerToken = await authenticateAs('manager');

    // Manager should create tenants but not admins
    const tenantData = {
      email: 'nouveau.locataire@example.com',
      firstName: 'Pierre',
      lastName: 'Tremblay',
      role: 'tenant',
    };

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(tenantData)
      .expect(201);

    // Should reject admin creation
    const adminData = { ...tenantData, role: 'admin' };

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(adminData)
      .expect(403);
  });
});
```

**Database Integration Testing**:

```typescript
describe('Building-Residence Relationships', () => {
  it('maintains referential integrity with Quebec constraints', async () => {
    const building = await createTestBuilding({
      name: 'Les Appartements du Plateau',
      address: '123 Rue Saint-Denis',
      city: 'Montréal',
      postalCode: 'H2X 1L3',
    });

    const residence = await createTestResidence({
      buildingId: building.id,
      unitNumber: '3A',
      rentControlled: true, // Quebec rent control requirement
    });

    expect(residence.buildingId).toBe(building.id);
    expect(residence.rentControlled).toBe(true);
  });
});
```

### 3. End-to-End Testing

**Scope**: Complete user workflows, Quebec compliance scenarios
**Framework**: Playwright
**Coverage Target**: Critical user journeys, compliance workflows

**Quebec Property Manager Workflow**:

```typescript
test('Quebec property manager complete workflow', async ({ page }) => {
  // Login with Quebec-specific interface
  await page.goto('/login');
  await page.selectOption('[data-testid="language-selector"]', 'fr');

  await page.fill('[data-testid="email"]', 'gestionnaire@koveo.com');
  await page.fill('[data-testid="password"]', 'MotDePasse123!');
  await page.click('[data-testid="login-button"]');

  // Verify French interface loaded
  await expect(page.locator('h1')).toContainText('Tableau de bord');

  // Create new building with Quebec requirements
  await page.click('[data-testid="nav-buildings"]');
  await page.click('[data-testid="add-building"]');

  await page.fill('[data-testid="building-name"]', 'Résidence du Vieux-Montréal');
  await page.fill('[data-testid="address"]', '456 Rue Notre-Dame');
  await page.fill('[data-testid="city"]', 'Montréal');
  await page.selectOption('[data-testid="province"]', 'QC');
  await page.fill('[data-testid="postal-code"]', 'H2Y 2R2');

  // Quebec-specific fields
  await page.check('[data-testid="rent-controlled"]');
  await page.fill('[data-testid="regie-registration"]', 'RDL-2024-001234');

  await page.click('[data-testid="save-building"]');

  // Verify success message in French
  await expect(page.locator('[data-testid="success-message"]')).toContainText(
    'Immeuble créé avec succès'
  );
});
```

**Accessibility Compliance Testing**:

```typescript
test('WCAG 2.1 AA compliance for Quebec users', async ({ page }) => {
  await page.goto('/dashboard');

  // Test keyboard navigation
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'main-nav');

  // Test screen reader support
  const results = await injectAxe(page);
  expect(results.violations).toHaveLength(0);

  // Test French screen reader labels
  await page.selectOption('[data-testid="language-selector"]', 'fr');
  await expect(page.locator('[aria-label="Navigation principale"]')).toBeVisible();
});
```

### 4. Quebec Compliance Testing

**Scope**: Quebec-specific requirements, Law 25, bilingual functionality
**Framework**: Custom compliance test suite
**Coverage Target**: 100% of Quebec-specific features

**Bilingual Interface Testing**:

```typescript
describe('Quebec Bilingual Compliance', () => {
  const testPages = ['/dashboard', '/buildings', '/maintenance', '/bills'];

  testPages.forEach(page => {
    it(`supports complete French translation on ${page}`, async () => {
      const { container } = render(
        <LanguageProvider locale="fr">
          <Router>
            <Route path={page} component={getPageComponent(page)} />
          </Router>
        </LanguageProvider>
      );

      // Check that no English text appears when French is selected
      const englishTexts = ['Dashboard', 'Buildings', 'Maintenance', 'Bills'];
      englishTexts.forEach(text => {
        expect(container).not.toHaveTextContent(text);
      });

      // Verify French translations are present
      const frenchTexts = ['Tableau de bord', 'Immeubles', 'Entretien', 'Factures'];
      frenchTexts.forEach(text => {
        expect(container).toHaveTextContent(text);
      });
    });
  });
});
```

**Law 25 Privacy Compliance Testing**:

```typescript
describe('Law 25 Privacy Compliance', () => {
  it('requires explicit consent for data collection', async () => {
    render(<UserRegistrationForm />);

    // Fill form without consent
    await fillForm({
      firstName: 'Marie',
      lastName: 'Dubois',
      email: 'marie.dubois@example.com'
    });

    const submitButton = screen.getByRole('button', { name: /s'inscrire/i });
    fireEvent.click(submitButton);

    // Should show consent requirement
    expect(screen.getByText(/consentement à la collecte de données requis/i))
      .toBeInTheDocument();

    // Provide consent
    const consentCheckbox = screen.getByLabelText(/j'accepte la politique/i);
    fireEvent.click(consentCheckbox);

    fireEvent.click(submitButton);

    // Should succeed with consent
    await waitFor(() => {
      expect(screen.queryByText(/consentement.*requis/i)).not.toBeInTheDocument();
    });
  });

  it('implements data portability rights', async () => {
    const userId = 'test-user-123';

    const response = await request(app)
      .get(`/api/users/${userId}/export`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      user: expect.objectContaining({
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String)
      }),
      buildings: expect.any(Array),
      maintenanceRequests: expect.any(Array),
      exportDate: expect.any(String),
      format: 'JSON'
    });
  });
});
```

### 5. Performance Testing

**Scope**: Response times, load handling, database performance
**Framework**: Jest with performance assertions
**Coverage Target**: All critical paths under performance budgets

**API Performance Testing**:

```typescript
describe('API Performance', () => {
  it('maintains response times under Quebec service standards', async () => {
    const iterations = 50;
    const responseTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await request(app)
        .get('/api/buildings')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      responseTimes.push(performance.now() - start);
    }

    const averageTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
    const p95Time = responseTimes.sort()[Math.floor(responseTimes.length * 0.95)];

    // Quebec service standards: average under 200ms, 95th percentile under 500ms
    expect(averageTime).toBeLessThan(200);
    expect(p95Time).toBeLessThan(500);
  });
});
```

**Database Performance Testing**:

```typescript
describe('Database Performance', () => {
  it('efficiently handles Quebec property queries', async () => {
    // Create test data representing typical Quebec building portfolio
    await createTestData({
      buildings: 100,
      residencesPerBuilding: 25,
      maintenanceRequestsPerMonth: 50,
    });

    const start = performance.now();

    const result = await db
      .select({
        buildingName: buildings.name,
        totalUnits: sql<number>`COUNT(${residences.id})`,
        activeRequests: sql<number>`COUNT(${maintenanceRequests.id})`,
      })
      .from(buildings)
      .leftJoin(residences, eq(residences.buildingId, buildings.id))
      .leftJoin(
        maintenanceRequests,
        and(
          eq(maintenanceRequests.residenceId, residences.id),
          eq(maintenanceRequests.status, 'active')
        )
      )
      .where(eq(buildings.province, 'QC'))
      .groupBy(buildings.id, buildings.name)
      .limit(50);

    const queryTime = performance.now() - start;

    expect(queryTime).toBeLessThan(100); // Should complete under 100ms
    expect(result).toHaveLength(50);
  });
});
```

### 6. Security Testing

**Scope**: Authentication, authorization, data protection
**Framework**: Custom security test suite
**Coverage Target**: All security-sensitive operations

**Authentication Security Testing**:

```typescript
describe('Authentication Security', () => {
  it('prevents brute force attacks on Quebec accounts', async () => {
    const testEmail = 'test.user@koveo.com';
    const wrongPassword = 'WrongPassword123!';

    // Attempt 6 failed logins
    const failedAttempts = Array(6)
      .fill(null)
      .map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ username: testEmail, password: wrongPassword })
          .expect(401)
      );

    await Promise.all(failedAttempts);

    // Next attempt should be rate limited
    const rateLimitedResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: testEmail, password: wrongPassword })
      .expect(429);

    expect(rateLimitedResponse.body.message).toContain('Too many login attempts');
  });

  it('validates Quebec-specific data formats securely', async () => {
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      '<script>alert("xss")</script>',
      '../../etc/passwd',
      "H1A 1A1'; DROP TABLE buildings; --",
    ];

    for (const maliciousInput of maliciousInputs) {
      const response = await request(app)
        .post('/api/buildings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Building',
          postalCode: maliciousInput,
        });

      // Should reject with validation error, not execute injection
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('validation');
    }
  });
});
```

## Test Data Management

### Test Fixtures

**Quebec-Specific Test Data**:

```typescript
export const quebecTestData = {
  users: {
    admin: {
      email: 'admin@koveo.com',
      firstName: 'Administrateur',
      lastName: 'Système',
      role: 'admin',
      locale: 'fr-CA',
    },
    manager: {
      email: 'gestionnaire@koveo.com',
      firstName: 'Marie',
      lastName: 'Dubois',
      role: 'manager',
      locale: 'fr-CA',
    },
  },

  buildings: {
    montrealCondo: {
      name: 'Les Condos du Plateau',
      address: '123 Rue Saint-Denis',
      city: 'Montréal',
      province: 'QC',
      postalCode: 'H2X 1L3',
      buildingType: 'condo',
      rentControlled: true,
    },
    quebecApartment: {
      name: 'Appartements de la Capitale',
      address: '456 Grande Allée Est',
      city: 'Québec',
      province: 'QC',
      postalCode: 'G1R 2J5',
      buildingType: 'apartment',
      rentControlled: true,
    },
  },

  maintenanceRequests: {
    heatingEmergency: {
      title: 'Panne de chauffage - Urgent',
      description: 'Système de chauffage complètement arrêté, température intérieure 10°C',
      priority: 'urgent',
      category: 'heating',
      quebecRegulation: 'Loi sur la Régie du logement - Article 1910',
    },
  },
};
```

### Database Seeding

**Test Database Setup**:

```typescript
export async function setupTestDatabase() {
  // Clean database
  await db.delete(maintenanceRequests);
  await db.delete(residences);
  await db.delete(buildings);
  await db.delete(users);
  await db.delete(organizations);

  // Create test organization
  const [testOrg] = await db
    .insert(organizations)
    .values({
      name: 'Organisation Test Québec',
      type: 'property_management',
      province: 'QC',
      isActive: true,
    })
    .returning();

  // Create test users with Quebec context
  const testUsers = await db
    .insert(users)
    .values([
      {
        ...quebecTestData.users.admin,
        organizationId: testOrg.id,
        passwordHash: await hashPassword('admin123'),
      },
      {
        ...quebecTestData.users.manager,
        organizationId: testOrg.id,
        passwordHash: await hashPassword('manager123'),
      },
    ])
    .returning();

  // Create test buildings
  const testBuildings = await db
    .insert(buildings)
    .values([
      {
        ...quebecTestData.buildings.montrealCondo,
        organizationId: testOrg.id,
        managerId: testUsers[1].id,
      },
    ])
    .returning();

  return { testOrg, testUsers, testBuildings };
}
```

## Continuous Integration

### CI/CD Pipeline Testing

**GitHub Actions Workflow**:

```yaml
name: Koveo Gestion Test Suite

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
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run Quebec compliance tests
        run: npm run test:quebec

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Check coverage thresholds
        run: npm run coverage:check

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

### Quality Gates

**Automated Quality Checks**:

```typescript
// Quality gate validation
const qualityGates = {
  coverage: {
    lines: 85,
    branches: 80,
    functions: 85,
    statements: 85,
  },

  performance: {
    maxResponseTime: 200,
    maxBundleSize: '2MB',
  },

  quebecCompliance: {
    bilingualCoverage: 100,
    accessibilityScore: 95,
    privacyCompliance: 100,
  },

  security: {
    maxVulnerabilities: 0,
    securityScore: 90,
  },
};

// Fail build if quality gates not met
export function validateQualityGates(results: TestResults) {
  const failures: string[] = [];

  if (results.coverage.lines < qualityGates.coverage.lines) {
    failures.push(`Line coverage ${results.coverage.lines}% < ${qualityGates.coverage.lines}%`);
  }

  if (results.performance.avgResponseTime > qualityGates.performance.maxResponseTime) {
    failures.push(
      `Response time ${results.performance.avgResponseTime}ms > ${qualityGates.performance.maxResponseTime}ms`
    );
  }

  if (
    results.quebecCompliance.bilingualCoverage < qualityGates.quebecCompliance.bilingualCoverage
  ) {
    failures.push(`Bilingual coverage ${results.quebecCompliance.bilingualCoverage}% < 100%`);
  }

  if (failures.length > 0) {
    throw new Error(`Quality gate failures:\n${failures.join('\n')}`);
  }
}
```

## Test Maintenance

### Test Health Monitoring

**Flaky Test Detection**:

```typescript
// Track test reliability over time
const testResults: TestRunResult[] = [];

export function trackTestResult(testName: string, passed: boolean, duration: number) {
  testResults.push({
    testName,
    passed,
    duration,
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
  });

  // Analyze test stability
  const recentRuns = testResults.filter((r) => r.testName === testName).slice(-10); // Last 10 runs

  const successRate = recentRuns.filter((r) => r.passed).length / recentRuns.length;

  if (successRate < 0.9) {
    console.warn(
      `⚠️ Flaky test detected: ${testName} (${Math.round(successRate * 100)}% success rate)`
    );
  }
}
```

### Test Performance Monitoring

**Test Execution Optimization**:

```typescript
// Monitor test performance
export function analyzeTestPerformance() {
  const slowTests = testResults
    .filter((r) => r.duration > 1000) // Tests taking over 1 second
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  if (slowTests.length > 0) {
    console.log('🐌 Slowest tests:');
    slowTests.forEach((test) => {
      console.log(`  ${test.testName}: ${test.duration}ms`);
    });
  }
}
```

This comprehensive testing strategy ensures Koveo Gestion maintains high quality, performance, and Quebec compliance while providing reliable property management services to Quebec communities.
