# Server Directory

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Database Integration](#database-integration)
- [API Design Patterns](#api-design-patterns)
- [Email System](#email-system)
- [SSL Certificate Management](#ssl-certificate-management)
- [Performance Optimization](#performance-optimization)
- [Security Measures](#security-measures)
- [Development Guidelines](#development-guidelines)
- [Testing Strategy](#testing-strategy)

## Overview

This directory contains the backend Express.js server for the Koveo Gestion application, providing API endpoints, authentication, data persistence, and business logic for the property management platform.

## Architecture

```text
server/
├── routes.ts              # API route definitions and handlers
├── storage.ts             # Data access layer and storage interface
├── middleware.ts          # Custom middleware (auth, logging, etc.)
├── vite.ts               # Vite integration for development
├── ssl-manager.ts        # SSL certificate management
├── email-service.ts      # Email sending and templates
├── db/                   # Database utilities and migrations
├── types/                # Server-specific TypeScript types
└── utils/                # Server utility functions
```

## Core Components

### API Routes (`routes.ts`)
**Purpose**: RESTful API endpoints for all application functionality

**Key Features**:
- Authentication and authorization endpoints
- User and organization management
- Property and residence operations
- Financial management (bills, budgets)
- Maintenance request handling
- Document management
- Notification system
- Roadmap and feature management

**Route Structure**:
```typescript
// Authentication
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/user
POST   /api/auth/refresh

// User Management
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
POST   /api/users/:id/reset-password

// Organizations
GET    /api/organizations
POST   /api/organizations
PUT    /api/organizations/:id
DELETE /api/organizations/:id
```

### Data Storage (`storage.ts`)
**Purpose**: Abstracted data access layer with multiple storage implementations

**Storage Interface**:
```typescript
interface IStorage {
  // User operations
  createUser(user: InsertUser): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<void>;
  deleteUser(id: string): Promise<void>;
  
  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizations(): Promise<Organization[]>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<void>;
  
  // ... other entity operations
}
```

**Storage Implementations**:
- **PostgresStorage**: Production database storage with Drizzle ORM
- **MemStorage**: In-memory storage for development and testing

### Middleware (`middleware.ts`)
**Purpose**: Request processing and security middleware

**Available Middleware**:
- **Authentication**: JWT token validation and user context
- **Authorization**: Role-based access control
- **Rate Limiting**: API request throttling
- **Request Logging**: Comprehensive request/response logging
- **Error Handling**: Structured error responses
- **CORS**: Cross-origin request handling
- **Security Headers**: Security best practices

## Authentication System

### JWT Implementation
```typescript
// Token generation
const generateTokens = (user: User) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId: user.id },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};
```

### Role-Based Access Control
```typescript
// Permission middleware
const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

## Database Integration

### Drizzle ORM
- Type-safe database operations
- Automatic migration generation
- Query optimization and caching
- Connection pooling and management

### Schema Management
```typescript
// Example schema definition
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: roleEnum('role').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Migration Strategy
```bash
# Generate migration
npm run db:generate

# Apply migrations
npm run db:push

# Reset database (development only)
npm run db:reset
```

## API Design Patterns

### Consistent Response Format
```typescript
// Success response
{
  data: any,
  message?: string,
  meta?: {
    pagination?: PaginationInfo,
    filters?: FilterInfo
  }
}

// Error response
{
  error: string,
  details?: any,
  code?: string
}
```

### Request Validation
```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['admin', 'manager', 'owner', 'resident']),
});

// Route handler with validation
app.post('/api/users', async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    const user = await storage.createUser(validatedData);
    res.json({ data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

## Email System

### SendGrid Integration
```typescript
// Email service configuration
const emailService = {
  async sendInvitation(email: string, token: string) {
    const msg = {
      to: email,
      from: 'noreply@koveogestion.com',
      templateId: 'd-invitation-template-id',
      dynamicTemplateData: {
        invitationUrl: `${FRONTEND_URL}/accept-invitation?token=${token}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    };
    
    await sgMail.send(msg);
  },
};
```

### Email Templates
- User invitation with role assignment
- Password reset requests
- System notifications
- Billing and payment reminders
- Maintenance request updates

## SSL Certificate Management

### Automatic SSL with Let's Encrypt
```typescript
// SSL certificate management
class SslManager {
  async obtainCertificate(domain: string) {
    const client = new acme.Client({
      directoryUrl: acme.directory.letsencrypt.production,
      accountKey: await acme.crypto.createPrivateKey(),
    });
    
    const certificate = await client.auto({
      csr: await this.generateCSR(domain),
      email: 'admin@koveogestion.com',
      termsOfServiceAgreed: true,
    });
    
    return certificate;
  }
}
```

## Performance Optimization

### Caching Strategy
- Redis for session storage
- Database query result caching
- API response caching with ETags
- Static asset caching

### Database Optimization
- Connection pooling
- Query optimization with indexes
- Materialized views for complex queries
- Background job processing

### Monitoring
- Request/response time tracking
- Error rate monitoring
- Database performance metrics
- Memory and CPU usage tracking

## Security Measures

### Data Protection
- Input sanitization and validation
- SQL injection prevention
- XSS protection
- CSRF token validation
- Rate limiting and DDoS protection

### Authentication Security
- Secure password hashing (bcrypt)
- JWT token rotation
- Session timeout management
- Brute force protection

### API Security
- HTTPS enforcement
- Security headers (HSTS, CSP, etc.)
- API versioning and deprecation
- Request size limits

## Quebec Compliance

### Law 25 (Privacy)
- Data collection consent tracking
- Right to deletion implementation
- Data portability support
- Breach notification system
- Privacy policy enforcement

### Accessibility
- API documentation in French and English
- Accessible error messages
- Consistent response formats
- Cultural considerations

## Development Guidelines

### Adding New Endpoints
1. Define route in `routes.ts`
2. Add validation schema with Zod
3. Implement storage operations
4. Add proper error handling
5. Include authentication/authorization
6. Write comprehensive tests
7. Update API documentation

### Database Changes
1. Update schema in `shared/schema.ts`
2. Generate migration with Drizzle
3. Update storage interface
4. Test migration on development database
5. Update related API endpoints
6. Add/update tests

### Error Handling Best Practices
```typescript
// Structured error handling
class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
  } else {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Testing Strategy

### Unit Tests
- Route handler logic
- Middleware functionality
- Storage operations
- Utility functions

### Integration Tests
- API endpoint testing
- Database integration
- Authentication flows
- Email service integration

### Example Test
```typescript
describe('User API', () => {
  it('should create user with valid data', async () => {
    const userData = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'manager',
    };
    
    const response = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);
    
    expect(response.body.data).toMatchObject(userData);
  });
});
```

## Deployment Considerations

### Production Configuration
- Environment variable management
- Database connection pooling
- SSL certificate automation
- Process management (PM2)
- Logging and monitoring

### Scaling Strategy
- Horizontal scaling with load balancers
- Database read replicas
- Caching layer implementation
- CDN for static assets