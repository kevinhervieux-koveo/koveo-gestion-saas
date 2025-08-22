/**
 * @file Project Structure Validation Tests.
 * @description Validates the overall project organization and structure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

describe('Project Structure Validation', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('Core Directory Structure', () => {
    test('should have all required root directories', () => {
      const requiredDirs = [
        'client',
        'server',
        'shared',
        'docs',
        'tests',
        'config',
        'migrations',
        'attached_assets'
      ];

      requiredDirs.forEach(dir => {
        const dirPath = path.join(rootDir, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      });
    });

    test('should have all required client directories', () => {
      const clientDirs = [
        'client/src',
        'client/src/components',
        'client/src/pages',
        'client/src/hooks',
        'client/src/lib',
        'client/src/components/ui',
        'client/src/components/forms',
        'client/src/components/layout'
      ];

      clientDirs.forEach(dir => {
        const dirPath = path.join(rootDir, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      });
    });

    test('should have all required server directories', () => {
      const serverDirs = [
        'server/api',
        'server/db',
        'server/auth',
        'server/services',
        'server/middleware',
        'server/utils',
        'server/controllers'
      ];

      serverDirs.forEach(dir => {
        const dirPath = path.join(rootDir, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      });
    });
  });

  describe('Configuration Files', () => {
    test('should have all required configuration files', () => {
      const configFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'tailwind.config.ts',
        'drizzle.config.ts',
        'postcss.config.js',
        'jest.config.js',
        'components.json'
      ];

      configFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.statSync(filePath).isFile()).toBe(true);
      });
    });

    test('should have valid JSON configuration files', () => {
      const jsonFiles = [
        'package.json',
        'tsconfig.json',
        'components.json',
        'config/permissions.json'
      ];

      jsonFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(() => JSON.parse(content)).not.toThrow();
      });
    });
  });

  describe('Documentation Structure', () => {
    test('should have main documentation files', () => {
      const docFiles = [
        'replit.md',
        'koveo-gestion-exhaustive-docs.md',
        'ROADMAP.md',
        'RBAC_IMPLEMENTATION.md',
        'SYSTEM_PROMPT_GUIDELINES.md',
        'DEPLOYMENT_FIXES.md'
      ];

      docFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    test('should have all docs folder documentation', () => {
      const docsFiles = [
        'docs/BRANCH_PROTECTION_SETUP.md',
        'docs/CODE_REVIEW_GUIDE.md',
        'docs/PAGE_ORGANIZATION_GUIDE.md',
        'docs/PAGE_ROUTING_GUIDE.md',
        'docs/QUALITY_SYSTEM_OVERVIEW.md',
        'docs/RBAC_SYSTEM.md',
        'docs/ROUTING_CHECKLIST.md'
      ];

      docsFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });
  });

  describe('Source Code Organization', () => {
    test('should not have duplicate component files', async () => {
      const componentFiles = await glob('**/components/**/*.{tsx,ts}', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**']
      });

      const componentNames = new Map<string, string[]>();
      
      componentFiles.forEach(file => {
        const basename = path.basename(file, path.extname(file));
        if (!componentNames.has(basename)) {
          componentNames.set(basename, []);
        }
        componentNames.get(basename)!.push(file);
      });

      const duplicates: string[] = [];
      componentNames.forEach((files, name) => {
        if (files.length > 1 && name !== 'index') {
          duplicates.push(`${name}: ${files.join(', ')}`);
        }
      });

      expect(duplicates).toEqual([]);
    });

    test('should follow consistent file naming conventions', async () => {
      const sourceFiles = await glob('**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**', '*.config.ts', '*.config.js']
      });

      const invalidNames: string[] = [];
      
      sourceFiles.forEach(file => {
        const basename = path.basename(file, path.extname(file));
        // Allow index, test files, and config files
        if (basename === 'index' || 
            basename.includes('.test') || 
            basename.includes('.spec') ||
            basename.includes('.config')) {
          return;
        }

        // Check for various valid naming conventions
        const isKebabCase = /^[a-z]+(-[a-z]+)*$/.test(basename);
        const isPascalCase = /^[A-Z][a-zA-Z]*$/.test(basename);
        const isCamelCase = /^[a-z][a-zA-Z]*$/.test(basename);
        const isSnakeCase = /^[a-z]+(_[a-z]+)*$/.test(basename);
        const isHookName = basename.startsWith('use-') && /^use-[a-z]+(-[a-z]+)*$/.test(basename);
        const isI18n = basename === 'i18n'; // Special case for internationalization
        
        // Allow multiple naming conventions based on file type and location
        if (!isKebabCase && !isPascalCase && !isCamelCase && !isSnakeCase && !isHookName && !isI18n) {
          invalidNames.push(file);
        }
      });

      if (invalidNames.length > 0) {
        console.warn('Files with invalid naming conventions:', invalidNames);
      }
      expect(invalidNames.length).toBe(0);
    });
  });

  describe('Import Organization', () => {
    test('should use path aliases consistently', async () => {
      const tsFiles = await glob('**/*.{ts,tsx}', {
        cwd: path.join(rootDir, 'client', 'src'),
        ignore: ['**/*.test.ts', '**/*.test.tsx']
      });

      const filesWithRelativeImports: string[] = [];

      tsFiles.forEach(file => {
        const filePath = path.join(rootDir, 'client', 'src', file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check for relative imports that could use aliases
        const relativeImports = content.match(/from ['"]\.\.\/\.\.\//g);
        if (relativeImports) {
          filesWithRelativeImports.push(file);
        }
      });

      // Allow some relative imports but warn if there are too many
      expect(filesWithRelativeImports.length).toBeLessThan(5);
    });
  });

  describe('Test Organization', () => {
    test('should have tests for critical modules', () => {
      const criticalModules = [
        'tests/unit/auth/rbac.test.ts',
        'tests/unit/db/query-scoping.test.ts',
        'tests/unit/utils.test.ts',
        'tests/unit/language.test.tsx'
      ];

      criticalModules.forEach(module => {
        const modulePath = path.join(rootDir, module);
        expect(fs.existsSync(modulePath)).toBe(true);
      });
    });

    test('should have consistent test file naming', async () => {
      const testFiles = await glob('tests/**/*.{test,spec}.{ts,tsx}', {
        cwd: rootDir
      });

      testFiles.forEach(file => {
        const fullExt = file.substring(file.lastIndexOf('.test.') !== -1 ? file.lastIndexOf('.test.') : file.lastIndexOf('.spec.'));
        expect(['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'].some(validExt => 
          file.endsWith(validExt)
        )).toBe(true);
      });
    });
  });

  describe('Database Organization', () => {
    test('should have schema file', () => {
      const schemaPath = path.join(rootDir, 'shared', 'schema.ts');
      expect(fs.existsSync(schemaPath)).toBe(true);
    });

    test('should have migrations directory', () => {
      const migrationsPath = path.join(rootDir, 'migrations');
      expect(fs.existsSync(migrationsPath)).toBe(true);
      
      const migrations = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'));
      expect(migrations.length).toBeGreaterThan(0);
    });
  });

  describe('Build Output Organization', () => {
    test('should have proper build output structure', () => {
      const distPath = path.join(rootDir, 'dist');
      
      if (fs.existsSync(distPath)) {
        expect(fs.existsSync(path.join(distPath, 'index.js'))).toBe(true);
        expect(fs.existsSync(path.join(distPath, 'public'))).toBe(true);
      }
    });
  });

  describe('Environment Configuration', () => {
    test('should not have sensitive files in repository', () => {
      const sensitiveFiles = [
        '.env',
        '.env.local',
        '.env.production',
        'secrets.json',
        'credentials.json'
      ];

      sensitiveFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        expect(fs.existsSync(filePath)).toBe(false);
      });
    });
  });
});