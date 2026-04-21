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
  
  // SQL injection patterns - more context-aware to avoid false positives
  SQL_INJECTION: /((?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+(?:.*\s+)?(?:FROM|INTO|TABLE|DATABASE|SCHEMA)|(?:UNION|JOIN)\s+(?:ALL\s+)?(?:SELECT|FROM)|(?:;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER))|(?:\'\s*(?:OR|AND)\s*\')|(?:--\s*)|(?:\/\*.*\*\/)|(?:EXEC\s*\()|(?:LOAD_FILE\s*\()|(?:INTO\s+OUTFILE)|(?:INFORMATION_SCHEMA)|(?:mysql\.user)|(?:pg_|information_schema\.))/gi,
  
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
 * Credential field names whose VALUES are excluded from the
 * dangerous-pattern body scan (see `sanitizeInputMiddleware`). Keys
 * here are matched as JSON property names by a `JSON.stringify`
 * replacer, so they are field-name based rather than path-based and
 * apply uniformly across login, signup, invitation acceptance, and
 * password-reset payloads.
 *
 * Adding a new credential-bearing field name (e.g. a future
 * `repeatPassword`) requires updating this set.
 */
const PASSWORD_FIELD_KEYS: ReadonlySet<string> = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'currentPassword',
]);

/**
 * Method-aware allow-list for the MCP / OAuth bypass.
 *
 * Each entry pins (path, allowed HTTP methods). The middleware bypasses
 * sanitization ONLY when the request matches both. New OAuth/MCP routes
 * must be added here explicitly — and only with the methods they actually
 * implement — so a contributor cannot accidentally widen the bypass by
 * adding a sibling sub-route or an unintended HTTP verb.
 *
 * Method choices reflect the relevant specs:
 *   - /mcp                                       Streamable HTTP (POST init,
 *                                                GET SSE stream, DELETE end)
 *   - /register                                  RFC 7591 (POST only)
 *   - /authorize                                 RFC 6749 (GET, plus POST for
 *                                                form-post / consent submit)
 *   - /token, /revoke                            RFC 6749 / 7009 (POST only)
 *   - /.well-known/*                             RFC 8414 / 9728 (GET only)
 *   - /oauth/consent                             our consent UI (GET form,
 *                                                POST submission)
 */
const mcpOAuthBypass: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['/mcp', new Set(['POST', 'GET', 'DELETE'])],
  ['/register', new Set(['POST'])],
  ['/authorize', new Set(['GET', 'POST'])],
  ['/token', new Set(['POST'])],
  ['/revoke', new Set(['POST'])],
  ['/.well-known/oauth-authorization-server', new Set(['GET'])],
  ['/.well-known/oauth-protected-resource', new Set(['GET'])],
  ['/.well-known/oauth-protected-resource/mcp', new Set(['GET'])],
  ['/oauth/consent', new Set(['GET', 'POST'])],
]);

/**
 * Method-aware allow-list for legacy routes that bypass sanitization
 * because they handle binary uploads, multipart bodies, financial JSON
 * with characters that trip the heuristic patterns, or have their own
 * stricter Zod validation downstream.
 *
 * Originally this was a `req.path.includes(prefix)` list, which meant a
 * future contributor could shadow these prefixes with a sibling route
 * (e.g. `/api/bills-evil`) or an unintended HTTP verb and silently
 * inherit the bypass.
 *
 * The list is now derived at startup from the actual Express route
 * table via {@link buildLegacyBypassFromApp}. Each entry is an exact
 * route pattern (with `:param` segments resolved to `[^/]+`) pinned to
 * the exact HTTP methods actually mounted for that path. Because the
 * map only contains patterns Express itself registered, a sibling like
 * `/api/bills-evil` cannot match (it's not in the table), and an
 * unintended verb on a real path falls through because the method set
 * is keyed off the registered handlers.
 *
 * The eight legacy resource roots below define what counts as "in
 * scope" for the bypass — i.e. the same prefixes the previous
 * `skipRoutes` list used. Anything Express registers under one of these
 * roots is auto-added; anything outside them sanitizes normally.
 */
const LEGACY_BYPASS_RESOURCE_ROOTS: readonly string[] = [
  '/api/upload',
  '/api/documents/upload',
  '/api/bills',
  '/api/invoices',
  '/api/budgets',
  '/api/maintenance',
  '/api/performance/web-vitals',
  '/api/demands',
];

interface LegacyBypassRule {
  pattern: RegExp;
  methods: Set<string>;
  source: string; // original Express path, for debugging
}

let legacyBypassRules: LegacyBypassRule[] = [];

/**
 * Convert an Express route pattern (`/api/bills/:id/payments`) to an
 * anchored RegExp that matches the literal request path. Dynamic
 * segments become `[^/]+`; regex metacharacters in literal segments
 * are escaped.
 */
function expressPathToRegex(routePath: string): RegExp {
  let pattern = '';
  let i = 0;
  while (i < routePath.length) {
    const ch = routePath[i];
    if (ch === ':') {
      // consume :paramName
      i++;
      while (i < routePath.length && /[A-Za-z0-9_]/.test(routePath[i])) {
        i++;
      }
      pattern += '[^/]+';
    } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      pattern += '\\' + ch;
      i++;
    } else {
      pattern += ch;
      i++;
    }
  }
  return new RegExp('^' + pattern + '$');
}

function isInLegacyScope(routePath: string): boolean {
  return LEGACY_BYPASS_RESOURCE_ROOTS.some(
    (root) => routePath === root || routePath.startsWith(root + '/'),
  );
}

interface CollectedRoute {
  path: string;
  method: string;
}

/**
 * Walk an Express router (recursively for sub-routers mounted via
 * `app.use(prefix, router)`) and collect every (full path, method)
 * pair it serves.
 */
function collectRoutes(
  router: any,
  prefix: string,
  out: CollectedRoute[],
): void {
  if (!router || !Array.isArray(router.stack)) {
    return;
  }
  for (const layer of router.stack) {
    if (layer.route && layer.route.path) {
      const fullPath = prefix + layer.route.path;
      const methods = layer.route.methods || {};
      for (const method of Object.keys(methods)) {
        if (methods[method]) {
          out.push({ path: fullPath, method: method.toUpperCase() });
        }
      }
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const mount = extractMountPath(layer);
      collectRoutes(layer.handle, prefix + mount, out);
    }
  }
}

/**
 * Recover the literal mount path from a router layer. Express stores
 * the mount path inside `layer.regexp` after compiling it for fast
 * matching; we parse the source back to a literal string. For the
 * default `'/'` mount, Express sets `regexp.fast_slash = true`.
 */
function extractMountPath(layer: any): string {
  if (!layer.regexp) return '';
  if (layer.regexp.fast_slash) return '';
  const src: string = layer.regexp.source;
  // Typical shape: `^\/api\/budgets\/?(?=\/|$)` or `^\/api\/budgets\/?$`
  const match = src.match(/^\^((?:\\\/[^\\?(]+)+)\\\/\?(?:\(\?=.+?\)|\$)/);
  if (!match) return '';
  return match[1].replace(/\\\//g, '/');
}

/**
 * Build the legacy bypass map by introspecting an Express app's
 * route table. Call this AFTER all routes are registered.
 */
export function buildLegacyBypassFromApp(app: any): void {
  const collected: CollectedRoute[] = [];
  collectRoutes(app?._router, '', collected);

  const byPath = new Map<string, Set<string>>();
  for (const { path, method } of collected) {
    if (!isInLegacyScope(path)) continue;
    let methods = byPath.get(path);
    if (!methods) {
      methods = new Set<string>();
      byPath.set(path, methods);
    }
    methods.add(method);
  }

  legacyBypassRules = Array.from(byPath.entries()).map(([path, methods]) => ({
    pattern: expressPathToRegex(path),
    methods,
    source: path,
  }));
}

function matchesLegacyBypass(path: string, method: string): boolean {
  for (const rule of legacyBypassRules) {
    if (rule.methods.has(method) && rule.pattern.test(path)) {
      return true;
    }
  }
  return false;
}

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
  // The patterns carry the /g flag so they can be reused for `.replace()`
  // in sanitizeInput; calling `.test()` on a stateful global RegExp leaks
  // `lastIndex` across calls and causes random misses on subsequent
  // requests. Reset before each probe so detection is deterministic.
  const probes = [
    DANGEROUS_PATTERNS.SQL_INJECTION,
    DANGEROUS_PATTERNS.COMMAND_INJECTION,
    DANGEROUS_PATTERNS.LDAP_INJECTION,
    DANGEROUS_PATTERNS.NOSQL_INJECTION,
  ];
  for (const pattern of probes) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      pattern.lastIndex = 0;
      return true;
    }
  }
  return false;
}

/**
 * Walk a request body and return the dotted path of the first string
 * value — OR object key — whose contents trip the dangerous-pattern
 * probes. Credential field values are skipped for the same reason
 * they are excluded from the bulk-string scan (see
 * `PASSWORD_FIELD_KEYS`). Array indices are rendered as `[n]` so
 * paths like `profile.phones[0]` are unambiguous.
 *
 * Key scanning matters: the NOSQL_INJECTION probe is designed to
 * catch things like `{ filter: { $ne: null } }` where the payload is
 * entirely in the KEY. A values-only walk would silently let those
 * through, which was a regression in an earlier draft. Key checks
 * run before recursing into the value.
 *
 * Returns `null` when nothing is found.
 */
function findDangerousFieldPath(
  value: unknown,
  currentPath: string = '',
): string | null {
  if (typeof value === 'string') {
    return containsDangerousPatterns(value) ? currentPath : null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findDangerousFieldPath(value[i], `${currentPath}[${i}]`);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (PASSWORD_FIELD_KEYS.has(key)) continue;
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      // Check the KEY itself (catches NoSQL operator injection like
      // `$ne`, `$where`, command-injection chars in a key name, etc.)
      // before descending into the value.
      if (containsDangerousPatterns(key)) {
        return nextPath;
      }
      const hit = findDangerousFieldPath(child, nextPath);
      if (hit !== null) return hit;
    }
  }
  return null;
}

/**
 * Human-readable labels for the common field paths surfaced on auth /
 * account / invitation forms. Keeping this server-side (rather than
 * translating on the client) means the same message shows up in API
 * clients, mobile, and log lines without each surface having to
 * duplicate the mapping. French is the primary project locale.
 */
const FIELD_LABELS: Record<string, string> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'Courriel',
  phone: 'Téléphone',
  address: 'Adresse',
  city: 'Ville',
  postalCode: 'Code postal',
  note: 'Note',
  notes: 'Notes',
  description: 'Description',
  title: 'Titre',
  name: 'Nom',
};

function labelForFieldPath(path: string): string {
  if (!path) return 'ce champ';
  // Use the last segment (stripped of array indices) for the label
  // lookup — nested paths like `profile.firstName` still resolve to
  // "Prénom".
  const lastSegment = path.split('.').pop()!.replace(/\[\d+\]$/, '');
  return FIELD_LABELS[lastSegment] ?? lastSegment;
}

/**
 * Input sanitization middleware
 */
export function sanitizeInputMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Skip sanitization for legacy routes that need raw data or have their
    // own validation. Matching is method-aware and exact-segment (see the
    // `legacyBypassRules` doc-comment) so a sibling lookalike like
    // `/api/bills-evil` or an unintended verb like DELETE on `/api/upload`
    // falls through to the normal sanitizer.
    if (matchesLegacyBypass(req.path, req.method)) {
      return next();
    }

    // Skip sanitization for MCP and OAuth 2.0 endpoints. These are spec-defined
    // protocols (RFC 6749, RFC 7591, MCP Streamable HTTP) with their own
    // validation in the @modelcontextprotocol/sdk auth router and our
    // KoveoMcpOAuthProvider. Generic injection heuristics produce false
    // positives on JSON-RPC payloads (e.g. NoSQL `$`-key matches on
    // `$schema`) and OAuth bodies, blocking legitimate Claude.ai traffic.
    //
    // The bypass is BOTH path-exact AND method-restricted:
    //  - Path matching uses an exact-string Set lookup (no prefix matching),
    //    so a future route such as `/authorize-evil` or `/register/admin`
    //    cannot inherit the bypass.
    //  - Each entry also pins the allowed HTTP methods, so e.g. a stray
    //    PUT on `/token` would still be sanitized rather than waved through.
    if (mcpOAuthBypass.get(req.path)?.has(req.method)) {
      return next();
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeInput(req.query);
    }
    
    // Sanitize body parameters
    if (req.body) {
      // Check for dangerous patterns before sanitization. Credential
      // fields are excluded from the scan because passwords legitimately
      // contain characters the COMMAND_INJECTION / NOSQL_INJECTION
      // heuristics treat as dangerous (`$`, `;`, `|`, backtick, etc.).
      // Those values never reach the database raw — they are hashed
      // immediately in the auth handlers — so scanning them produces
      // only false positives that block account creation, login, and
      // password reset. The actual `req.body` is NOT mutated — the
      // walker below skips credential keys.
      //
      // Returning the offending `fieldPath` along with the 400 lets
      // the UI tell users which field to fix (before this change the
      // generic "potentially harmful content" message left users
      // retrying the same payload forever). `fieldPath` is also
      // included in the security log so admins can spot common false
      // positives (e.g. "every rejection is `note`").
      const offendingPath = findDangerousFieldPath(req.body);
      if (offendingPath !== null) {
        const bodyString = JSON.stringify(req.body, (key, value) =>
          PASSWORD_FIELD_KEYS.has(key) ? undefined : value,
        );
        logSecurity('dangerous_input_detected', {
          requestId: req.headers['x-request-id'] as string || 'unknown',
          ip: req.ip || 'unknown',
          metadata: {
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            fieldPath: offendingPath,
            body: bodyString.substring(0, 500), // Log first 500 chars
          },
        });

        const fieldLabel = labelForFieldPath(offendingPath);
        res.status(400).json({
          error: 'Invalid input detected',
          message:
            `Le champ « ${fieldLabel} » contient des caractères non autorisés ` +
            `(par exemple : ; & | \` $ < >). Merci de les retirer et de réessayer.`,
          code: 'DANGEROUS_INPUT',
          fieldPath: offendingPath,
          fieldLabel,
        });
        return;
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
    
    res.status(500).json({
      error: 'Input processing error',
      message: 'Unable to process request safely',
      code: 'SANITIZATION_ERROR'
    });
    return;
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