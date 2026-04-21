import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export interface DiscoveredRoute {
  method: string;
  path: string;
  file: string;
}

export interface ScanResult {
  routes: DiscoveredRoute[];
  writeRoutes: DiscoveredRoute[];
  apiWriteRoutes: DiscoveredRoute[];
}

export const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export const AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-reset-token',
];

export const MCP_PATHS = ['/mcp'];

export function isExemptPath(routePath: string): boolean {
  if (AUTH_PATHS.some((ap) => routePath === ap)) return true;
  if (MCP_PATHS.some((mp) => routePath === mp)) return true;
  if (!routePath.startsWith('/api')) return true;
  if (routePath === '/api/test') return true;
  if (routePath.includes('/api/trial-requests') || routePath.includes('/trial-requests'))
    return true;
  return false;
}

function parseSourceFile(filePath: string): ts.SourceFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function getStaticString(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function isExpressMethodCall(
  expr: ts.CallExpression
): { receiver: string; method: string } | null {
  if (!ts.isPropertyAccessExpression(expr.expression)) return null;
  const methodName = expr.expression.name.text.toLowerCase();
  if (!HTTP_METHODS.has(methodName)) return null;

  const receiverExpr = expr.expression.expression;
  let receiverName: string | null = null;
  if (ts.isIdentifier(receiverExpr)) {
    receiverName = receiverExpr.text;
  } else {
    return null;
  }

  const rlower = receiverName.toLowerCase();
  const isAppLike = rlower === 'app' || rlower.endsWith('app');
  const isRouterLike = rlower === 'router' || rlower.endsWith('router');
  if (!isAppLike && !isRouterLike) return null;

  return { receiver: isAppLike ? 'app' : 'router', method: methodName };
}

interface RouteCall {
  method: string;
  path: string;
  receiver: 'app' | 'router';
}

function extractRouteCalls(source: ts.SourceFile): RouteCall[] {
  const results: RouteCall[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const info = isExpressMethodCall(node);
      if (info) {
        const firstArg = node.arguments[0];
        const literal = getStaticString(firstArg);
        if (literal !== null && literal.startsWith('/')) {
          results.push({
            method: info.method.toUpperCase(),
            path: literal,
            receiver: info.receiver as 'app' | 'router',
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return results;
}

interface RouterMountResolution {
  registeredFiles: Set<string>;
  mountMap: Map<string, string>;
}

function collectLocalImports(source: ts.SourceFile): Map<string, string> {
  const imports = new Map<string, string>();
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
    const resolved = spec.replace(/^\.\//, '');
    const clause = stmt.importClause;
    if (!clause) continue;
    if (clause.name) {
      imports.set(clause.name.text, resolved);
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        imports.set(el.name.text, resolved);
      }
    }
  }
  return imports;
}

function resolveImportToFile(serverDir: string, rel: string): string | null {
  const candidates = [rel, rel + '.ts', rel + '/index.ts'];
  for (const c of candidates) {
    const full = path.join(serverDir, c);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return path.relative(serverDir, full).replace(/\\/g, '/');
    }
  }
  return null;
}

function resolveRouteRegistrations(serverDir: string): RouterMountResolution {
  const routesTsPath = path.join(serverDir, 'routes.ts');
  const source = parseSourceFile(routesTsPath);
  const imports = collectLocalImports(source);
  const registeredFiles = new Set<string>(['routes.ts']);
  const mountMap = new Map<string, string>();

  function registerByIdentifier(name: string, mountPrefix?: string) {
    const spec = imports.get(name);
    if (!spec) return;
    const resolved = resolveImportToFile(serverDir, spec);
    if (!resolved) return;
    registeredFiles.add(resolved);
    if (mountPrefix !== undefined) {
      mountMap.set(resolved, mountPrefix);
    }
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const fnName = node.expression.text;
        const firstArg = node.arguments[0];
        if (
          (fnName.startsWith('register') && fnName.endsWith('Routes')) ||
          (fnName.startsWith('setup') && fnName.endsWith('Routes'))
        ) {
          if (firstArg && ts.isIdentifier(firstArg) && firstArg.text === 'app') {
            registerByIdentifier(fnName);
          }
        }
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;
        const receiver = node.expression.expression;
        if (
          methodName === 'use' &&
          ts.isIdentifier(receiver) &&
          receiver.text === 'app'
        ) {
          const args = node.arguments;
          if (args.length === 0) return;
          let mountPrefix = '';
          let startIdx = 0;
          const pathLit = getStaticString(args[0]);
          if (pathLit !== null) {
            mountPrefix = pathLit;
            startIdx = 1;
          }
          for (let i = startIdx; i < args.length; i++) {
            const a = args[i];
            if (ts.isIdentifier(a)) {
              registerByIdentifier(a.text, mountPrefix || undefined);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const apiDir = path.join(serverDir, 'api');
  if (fs.existsSync(apiDir)) {
    for (const entry of fs.readdirSync(apiDir)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue;
      const relPath = 'api/' + entry;
      if (!registeredFiles.has(relPath)) continue;
      if (mountMap.has(relPath)) continue;

      const apiSrc = parseSourceFile(path.join(apiDir, entry));
      let foundMount: string | null = null;

      function walk(n: ts.Node) {
        if (foundMount) return;
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === 'use'
        ) {
          const recv = n.expression.expression;
          if (ts.isIdentifier(recv) && recv.text === 'app') {
            const pathLit = getStaticString(n.arguments[0]);
            const hasRouterArg = n.arguments
              .slice(1)
              .some(
                (a) =>
                  ts.isIdentifier(a) &&
                  (a.text === 'router' || a.text.toLowerCase().endsWith('router'))
              );
            if (pathLit !== null && hasRouterArg) {
              foundMount = pathLit;
              return;
            }
          }
        }
        ts.forEachChild(n, walk);
      }
      walk(apiSrc);
      if (foundMount) {
        mountMap.set(relPath, foundMount);
      }
    }
  }

  return { registeredFiles, mountMap };
}

export function scanServerRoutes(serverDir?: string): ScanResult {
  const resolvedServerDir = serverDir ?? path.resolve(process.cwd(), 'server');
  const { registeredFiles, mountMap } = resolveRouteRegistrations(resolvedServerDir);

  const routes: DiscoveredRoute[] = [];
  for (const relFile of registeredFiles) {
    const full = path.join(resolvedServerDir, relFile);
    if (!fs.existsSync(full)) continue;
    const source = parseSourceFile(full);
    const calls = extractRouteCalls(source);
    const mountPrefix = mountMap.get(relFile) ?? '';

    for (const call of calls) {
      let routePath = call.path;
      if (call.receiver === 'router' && mountPrefix && !routePath.startsWith(mountPrefix)) {
        routePath = mountPrefix + routePath;
      }
      routes.push({ method: call.method, path: routePath, file: relFile });
    }
  }

  const dedup = new Map<string, DiscoveredRoute>();
  for (const r of routes) {
    dedup.set(`${r.method} ${r.path} ${r.file}`, r);
  }
  const uniqueRoutes = Array.from(dedup.values()).sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.method !== b.method) return a.method < b.method ? -1 : 1;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });

  const writeRoutes = uniqueRoutes.filter((r) => WRITE_METHODS.includes(r.method));
  const apiWriteRoutes = writeRoutes.filter((r) => !isExemptPath(r.path));

  return { routes: uniqueRoutes, writeRoutes, apiWriteRoutes };
}

export interface RouteManifest {
  generatedBy: string;
  description: string;
  totals: {
    allRoutes: number;
    writeRoutes: number;
    apiWriteRoutes: number;
  };
  routes: DiscoveredRoute[];
}

export function buildManifest(serverDir?: string): RouteManifest {
  const result = scanServerRoutes(serverDir);
  return {
    generatedBy: 'scripts/generate-route-manifest.ts',
    description:
      'Auto-generated inventory of all routes reachable through server/routes.ts. Regenerate with `npx tsx scripts/generate-route-manifest.ts` whenever routes change. The drift guard in tests/security/route-manifest-drift.test.ts fails the build if a new write endpoint is added without updating this manifest, or if a write endpoint is registered outside the /api/* global demo-security mount.',
    totals: {
      allRoutes: result.routes.length,
      writeRoutes: result.writeRoutes.length,
      apiWriteRoutes: result.apiWriteRoutes.length,
    },
    routes: result.routes,
  };
}

export function serializeManifest(manifest: RouteManifest): string {
  return JSON.stringify(manifest, null, 2) + '\n';
}
