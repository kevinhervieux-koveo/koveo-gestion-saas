/**
 * Server-Side Request Forgery (SSRF) Protection Middleware
 * Prevents malicious requests to internal services and sensitive endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logSecurity } from '../utils/logger';

/**
 * List of blocked IP ranges and domains to prevent SSRF attacks
 */
const BLOCKED_PATTERNS = {
  // Private IP ranges (RFC 1918)
  PRIVATE_IPV4: [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./, // Link-local
    /^224\./,      // Multicast
  ],
  
  // Loopback and local addresses
  LOOPBACK: [
    /^localhost$/i,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^::$/,
  ],
  
  // Cloud metadata endpoints
  METADATA_ENDPOINTS: [
    /^169\.254\.169\.254$/, // AWS, GCP, Azure metadata
    /^100\.100\.100\.200$/, // Alibaba Cloud
    /^metadata\.google\.internal$/i,
    /^169\.254\.169\.123$/, // DigitalOcean
  ],
  
  // Internal domains that should not be accessible
  INTERNAL_DOMAINS: [
    /^internal\./i,
    /^admin\./i,
    /^test\./i,
    /^staging\./i,
    /^dev\./i,
    /\.local$/i,
    /\.internal$/i,
  ]
};

/**
 * Check if a URL or IP is potentially dangerous for SSRF
 */
function isDangerousTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Check for blocked IP patterns
    for (const pattern of BLOCKED_PATTERNS.PRIVATE_IPV4) {
      if (pattern.test(hostname)) {
        return true;
      }
    }
    
    // Check for loopback addresses
    for (const pattern of BLOCKED_PATTERNS.LOOPBACK) {
      if (pattern.test(hostname)) {
        return true;
      }
    }
    
    // Check for metadata endpoints
    for (const pattern of BLOCKED_PATTERNS.METADATA_ENDPOINTS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }
    
    // Check for internal domains
    for (const pattern of BLOCKED_PATTERNS.INTERNAL_DOMAINS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }
    
    // Check for non-HTTP protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return true;
    }
    
    // Check for suspicious ports
    const port = parsed.port;
    if (port) {
      const portNum = parseInt(port);
      // Block common internal service ports
      const blockedPorts = [22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 1433, 3306, 5432, 6379, 27017];
      if (portNum < 1024 || blockedPorts.includes(portNum)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    // If URL parsing fails, consider it dangerous
    return true;
  }
}

/**
 * SSRF protection middleware
 * Scans request bodies and parameters for potentially dangerous URLs
 */
export function ssrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Skip for safe routes
    const safeRoutes = ['/api/health', '/api/auth/user', '/health'];
    if (safeRoutes.includes(req.path)) {
      return next();
    }
    
    // Check request body for URLs
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      
      // Look for URL patterns in the body
      const urlPattern = /(https?:\/\/[^\s<>"']+)/gi;
      const urls = bodyStr.match(urlPattern) || [];
      
      for (const url of urls) {
        if (isDangerousTarget(url)) {
          logSecurity('ssrf_attempt_blocked', {
            requestId: req.headers['x-request-id'] as string || 'unknown',
            ip: req.ip || 'unknown',
            metadata: {
              path: req.path,
              method: req.method,
              dangerousUrl: url,
              userAgent: req.get('User-Agent'),
              referer: req.get('Referer')
            }
          });
          
          return res.status(400).json({
            error: 'Invalid URL detected',
            message: 'The request contains a URL that is not allowed for security reasons',
            code: 'SSRF_BLOCKED'
          });
        }
      }
    }
    
    // Check query parameters for URLs
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          const urlPattern = /(https?:\/\/[^\s<>"']+)/gi;
          const urls = value.match(urlPattern) || [];
          
          for (const url of urls) {
            if (isDangerousTarget(url)) {
              logSecurity('ssrf_attempt_blocked', {
                requestId: req.headers['x-request-id'] as string || 'unknown',
                ip: req.ip || 'unknown',
                metadata: {
                  path: req.path,
                  method: req.method,
                  parameter: key,
                  dangerousUrl: url,
                  userAgent: req.get('User-Agent')
                }
              });
              
              return res.status(400).json({
                error: 'Invalid URL parameter',
                message: 'The URL parameter contains a value that is not allowed',
                code: 'SSRF_BLOCKED'
              });
            }
          }
        }
      }
    }
    
    next();
  } catch (error: any) {
    logSecurity('ssrf_protection_error', {
      requestId: req.headers['x-request-id'] as string || 'unknown',
      ip: req.ip || 'unknown',
      metadata: {
        error: error.message,
        path: req.path
      }
    });
    
    // Continue on error to avoid breaking the application
    next();
  }
}

/**
 * URL validator for use in application code
 */
export function validateUrl(url: string): { isValid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required and must be a string' };
  }
  
  if (url.length > 2048) {
    return { isValid: false, error: 'URL is too long' };
  }
  
  if (isDangerousTarget(url)) {
    return { isValid: false, error: 'URL targets a forbidden resource' };
  }
  
  return { isValid: true };
}

export default {
  ssrfProtectionMiddleware,
  validateUrl,
  isDangerousTarget
};