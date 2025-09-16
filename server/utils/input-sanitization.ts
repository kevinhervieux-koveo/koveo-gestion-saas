/**
 * Enhanced input sanitization and validation utilities for Quebec property management system.
 * Provides comprehensive security and data consistency functions for user input processing.
 * Protects against XSS, SQL injection, NoSQL injection, and other attack vectors.
 */

// Common attack patterns to detect and prevent
const ATTACK_PATTERNS = [
  // SQL injection patterns
  /('|(\-\-)|(\;)|(\||\\|)|(\*|\*))/, 
  /(exec(\s|\+)+(s|x)p\w+)/i,
  /((sp_|xp_)\w+)/i,
  // XSS patterns
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  // NoSQL injection patterns
  /\$where/gi,
  /\$ne/gi,
  /\$gt/gi,
  /\$lt/gi,
];

// Dangerous file extensions to block
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.ps1', '.sh', '.php', '.asp', '.aspx', '.jsp', '.py', '.rb'
];

/**
 * Enhanced sanitization for user input to prevent XSS, SQL injection, and other attacks
 */
export function sanitizeString(input: string, maxLength = 500): string {
  if (!input || typeof input !== 'string') return '';

  // Detect potential attacks
  for (const pattern of ATTACK_PATTERNS) {
    if (pattern.test(input)) {
      console.warn(`🚨 Security: Potential attack pattern detected in input: ${pattern}`);
      return ''; // Return empty string for suspicious input
    }
  }

  return input
    .trim()
    // HTML encode dangerous characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove null bytes and control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Limit length to prevent buffer overflow
    .substring(0, maxLength);
}

/**
 * Sanitizes HTML content while preserving safe tags
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove all scripts
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<(?!\/?(?:b|i|em|strong|u|br|p|div|span|h[1-6])(?:\s|>))[^>]*>/gi, ''); // Remove non-safe tags
}

/**
 * Validates and normalizes email addresses
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Validates Quebec postal code format
 */
export function isValidQuebecPostalCode(postalCode: string): boolean {
  if (!postalCode) return true; // Optional field
  const quebecPostalCodeRegex =
    /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVWXYZ] ?\d[ABCEGHJKLMNPRSTVWXYZ]\d$/i;
  return quebecPostalCodeRegex.test(postalCode.trim());
}

/**
 * Validates North American phone number format
 */
export function isValidNorthAmericanPhone(phone: string): boolean {
  if (!phone) return true; // Optional field
  const phoneRegex = /^(\+1\s?)?(\([0-9]{3}\)|[0-9]{3})[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Sanitizes and validates user names (first, last)
 */
export function sanitizeName(name: string): string {
  if (!name) return '';

  return name
    .trim()
    .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, '') // Allow accented characters for Quebec names
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .substring(0, 100); // Limit to 100 characters
}

/**
 * Generates a secure, unique username from email
 */
export function generateUsernameFromEmail(email: string): string {
  if (!email) return '';

  return email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
    .substring(0, 30); // Limit username length
}

/**
 * Validates password strength for Quebec compliance
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[@$!%*?&]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
    return {
      isValid: false,
      message:
        'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)',
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes and validates address fields for Quebec addresses
 */
export function sanitizeAddress(address: string): string {
  if (!address || typeof address !== 'string') return '';

  return sanitizeString(address, 200)
    .replace(/[^\w\s\-\.\,\#\'\(\)\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ef\u00ee\u00f4\u00f6\u00f9\u00fb\u00fc\u00ff\u00e7]/gi, ''); // Allow Quebec address characters
}

/**
 * Validates file uploads for security
 */
export function validateFileUpload(filename: string, fileSize: number, mimeType: string): { isValid: boolean; message?: string } {
  if (!filename || typeof filename !== 'string') {
    return { isValid: false, message: 'Invalid filename' };
  }

  // Check file extension
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    console.warn(`🚨 Security: Dangerous file extension blocked: ${ext}`);
    return { isValid: false, message: 'File type not allowed for security reasons' };
  }

  // Check file size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (fileSize > MAX_FILE_SIZE) {
    return { isValid: false, message: 'File size too large (max 50MB)' };
  }

  // Validate MIME type
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (!allowedMimeTypes.includes(mimeType)) {
    return { isValid: false, message: 'File type not allowed' };
  }

  return { isValid: true };
}

/**
 * Rate limiting helper to prevent brute force attacks
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = rateLimitStore.get(identifier);
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  
  if (current.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  current.count++;
  return { allowed: true, remaining: limit - current.count };
}
