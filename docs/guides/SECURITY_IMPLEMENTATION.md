# Security Implementation Guide

> Comprehensive security practices for Koveo Gestion platform

## Security Architecture Overview

Koveo Gestion implements defense-in-depth security with multiple layers:

1. **Authentication & Authorization**: Session-based auth with RBAC (36 test cases ✅)
2. **Data Protection**: Encryption at rest and in transit
3. **Input Validation**: Comprehensive data sanitization
4. **Quebec Law 25 Compliance**: Privacy by design
5. **Infrastructure Security**: Secure deployment and monitoring
6. **Password Security**: Advanced validation with edge case handling (17 test cases ✅)

**Latest Updates (September 2025)**:
- RBAC system fully validated with comprehensive test coverage
- Password validation edge cases resolved
- Demo user write operation restrictions enforced
- Server build process hardened for test environments

## Authentication System

### Session-Based Authentication

```typescript
// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PgStore({
      pool: db,
      tableName: 'user_sessions',
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
    },
  })
);
```

### Password Security

```typescript
import { pbkdf2Sync, randomBytes } from 'crypto';

class PasswordService {
  /**
   * Hash password using PBKDF2 with random salt
   */
  static hashPassword(password: string): { hash: string; salt: string } {
    const salt = randomBytes(32).toString('hex');
    const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

    return { hash, salt };
  }

  /**
   * Verify password against stored hash
   */
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const hashToVerify = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === hashToVerify;
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

## Role-Based Access Control (RBAC)

### Permission System

```typescript
// Permission definitions
export const PERMISSIONS = {
  // User management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // Building management
  BUILDING_CREATE: 'building:create',
  BUILDING_READ: 'building:read',
  BUILDING_UPDATE: 'building:update',
  BUILDING_DELETE: 'building:delete',

  // Financial management
  BILL_CREATE: 'bill:create',
  BILL_READ: 'bill:read',
  BILL_UPDATE: 'bill:update',
  BILL_APPROVE: 'bill:approve',

  // System administration
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_CONFIG: 'system:config',
} as const;

// Role definitions with permissions
export const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.BUILDING_CREATE,
    PERMISSIONS.BUILDING_READ,
    PERMISSIONS.BUILDING_UPDATE,
    PERMISSIONS.BUILDING_DELETE,
    PERMISSIONS.BILL_CREATE,
    PERMISSIONS.BILL_READ,
    PERMISSIONS.BILL_UPDATE,
    PERMISSIONS.BILL_APPROVE,
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.SYSTEM_CONFIG,
  ],

  manager: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.BUILDING_READ,
    PERMISSIONS.BUILDING_UPDATE,
    PERMISSIONS.BILL_CREATE,
    PERMISSIONS.BILL_READ,
    PERMISSIONS.BILL_UPDATE,
  ],

  tenant: [PERMISSIONS.USER_READ, PERMISSIONS.BUILDING_READ, PERMISSIONS.BILL_READ],

  resident: [PERMISSIONS.USER_READ, PERMISSIONS.BILL_READ],
} as const;
```

### Authorization Middleware

```typescript
/**
 * Middleware to check if user has required permissions
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        required: permission,
        userRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * Check multiple permissions (user needs all)
 */
export function requireAllPermissions(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const missingPermissions = permissions.filter((p) => !userPermissions.includes(p));

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        missing: missingPermissions,
      });
    }

    next();
  };
}

/**
 * Resource-based authorization (user can only access own resources)
 */
export function requireResourceOwnership(resourceField = 'userId') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Allow admins to access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceUserId = req.body[resourceField] || req.params[resourceField];

    if (resourceUserId && resourceUserId !== req.user.id) {
      return res.status(403).json({
        message: 'Access denied: Resource not owned by user',
      });
    }

    next();
  };
}
```

### Usage Examples

```typescript
// API route protection
app.post(
  '/api/users',
  requireAuthentication,
  requirePermission(PERMISSIONS.USER_CREATE),
  createUser
);

app.delete(
  '/api/buildings/:id',
  requireAuthentication,
  requirePermission(PERMISSIONS.BUILDING_DELETE),
  deleteBuilding
);

app.get(
  '/api/bills/user/:userId',
  requireAuthentication,
  requireResourceOwnership('userId'),
  getUserBills
);
```

## Input Validation & Sanitization

### Zod Schema Validation

```typescript
import { z } from 'zod';

// User input validation
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long').toLowerCase().trim(),

  firstName: z
    .string()
    .min(1, 'First name required')
    .max(100, 'First name too long')
    .regex(/^[a-zA-ZÀ-ÿ\s\-']+$/, 'Invalid characters in first name')
    .trim(),

  lastName: z
    .string()
    .min(1, 'Last name required')
    .max(100, 'Last name too long')
    .regex(/^[a-zA-ZÀ-ÿ\s\-']+$/, 'Invalid characters in last name')
    .trim(),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),

  role: z.enum(['admin', 'manager', 'tenant', 'resident']),

  organizationId: z.string().uuid('Invalid organization ID'),
});

// Building validation with Quebec-specific requirements
export const CreateBuildingSchema = z.object({
  name: z.string().min(1, 'Building name required').max(200, 'Building name too long').trim(),

  address: z.string().min(5, 'Complete address required').max(500, 'Address too long').trim(),

  city: z.string().min(1, 'City required').max(100, 'City name too long').trim(),

  postalCode: z
    .string()
    .regex(/^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/, 'Invalid Quebec postal code format')
    .transform((pc) => pc.toUpperCase()),

  buildingType: z.enum(['condo', 'apartment', 'townhouse', 'mixed']),

  totalUnits: z
    .number()
    .int('Must be whole number')
    .min(1, 'Must have at least 1 unit')
    .max(1000, 'Too many units'),

  yearBuilt: z
    .number()
    .int()
    .min(1800, 'Invalid year')
    .max(new Date().getFullYear(), 'Cannot be future year'),
});
```

### Validation Middleware

```typescript
/**
 * Generic validation middleware using Zod schemas
 */
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and sanitize request body
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          message: 'Validation failed',
          errors,
        });
      }

      next(error);
    }
  };
}

// Usage example
app.post('/api/users', validateRequest(CreateUserSchema), createUser);
```

## Data Protection

### Database Security

```typescript
// Query parameterization to prevent SQL injection
export async function getUserById(id: string): Promise<User | null> {
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id)) // Drizzle handles parameterization
    .limit(1);

  return users[0] || null;
}

// Input sanitization for search queries
export async function searchUsers(query: string): Promise<User[]> {
  const sanitizedQuery = query
    .replace(/[%_]/g, '\\$&') // Escape LIKE wildcards
    .slice(0, 100) // Limit query length
    .trim();

  return await db
    .select()
    .from(usersTable)
    .where(
      or(
        ilike(usersTable.firstName, `%${sanitizedQuery}%`),
        ilike(usersTable.lastName, `%${sanitizedQuery}%`),
        ilike(usersTable.email, `%${sanitizedQuery}%`)
      )
    )
    .limit(50); // Limit results
}
```

### Data Encryption

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class EncryptionService {
  private static readonly algorithm = 'aes-256-gcm';
  private static readonly key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

  /**
   * Encrypt sensitive data before database storage
   */
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypt sensitive data from database
   */
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// Usage example for sensitive data
export async function storeSensitiveData(userId: string, data: string) {
  const encrypted = EncryptionService.encrypt(data);

  await db.insert(sensitiveDataTable).values({
    userId,
    encryptedData: encrypted.encrypted,
    iv: encrypted.iv,
    tag: encrypted.tag,
  });
}
```

## Quebec Law 25 Compliance

### Data Consent Management

```typescript
interface ConsentRecord {
  id: string;
  userId: string;
  dataType: 'personal' | 'financial' | 'maintenance' | 'communications';
  purpose: string;
  consentGiven: boolean;
  consentDate: Date;
  expiryDate?: Date;
  withdrawalDate?: Date;
  legalBasis: 'consent' | 'contract' | 'legal_obligation';
}

class ConsentService {
  /**
   * Record user consent for data processing
   */
  static async recordConsent(
    consent: Omit<ConsentRecord, 'id' | 'consentDate'>
  ): Promise<ConsentRecord> {
    const consentRecord = await db
      .insert(consentTable)
      .values({
        ...consent,
        consentDate: new Date(),
      })
      .returning();

    // Log consent for audit trail
    await AuditService.log({
      action: 'consent_recorded',
      userId: consent.userId,
      details: { dataType: consent.dataType, purpose: consent.purpose },
    });

    return consentRecord[0];
  }

  /**
   * Withdraw consent and schedule data deletion
   */
  static async withdrawConsent(userId: string, dataType: string): Promise<void> {
    await db
      .update(consentTable)
      .set({
        consentGiven: false,
        withdrawalDate: new Date(),
      })
      .where(and(eq(consentTable.userId, userId), eq(consentTable.dataType, dataType)));

    // Schedule data deletion according to retention policy
    await DataRetentionService.scheduleDataDeletion(userId, dataType);

    await AuditService.log({
      action: 'consent_withdrawn',
      userId,
      details: { dataType },
    });
  }

  /**
   * Check if user has valid consent for data type
   */
  static async hasValidConsent(userId: string, dataType: string): Promise<boolean> {
    const consent = await db
      .select()
      .from(consentTable)
      .where(
        and(
          eq(consentTable.userId, userId),
          eq(consentTable.dataType, dataType),
          eq(consentTable.consentGiven, true)
        )
      )
      .limit(1);

    if (!consent[0]) return false;

    // Check if consent has expired
    if (consent[0].expiryDate && consent[0].expiryDate < new Date()) {
      return false;
    }

    return true;
  }
}
```

### Data Portability

```typescript
class DataPortabilityService {
  /**
   * Export all user data in portable format
   */
  static async exportUserData(userId: string): Promise<UserDataExport> {
    // Verify user has right to export this data
    const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user[0]) {
      throw new Error('User not found');
    }

    const exportData: UserDataExport = {
      user: user[0],
      buildings: [],
      residences: [],
      maintenanceRequests: [],
      bills: [],
      documents: [],
      exportDate: new Date(),
      format: 'JSON',
      version: '1.0',
    };

    // Export related data based on user permissions
    if (user[0].role === 'admin' || user[0].role === 'manager') {
      exportData.buildings = await this.getUserBuildings(userId);
    }

    exportData.residences = await this.getUserResidences(userId);
    exportData.maintenanceRequests = await this.getUserMaintenanceRequests(userId);
    exportData.bills = await this.getUserBills(userId);
    exportData.documents = await this.getUserDocuments(userId);

    // Log data export for audit
    await AuditService.log({
      action: 'data_exported',
      userId,
      details: {
        recordCount: this.countExportRecords(exportData),
        format: 'JSON',
      },
    });

    return exportData;
  }

  /**
   * Delete all user data (right to be forgotten)
   */
  static async deleteUserData(userId: string): Promise<void> {
    // Begin transaction
    await db.transaction(async (tx) => {
      // Delete user-related records in correct order (foreign key constraints)
      await tx.delete(maintenanceRequestsTable).where(eq(maintenanceRequestsTable.userId, userId));
      await tx.delete(billsTable).where(eq(billsTable.userId, userId));
      await tx.delete(documentsTable).where(eq(documentsTable.userId, userId));
      await tx.delete(consentTable).where(eq(consentTable.userId, userId));

      // Anonymize audit logs (keep for legal compliance but remove PII)
      await tx
        .update(auditLogsTable)
        .set({
          userId: null,
          details: { anonymized: true, originalUserId: userId },
        })
        .where(eq(auditLogsTable.userId, userId));

      // Finally delete user record
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });

    await AuditService.log({
      action: 'user_data_deleted',
      userId: null, // User no longer exists
      details: { deletedUserId: userId },
    });
  }
}
```

## Security Monitoring & Incident Response

### Audit Logging

```typescript
interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class AuditService {
  /**
   * Log security-relevant events
   */
  static async log(
    event: Omit<AuditLog, 'id' | 'timestamp' | 'ipAddress' | 'userAgent'>,
    req?: Request
  ): Promise<void> {
    const auditLog: Partial<AuditLog> = {
      ...event,
      timestamp: new Date(),
      ipAddress: req?.ip || 'system',
      userAgent: req?.get('User-Agent') || 'system',
    };

    await db.insert(auditLogsTable).values(auditLog);

    // Alert on high-severity events
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.sendSecurityAlert(auditLog);
    }
  }

  /**
   * Monitor for suspicious activity patterns
   */
  static async detectAnomalies(): Promise<SecurityAnomaly[]> {
    const anomalies: SecurityAnomaly[] = [];

    // Check for multiple failed login attempts
    const failedLogins = await db
      .select({
        userId: auditLogsTable.userId,
        count: sql<number>`count(*)`,
        lastAttempt: sql<Date>`max(timestamp)`,
      })
      .from(auditLogsTable)
      .where(
        and(
          eq(auditLogsTable.action, 'login_failed'),
          gt(auditLogsTable.timestamp, sql`now() - interval '1 hour'`)
        )
      )
      .groupBy(auditLogsTable.userId)
      .having(sql`count(*) >= 5`);

    for (const login of failedLogins) {
      anomalies.push({
        type: 'brute_force_attempt',
        userId: login.userId,
        severity: 'high',
        details: { failedAttempts: login.count, lastAttempt: login.lastAttempt },
      });
    }

    // Check for unusual data access patterns
    const unusualAccess = await this.detectUnusualDataAccess();
    anomalies.push(...unusualAccess);

    return anomalies;
  }

  private static async sendSecurityAlert(event: Partial<AuditLog>): Promise<void> {
    // Send alert to security team
    // Implementation depends on alerting system (email, Slack, etc.)
  }
}
```

## Security Headers & HTTPS

### Express Security Configuration

```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', authLimiter);
```

## Security Testing

### Automated Security Testing

```typescript
// Security test examples
describe('Authentication Security', () => {
  it('should reject weak passwords', async () => {
    const weakPasswords = ['123456', 'password', 'abc123'];

    for (const password of weakPasswords) {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password,
        firstName: 'Test',
        lastName: 'User',
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain(
        expect.objectContaining({
          field: 'password',
        })
      );
    }
  });

  it('should prevent SQL injection in user search', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const response = await request(app)
      .get(`/api/users/search?q=${encodeURIComponent(maliciousInput)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    // Verify users table still exists
    const usersCount = await db.select({ count: sql`count(*)` }).from(usersTable);
    expect(usersCount[0].count).toBeGreaterThan(0);
  });
});
```

## Security Best Practices Summary

### Development Guidelines

1. **Always validate input**: Use Zod schemas for all user input
2. **Parameterize queries**: Use Drizzle ORM to prevent SQL injection
3. **Hash passwords**: Use PBKDF2 or Argon2 for password hashing
4. **Implement RBAC**: Check permissions for every action
5. **Log security events**: Maintain comprehensive audit trails
6. **Encrypt sensitive data**: Use AES-256 for data at rest
7. **Use HTTPS**: Always encrypt data in transit
8. **Rate limit requests**: Prevent brute force and DoS attacks
9. **Validate Quebec compliance**: Ensure all features meet Law 25 requirements
10. **Regular security reviews**: Audit code and infrastructure regularly

### Emergency Procedures

**Data Breach Response**

1. Immediate containment
2. Impact assessment
3. Quebec regulatory notification (within 72 hours)
4. User notification (without undue delay)
5. Forensic analysis
6. System hardening
7. Post-incident review

**Security Incident Escalation**

- **Low**: Log and monitor
- **Medium**: Alert development team
- **High**: Alert security team and management
- **Critical**: Immediate response team activation

This security implementation guide provides the foundation for maintaining a secure, Law 25-compliant property management platform.
