import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { enforceDemoSecurity } from '../../server/middleware/demo-security';
import { isOpenDemoUser } from '../../server/rbac';

jest.mock('../../server/rbac', () => ({
  isOpenDemoUser: jest.fn(),
  canUserPerformWriteOperation: jest.fn(),
}));

const mockIsOpenDemoUser = isOpenDemoUser as jest.MockedFunction<typeof isOpenDemoUser>;

interface DiscoveredRoute {
  method: string;
  path: string;
  file: string;
}

interface MockRequestFields {
  user: { id: string; email: string };
  method: string;
  path: string;
  url: string;
  originalUrl: string;
  headers: Record<string, string>;
}

interface MockResponseFields {
  status: jest.Mock;
  json: jest.Mock;
}

function createMockReq(overrides: Partial<MockRequestFields> = {}): Request {
  return {
    user: { id: 'demo-user-id', email: 'demo@example.com' },
    method: 'POST',
    path: '/api/test',
    url: '/api/test',
    originalUrl: '/api/test',
    headers: { 'accept-language': 'en-US' },
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): MockResponseFields & Response {
  const res: MockResponseFields = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return res as MockResponseFields & Response;
}

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-reset-token',
];

const MCP_PATHS = ['/mcp'];

function resolveRouterMounts(serverDir: string): Map<string, string> {
  const mountMap = new Map<string, string>();
  const routesTsPath = path.join(serverDir, 'routes.ts');
  const routesContent = fs.readFileSync(routesTsPath, 'utf-8');

  const importPattern = /import\s+(?:\{[^}]*\}|(\w+))\s+from\s+['"]\.\/([^'"]+)['"]/g;
  const imports = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = importPattern.exec(routesContent)) !== null) {
    if (m[1]) {
      imports.set(m[1], m[2]);
    }
  }

  const mountPattern = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*[^,)]*,?\s*(\w+Router)\s*\)/g;
  while ((m = mountPattern.exec(routesContent)) !== null) {
    const mountPrefix = m[1];
    const varName = m[2];
    const importPath = imports.get(varName);
    if (importPath) {
      let resolvedFile = importPath;
      if (!resolvedFile.endsWith('.ts')) resolvedFile += '.ts';
      mountMap.set(resolvedFile, mountPrefix);
    }
  }

  const registerPattern = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;
  while ((m = registerPattern.exec(routesContent)) !== null) {
    const mountPrefix = m[1];
    const varName = m[2];
    if (varName.endsWith('Router') || varName === 'router') {
      const importPath = imports.get(varName);
      if (importPath) {
        let resolvedFile = importPath;
        if (!resolvedFile.endsWith('.ts')) resolvedFile += '.ts';
        mountMap.set(resolvedFile, mountPrefix);
      }
    }
  }

  const registerFnPattern = /export function register\w+Routes\(app.*?\)\s*\{[^}]*app\.use\(\s*['"]([^'"]+)['"]\s*,\s*router\s*\)/gs;
  const apiDir = path.join(serverDir, 'api');
  if (fs.existsSync(apiDir)) {
    const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const file of apiFiles) {
      const filePath = path.join(apiDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const fnCopy = new RegExp(registerFnPattern.source, registerFnPattern.flags);
      const fnMatch = fnCopy.exec(content);
      if (fnMatch) {
        const relPath = 'api/' + file;
        if (!mountMap.has(relPath)) {
          mountMap.set(relPath, fnMatch[1]);
        }
      }
    }
  }

  return mountMap;
}

function scanSourceForRoutes(): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  const serverDir = path.resolve(__dirname, '../../server');
  const routePattern = /(?:app|router)\.(post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi;

  const mountMap = resolveRouterMounts(serverDir);

  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relFile = path.relative(serverDir, filePath);
    let match: RegExpExecArray | null;

    const isRouterFile = content.includes('express.Router()') || content.includes('Router()');
    let mountPrefix = '';
    if (isRouterFile) {
      for (const [key, prefix] of mountMap.entries()) {
        if (relFile === key || relFile.endsWith(key)) {
          mountPrefix = prefix;
          break;
        }
      }
    }

    const patternCopy = new RegExp(routePattern.source, routePattern.flags);
    while ((match = patternCopy.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      let routePath = match[2];

      if (!routePath.startsWith('/')) routePath = '/' + routePath;

      if (isRouterFile && mountPrefix && !routePath.startsWith(mountPrefix)) {
        routePath = mountPrefix + routePath;
      }

      routes.push({
        method,
        path: routePath,
        file: relFile,
      });
    }
  }

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'tests') {
        walkDir(full);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
        scanFile(full);
      }
    }
  }

  walkDir(serverDir);
  return routes;
}

function isExemptPath(routePath: string): boolean {
  if (AUTH_PATHS.some(ap => routePath === ap)) return true;
  if (MCP_PATHS.some(mp => routePath === mp)) return true;
  if (!routePath.startsWith('/api')) return true;
  if (routePath === '/api/test') return true;
  if (routePath.includes('/api/trial-requests') || routePath.includes('/trial-requests')) return true;
  return false;
}

function concretizePath(routePath: string): string {
  return routePath.replace(/:(\w+)/g, '12345678-1234-1234-1234-123456789abc');
}

describe('Demo Endpoint Security Inventory Guard', () => {
  let allRoutes: DiscoveredRoute[];
  let writeRoutes: DiscoveredRoute[];
  let apiWriteRoutes: DiscoveredRoute[];

  beforeAll(() => {
    allRoutes = scanSourceForRoutes();
    writeRoutes = allRoutes.filter(r => WRITE_METHODS.includes(r.method));
    apiWriteRoutes = writeRoutes.filter(r => !isExemptPath(r.path));
  });

  it('should discover write endpoints from actual server source files', () => {
    expect(allRoutes.length).toBeGreaterThan(0);
    expect(writeRoutes.length).toBeGreaterThanOrEqual(30);

    const sourceFiles = [...new Set(allRoutes.map(r => r.file))];
    expect(sourceFiles.length).toBeGreaterThanOrEqual(5);
  });

  it('should find write routes in all core API modules', () => {
    const filesWithWrites = [...new Set(writeRoutes.map(r => r.file))];

    const expectedModules = [
      'api/users.ts',
      'api/buildings.ts',
      'api/bills.ts',
      'api/documents.ts',
      'api/demands.ts',
      'api/residences.ts',
      'api/budgets.ts',
    ];

    const missing = expectedModules.filter(
      mod => !filesWithWrites.some(f => f.endsWith(mod))
    );

    if (missing.length > 0) {
      fail(
        `Expected write routes in these modules but found none:\n${missing.join('\n')}\n` +
        `If a module was restructured, update expectedModules.`
      );
    }
  });

  it('should resolve mounted router prefixes for budget routes', () => {
    const budgetRoutes = writeRoutes.filter(r => r.file === 'api/budgets.ts');
    expect(budgetRoutes.length).toBeGreaterThanOrEqual(3);

    for (const route of budgetRoutes) {
      expect(route.path).toMatch(/^\/api\/budgets\//);
    }
  });

  it('should verify enforceDemoSecurity is mounted globally on /api/* wildcard', () => {
    const routesTsPath = path.resolve(__dirname, '../../server/routes.ts');
    const content = fs.readFileSync(routesTsPath, 'utf-8');

    const globalMount = content.match(/app\.use\(\s*['"]\/api\/\*['"]\s*,\s*enforceDemoSecurity\(\)\s*\)/);
    expect(globalMount).not.toBeNull();
  });

  it('should verify enforceDemoSecurity appears before ALL API route registrations in routes.ts', () => {
    const routesTsPath = path.resolve(__dirname, '../../server/routes.ts');
    const content = fs.readFileSync(routesTsPath, 'utf-8');

    const middlewarePos = content.indexOf("enforceDemoSecurity()");
    expect(middlewarePos).toBeGreaterThan(-1);

    const preMiddlewareExemptions = [
      'registerMcpRoutes',
      'setupAuthRoutes',
    ];

    const routeRegistrationPatterns = [
      /register\w+Routes\s*\(\s*app\s*\)/g,
      /setup\w+Routes\s*\(\s*app\s*\)/g,
      /app\.use\(\s*['"]\/api\/[^*][^'"]*['"]\s*,/g,
      /app\.(post|put|patch|delete)\(\s*['"]\/api\//g,
    ];

    const violations: string[] = [];

    for (const pattern of routeRegistrationPatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(content)) !== null) {
        if (m.index < middlewarePos) {
          const matchText = m[0].trim();
          const isExempt = preMiddlewareExemptions.some(ex => matchText.includes(ex));
          if (!isExempt) {
            const lineNum = content.substring(0, m.index).split('\n').length;
            violations.push(`Line ${lineNum}: "${matchText}" appears before enforceDemoSecurity()`);
          }
        }
      }
    }

    if (violations.length > 0) {
      fail(
        `Route registrations found BEFORE enforceDemoSecurity() middleware:\n` +
        violations.join('\n') +
        '\nAll /api route registrations must come AFTER the enforceDemoSecurity() global mount.\n' +
        `Exemptions (non-API or auth-specific): ${preMiddlewareExemptions.join(', ')}`
      );
    }
  });

  it('should confirm global /api/* mount covers every discovered API write route', () => {
    const uncoveredRoutes = apiWriteRoutes.filter(r => !r.path.startsWith('/api/'));

    if (uncoveredRoutes.length > 0) {
      fail(
        `${uncoveredRoutes.length} API write route(s) are NOT under /api/* and would bypass global demo security:\n` +
        uncoveredRoutes.map(r => `  ${r.method} ${r.path} (${r.file})`).join('\n') +
        '\nEither mount these routes under /api/ or add explicit enforceDemoSecurity() middleware.'
      );
    }
  });

  describe('All discovered write endpoints blocked for demo users', () => {
    it('should block demo users on every API write endpoint found in source', async () => {
      expect(apiWriteRoutes.length).toBeGreaterThan(0);

      const middleware = enforceDemoSecurity();
      const failures: string[] = [];

      for (const route of apiWriteRoutes) {
        mockIsOpenDemoUser.mockResolvedValue(true);

        const concretePath = concretizePath(route.path);

        const req = createMockReq({
          method: route.method,
          path: concretePath,
          url: concretePath,
          originalUrl: concretePath,
        });
        const res = createMockRes();
        const next = jest.fn() as unknown as NextFunction;

        await middleware(req, res, next);

        if ((next as jest.Mock).mock.calls.length > 0 || !res.status.mock.calls.length) {
          failures.push(`${route.method} ${route.path} (${route.file}) was NOT blocked`);
        } else if (res.status.mock.calls[0]?.[0] !== 403) {
          failures.push(`${route.method} ${route.path} (${route.file}) returned ${res.status.mock.calls[0]?.[0]} instead of 403`);
        }

        jest.clearAllMocks();
      }

      if (failures.length > 0) {
        fail(
          `Demo security bypass: ${failures.length} write endpoint(s) not blocked:\n` +
          failures.join('\n') +
          '\nEnsure enforceDemoSecurity() covers these paths or add them to AUTH_PATHS/MCP_PATHS exemptions.'
        );
      }
    });
  });

  describe('Exempt auth endpoints remain accessible', () => {
    it('should allow demo users to POST auth endpoints', async () => {
      const middleware = enforceDemoSecurity();

      for (const authPath of AUTH_PATHS) {
        mockIsOpenDemoUser.mockResolvedValue(true);

        const req = createMockReq({
          method: 'POST',
          path: authPath,
          url: authPath,
          originalUrl: authPath,
          headers: {},
        });
        const res = createMockRes();
        const next = jest.fn() as unknown as NextFunction;

        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        jest.clearAllMocks();
      }
    });
  });

  describe('Read endpoints remain accessible to demo users', () => {
    it('should allow demo users to GET safe collection endpoints', async () => {
      const middleware = enforceDemoSecurity();
      const safeReads = ['/api/users', '/api/buildings', '/api/health', '/api/features',
                         '/api/bills', '/api/documents', '/api/demands'];

      for (const readPath of safeReads) {
        mockIsOpenDemoUser.mockResolvedValue(true);

        const req = createMockReq({
          method: 'GET',
          path: readPath,
          url: readPath,
          originalUrl: readPath,
          headers: {},
        });
        const res = createMockRes();
        const next = jest.fn() as unknown as NextFunction;

        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        jest.clearAllMocks();
      }
    });
  });

  it('should produce a coverage report of all discovered write endpoints', () => {
    const byModule: Record<string, number> = {};
    for (const r of apiWriteRoutes) {
      byModule[r.file] = (byModule[r.file] || 0) + 1;
    }

    expect(Object.keys(byModule).length).toBeGreaterThanOrEqual(5);
    expect(apiWriteRoutes.length).toBeGreaterThanOrEqual(30);
  });
});
