# Deployment Guide

> Complete guide for deploying Koveo Gestion to production on Replit

## Overview

Koveo Gestion is optimized for deployment on Replit with automatic database optimization, SSL management, and performance monitoring. This guide covers both initial deployment and ongoing maintenance.

## Prerequisites

### Required Services

- **Replit Account**: Professional or Team plan recommended
- **Neon Database**: Serverless PostgreSQL instance
- **SendGrid Account**: Email service provider (optional)
- **Domain Name**: Custom domain for production (optional)

### Environment Preparation

- Tested codebase with passing tests
- Database migrations ready
- Environment variables configured
- SSL certificates prepared (if using custom domain)

## Initial Deployment Setup

### 1. Environment Configuration

Create production environment variables in Replit:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@ep-cool-name-123456.us-east-1.aws.neon.tech/koveo_gestion?sslmode=require

# Application Security
SESSION_SECRET=your-super-secure-session-secret-key-here
NODE_ENV=production

# Email Service (Optional)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key

# Feature Flags
SYNC_DEMO_ON_DEPLOY=true
ENABLE_SSL_RENEWAL=true
ENABLE_PERFORMANCE_MONITORING=true

# Quebec Compliance
LANGUAGE_DEFAULT=en
ENABLE_BILINGUAL=true
DATA_RETENTION_DAYS=2555  # 7 years as per Quebec requirements
```

### 2. Database Setup

The application automatically handles database setup on deployment:

```typescript
// Automatic database initialization
async function initializeDatabase() {
  try {
    // Apply schema changes
    console.log('🔧 Applying database schema changes...');
    await db.execute(sql`SELECT 1`); // Test connection

    // Run optimizations
    console.log('⚡ Optimizing database performance...');
    await DatabaseOptimizationService.applyOptimizations();

    // Setup materialized views
    await DatabaseOptimizationService.createMaterializedViews();

    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}
```

### 3. Build Configuration

The application uses optimized build settings:

```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server",
    "build:client": "cd client && vite build",
    "build:server": "esbuild server/index.ts --bundle --platform=node --target=node18 --outfile=dist/server.js",
    "start": "node dist/server.js",
    "deploy": "npm run build && npm run start"
  }
}
```

## Production Deployment Process

### 1. Pre-Deployment Checklist

Before deploying to production, verify:

```bash
# Code Quality
npm run lint           # ✅ No linting errors
npm run type-check     # ✅ No TypeScript errors
npm test               # ✅ All tests passing
npm run build          # ✅ Build succeeds

# Security
npm audit              # ✅ No high-severity vulnerabilities
npm run test:security  # ✅ Security tests passing

# Performance
npm run bundle-analyze # ✅ Bundle size acceptable
npm run lighthouse     # ✅ Performance metrics good

# Quebec Compliance
npm run test:quebec    # ✅ Compliance tests passing
npm run translation-check # ✅ All strings translated
```

### 2. Automated Deployment Pipeline

The deployment process includes automatic optimizations:

```typescript
// Deployment initialization sequence
async function deploymentSequence() {
  console.log('🚀 Starting Koveo Gestion deployment...');

  // 1. Database optimizations
  await DatabaseOptimizationService.initialize();

  // 2. SSL certificate setup
  if (process.env.ENABLE_SSL_RENEWAL === 'true') {
    await SSLService.initialize();
  }

  // 3. Background job initialization
  await BackgroundJobService.startAll();

  // 4. Demo data synchronization
  if (process.env.SYNC_DEMO_ON_DEPLOY === 'true') {
    await DemoOrganizationService.syncToProd();
  }

  // 5. Health checks
  await HealthCheckService.validateDeployment();

  console.log('✅ Deployment completed successfully');
}
```

### 3. Database Optimization

The system automatically applies performance optimizations:

```sql
-- Automatic index creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_email
ON users(email) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_org_active
ON buildings(organization_id, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_unpaid
ON bills(residence_id, due_date) WHERE status IN ('sent', 'overdue');

-- Materialized views for reporting
CREATE MATERIALIZED VIEW mv_building_stats AS
SELECT
  b.id,
  b.name,
  COUNT(r.id) as total_units,
  COUNT(CASE WHEN r.is_occupied = true THEN 1 END) as occupied_units,
  AVG(r.square_footage) as avg_unit_size
FROM buildings b
LEFT JOIN residences r ON b.id = r.building_id
WHERE b.is_active = true
GROUP BY b.id, b.name;
```

## SSL Certificate Management

### Automatic SSL Renewal

The application includes automatic Let's Encrypt integration:

```typescript
class SSLService {
  static async initialize() {
    console.log('[SSL-RENEWAL] [INFO] SSL service initialized');

    // Schedule automatic renewal
    cron.schedule('0 2 * * *', async () => {
      await this.renewCertificates();
    });
  }

  static async renewCertificates() {
    try {
      const domains = this.getConfiguredDomains();

      for (const domain of domains) {
        const client = new acme.Client({
          directoryUrl: acme.directory.letsencrypt.production,
          accountKey: await this.getAccountKey(),
        });

        const [key, csr] = await acme.crypto.createCsr({
          commonName: domain,
        });

        const cert = await client.auto({
          csr,
          email: process.env.SSL_EMAIL,
          termsOfServiceAgreed: true,
          challengeCreateFn: this.createChallenge,
          challengeRemoveFn: this.removeChallenge,
        });

        await this.saveCertificate(domain, key, cert);
        console.log(`[SSL-RENEWAL] Certificate renewed for ${domain}`);
      }
    } catch (error) {
      console.error('[SSL-RENEWAL] Renewal failed:', error);
    }
  }
}
```

## Performance Monitoring

### Real-time Performance Tracking

```typescript
class PerformanceMonitoringService {
  static initialize() {
    // Track database query performance
    this.monitorDatabaseQueries();

    // Monitor API response times
    this.monitorAPIPerformance();

    // Track system resources
    this.monitorSystemResources();
  }

  private static monitorDatabaseQueries() {
    const originalQuery = db.execute;

    db.execute = async function (query: any) {
      const startTime = Date.now();
      const result = await originalQuery.call(this, query);
      const duration = Date.now() - startTime;

      if (duration > 100) {
        // Log slow queries
        console.log(`Slow query detected: ${query.sql} took ${duration}ms`);

        // Alert if extremely slow
        if (duration > 1000) {
          await AlertService.sendSlowQueryAlert(query.sql, duration);
        }
      }

      return result;
    };
  }

  private static monitorAPIPerformance() {
    // Express middleware for response time tracking
    app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;

        console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);

        // Alert on slow API responses
        if (duration > 2000) {
          AlertService.sendSlowAPIAlert(req.path, duration);
        }
      });

      next();
    });
  }
}
```

### Health Check Endpoints

```typescript
// Health check endpoints for monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
  });
});

app.get('/healthz', async (req, res) => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);

    // Test critical services
    const checks = await Promise.all([
      HealthCheckService.checkDatabase(),
      HealthCheckService.checkEmail(),
      HealthCheckService.checkFileSystem(),
    ]);

    const allHealthy = checks.every((check) => check.healthy);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/ready', async (req, res) => {
  // Check if application is ready to serve requests
  const isReady = await HealthCheckService.checkReadiness();

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
  });
});
```

## Monitoring & Alerting

### Error Tracking

```typescript
class ErrorTrackingService {
  static initialize() {
    // Global error handler
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.reportError(error, 'uncaught_exception');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.reportError(reason, 'unhandled_rejection');
    });

    // Express error handler
    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Express Error:', error);

      this.reportError(error, 'express_error', {
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private static async reportError(error: any, type: string, context?: any) {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      type,
      context,
      timestamp: new Date(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
    };

    // Log to console
    console.error('Error Report:', errorReport);

    // Store in database for analysis
    try {
      await db.insert(errorLogsTable).values(errorReport);
    } catch (dbError) {
      console.error('Failed to store error in database:', dbError);
    }

    // Send critical errors to alerting system
    if (this.isCriticalError(error)) {
      await this.sendCriticalAlert(errorReport);
    }
  }
}
```

### Backup Strategy

```typescript
class BackupService {
  static initialize() {
    // Schedule daily database backups
    cron.schedule('0 3 * * *', async () => {
      await this.createDatabaseBackup();
    });

    // Schedule weekly full system backup
    cron.schedule('0 4 * * 0', async () => {
      await this.createFullSystemBackup();
    });
  }

  static async createDatabaseBackup() {
    try {
      console.log('🔄 Starting database backup...');

      const backupName = `koveo-gestion-db-${new Date().toISOString().split('T')[0]}`;

      // For Neon database, use their backup API
      const backup = await this.createNeonBackup(backupName);

      // Store backup metadata
      await db.insert(backupsTable).values({
        name: backupName,
        type: 'database',
        size: backup.size,
        location: backup.location,
        createdAt: new Date(),
      });

      console.log('✅ Database backup completed:', backupName);
    } catch (error) {
      console.error('❌ Database backup failed:', error);
      await AlertService.sendBackupFailureAlert(error);
    }
  }

  private static async createNeonBackup(name: string) {
    // Implementation depends on Neon API
    // This is a placeholder for the actual backup logic
    return {
      size: 0,
      location: `neon://backups/${name}`,
    };
  }
}
```

## Rollback Procedures

### Automated Rollback

```typescript
class RollbackService {
  static async performRollback(version: string) {
    console.log(`🔄 Starting rollback to version ${version}...`);

    try {
      // 1. Stop current application
      await this.gracefulShutdown();

      // 2. Restore database from backup
      await this.restoreDatabase(version);

      // 3. Deploy previous version
      await this.deployVersion(version);

      // 4. Verify deployment
      await this.verifyRollback();

      console.log('✅ Rollback completed successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      await AlertService.sendRollbackFailureAlert(error);
      throw error;
    }
  }

  private static async gracefulShutdown() {
    // Close database connections
    await db.end();

    // Stop background jobs
    await BackgroundJobService.stopAll();

    // Drain existing requests
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
}
```

## Custom Domain Configuration

### DNS Configuration

For custom domains, configure DNS records:

```
# A Record
@ -> 192.168.1.1 (Replit IP)
www -> 192.168.1.1 (Replit IP)

# CNAME Record (alternative)
www -> your-repl-name.repl.co

# MX Record (for email)
@ -> mail.your-domain.com (priority 10)
```

### Domain Validation

```typescript
class DomainService {
  static async validateCustomDomain(domain: string) {
    try {
      // Check DNS propagation
      const dnsRecords = await dns.resolve4(domain);
      console.log(`DNS records for ${domain}:`, dnsRecords);

      // Verify domain ownership
      const ownershipToken = await this.generateOwnershipToken();
      const verification = await this.verifyDomainOwnership(domain, ownershipToken);

      if (!verification.valid) {
        throw new Error('Domain ownership verification failed');
      }

      // Request SSL certificate
      await SSLService.requestCertificate(domain);

      return {
        domain,
        verified: true,
        ssl: true,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Domain validation failed:', error);
      throw error;
    }
  }
}
```

## Production Maintenance

### Regular Maintenance Tasks

```typescript
class MaintenanceService {
  static initialize() {
    // Daily maintenance
    cron.schedule('0 1 * * *', async () => {
      await this.dailyMaintenance();
    });

    // Weekly maintenance
    cron.schedule('0 2 * * 1', async () => {
      await this.weeklyMaintenance();
    });

    // Monthly maintenance
    cron.schedule('0 3 1 * *', async () => {
      await this.monthlyMaintenance();
    });
  }

  private static async dailyMaintenance() {
    console.log('🔧 Starting daily maintenance...');

    // Clean up old sessions
    await this.cleanupOldSessions();

    // Update database statistics
    await this.updateDatabaseStats();

    // Clear expired caches
    await this.clearExpiredCaches();

    // Generate daily reports
    await this.generateDailyReports();

    console.log('✅ Daily maintenance completed');
  }

  private static async weeklyMaintenance() {
    console.log('🔧 Starting weekly maintenance...');

    // Full database vacuum
    await this.vacuumDatabase();

    // Rotate log files
    await this.rotateLogFiles();

    // Update search indexes
    await this.updateSearchIndexes();

    // Security audit
    await this.performSecurityAudit();

    console.log('✅ Weekly maintenance completed');
  }
}
```

## Troubleshooting Common Issues

### Database Connection Issues

```bash
# Check database status
curl -f https://your-app.repl.co/health

# Test database connectivity
npm run db:test-connection

# Check recent database logs
npm run logs:database
```

### Performance Issues

```bash
# Check system resources
npm run monitor:resources

# Analyze slow queries
npm run analyze:queries

# Generate performance report
npm run report:performance
```

### SSL Certificate Issues

```bash
# Check SSL certificate status
npm run ssl:status

# Force certificate renewal
npm run ssl:renew

# Check certificate expiration
npm run ssl:check-expiry
```

## Security Considerations

### Production Security Checklist

- [ ] Strong session secrets configured
- [ ] Database connections encrypted (SSL)
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Input validation implemented
- [ ] Audit logging enabled
- [ ] Error handling sanitized
- [ ] Backup encryption enabled
- [ ] SSL certificates valid
- [ ] Quebec compliance verified

### Security Monitoring

```typescript
// Security event monitoring
class SecurityMonitoringService {
  static initialize() {
    // Monitor failed login attempts
    this.monitorFailedLogins();

    // Track unusual access patterns
    this.monitorAccessPatterns();

    // Watch for potential attacks
    this.monitorSecurityThreats();
  }

  private static monitorFailedLogins() {
    // Implementation for monitoring failed login attempts
    // Alert after 5 failed attempts from same IP
  }

  private static monitorAccessPatterns() {
    // Implementation for detecting unusual access patterns
    // Alert on suspicious data access
  }
}
```

This deployment guide provides comprehensive coverage of deploying and maintaining Koveo Gestion in production. Follow these procedures to ensure a secure, performant, and reliable deployment.
