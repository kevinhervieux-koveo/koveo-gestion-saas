# Contributing to Koveo Gestion

> Updated: September 09, 2025

Thank you for your interest in contributing to Koveo Gestion! This guide outlines our development process and standards for the Quebec property management platform.

## Development Process

### 1. Setup Development Environment

```bash
# Clone and setup
git clone https://github.com/koveo/koveo-gestion.git
cd koveo-gestion
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
npm run db:push

# Start development server
npm run dev
```

### 2. Branch Strategy

- **Main Branch**: Production-ready code
- **Feature Branches**: `feature/description-of-change`
- **Bug Fixes**: `fix/description-of-bug`
- **Documentation**: `docs/description-of-change`

### 3. Development Workflow

1. **Create Feature Branch**:

   ```bash
   git checkout -b feature/new-dashboard-widget
   ```

2. **Make Changes**:
   - Follow coding standards
   - Write/update tests
   - Update documentation

3. **Quality Checks**:

   ```bash
   npm run lint                                     # Code linting
   npm run type-check                              # TypeScript validation
   npx jest --config=jest.config.simple.cjs       # Run stable test suite
   npm run test:coverage                           # Verify coverage
   ```

4. **Commit Changes**:

   ```bash
   # Use conventional commits
   git commit -m "feat: add new dashboard widget for maintenance overview"
   ```

5. **Submit Pull Request**:
   - Create PR with clear description
   - Link related issues
   - Ensure all checks pass

## Code Standards

### TypeScript Guidelines

```typescript
// Use explicit types for function parameters
function createUser(userData: CreateUserInput): Promise<User> {
  return userService.create(userData);
}

// Use proper error handling
try {
  const result = await apiCall();
  return result;
} catch (error) {
  logger.error('API call failed:', error);
  throw new Error('Operation failed');
}

// Document complex functions
/**
 * Calculates monthly maintenance costs for a building
 * @param buildingId - Unique identifier for building
 * @param month - Target month (1-12)
 * @param year - Target year
 * @returns Promise resolving to cost breakdown
 */
async function calculateMaintenance(
  buildingId: string,
  month: number,
  year: number
): Promise<MaintenanceCost> {
  // Implementation
}
```

### React Component Guidelines

```tsx
// Use proper typing for props
interface DashboardProps {
  userId: string;
  organizationId: string;
  onUpdate?: (data: DashboardData) => void;
}

// Implement proper error boundaries
function Dashboard({ userId, organizationId, onUpdate }: DashboardProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboard(userId),
  });

  if (error) {
    return <ErrorDisplay message='Failed to load dashboard' />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <div className='dashboard'>{/* Component content */}</div>;
}
```

### Database Schema Guidelines

```typescript
// Use descriptive table and column names
export const maintenanceRequests = pgTable('maintenance_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  residenceId: uuid('residence_id').references(() => residences.id),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', {
    enum: ['low', 'medium', 'high', 'urgent'],
  }).notNull(),
  status: text('status', {
    enum: ['submitted', 'acknowledged', 'in_progress', 'completed', 'cancelled'],
  })
    .notNull()
    .default('submitted'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Create proper insert schemas
export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;
```

## Testing Requirements

### Unit Tests

```typescript
// Test React components
describe('UserProfile Component', () => {
  it('displays user information correctly', () => {
    const mockUser = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'tenant'
    };

    render(<UserProfile user={mockUser} />);

    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('jean.dupont@example.com')).toBeInTheDocument();
  });
});

// Test API functions
describe('User API', () => {
  it('creates user successfully', async () => {
    const userData = {
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie.martin@example.com',
      role: 'resident'
    };

    const result = await userService.create(userData);

    expect(result.id).toBeDefined();
    expect(result.email).toBe(userData.email);
  });
});
```

### Integration Tests

```typescript
describe('Building Management API', () => {
  it('should create building with valid data', async () => {
    const buildingData = {
      name: 'Les Jardins du Plateau',
      address: '123 Rue Saint-Denis',
      city: 'Montréal',
      organizationId: testOrgId,
    };

    const response = await request(app).post('/api/buildings').send(buildingData).expect(201);

    expect(response.body.name).toBe(buildingData.name);
    expect(response.body.id).toBeDefined();
  });
});
```

### Coverage Requirements

- **Minimum Coverage**: 80% overall
- **Critical Paths**: 90% coverage for authentication, payments
- **New Features**: 85% coverage required
- **Bug Fixes**: Include regression tests

## Quebec Compliance Standards

### Bilingual Implementation

```typescript
// Language support
const translations = {
  en: {
    dashboard: 'Dashboard',
    maintenance: 'Maintenance',
    bills: 'Bills'
  },
  fr: {
    dashboard: 'Tableau de bord',
    maintenance: 'Entretien',
    bills: 'Factures'
  }
};

// Use translation helper
function MaintenanceHeader() {
  const { t } = useTranslation();

  return (
    <h1>{t('maintenance.title')}</h1>
  );
}
```

### Law 25 Compliance

```typescript
// Data collection with consent
interface DataCollectionRequest {
  userId: string;
  dataType: 'personal' | 'financial' | 'maintenance';
  purpose: string;
  consentGiven: boolean;
  consentTimestamp: Date;
}

// Implement data retention policies
class DataRetentionService {
  async scheduleDataDeletion(userId: string, retentionPeriod: number) {
    // Schedule automatic data deletion
  }

  async handleDataPortability(userId: string): Promise<UserDataExport> {
    // Export user data in portable format
  }
}
```

## Documentation Standards

### Code Documentation

````typescript
/**
 * Service for managing building maintenance requests in Quebec properties
 *
 * Handles the complete lifecycle of maintenance requests including:
 * - Request submission and validation
 * - Priority assignment based on Quebec housing standards
 * - Contractor coordination and scheduling
 * - Completion verification and billing
 *
 * @example
 * ```typescript
 * const service = new MaintenanceService();
 * const request = await service.createRequest({
 *   residenceId: 'uuid',
 *   title: 'Réparation chauffage', // French title supported
 *   priority: 'urgent'
 * });
 * ```
 */
class MaintenanceService {
  /**
   * Creates new maintenance request with Quebec compliance validation
   *
   * @param requestData - Maintenance request details
   * @returns Promise resolving to created request with tracking ID
   * @throws ValidationError when data doesn't meet Quebec standards
   */
  async createRequest(requestData: CreateMaintenanceRequest): Promise<MaintenanceRequest> {
    // Implementation
  }
}
````

### README Updates

When adding new features, update relevant documentation:

- **API Changes**: Update `docs/API_DOCUMENTATION.md`
- **New Components**: Document in `docs/COMPONENT_DOCUMENTATION.md`
- **Quebec Features**: Add examples to `docs/QUEBEC_COMPLIANCE_EXAMPLES.md`

## Pull Request Guidelines

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Quebec compliance update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Quebec compliance verified

## Documentation

- [ ] Code comments updated
- [ ] API documentation updated
- [ ] User documentation updated
- [ ] Quebec examples added

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass
- [ ] No linting errors
- [ ] Documentation updated
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one approval required
3. **Quebec Compliance**: Verify bilingual support and Law 25 requirements
4. **Testing**: Verify test coverage meets requirements
5. **Documentation**: Ensure updates are complete and accurate

## Getting Help

### Resources

- **Documentation**: `/docs` directory for comprehensive guides
- **Examples**: Check existing code for patterns
- **Quebec Compliance**: See `docs/QUEBEC_COMPLIANCE_EXAMPLES.md`
- **API Reference**: `docs/API_DOCUMENTATION.md`

### Communication

- **Questions**: Create GitHub discussions
- **Bugs**: File GitHub issues with reproduction steps
- **Features**: Discuss in GitHub issues before implementation
- **Urgent Issues**: Contact development team directly

## Recognition

Contributors will be recognized in:

- Project documentation
- Release notes for significant contributions
- Annual contributor recognition

Thank you for helping make Koveo Gestion the best property management platform for Quebec!
