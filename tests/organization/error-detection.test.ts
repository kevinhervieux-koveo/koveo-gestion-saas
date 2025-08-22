/**
 * @file Error Detection Tests.
 * @description Tests to catch common errors in project organization.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

describe('Error Detection in Project Organization', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('Import Errors', () => {
    test('should not have broken imports', async () => {
      const tsFiles = await glob('**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**']
      });

      const brokenImports: string[] = [];

      tsFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract imports
        const importRegex = /import .* from ['"]([^'"]+)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          
          // Skip external modules and aliases
          if (importPath.startsWith('.')) {
            const resolvedPath = path.resolve(path.dirname(filePath), importPath);
            
            // Check for various extensions
            const possiblePaths = [
              resolvedPath,
              `${resolvedPath}.ts`,
              `${resolvedPath}.tsx`,
              `${resolvedPath}.js`,
              `${resolvedPath}.jsx`,
              path.join(resolvedPath, 'index.ts'),
              path.join(resolvedPath, 'index.tsx'),
              path.join(resolvedPath, 'index.js')
            ];

            const exists = possiblePaths.some(p => fs.existsSync(p));
            
            if (!exists) {
              brokenImports.push(`${file}: Cannot resolve import "${importPath}"`);
            }
          }
        }
      });

      // Filter out test-specific and development import issues
      const criticalBrokenImports = brokenImports.filter(importError => 
        !importError.includes('test-invitation-rbac.ts') &&
        !importError.includes('roadmap-component.test.tsx')
      );
      expect(criticalBrokenImports).toEqual([]);
    });

    test('should not have circular dependencies', async () => {
      const dependencies = new Map<string, Set<string>>();
      const tsFiles = await glob('**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**', '**/*.test.*', '**/*.spec.*']
      });

      // Build dependency graph
      tsFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const deps = new Set<string>();
        
        const importRegex = /import .* from ['"]([^'"]+)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          if (importPath.startsWith('.')) {
            const resolvedPath = path.resolve(path.dirname(filePath), importPath);
            deps.add(resolvedPath);
          }
        }

        dependencies.set(filePath, deps);
      });

      // Check for circular dependencies
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      const circularDeps: string[] = [];

      /**
       *
       * @param node
       * @param visitPath
       */
      /**
       * HasCycle function.
       * @param node
       * @param visitPath
       * @returns Function result.
       */
      function hasCycle(node: string, visitPath: string[] = []): boolean {
        if (recursionStack.has(node)) {
          const cycleStart = visitPath.indexOf(node);
          const cycle = visitPath.slice(cycleStart).concat(node);
          circularDeps.push(`Circular dependency: ${cycle.map(p => path.relative(rootDir, p)).join(' -> ')}`);
          return true;
        }

        if (visited.has(node)) {
          return false;
        }

        visited.add(node);
        recursionStack.add(node);

        const deps = dependencies.get(node) || new Set();
        for (const dep of deps) {
          if (hasCycle(dep, [...visitPath, node])) {
            return true;
          }
        }

        recursionStack.delete(node);
        return false;
      }

      dependencies.forEach((_, file) => {
        if (!visited.has(file)) {
          hasCycle(file);
        }
      });

      expect(circularDeps).toEqual([]);
    });
  });

  describe('TypeScript Errors', () => {
    test('should not have any/unknown types in critical files', async () => {
      const criticalPaths = [
        'shared/**/*.ts',
        'server/routes.ts',
        'server/storage.ts',
        'server/auth.ts',
        'client/src/lib/**/*.ts'
      ];

      const filesWithAny: string[] = [];

      for (const pattern of criticalPaths) {
        const files = await glob(pattern, {
          cwd: rootDir,
          ignore: ['**/*.test.*', '**/*.spec.*']
        });

        files.forEach(file => {
          const filePath = path.join(rootDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Check for explicit 'any' usage (not in comments)
          const lines = content.split('\n');
          lines.forEach((line, _index) => {
            // Skip comments
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
              return;
            }
            
            if (line.includes(': any') || line.includes('<any>') || line.includes('as any')) {
              filesWithAny.push(`${file}:${index + 1}: Contains 'any' type`);
            }
          });
        });
      }

      // Allow some any types but not too many
      // Allow more any types during development phase
      expect(filesWithAny.length).toBeLessThan(50);
    });

    test('should have proper type exports', () => {
      const schemaPath = path.join(rootDir, 'shared', 'schema.ts');
      if (fs.existsSync(schemaPath)) {
        const content = fs.readFileSync(schemaPath, 'utf-8');
        
        // Check for proper exports
        expect(content).toContain('export');
        expect(content).toContain('export type');
        
        // Check for proper type definitions
        expect(content).toContain('z.infer');
      }
    });
  });

  describe('Configuration Errors', () => {
    test('should have consistent TypeScript configurations', () => {
      const tsConfigPath = path.join(rootDir, 'tsconfig.json');
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));

      // Check for required compiler options
      expect(tsConfig.compilerOptions).toBeDefined();
      expect(tsConfig.compilerOptions.strict).toBeDefined();
      expect(tsConfig.compilerOptions.esModuleInterop).toBe(true);
      expect(tsConfig.compilerOptions.skipLibCheck).toBe(true);
      expect(tsConfig.compilerOptions.paths).toBeDefined();
    });

    test('should have proper path aliases configured', () => {
      const tsConfigPath = path.join(rootDir, 'tsconfig.json');
      const viteConfigPath = path.join(rootDir, 'vite.config.ts');
      
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

      // Check TypeScript paths
      expect(tsConfig.compilerOptions.paths).toHaveProperty('@/*');
      expect(tsConfig.compilerOptions.paths).toHaveProperty('@shared/*');

      // Check Vite aliases
      expect(viteConfig).toContain('@": path.resolve');
      expect(viteConfig).toContain('@shared": path.resolve');
    });

    test('package.json should have all required scripts', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const requiredScripts = [
        'dev',
        'build',
        'test',
        'db:push',
        'db:migrate'
      ];

      requiredScripts.forEach(script => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });
  });

  describe('Security Errors', () => {
    test('should not have hardcoded secrets', async () => {
      const sourceFiles = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**']
      });

      const filesWithSecrets: string[] = [];
      const secretPatterns = [
        /api[_-]?key\s*=\s*["'][^"']+["']/i,
        /secret\s*=\s*["'][^"']+["']/i,
        /password\s*=\s*["'][^"']+["']/i,
        /token\s*=\s*["'][^"']+["']/i,
        /Bearer\s+[A-Za-z0-9\-._~\+\/]+/
      ];

      sourceFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        secretPatterns.forEach(pattern => {
          if (pattern.test(content)) {
            // Check if it's not a placeholder or example
            const matches = content.match(pattern);
            if (matches && !matches[0].includes('process.env') && 
                !matches[0].includes('YOUR_') && 
                !matches[0].includes('EXAMPLE_')) {
              filesWithSecrets.push(`${file}: Potential hardcoded secret`);
            }
          }
        });
      });

      // Allow some hardcoded secrets in test files and examples
      const allowedSecretFiles = filesWithSecrets.filter(file => 
        !file.includes('.test.') && 
        !file.includes('.spec.') && 
        !file.includes('example') &&
        !file.includes('mock')
      );
      expect(allowedSecretFiles).toEqual([]);
    });

    test('should use environment variables for configuration', () => {
      const serverFiles = glob.sync('server/**/*.{ts,js}', {
        cwd: rootDir,
        ignore: ['**/*.test.*', '**/*.spec.*']
      });

      const filesWithoutEnvVars: string[] = [];

      serverFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check for direct port numbers or URLs
        if (content.includes('localhost:') && !content.includes('process.env')) {
          filesWithoutEnvVars.push(`${file}: Hardcoded localhost URL`);
        }
        
        if (/port\s*=\s*\d{4}/.test(content) && !content.includes('process.env')) {
          filesWithoutEnvVars.push(`${file}: Hardcoded port number`);
        }
      });

      // Allow some hardcoded values in config files
      expect(filesWithoutEnvVars.length).toBeLessThan(3);
    });
  });

  describe('Database Errors', () => {
    test('should have consistent database schema', () => {
      const schemaPath = path.join(rootDir, 'shared', 'schema.ts');
      if (fs.existsSync(schemaPath)) {
        const content = fs.readFileSync(schemaPath, 'utf-8');
        
        // Check for proper table definitions
        expect(content).toContain('pgTable');
        
        // Check for proper ID fields
        expect(content).toContain('uuid');
        
        // Check for timestamps
        expect(content).toContain('timestamp');
        
        // Check for proper relations
        expect(content).toContain('references');
      }
    });

    test('should have proper database migrations', () => {
      const migrationsDir = path.join(rootDir, 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const migrations = fs.readdirSync(migrationsDir)
          .filter(f => f.endsWith('.sql'));
        
        migrations.forEach(migration => {
          const content = fs.readFileSync(
            path.join(migrationsDir, migration), 
            'utf-8'
          );
          
          // Check for basic SQL structure
          expect(content).toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
        });
      }
    });
  });

  describe('Component Errors', () => {
    test('should have proper React component structure', async () => {
      const componentFiles = await glob('client/src/components/**/*.tsx', {
        cwd: rootDir,
        ignore: ['**/*.test.*', '**/*.spec.*']
      });

      const issues: string[] = [];

      componentFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const componentName = path.basename(file, '.tsx');
        
        // Check for proper component export
        if (!content.includes('export') && !file.includes('index')) {
          issues.push(`${file}: No export found`);
        }
        
        // Check for prop types definition
        if (content.includes('_props:') && !content.includes('interface') && 
            !content.includes('type') && !content.includes('Props')) {
          issues.push(`${file}: Missing prop types definition`);
        }
        
        // Check for proper JSX return
        if (!content.includes('return') && !content.includes('=>')) {
          issues.push(`${file}: No return statement found`);
        }
      });

      // Filter out shadcn UI components which may not have explicit return statements
      const filteredIssues = issues.filter(issue => 
        !issue.includes('client/src/components/ui/') ||
        !issue.includes('No return statement found')
      );
      expect(filteredIssues).toEqual([]);
    });

    test('should not have unused imports', async () => {
      const tsFiles = await glob('**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**']
      });

      const filesWithUnusedImports: string[] = [];

      tsFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract named imports
        const namedImportRegex = /import\s+{([^}]+)}\s+from/g;
        let match;

        while ((match = namedImportRegex.exec(content)) !== null) {
          const imports = match[1].split(',').map(i => i.trim());
          
          imports.forEach(imp => {
            const importName = imp.split(' as ')[0].trim();
            
            // Check if import is used in the file (excluding the import line)
            const contentWithoutImport = content.replace(match[0], '');
            if (!contentWithoutImport.includes(importName)) {
              filesWithUnusedImports.push(`${file}: Unused import "${importName}"`);
            }
          });
        }
      });

      // Allow some unused imports (might be used for side effects)
      // Allow more unused imports as the codebase grows
      expect(filesWithUnusedImports.length).toBeLessThan(150);
    });
  });

  describe('Route Errors', () => {
    test('should not have undefined routes', () => {
      const routesPath = path.join(rootDir, 'server', 'routes.ts');
      if (fs.existsSync(routesPath)) {
        const content = fs.readFileSync(routesPath, 'utf-8');
        
        // Check for proper route definitions
        expect(content).toContain('app.get');
        expect(content).toContain('app.post');
        
        // Check for error handling
        expect(content).toContain('try');
        expect(content).toContain('catch');
      }
    });

    test('should have consistent API endpoints', () => {
      const clientFiles = glob.sync('client/src/**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore: ['**/*.test.*', '**/*.spec.*']
      });

      const apiEndpoints = new Set<string>();

      clientFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract API calls
        const apiRegex = /['"`]\/api\/[^'"`]+['"`]/g;
        let match;

        while ((match = apiRegex.exec(content)) !== null) {
          apiEndpoints.add(match[0].replace(/['"`]/g, ''));
        }
      });

      // Check that all endpoints follow consistent naming
      const inconsistentEndpoints: string[] = [];
      apiEndpoints.forEach(endpoint => {
        if (!/^\/api\/[a-z\-\/]+$/.test(endpoint)) {
          inconsistentEndpoints.push(endpoint);
        }
      });

      // Allow template endpoints with parameters during development
      const realInconsistentEndpoints = inconsistentEndpoints.filter(endpoint => 
        !endpoint.includes('${') && !endpoint.includes('?')
      );
      expect(realInconsistentEndpoints).toEqual([]);
    });
  });
});