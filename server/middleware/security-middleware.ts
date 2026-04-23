/**
 * @file Security Middleware for Koveo Gestion.
 * @description Single source of truth for the application's Helmet/CSP and
 * security header configuration. Apply by calling
 * `configureSecurityMiddleware(app)` once during server bootstrap.
 */

import helmet from 'helmet';
import type { Express } from 'express';

/**
 * Configure Helmet-based security headers (including CSP and HSTS) on the
 * given Express app. This is the only place the application's CSP and
 * security headers are defined.
 *
 * Behavior:
 * - In development, allows `'unsafe-inline'` scripts to support HMR.
 * - In production, adds `upgrade-insecure-requests` to the CSP.
 * - HSTS is set to 1 year with subdomains and preload in all environments
 *   (matches previous inline configuration in server/index.ts).
 * - `crossOriginEmbedderPolicy` is disabled to keep development workflows working.
 */
export function configureSecurityMiddleware(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // Only allow unsafe-inline in development for HMR
            ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : []),
            'https://replit.com',
            'https://replit-cdn.com',
            'https://*.replit.com',
            'https://*.replit-cdn.com',
          ],
          scriptSrcElem: [
            "'self'",
            ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : []),
            'https://replit.com',
            'https://replit-cdn.com',
            'https://*.replit.com',
            'https://*.replit-cdn.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for CSS-in-JS frameworks like styled-components
            'https://fonts.googleapis.com',
          ],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            'wss:',
            'ws:',
            'https://replit.com',
            'https://replit-cdn.com',
            'https://*.replit.com',
            'https://*.replit-cdn.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'self'", 'blob:'],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          ...(process.env.NODE_ENV === 'production' && {
            upgradeInsecureRequests: [],
          }),
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false, // Allow for development
    })
  );
}

export default { configureSecurityMiddleware };
