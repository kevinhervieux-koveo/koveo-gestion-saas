/**
 * @file Security Middleware for Koveo Gestion.
 * @description Comprehensive security headers and protections for Quebec property management SaaS
 * Ensures Law 25 compliance and protects against common web vulnerabilities.
 */

import helmet from 'helmet';
import cors from 'cors';
import express, { Express, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { logSecurity } from '../utils/logger.js';

/**
 * Generate a cryptographic nonce for CSP
 */
function generateNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Middleware to add CSP nonce to requests
 */
export function addCSPNonce(req: Request, res: Response, next: NextFunction): void {
  // Generate a unique nonce for this request
  res.locals.cspNonce = generateNonce();
  next();
}

/**
 * Content Security Policy configuration for Law 25 compliance
 * Restricts resource loading to protect user data and maintain privacy.
 * @param isDevelopment
 */
const getCSPConfig = (isDevelopment: boolean) => {
  const devSources = isDevelopment
    ? [
        "'unsafe-eval'", // Required for Vite HMR in development
        "'unsafe-inline'", // Required for dev CSS injection
        'ws:',
        'wss:', // WebSocket for HMR
        'localhost:*',
        '127.0.0.1:*',
        '*.replit.com',
        '*.replit.co',
        '*.replit.dev',
        'http:',
        'https:', // Allow all HTTP/HTTPS in development
      ]
    : [];

  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Use nonce for inline scripts in production, unsafe-inline only in dev
        ...(isDevelopment ? ["'unsafe-inline'"] : []),
        // Quebec government trusted domains for integration
        '*.quebec.ca',
        '*.gouv.qc.ca',
        // Essential CDNs with SRI
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
        // Allow application domain for built assets
        'https://koveo-gestion.com',
        'https://*.replit.app',
        'https://replit.com', // For Replit dev banner
        ...devSources,
      ],
      styleSrc: [
        "'self'",
        // Allow unsafe-inline for styles in both dev and prod (required for CSS-in-JS)
        // but only from trusted sources
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        // Allow application domain for built CSS
        'https://koveo-gestion.com',
        'https://*.replit.app',
        ...devSources,
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:', ...devSources],
      imgSrc: [
        "'self'",
        'data:',
        'blob:', // Required for image preview functionality during upload
        'https:', // Allow HTTPS images for property photos
        ...devSources,
      ],
      mediaSrc: ["'self'", 'blob:', 'data:', ...devSources],
      connectSrc: [
        "'self'",
        // Quebec government APIs for compliance
        '*.quebec.ca',
        '*.gouv.qc.ca',
        // Essential services
        'https://api.koveo.com',
        // Allow application domain for API calls
        'https://koveo-gestion.com',
        'https://*.replit.app',
        ...devSources,
      ],
      frameSrc: [
        "'self'",
        // Quebec government integration frames
        '*.quebec.ca',
        '*.gouv.qc.ca',
        ...devSources,
      ],
      frameAncestors: ["'none'"], // Prevent clickjacking
      objectSrc: ["'none'"], // Block plugins
      baseUri: ["'self'"], // Restrict base tag
      formAction: ["'self'"], // Restrict form submissions
      ...(process.env.NODE_ENV === 'production' && {
        upgradeInsecureRequests: [], // Force HTTPS in production
        blockAllMixedContent: [], // Block mixed content
      })
    },
    reportOnly: isDevelopment, // Only report in development, enforce in production
    reportUri: isDevelopment ? undefined : '/api/security/csp-report',
  };
};

/**
 * CORS configuration for Quebec property management
 * Allows cross-origin requests from authorized domains only.
 * @param isDevelopment
 */
const getCorsConfig = (isDevelopment: boolean) => {
  const allowedOrigins: (string | RegExp)[] = [
    'https://koveo-gestion.com', // Primary production domain
    'https://koveogestion.com',
    'https://app.koveogestion.com',
    'https://koveo.com',
    // Quebec government domains for integration
    'https://www.quebec.ca',
    'https://rdl.gouv.qc.ca', // Régie du logement
  ];

  if (isDevelopment) {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000',
      /.*\.replit\.com$/,
      /.*\.replit\.co$/,
      /.*\.replit\.dev$/
    );
  }

  // Always allow Replit domains for production deployments
  allowedOrigins.push(
    /^https:\/\/.*\.replit\.com$/,
    /^https:\/\/.*\.replit\.co$/,
    /^https:\/\/.*\.replit\.dev$/,
    /^https:\/\/.*\.replit\.app$/
  );

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check against allowed origins
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'), false);
      }
    },
    credentials: true, // Allow cookies for authentication
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-CSRF-Token',
      'X-Language', // For Quebec bilingual support
    ],
    exposedHeaders: [
      'X-Total-Count', // For pagination
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-Language', // For Quebec bilingual responses
    ],
    maxAge: 86400, // 24 hours preflight cache
  };
};

/**
 * Rate limiting configuration for different endpoints.
 */
export const rateLimitConfig = {
  // Authentication endpoints - more lenient for development
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Increased limit for development - 20 requests per windowMs
    message: {
      error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
      error_en: 'Too many login attempts. Please try again in 15 minutes.',
      code: 'RATE_LIMIT_AUTH',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Secure IP extraction for rate limiting
    keyGenerator: (req, _res) => {
      // Use a combination of IP and User-Agent for better accuracy
      const forwarded = req.headers['x-forwarded-for'] as string;
      const realIp = req.headers['x-real-ip'] as string;
      const clientIp =
        forwarded?.split(',')[0]?.trim() || realIp || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      return `${clientIp}:${userAgent.substring(0, 50)}`;
    },
  },

  // General API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Trop de requêtes. Veuillez réessayer plus tard.',
      error_en: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_API',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Password reset endpoints - more lenient than login
  passwordReset: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Increased limit for development - 30 attempts for password reset
    message: {
      error: 'Trop de demandes de réinitialisation. Veuillez réessayer dans 15 minutes.',
      error_en: 'Too many password reset requests. Please try again in 15 minutes.',
      code: 'RATE_LIMIT_PASSWORD_RESET',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, _res) => {
      // Use a combination of IP and User-Agent for better accuracy
      const forwarded = req.headers['x-forwarded-for'] as string;
      const realIp = req.headers['x-real-ip'] as string;
      const clientIp =
        forwarded?.split(',')[0]?.trim() || realIp || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      return `${clientIp}:${userAgent.substring(0, 50)}`;
    },
  },

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit file uploads
    message: {
      error: 'Limite de téléchargement atteinte. Veuillez réessayer dans 1 heure.',
      error_en: 'Upload limit reached. Please try again in 1 hour.',
      code: 'RATE_LIMIT_UPLOAD',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
};

/**
 * Configure comprehensive security middleware for Koveo Gestion
 * Implements Law 25 compliant security headers and protections.
 * @param app
 */
export function configureSecurityMiddleware(app: Express): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Configuring security middleware

  // CORS Configuration
  app.use(cors(getCorsConfig(isDevelopment)));

  // Helmet Security Headers
  app.use(
    helmet({
      // Content Security Policy - Always use custom config to ensure blob: support
      contentSecurityPolicy: getCSPConfig(isDevelopment),

      // Cross-Origin Embedder Policy - Relaxed in development
      crossOriginEmbedderPolicy: isDevelopment
        ? false
        : {
            policy: 'require-corp',
          },

      // Cross-Origin Opener Policy - Relaxed in development
      crossOriginOpenerPolicy: isDevelopment
        ? false
        : {
            policy: 'same-origin',
          },

      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: {
        policy: 'cross-origin', // Allow Quebec government integrations
      },

      // DNS Prefetch Control
      dnsPrefetchControl: {
        allow: false,
      },

      // Note: expectCt has been removed from helmet v5+
      // Certificate Transparency is now handled by browsers automatically

      // Note: permissionsPolicy has been replaced with individual policy headers in helmet v5+
      // These are now handled by individual middleware or manual headers

      // Frame Options
      frameguard: {
        action: 'deny', // Prevent embedding in frames (clickjacking protection)
      },

      // Hide Powered-By
      hidePoweredBy: true,

      // HSTS (HTTP Strict Transport Security)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      // IE No Open
      ieNoOpen: true,

      // No Sniff
      noSniff: true,

      // Origin Agent Cluster
      originAgentCluster: true,

      // Referrer Policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },

      // X-Download-Options
      xssFilter: true,
    })
  );

  // Additional custom security headers for Law 25 compliance
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Privacy and data protection headers for Quebec Law 25
    res.setHeader('X-Privacy-Policy', '/privacy-policy');
    res.setHeader('X-Data-Retention', '7-years'); // Quebec property records retention
    res.setHeader('X-Content-Language', 'fr-CA,en-CA'); // Bilingual support

    // Enhanced security headers to prevent antivirus flagging
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Additional security headers for enhanced protection
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', isDevelopment ? 'unsafe-none' : 'require-corp');
    
    // Cache control for sensitive endpoints
    if (req.path.includes('/api/auth') || req.path.includes('/api/user')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    
    // Security reporting headers
    res.setHeader('Report-To', JSON.stringify({
      group: 'security',
      max_age: 31536000,
      endpoints: [{ url: '/api/security/reports' }]
    }));
    
    // Network Error Logging
    res.setHeader('NEL', JSON.stringify({
      report_to: 'security',
      max_age: 31536000,
      include_subdomains: true
    }));

    // Ensure blob: support for image previews in document uploads
    if (isDevelopment) {
      const existingCSP = res.getHeader('Content-Security-Policy') as string;
      if (existingCSP && !existingCSP.includes('blob:')) {
        console.log(`🛡️ CSP Debug: Adding blob: support to existing CSP for ${req.path}`);
        const updatedCSP = existingCSP.replace(/img-src ([^;]+)/g, (match, sources) => {
          if (!sources.includes('blob:')) {
            return `img-src ${sources} blob:`;
          }
          return match;
        });
        res.setHeader('Content-Security-Policy', updatedCSP);
        console.log(`🛡️ CSP Updated: ${updatedCSP}`);
      }
    }

    // Server information hiding
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Cache control for sensitive data
    if (req.path.includes('/api/') && !req.path.includes('/api/public/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  });

  // CSP Report Endpoint (for monitoring CSP violations)
  app.post(
    '/api/security/csp-report',
    express.json({ type: 'application/csp-report' }),
    (req: Request, res: Response) => {
      const report = req.body;
      logSecurity('csp_violation_report', {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        ip: req.ip || 'unknown',
        metadata: {
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
          report: report,
        }
      });
      res.status(204).end();
    }
  );

  // Certificate Transparency Report Endpoint (for legacy support)
  app.post('/api/security/ct-report', express.json(), (req: Request, res: Response) => {
    const report = req.body;
    logSecurity('certificate_transparency_report', {
      requestId: req.headers['x-request-id'] as string || 'unknown',
      ip: req.ip || 'unknown',
      metadata: {
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        report: report,
      }
    });
    res.status(204).end();
  });

  // Security middleware configured successfully
}

/**
 * Security health check middleware
 * Validates that all security headers are properly configured.
 * @param req
 * @param res
 * @param next
 */
export function securityHealthCheck(req: Request, res: Response, next: NextFunction): void {
  // Check if running in secure context (HTTPS in production)
  const isSecure =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'development';

  if (!isSecure && process.env.NODE_ENV === 'production') {
    logSecurity('insecure_production_request', {
      requestId: req.headers['x-request-id'] as string || 'unknown',
      ip: req.ip || 'unknown',
      metadata: {
        url: req.url,
        userAgent: req.get('User-Agent'),
      }
    });
  }

  next();
}

/**
 * Law 25 compliance headers for Quebec privacy regulations.
 * @param req
 * @param res
 * @param next
 */
export function addLaw25Headers(req: Request, res: Response, next: NextFunction): void {
  // Add headers specific to Quebec Law 25 compliance
  res.setHeader('X-Quebec-Law25-Compliant', 'true');
  res.setHeader('X-Data-Controller', 'Koveo Gestion Inc.');
  res.setHeader('X-Privacy-Officer', 'privacy@koveogestion.com');
  res.setHeader('X-Data-Processing-Lawful-Basis', 'legitimate-interest,contract');

  // Language preference for Quebec users
  const acceptLanguage = req.headers['accept-language'] || '';
  const prefersFrench = acceptLanguage.includes('fr');
  res.setHeader('X-Content-Language-Preference', prefersFrench ? 'fr-CA' : 'en-CA');

  next();
}

/**
 * Enhanced domain validation middleware for production security
 */
export function validateRequestDomain(req: Request, res: Response, next: NextFunction): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Skip validation in development
  if (isDevelopment) {
    return next();
  }
  
  const host = req.get('host');
  const userAgent = req.get('user-agent') || '';
  
  // Allowed production domains
  const allowedDomains = [
    'koveo-gestion.com',
    'koveogestion.com',
    'app.koveogestion.com',
    'koveo.com'
  ];
  
  // Allow Replit domains for deployment
  const isReplitDomain = host && (
    host.endsWith('.replit.app') ||
    host.endsWith('.replit.com') ||
    host.endsWith('.replit.dev')
  );
  
  const isAllowedDomain = host && allowedDomains.some(domain => 
    host === domain || host === `www.${domain}`
  );
  
  if (!host || (!isAllowedDomain && !isReplitDomain)) {
    logSecurity('domain_validation_failed', {
      requestId: req.headers['x-request-id'] as string || 'unknown',
      ip: req.ip || 'unknown',
      metadata: {
        host,
        userAgent: userAgent.substring(0, 100),
        referer: req.get('referer'),
        path: req.path
      }
    });
    
    return res.status(421).json({
      error: 'Misdirected Request',
      message: 'Request not allowed for this domain',
      code: 'INVALID_DOMAIN'
    });
  }
  
  // Log successful domain validation for monitoring
  if (process.env.NODE_ENV === 'production') {
    logSecurity('domain_validation_success', {
      requestId: req.headers['x-request-id'] as string || 'unknown',
      ip: req.ip || 'unknown',
      metadata: { host, path: req.path }
    });
  }
  
  next();
}

export default {
  configureSecurityMiddleware,
  securityHealthCheck,
  addLaw25Headers,
  validateRequestDomain,
  addCSPNonce,
  rateLimitConfig,
};
