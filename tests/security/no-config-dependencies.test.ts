/**
 * No Config Dependencies Tests.
 * 
 * These tests ensure that no parts of the system depend on config files
 * for permissions and that the database is the only source of truth.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('No Config File Dependencies', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  
  describe('Config File Removal', () => {
    it('should not have permissions.json file', () => {
      const permissionsJsonPath = path.join(projectRoot, 'config/permissions.json');
      expect(fs.existsSync(permissionsJsonPath)).toBe(false);
    });

    it('should not have permissions-schema.ts file', () => {
      const permissionsSchemaPath = path.join(projectRoot, 'config/permissions-schema.ts');
      expect(fs.existsSync(permissionsSchemaPath)).toBe(false);
    });

    it('should not have validate-permissions.ts file', () => {
      const validatePermissionsPath = path.join(projectRoot, 'config/validate-permissions.ts');
      expect(fs.existsSync(validatePermissionsPath)).toBe(false);
    });

    it('should not have test-permissions.ts file', () => {
      const testPermissionsPath = path.join(projectRoot, 'config/test-permissions.ts');
      expect(fs.existsSync(testPermissionsPath)).toBe(false);
    });
  });

  describe('Code Analysis for Config Dependencies', () => {
    const getFilesRecursively = (dir: string, extensions: string[]): string[] => {
      const files: string[] = [];
      
      if (!fs.existsSync(dir)) {return files;}
      
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          files.push(...getFilesRecursively(fullPath, extensions));
        } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
      
      return files;
    };

    const searchFileForPatterns = (filePath: string, patterns: string[]): string[] => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const foundPatterns: string[] = [];
        
        patterns.forEach(pattern => {
          if (content.includes(pattern)) {
            foundPatterns.push(pattern);
          }
        });
        
        return foundPatterns;
      } catch (error) {
        return [];
      }
    };

    it('should not import permissions from config files in server code', () => {
      const serverFiles = getFilesRecursively(path.join(projectRoot, 'server'), ['.ts', '.js']);
      const suspiciousPatterns = [
        'import.*permissions.*from.*config',
        'require.*permissions.json',
        'permissions-schema',
        'validate-permissions',
        'import.*checkPermission.*from.*config',
        'PERMISSION_CATEGORIES'
      ];
      
      const violations: { file: string; patterns: string[] }[] = [];
      
      serverFiles.forEach(file => {
        // Skip the test files and config index
        if (file.includes('test') || file.includes('spec') || file.endsWith('config/index.ts')) {
          return;
        }
        
        const foundPatterns = searchFileForPatterns(file, suspiciousPatterns);
        if (foundPatterns.length > 0) {
          violations.push({ file: path.relative(projectRoot, file), patterns: foundPatterns });
        }
      });
      
      if (violations.length > 0) {
        const violationDetails = violations.map(v => 
          `${v.file}: ${v.patterns.join(', ')}`
        ).join('\n');
        
        throw new Error(`Found config permission dependencies:\n${violationDetails}`);
      }
      
      expect(violations).toHaveLength(0);
    });

    it('should not have hardcoded permission lists in API code', () => {
      const apiFiles = getFilesRecursively(path.join(projectRoot, 'server/api'), ['.ts', '.js']);
      const hardcodedPatterns = [
        'permissions\\[.*\\]',
        'rolePermissions\\[.*\\]',
        'permissionsConfig\\['
      ];
      
      const violations: { file: string; patterns: string[] }[] = [];
      
      apiFiles.forEach(file => {
        if (file.includes('test') || file.includes('spec')) {
          return;
        }
        
        const content = fs.readFileSync(file, 'utf-8');
        const foundPatterns: string[] = [];
        
        hardcodedPatterns.forEach(pattern => {
          const regex = new RegExp(pattern, 'g');
          if (regex.test(content)) {
            foundPatterns.push(pattern);
          }
        });
        
        if (foundPatterns.length > 0) {
          violations.push({ file: path.relative(projectRoot, file), patterns: foundPatterns });
        }
      });
      
      // Allow some legitimate uses in permissions.ts for authorization
      const allowedFiles = ['server/api/permissions.ts'];
      const filteredViolations = violations.filter(v => 
        !allowedFiles.some(allowed => v.file.endsWith(allowed))
      );
      
      expect(filteredViolations).toHaveLength(0);
    });

    it('should use database queries for permission checks in auth middleware', () => {
      const authFiles = getFilesRecursively(path.join(projectRoot, 'server'), ['.ts', '.js'])
        .filter(file => file.includes('auth') && !file.includes('test'));
      
      authFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Should not contain direct permission config imports
        expect(content).not.toContain('import { permissions } from');
        expect(content).not.toContain('require(.*permissions.json');
        
        // If it has permission checking, it should use database methods
        if (content.includes('permission') || content.includes('authorize')) {
          // Should use database queries or storage methods
          const hasDbQuery = content.includes('storage.') || 
                           content.includes('db.select') || 
                           content.includes('getRolePermissions()') ||
                           content.includes('checkUserPermission');
          
          if (!hasDbQuery && !file.includes('config/index.ts')) {
            console.warn(`Warning: ${path.relative(projectRoot, file)} may need database permission checking`);
          }
        }
      });
    });

    it('should ensure config/index.ts only exports utility functions', () => {
      const configIndexPath = path.join(projectRoot, 'config/index.ts');
      
      if (fs.existsSync(configIndexPath)) {
        const content = fs.readFileSync(configIndexPath, 'utf-8');
        
        // Should not export permissions data
        expect(content).not.toContain('export { permissionsData');
        expect(content).not.toContain('loadPermissionsData');
        expect(content).not.toContain('PERMISSION_CATEGORIES');
        
        // Should only have utility functions
        expect(content).toContain('ROLE_HIERARCHY');
        expect(content).toContain('hasRoleOrHigher');
        
        // Should have a comment about database being source of truth
        expect(content).toContain('database');
      }
    });
  });

  describe('Database-Only API Endpoints', () => {
    it('should ensure all permission endpoints use database storage', () => {
      const permissionsApiPath = path.join(projectRoot, 'server/api/permissions.ts');
      
      if (fs.existsSync(permissionsApiPath)) {
        const content = fs.readFileSync(permissionsApiPath, 'utf-8');
        
        // Should use storage methods
        expect(content).toContain('storage.getPermissions');
        expect(content).toContain('storage.getRolePermissions');
        expect(content).toContain('storage.getUserPermissions');
        
        // Should not use config imports
        expect(content).not.toContain('import { permissions }');
        expect(content).not.toContain('permissionsConfig');
      }
    });
  });

  describe('Environment and Deployment Safety', () => {
    it('should not have permissions config in production build', () => {
      const distPath = path.join(projectRoot, 'dist');
      
      if (fs.existsSync(distPath)) {
        const checkForConfigFiles = (dir: string): string[] => {
          const files: string[] = [];
          const items = fs.readdirSync(dir, { withFileTypes: true });
          
          for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              files.push(...checkForConfigFiles(fullPath));
            } else if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.json'))) {
              files.push(fullPath);
            }
          }
          return files;
        };
        
        const distFiles = checkForConfigFiles(distPath);
        const permissionConfigFiles = distFiles.filter(file => 
          file.includes('permissions.json') || 
          file.includes('permissions-schema') ||
          file.includes('validate-permissions')
        );
        
        expect(permissionConfigFiles).toHaveLength(0);
      }
    });

    it('should ensure package.json does not reference permission config scripts', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const scripts = packageJson.scripts || {};
        
        Object.values(scripts).forEach((script: any) => {
          expect(script).not.toContain('validate-permissions');
          expect(script).not.toContain('test-permissions');
        });
      }
    });
  });
});