# Getting Started with Koveo Gestion

> Updated: September 09, 2025
> Complete guide to setting up and understanding the Koveo Gestion property management platform

## Quick Setup (5 minutes)

### Prerequisites

- **Node.js**: Version 20 or higher (required for ES modules)
- **PostgreSQL**: Version 14 or higher (Neon serverless supported)
- **Git**: For version control
- **Code Editor**: VS Code recommended with TypeScript extensions

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/koveo/koveo-gestion.git
cd koveo-gestion

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env file with your database credentials

# 4. Initialize the database
npm run db:push

# 5. Start the development server
npm run dev
```

The application will be running at `http://localhost:5000`

### Demo Login

Access the platform with these pre-configured accounts:

**Admin User**

```
Email: admin@koveo.com
Password: admin123
```

**Manager User**

```
Email: manager@koveo.com
Password: manager123
```

**Tenant User**

```
Email: tenant@koveo.com
Password: tenant123
```

## Understanding the Platform

### What is Koveo Gestion?

Koveo Gestion is a comprehensive property management system designed specifically for Quebec's regulatory environment. It helps property managers, tenants, and residents collaborate effectively while maintaining compliance with Law 25.

### Key Features Overview

- **🏢 Property Management**: Buildings, units, and resident management
- **💰 Financial Tracking**: Budgets, bills, and payment tracking
- **🔧 Maintenance**: Request management and contractor coordination
- **📊 Reporting**: Financial and operational analytics
- **👥 User Management**: Role-based access with Quebec compliance
- **🌍 Bilingual**: Complete French and English support

### User Roles Explained

**Admin**

- Complete system control
- Organization and user management
- System configuration and monitoring

**Manager**

- Building and property oversight
- Financial management and reporting
- Maintenance coordination

**Tenant**

- Unit management and resident coordination
- Maintenance approval and oversight
- Financial reporting for managed properties

**Resident**

- Personal profile management
- Maintenance request submission
- Bill viewing and payment tracking

## Your First Tasks

### 1. Explore the Dashboard

After logging in, you'll see role-specific dashboards:

- **Recent Activity**: Latest system events
- **Quick Actions**: Common tasks for your role
- **Key Metrics**: Important statistics
- **Notifications**: System and user messages

### 2. Understand Navigation

The main navigation varies by role but typically includes:

- **Dashboard**: Overview and quick actions
- **Buildings**: Property management (Admin/Manager)
- **Residences**: Unit management
- **Maintenance**: Request handling
- **Bills**: Financial tracking
- **Users**: User management (Admin/Manager)
- **Reports**: Analytics and reporting

### 3. Try Key Features

**Create a Maintenance Request** (All Roles)

1. Navigate to Maintenance section
2. Click "New Request"
3. Fill in details (title, description, priority)
4. Submit and track progress

**Manage a Building** (Admin/Manager)

1. Go to Buildings section
2. Click "Add Building"
3. Enter building details
4. Set up units and residents

**Review Financial Reports** (Admin/Manager/Tenant)

1. Access Reports section
2. Select report type (budget, expenses, etc.)
3. Choose date range
4. Generate and download report

## Development Environment

### Project Structure

```
koveo-gestion/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities and helpers
├── server/              # Express.js backend
│   ├── api/             # API route handlers
│   ├── middleware/      # Express middleware
│   └── utils/           # Server utilities
├── shared/              # Shared types and schemas
├── docs/                # Documentation
└── tests/               # Test suites
```

### Available Commands

**Development**

```bash
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build
```

**Database**

```bash
npm run db:push         # Push schema changes
npm run db:generate     # Generate migration files
npm run db:studio       # Open database GUI
```

**Testing**

```bash
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:e2e        # End-to-end tests
npm run test:coverage   # Generate coverage report
```

**Code Quality**

```bash
npm run lint            # Check code style
npm run format          # Auto-format code
npm run type-check      # TypeScript validation
```

### Environment Configuration

Key environment variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/koveo_gestion

# Authentication
SESSION_SECRET=your-session-secret-key

# Email (optional for development)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Features
ENABLE_DEMO_MODE=true
SYNC_DEMO_ON_DEPLOY=false
```

## Understanding Quebec Requirements

### Law 25 Compliance

Koveo Gestion implements Quebec's privacy law requirements:

**Data Protection**

- Explicit consent for data collection
- Data minimization principles
- Right to deletion and portability
- Breach notification procedures

**Implementation Examples**

```typescript
// Consent tracking
interface ConsentRecord {
  userId: string;
  dataType: 'personal' | 'financial' | 'maintenance';
  consentGiven: boolean;
  timestamp: Date;
  purpose: string;
}

// Data retention
class DataRetentionService {
  async scheduleDataDeletion(userId: string, retentionPeriod: number) {
    // Automatic data cleanup after retention period
  }
}
```

### Bilingual Support

The platform supports both English and French:

**Translation Structure**

```typescript
const translations = {
  en: {
    dashboard: 'Dashboard',
    maintenance: 'Maintenance',
    bills: 'Bills',
  },
  fr: {
    dashboard: 'Tableau de bord',
    maintenance: 'Entretien',
    bills: 'Factures',
  },
};
```

**Using Translations**

```tsx
function ComponentExample() {
  const { t } = useTranslation();

  return <h1>{t('dashboard.welcome')}</h1>;
}
```

## Common Development Tasks

### Adding a New Page

1. **Create Page Component**

   ```tsx
   // client/src/pages/NewFeaturePage.tsx
   export default function NewFeaturePage() {
     return (
       <div>
         <h1>New Feature</h1>
         {/* Page content */}
       </div>
     );
   }
   ```

2. **Add Route**

   ```tsx
   // client/src/App.tsx
   import NewFeaturePage from './pages/NewFeaturePage';

   <Route path='/new-feature' component={NewFeaturePage} />;
   ```

3. **Update Navigation**
   ```tsx
   // Add to navigation component
   <Link href='/new-feature'>New Feature</Link>
   ```

### Creating API Endpoints

1. **Define Schema**

   ```typescript
   // shared/schema.ts
   export const newFeatures = pgTable('new_features', {
     id: uuid('id').primaryKey().defaultRandom(),
     name: text('name').notNull(),
     description: text('description'),
     createdAt: timestamp('created_at').defaultNow(),
   });
   ```

2. **Add API Route**

   ```typescript
   // server/api/new-features.ts
   export async function createNewFeature(req: Request, res: Response) {
     const { name, description } = req.body;

     const feature = await db
       .insert(newFeatures)
       .values({
         name,
         description,
       })
       .returning();

     res.json(feature[0]);
   }
   ```

3. **Frontend Integration**
   ```tsx
   // Use in React component
   const { mutate } = useMutation({
     mutationFn: (data) => apiRequest('POST', '/api/new-features', data),
     onSuccess: () => {
       // Handle success
     },
   });
   ```

## Troubleshooting

### Common Issues

**Database Connection Failed**

```bash
# Check PostgreSQL is running
pg_ctl status

# Verify connection string in .env
DATABASE_URL=postgresql://user:password@localhost:5432/koveo_gestion

# Test connection
npm run db:studio
```

**Build Errors**

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run type-check

# Fix linting issues
npm run lint --fix
```

**Tests Failing**

```bash
# Run specific test file
npm test -- auth-hooks.test.tsx

# Update snapshots
npm test -- --updateSnapshot

# Check test coverage
npm run test:coverage
```

### Getting Help

**Documentation**

- [API Reference](../API_DOCUMENTATION.md)
- [Component Guide](../COMPONENT_DOCUMENTATION.md)
- [Quebec Compliance](../QUEBEC_COMPLIANCE_EXAMPLES.md)

**Development Resources**

- [Contributing Guide](../../CONTRIBUTING.md)
- [Code Review Standards](../CODE_REVIEW_GUIDE.md)
- [Architecture Overview](../references/PROJECT_STRUCTURE_GUIDE.md)

## Next Steps

1. **Explore Features**: Try different user roles and features
2. **Read Documentation**: Review API and component documentation
3. **Understand Architecture**: Study the project structure and patterns
4. **Make Changes**: Start with small improvements or bug fixes
5. **Contribute**: Follow the contributing guidelines for larger changes

Welcome to the Koveo Gestion development team!
