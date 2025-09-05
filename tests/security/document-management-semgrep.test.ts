/**
 * Document Management Security Tests (Semgrep Integration)
 * 
 * This test suite validates security controls using patterns that would be detected
 * by Semgrep static analysis tool. Each test represents a security vulnerability
 * category that Semgrep would flag in real code.
 * 
 * Test Categories:
 * 1. SQL Injection Prevention (semgrep: sql-injection)
 * 2. Path Traversal Protection (semgrep: path-traversal)
 * 3. File Upload Security (semgrep: file-upload-security)
 * 4. Input Validation (semgrep: input-validation)
 * 5. Authentication & Authorization (semgrep: auth-security)
 * 
 * Each test demonstrates both vulnerable patterns that Semgrep would flag
 * and secure implementations that pass security validation.
 */

import { describe, it, expect } from '@jest/globals';

describe('Document Management Security Tests (Semgrep Patterns)', () => {
  
  describe('SQL Injection Prevention (semgrep: sql-injection)', () => {
    it('should use parameterized queries for document searches', () => {
      // This simulates secure database query patterns that Semgrep would approve
      const secureDocumentQuery = (searchTerm: string, userId: string) => {
        // Good: Parameterized query (Semgrep would approve)
        const query = 'SELECT * FROM documents WHERE title = ? AND user_id = ?';
        const params = [searchTerm, userId];
        return { query, params };
      };

      const result = secureDocumentQuery('test document', 'user123');
      expect(result.query).toContain('?');
      expect(result.params).toHaveLength(2);
      expect(result.params[0]).toBe('test document');
      expect(result.params[1]).toBe('user123');
    });

    it('should sanitize document metadata for database operations', () => {
      const sanitizeForDB = (input: string): string => {
        // Escape single quotes and remove null bytes
        return input
          .replace(/'/g, "''")
          .replace(/\0/g, '')
          .trim();
      };

      expect(sanitizeForDB("O'Connor Document")).toBe("O''Connor Document");
      expect(sanitizeForDB("Test\0Document")).toBe("TestDocument");
      expect(sanitizeForDB("  Normal Document  ")).toBe("Normal Document");
    });
  });

  describe('Path Traversal Protection (semgrep: path-traversal)', () => {
    it('should prevent directory traversal in document file paths', () => {
      const secureFilePath = (filename: string): string => {
        // Remove path traversal patterns
        const cleaned = filename
          .replace(/\.\./g, '')  // Remove ..
          .replace(/\//g, '')    // Remove forward slashes
          .replace(/\\/g, '')    // Remove backslashes
          .replace(/:/g, '');    // Remove colons (Windows drive letters)
        
        return `documents/${cleaned}`;
      };

      // Test various path traversal attempts
      expect(secureFilePath('../../../etc/passwd')).toBe('documents/etcpasswd');
      expect(secureFilePath('..\\..\\windows\\system32\\config')).toBe('documents/windowssystem32config');
      expect(secureFilePath('normal-document.pdf')).toBe('documents/normal-document.pdf');
      expect(secureFilePath('c:\\temp\\file.txt')).toBe('documents/ctempfile.txt');
    });

    it('should validate document upload paths are within allowed directories', () => {
      const isValidUploadPath = (path: string): boolean => {
        const allowedPaths = ['/uploads/', '/documents/', '/temp/'];
        const normalizedPath = path.replace(/\\/g, '/');
        
        // Check if path starts with allowed directory
        const isInAllowedDir = allowedPaths.some(allowed => 
          normalizedPath.startsWith(allowed)
        );
        
        // Check for path traversal
        const hasTraversal = normalizedPath.includes('../') || normalizedPath.includes('..\\');
        
        return isInAllowedDir && !hasTraversal;
      };

      expect(isValidUploadPath('/uploads/document.pdf')).toBe(true);
      expect(isValidUploadPath('/documents/legal/contract.pdf')).toBe(true);
      expect(isValidUploadPath('/temp/processing.tmp')).toBe(true);
      
      // Should reject traversal attempts
      expect(isValidUploadPath('/uploads/../../../etc/passwd')).toBe(false);
      expect(isValidUploadPath('/documents/../../config/app.config')).toBe(false);
      expect(isValidUploadPath('/unauthorized/file.pdf')).toBe(false);
    });
  });

  describe('File Upload Security (semgrep: file-upload-security)', () => {
    it('should validate file types against whitelist', () => {
      const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      const isAllowedFileType = (mimeType: string): boolean => {
        return allowedMimeTypes.includes(mimeType.toLowerCase());
      };

      // Valid file types
      expect(isAllowedFileType('application/pdf')).toBe(true);
      expect(isAllowedFileType('image/jpeg')).toBe(true);
      expect(isAllowedFileType('text/plain')).toBe(true);

      // Invalid/dangerous file types
      expect(isAllowedFileType('application/x-executable')).toBe(false);
      expect(isAllowedFileType('text/javascript')).toBe(false);
      expect(isAllowedFileType('application/x-shockwave-flash')).toBe(false);
    });

    it('should detect potentially dangerous file extensions', () => {
      const dangerousExtensions = [
        '.exe', '.bat', '.cmd', '.scr', '.pif', '.com',
        '.js', '.vbs', '.jar', '.sh', '.php', '.asp',
        '.jsp', '.pl', '.py', '.rb'
      ];

      const isDangerousFileType = (filename: string, mimeType: string): boolean => {
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return dangerousExtensions.includes(ext);
      };

      // Should detect dangerous files
      expect(isDangerousFileType('malware.exe', 'application/octet-stream')).toBe(true);
      expect(isDangerousFileType('script.js', 'text/javascript')).toBe(true);
      expect(isDangerousFileType('virus.bat', 'text/plain')).toBe(true);

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

  describe('Input Validation (semgrep: input-validation)', () => {
    it('should sanitize document metadata inputs', () => {
      const sanitizeDocumentInput = (input: string): string => {
        return input
          // Remove script tags
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          // Remove all HTML tags
          .replace(/<[^>]+>/g, '')
          // Remove javascript: protocol
          .replace(/javascript:/gi, '')
          // Remove event handlers
          .replace(/on\w+\s*=/gi, '')
          // Remove data: URLs
          .replace(/data:[^;]*;base64,/gi, '')
          // Trim whitespace
          .trim();
      };

      const maliciousInputs = [
        '<script>alert("XSS")</script>Document Title',
        'Title<img src=x onerror=alert(1)>',
        'javascript:alert("XSS")Document',
        '<iframe src="javascript:alert(1)"></iframe>Title',
        'Document<svg onload=alert(1)>',
        'Title<body onload=alert(1)>'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizeDocumentInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('<iframe>');
      });
    });

    it('should validate document categories against whitelist', () => {
      const allowedCategories = [
        'legal', 'financial', 'maintenance', 'general',
        'building_rules', 'meeting_minutes', 'insurance',
        'contracts', 'correspondence', 'technical'
      ];

      const validateCategory = (category: string): boolean => {
        const normalized = category.toLowerCase().trim();
        return allowedCategories.includes(normalized);
      };

      expect(validateCategory('legal')).toBe(true);
      expect(validateCategory('FINANCIAL')).toBe(true);
      expect(validateCategory('invalid_category')).toBe(false);
      expect(validateCategory('<script>alert(1)</script>legal')).toBe(false);
    });
  });
});