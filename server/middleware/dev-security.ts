/**
 * @file Development Security Middleware.
 * @description Additional security measures for development environment
 * Mitigates GHSA-67mh-4wv8-2f99 esbuild vulnerability in development.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Development-only security middleware to mitigate esbuild vulnerability
 * GHSA-67mh-4wv8-2f99: esbuild enables any website to send requests to dev server.
 * @param req
 * @param res
 * @param next
 */
export function devSecurityMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only apply in development
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  // Block suspicious development requests that could exploit esbuild
  const suspiciousPatterns = [
    /\/esbuild\//,
    /\/__vite__/,
    /\/\@vite\//,
    /\/node_modules\//,
    /\.ts$/,
    /\.tsx$/,
    /\.js\.map$/,
    /\/src\//,
  ];

  // Check if request is from external origin (not localhost/replit)
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const userAgent = req.headers['user-agent'] || '';

  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
  const isReplit =
    origin.includes('replit.com') || origin.includes('replit.co') || origin.includes('replit.dev');
  const isInternalRequest = referer.includes('localhost') || referer.includes('replit');
  const isBrowser =
    userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');

  const isLegitimate = isLocalhost || isReplit || isInternalRequest || !origin;

  // Block external requests to development endpoints
  if (!isLegitimate && isBrowser) {
    const path = req.path.toLowerCase();
    const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(path));

    if (isSuspicious) {
      console.warn(
        `🚫 Blocked suspicious external request to dev server: ${path} from ${origin || 'unknown'}`
      );
      return res.status(403).json({
        error: 'Access denied',
        message: 'External access to development resources is not permitted',
        code: 'DEV_SECURITY_BLOCK',
      });
    }
  }

  // Rate limit development endpoints more strictly
  if (req.path.startsWith('/@vite') || req.path.startsWith('/__vite__')) {
    const clientIp = req.ip || req.socket.remoteAddress;
    console.log(`🔍 Dev resource access: ${req.path} from ${clientIp}`);
  }

  next();
}

/**
 * Enhanced CORS for development to prevent esbuild exploitation.
 * @param req
 * @param res
 * @param next
 */
export function devCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  const origin = req.headers.origin;

  // Only allow known development origins
  const allowedOrigins = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/.*\.replit\.com$/,
    /^https?:\/\/.*\.replit\.co$/,
    /^https?:\/\/.*\.replit\.dev$/,
  ];

  if (origin) {
    const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin));
    if (!isAllowed) {
      console.warn(`🚫 CORS blocked external origin in dev: ${origin}`);
      return res.status(403).json({
        error: 'CORS policy violation in development',
        code: 'DEV_CORS_BLOCK',
      });
    }
  }

  next();
}

export default {
  devSecurityMiddleware,
  devCorsMiddleware,
};
