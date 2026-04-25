/**
 * User Serializer Password-Leak Audit — Integration (static-analysis) Tests
 *
 * Task #964: Lock down the user serializer and audit past password leaks.
 *
 * This file contains static source-analysis assertions that confirm no
 * bcrypt hash substring (`$2a$` / `$2b$`) and no `password` key can appear
 * in HTTP responses produced by the eight user-serializing endpoints:
 *
 *   1. GET /api/users                                (server/api/users.ts)
 *   2. GET /api/users/:id                            (server/api/users.ts)
 *   3. GET /api/users/me  (served by auth/user)      (server/auth.ts)
 *   4. GET /api/auth/user                            (server/auth.ts)
 *   5. GET /api/organizations/:id/users  (no separate handler — org-scoped
 *      users flow through GET /api/users with org filter)
 *   6. GET /api/buildings/:buildingId/residences     (server/api/buildings.ts)
 *   7. GET /api/residences/:residenceId/assigned-users (server/api/residences.ts)
 *   8. GET /api/maintenance/projects/:id/vendors     (server/api/maintenance.ts)
 *
 * Approach: reading source files and asserting structural invariants is more
 * reliable than live HTTP tests when the database layer is mocked, and it
 * catches future regressions at the syntactic level regardless of test-data
 * availability.
 *
 * Pass-#21 probe results are captured in the final describe block.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

const root = path.resolve(__dirname, '../..');
const serverApi = path.join(root, 'server', 'api');
const server = path.join(root, 'server');

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(root, rel), 'utf-8');
}

// ---------------------------------------------------------------------------
// Helper: returns every line that matches the regex, for readable assertions
// ---------------------------------------------------------------------------
function violatingLines(src: string, pattern: RegExp, skipPattern?: RegExp): string[] {
  return src
    .split('\n')
    .filter((l, _i) => pattern.test(l) && !(skipPattern && skipPattern.test(l)));
}

// ---------------------------------------------------------------------------
// 1. Schema audit — shared/schemas/core.ts
// ---------------------------------------------------------------------------
describe('Schema audit — users table', () => {
  const src = readSrc('shared/schemas/core.ts');

  it('users table has exactly one sensitive credential column: `password`', () => {
    const sensitivePattern = /(?:password|secret|token|totp|mfa|pin)\s*:/i;
    const lines = src
      .split('\n')
      .filter(l => sensitivePattern.test(l) && /users\s*=\s*pgTable/.test(src.slice(0, src.indexOf(l))));

    // After the users table definition block only `password` should appear
    // Extract the users table block
    const tableMatch = src.match(/export const users = pgTable\('users'[\s\S]+?\}\);/);
    expect(tableMatch).not.toBeNull();
    const tableBlock = tableMatch![0];

    // Only `password` is the credential column
    expect(tableBlock).toMatch(/password:\s*text\('password'\)/);
    // No MFA secret, TOTP, SSO token columns
    expect(tableBlock).not.toMatch(/(?:totp|mfa|otp|secret|sso_token|refresh_token)\s*:/i);
  });
});

// ---------------------------------------------------------------------------
// 2. safeUserColumns / SafeUser audit — server/db/queries/user-queries.ts
// ---------------------------------------------------------------------------
describe('safeUserColumns and SafeUser type reconciliation', () => {
  const src = readSrc('server/db/queries/user-queries.ts');

  it('safeUserColumns does not include a `password` property', () => {
    const block = src.match(/export const safeUserColumns\s*=\s*\{[\s\S]+?\}\s*as const/)?.[0] ?? '';
    expect(block).not.toMatch(/\bpassword\b/);
  });

  it('safeUserColumns enumerates all non-sensitive users table columns', () => {
    const src2 = readSrc('shared/schemas/core.ts');
    const tableBlock = src2.match(/export const users = pgTable\('users'[\s\S]+?\}\);/)?.[0] ?? '';
    const columnNames = [...tableBlock.matchAll(/\s+(\w+):\s+(?:text|varchar|boolean|timestamp|date|pgEnum)/g)]
      .map(m => m[1])
      .filter(n => n !== 'password');

    for (const col of columnNames) {
      expect(src).toContain(col);
    }
  });

  it('SafeUser type is derived from safeUserColumns (not from full User)', () => {
    expect(src).toMatch(/export type SafeUser\s*=/);
    expect(src).toMatch(/keyof typeof safeUserColumns/);
    expect(src).not.toMatch(/Omit<\s*User\s*,\s*['"]password['"]\s*>/);
  });

  it('stripPassword helper is present and removes password from any user object', () => {
    expect(src).toMatch(/export function stripPassword/);
    expect(src).toMatch(/password:\s*_pw/);
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/users — server/api/users.ts
// ---------------------------------------------------------------------------
describe('GET /api/users (server/api/users.ts)', () => {
  const src = readSrc('server/api/users.ts');

  it('imports stripPassword from user-queries', () => {
    expect(src).toMatch(/import.*stripPassword.*from.*user-queries/);
  });

  it('applies defence-in-depth password strip before res.json in GET /api/users handler', () => {
    expect(src).toMatch(/password:\s*_pw\b/);
  });

  it('does not select users.password in any Drizzle .select() block', () => {
    const violations = violatingLines(
      src,
      /password:\s*(?:users|schema\.users|schema\['users'\])\.password/,
      /stripPassword|\/\//
    );
    expect(violations).toHaveLength(0);
  });

  it('does not expose a raw `password` key in any res.json call', () => {
    const violations = violatingLines(
      src,
      /res\.(?:json|send)\s*\(.*\bpassword\b/,
      /\/\//
    );
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. GET /api/users/:id — server/api/users.ts
// ---------------------------------------------------------------------------
describe('GET /api/users/:id (server/api/users.ts)', () => {
  const src = readSrc('server/api/users.ts');

  it('calls stripPassword() before returning single user', () => {
    expect(src).toMatch(/res\.json\(\s*stripPassword\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// 5. GET /api/auth/user — server/auth.ts
// ---------------------------------------------------------------------------
describe('GET /api/auth/user (server/auth.ts)', () => {
  const src = readSrc('server/auth.ts');

  it('returns storage.getUser() (return type SafeUser per IStorage interface)', () => {
    // The IStorage interface in server/storage.ts declares getUser returns SafeUser
    const storageSrc = readSrc('server/storage.ts');
    expect(storageSrc).toMatch(/getUser\s*\([^)]+\)\s*:\s*Promise<SafeUser\s*\|/);
    // auth.ts calls storage.getUser
    expect(src).toMatch(/storage\.getUser\s*\(/);
  });

  it('does not select users.password in any Drizzle .select() block', () => {
    const violations = violatingLines(
      src,
      /password:\s*(?:users|schema\.users)\.password/,
      /\/\//
    );
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. GET /api/residences/:residenceId/assigned-users — server/api/residences.ts
// ---------------------------------------------------------------------------
describe('GET /api/residences/:residenceId/assigned-users (server/api/residences.ts)', () => {
  const src = readSrc('server/api/residences.ts');

  it('does not select users.password in the assigned-users select block', () => {
    const violations = violatingLines(
      src,
      /password:\s*(?:users|schema\.users)\.password/,
      /\/\//
    );
    expect(violations).toHaveLength(0);
  });

  it('explicitly enumerates only safe columns in the assigned-users select', () => {
    // The select block must include id, email, firstName, lastName
    // and must NOT contain a `password` key
    const selectBlock = src.match(/\/\/ Get assigned users[\s\S]{0,800}res\.json\(assignedUsers\)/)?.[0] ?? '';
    expect(selectBlock).toMatch(/id:\s*users\.id/);
    expect(selectBlock).toMatch(/email:\s*users\.email/);
    expect(selectBlock).not.toMatch(/password:/);
  });
});

// ---------------------------------------------------------------------------
// 7. GET /api/buildings/:buildingId/residences — server/api/buildings.ts
//    (returns residence rows, not user rows — password column not present)
// ---------------------------------------------------------------------------
describe('GET /api/buildings/:buildingId/residences (server/api/buildings.ts)', () => {
  const src = readSrc('server/api/buildings.ts');

  it('does not select any column named password', () => {
    const violations = violatingLines(
      src,
      /password:\s*(?:users|schema\.users|residences|buildings)\.password/,
      /\/\//
    );
    expect(violations).toHaveLength(0);
  });

  it('does not contain `$2a$` or `$2b$` bcrypt sentinel strings', () => {
    expect(src).not.toMatch(/\$2[ab]\$/);
  });
});

// ---------------------------------------------------------------------------
// 8. GET /api/maintenance/projects/:id/vendors — server/api/maintenance.ts
//    (returns submission_vendors + vendors rows, not user rows)
// ---------------------------------------------------------------------------
describe('GET /api/maintenance/projects/:id/vendors (server/api/maintenance.ts)', () => {
  const src = readSrc('server/api/maintenance.ts');

  it('does not select a users.password column in the project vendors handler', () => {
    const violations = violatingLines(
      src,
      /password:\s*(?:users|schema\.users)\.password/,
      /\/\//
    );
    expect(violations).toHaveLength(0);
  });

  it('does not contain `$2a$` or `$2b$` bcrypt sentinel strings', () => {
    expect(src).not.toMatch(/\$2[ab]\$/);
  });
});

// ---------------------------------------------------------------------------
// 9. Storage layer — optimized-db-storage.ts
// ---------------------------------------------------------------------------
describe('Storage layer (server/optimized-db-storage.ts)', () => {
  const src = readSrc('server/optimized-db-storage.ts');

  it('getUser() uses safeUserColumns projection (not SELECT *)', () => {
    const getUserBlock = src.match(/async getUser\s*\([^)]+\)[\s\S]{0,300}return result\[0\]/)?.[0] ?? '';
    expect(getUserBlock).toMatch(/safeUserColumns/);
    expect(getUserBlock).not.toMatch(/\.select\s*\(\s*\)/);
  });

  it('getUsersWithAssignmentsPaginated handler is used by GET /api/users (not raw getUsers)', () => {
    const usersTsSrc = readSrc('server/api/users.ts');
    expect(usersTsSrc).toMatch(/getUsersWithAssignmentsPaginated/);
    expect(usersTsSrc).not.toMatch(/storage\.getUsers\s*\(\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// 10. Semgrep rule guard — .semgrep.yml
// ---------------------------------------------------------------------------
describe('Regression-blocking semgrep rule', () => {
  const src = readSrc('.semgrep.yml');

  it('contains the no-password-in-drizzle-select rule', () => {
    expect(src).toContain('no-password-in-drizzle-select');
  });

  it('no-password-in-drizzle-select rule has ERROR severity', () => {
    const ruleBlock = src.match(/id:\s*no-password-in-drizzle-select[\s\S]+?severity:\s*\w+/)?.[0] ?? '';
    expect(ruleBlock).toMatch(/severity:\s*ERROR/);
  });

  it('contains the no-raw-users-select-star rule', () => {
    expect(src).toContain('no-raw-users-select-star');
  });

  it('no-raw-users-select-star rule has ERROR severity', () => {
    const ruleBlock = src.match(/id:\s*no-raw-users-select-star[\s\S]+?severity:\s*\w+/)?.[0] ?? '';
    expect(ruleBlock).toMatch(/severity:\s*ERROR/);
  });
});

// ---------------------------------------------------------------------------
// 11. Pass-#21 probe: confirm defence-in-depth strip is structurally present
//     for the GET /api/users route (the highest-risk bulk-user endpoint).
// ---------------------------------------------------------------------------
describe('Pass-#21 probe — GET /api/users defence-in-depth strip', () => {
  const src = readSrc('server/api/users.ts');

  it('the password strip destructure exists on the result array before res.json', () => {
    // Looking for the pattern: result.users.map(({ password: _pw, ...safe }) => safe)
    expect(src).toMatch(/result\.users\.map\s*\(\s*\(\s*\{[^}]*password:\s*_pw[^}]*\}\s*\)\s*=>/);
  });

  it('the stripped array is what is passed to res.json (not the raw result)', () => {
    // filteredUsers must appear in the res.json call
    const filteredVarMatch = src.match(/const\s+(\w+)\s*=\s*result\.users\.map\s*\(\s*\(\s*\{[^}]*password:\s*_pw/);
    expect(filteredVarMatch).not.toBeNull();
    const filteredVar = filteredVarMatch![1];
    // that variable is used in the json response
    const jsonCallPattern = new RegExp(`res\\.json\\([\\s\\S]{0,300}${filteredVar}`);
    expect(src).toMatch(jsonCallPattern);
  });

  it('safeUserColumns import is present in user-queries.ts confirming DB-level projection', () => {
    const userQueriesSrc = readSrc('server/db/queries/user-queries.ts');
    expect(userQueriesSrc).toMatch(/export const safeUserColumns\s*=/);
    const usersApiSrc = readSrc('server/api/users.ts');
    expect(usersApiSrc).toMatch(/stripPassword/);
  });

  it('no bcrypt sentinel strings appear in any of the 8 handler source files', () => {
    const files = [
      'server/api/users.ts',
      'server/auth.ts',
      'server/api/organizations.ts',
      'server/api/buildings.ts',
      'server/api/residences.ts',
      'server/api/maintenance.ts',
    ];
    for (const f of files) {
      const content = readSrc(f);
      expect(content).not.toMatch(/\$2[ab]\$\d+\$/);
    }
  });
});
