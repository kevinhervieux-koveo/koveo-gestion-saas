/**
 * Input Sanitization Middleware for Enhanced Security
 * Prevents XSS, SQL injection, and other injection attacks
 */

import { Request, Response, NextFunction } from 'express';
import { logSecurity } from '../utils/logger';

/**
 * Patterns that are potentially dangerous and should be blocked or sanitized
 */
const DANGEROUS_PATTERNS = {
  // Script injection patterns
  SCRIPT_TAGS: /<script[\s\S]*?<\/script>/gi,
  
  // SQL injection patterns
  SQL_INJECTION: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|OR|AND|XOR|NOT|NULL|TRUE|FALSE|LIKE|BETWEEN|IN|EXISTS|HAVING|GROUP|ORDER|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MAX|MIN|ROUND|FLOOR|CEIL|ABS|SQRT|POWER|LOG|EXP|PI|RAND|NOW|CURDATE|CURTIME|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|CURRENT_USER|DATABASE|VERSION|USER|SYSTEM_USER|SESSION_USER|CONNECTION_ID|LAST_INSERT_ID|ROW_COUNT|FOUND_ROWS|GET_LOCK|RELEASE_LOCK|IS_FREE_LOCK|IS_USED_LOCK|MASTER_POS_WAIT|NAME_CONST|SLEEP|BENCHMARK|LOAD_FILE|INTO|OUTFILE|DUMPFILE|FIELDS|LINES|STARTING|TERMINATED|ENCLOSED|ESCAPED|OPTIONALLY|IGNORE|REPLACE|LOW_PRIORITY|HIGH_PRIORITY|DELAYED|QUICK|EXTENDED|FULL|PARTIAL|REPAIR|OPTIMIZE|CHECK|ANALYZE|TABLE|INDEX|KEY|CONSTRAINT|FOREIGN|REFERENCES|CASCADE|RESTRICT|SET|NULL|DEFAULT|AUTO_INCREMENT|UNSIGNED|ZEROFILL|BINARY|ASCII|UNICODE|COLLATE|CHARACTER|CHARSET|ENGINE|TYPE|COMMENT|TEMPORARY|IF|NOT|EXISTS|SHOW|DESCRIBE|EXPLAIN|HELP)\b)/gi,
  
  // XSS patterns
  XSS_BASIC: /<[^>]*?(\bon\w+|javascript:)/gi,
  XSS_ENTITIES: /&[a-z0-9]+;/gi,
  
  // Path traversal patterns
  PATH_TRAVERSAL: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/gi,
  
  // Command injection patterns
  COMMAND_INJECTION: /[;&|`$]/g,
  
  // LDAP injection patterns
  LDAP_INJECTION: /[\(\)\*\\\x00]/g,
  
  // XML injection patterns
  XML_INJECTION: /<![\s\S]*?>/gi,
  
  // NoSQL injection patterns
  NOSQL_INJECTION: /\$[\w]+/g
};

/**
 * Sanitize input by removing or escaping dangerous patterns
 */
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    let sanitized = input;
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove or escape dangerous patterns
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.SCRIPT_TAGS, '');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.XSS_BASIC, '');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.PATH_TRAVERSAL, '');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.XML_INJECTION, '');
    
    // Escape HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    
    return sanitized.trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitizedObj: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitizedObj[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitizedObj;
  }
  
  return input;
}

/**
 * Check if input contains potentially dangerous patterns
 */
function containsDangerousPatterns(input: string): boolean {
  return (
    DANGEROUS_PATTERNS.SQL_INJECTION.test(input) ||
    DANGEROUS_PATTERNS.COMMAND_INJECTION.test(input) ||
    DANGEROUS_PATTERNS.LDAP_INJECTION.test(input) ||
    DANGEROUS_PATTERNS.NOSQL_INJECTION.test(input)
  );
}

/**
 * Input sanitization middleware
 */
export function sanitizeInputMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Skip sanitization for certain routes that need raw data
    const skipRoutes = ['/api/upload', '/api/documents/upload'];
    if (skipRoutes.some(route => req.path.includes(route))) {
      return next();
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeInput(req.query);
    }
    
    // Sanitize body parameters
    if (req.body) {
      // Check for dangerous patterns before sanitization
      const bodyString = JSON.stringify(req.body);
      if (containsDangerousPatterns(bodyString)) {
        logSecurity('dangerous_input_detected', {
          requestId: req.headers['x-request-id'] as string || 'unknown',
          ip: req.ip || 'unknown',
          metadata: {
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            body: bodyString.substring(0, 500) // Log first 500 chars
          }
        });
        
        return res.status(400).json({
          error: 'Invalid input detected',
          message: 'The request contains potentially harmful content',
          code: 'DANGEROUS_INPUT'
        });
      }
      
      req.body = sanitizeInput(req.body);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeInput(req.params);
    }
    
    next();
  } catch (error: any) {
    logSecurity('input_sanitization_error', {
      requestId: req.headers['x-request-id'] as string || 'unknown',
      ip: req.ip || 'unknown',
      metadata: {
        error: error.message,
        path: req.path
      }
    });
    
    return res.status(500).json({
      error: 'Input processing error',
      message: 'Unable to process request safely',
      code: 'SANITIZATION_ERROR'
    });
  }
}

/**
 * Validate specific input types
 */
export const inputValidators = {
  // Email validation with security checks
  email: (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && 
           !containsDangerousPatterns(email) && 
           email.length <= 255;
  },
  
  // Username validation
  username: (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9._-]{3,50}$/;
    return usernameRegex.test(username) && 
           !containsDangerousPatterns(username);
  },
  
  // ID validation (UUID or numeric)
  id: (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const numericRegex = /^\d+$/;
    return (uuidRegex.test(id) || numericRegex.test(id)) && 
           id.length <= 50;
  },
  
  // Filename validation
  filename: (filename: string): boolean => {
    const filenameRegex = /^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]{1,10}$/;
    return filenameRegex.test(filename) && 
           !filename.includes('..') && 
           filename.length <= 255 &&
           !containsDangerousPatterns(filename);
  }
};

export default {
  sanitizeInputMiddleware,
  sanitizeInput,
  inputValidators,
  containsDangerousPatterns
};