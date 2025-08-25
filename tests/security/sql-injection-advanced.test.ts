/**
 * @file Advanced SQL Injection Security Tests.
 * @description Advanced testing for SQL injection vulnerabilities including
 * raw SQL usage, complex attack vectors, and edge cases.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

describe('Advanced SQL Injection Security Tests', () => {
  describe('Raw SQL Usage Security Tests', () => {
    it('should verify raw SQL template literals are properly parameterized', async () => {
      // Test any raw SQL usage in the codebase
      const userInput = "'; DROP TABLE users; --";

      try {
        // This should fail safely without executing the injection
        const result = await db.execute(
          sql`SELECT COUNT(*) as count FROM ${schema.users} WHERE email = ${userInput}`
        );

        // Should return 0 count, not execute the DROP command
        expect(result.rows[0].count).toBe('0');
      } catch (_error) {
        // Should handle gracefully without revealing database details
        expect(error.message).not.toMatch(/syntax error|table.*users.*does not exist/i);
      }
    });

    it('should test dynamic query building with user input', async () => {
      const maliciousOrderBy = 'id; DROP TABLE users; --';
      const maliciousLimit = '10; DELETE FROM users; --';

      try {
        // These should be safely handled by Drizzle's query builder
        const query = db
          .select()
          .from(schema.users)
          .limit(parseInt(maliciousLimit.split(';')[0]) || 10);

        const result = await query;

        // Should return valid results without executing injection
        expect(Array.isArray(result)).toBe(true);
      } catch (error: any) {
        // Should fail safely
        expect(error.message).not.toMatch(/syntax error|relation.*does not exist/i);
      }
    });
  });

  describe('Query Scope Injection Tests', () => {
    it('should prevent injection in user context building', async () => {
      const maliciousUserId = "user-123'; DROP TABLE users; --";
      const maliciousRole = "admin'; UPDATE users SET role='admin'; --";

      const { buildUserContext } = require('../../server/db/queries/scope-query');

      try {
        const userContext = await buildUserContext(maliciousUserId, maliciousRole);

        // Should sanitize or reject malicious input
        expect(userContext.userId).not.toContain(';');
        expect(userContext.userId).not.toContain('DROP');
        expect(['admin', 'manager', 'tenant', 'resident']).toContain(userContext.role);
      } catch (error: any) {
        // Should fail safely without revealing database details
        expect(error.message).not.toMatch(/syntax error|database|constraint/i);
      }
    });

    it('should prevent injection in organization ID arrays', async () => {
      const maliciousOrgIds = [
        'org-1',
        "org-2'; DROP TABLE organizations; --",
        "'; SELECT * FROM users; --",
      ];

      const { getUserAccessibleBuildingIds } = require('../../server/db/queries/scope-query');

      try {
        const userContext = {
          userId: 'valid-user-id',
          role: 'manager' as const,
          organizationIds: maliciousOrgIds,
        };

        const buildingIds = await getUserAccessibleBuildingIds(userContext);

        // Should return valid building IDs or empty array, not execute injection
        expect(Array.isArray(buildingIds)).toBe(true);
        buildingIds.forEach((id) => {
          expect(id).not.toContain(';');
          expect(id).not.toContain('DROP');
          expect(id).not.toContain('SELECT');
        });
      } catch (_error) {
        // Should handle injection attempts gracefully
        expect(error.message).not.toMatch(/syntax error|relation.*does not exist/i);
      }
    });
  });

  describe('Unicode and Encoding Attack Tests', () => {
    it('should handle Unicode SQL injection attempts', async () => {
      const unicodePayloads = [
        'test\u0027 OR \u00271\u0027=\u00271', // Unicode single quotes
        'test\uFF07 UNION SELECT \u002A FROM users\uFF07', // Fullwidth quotation marks
        'test\u2019 OR 1=1\u2013\u2013', // Smart quotes and em dash
      ];

      for (const payload of unicodePayloads) {
        try {
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, payload));

          // Should not return unexpected results
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0); // No user should match malicious input
        } catch (_error) {
          expect(error.message).not.toMatch(/syntax error|unicode|encoding/i);
        }
      }
    });

    it('should handle double-encoded injection attempts', async () => {
      const doubleEncodedPayloads = [
        '%2527%20OR%20%2527%31%2527%3D%2527%31', // Double URL encoded ' OR '1'='1
        '%2527%20UNION%20SELECT%20%2A%20FROM%20users%2527', // Double encoded UNION
      ];

      for (const payload of doubleEncodedPayloads) {
        const decoded = decodeURIComponent(decodeURIComponent(payload));

        try {
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.username, decoded));

          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
        } catch (_error) {
          expect(error.message).not.toMatch(/syntax error|malformed|invalid/i);
        }
      }
    });
  });

  describe('Database Function Injection Tests', () => {
    it('should prevent injection through database function calls', async () => {
      const maliciousInputs = [
        "'; SELECT version(); --",
        "'; SELECT current_database(); --",
        "'; SELECT current_user; --",
        "'; SELECT session_user; --",
      ];

      for (const maliciousInput of maliciousInputs) {
        try {
          // Test if the input can execute database functions
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, maliciousInput));

          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);

          // Should not contain system information
          expect(JSON.stringify(result)).not.toMatch(/PostgreSQL|version|database|postgres/i);
        } catch (_error) {
          expect(error.message).not.toMatch(/function.*does not exist|syntax error/i);
        }
      }
    });
  });

  describe('Transaction-Based Injection Tests', () => {
    it('should prevent injection that attempts to commit/rollback transactions', async () => {
      const transactionPayloads = [
        "'; COMMIT; DROP TABLE users; --",
        "'; ROLLBACK; DELETE FROM users; --",
        "'; BEGIN; UPDATE users SET role='admin'; COMMIT; --",
      ];

      for (const payload of transactionPayloads) {
        try {
          // Test within a transaction context
          await db.transaction(async (tx) => {
            const result = await tx
              .select()
              .from(schema.users)
              .where(eq(schema.users.email, payload));

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);

            // Transaction should still be valid
            return result;
          });
        } catch (_error) {
          // Should not reveal transaction state information
          expect(error.message).not.toMatch(/transaction|commit|rollback|deadlock/i);
        }
      }
    });
  });

  describe('Column and Table Enumeration Tests', () => {
    it('should prevent table enumeration through error messages', async () => {
      const enumerationPayloads = [
        "' AND (SELECT 1 FROM information_schema.tables WHERE table_name='users') = 1 --",
        "' AND (SELECT 1 FROM pg_tables WHERE tablename='users') = 1 --",
        "' UNION SELECT table_name FROM information_schema.tables --",
      ];

      for (const payload of enumerationPayloads) {
        try {
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, payload));

          expect(Array.isArray(result)).toBe(true);

          // Should not reveal table names or schema information
          expect(JSON.stringify(result)).not.toMatch(/users|organizations|buildings|residences/);
          expect(JSON.stringify(result)).not.toMatch(/information_schema|pg_tables/);
        } catch (_error) {
          expect(error.message).not.toMatch(/table.*exists|column.*does not exist/i);
        }
      }
    });

    it('should prevent column enumeration attacks', async () => {
      const columnEnumerationPayloads = [
        "' AND (SELECT 1 FROM information_schema.columns WHERE column_name='password') = 1 --",
        "' UNION SELECT column_name FROM information_schema.columns WHERE table_name='users' --",
        "' ORDER BY 999 --", // Column count enumeration
      ];

      for (const payload of columnEnumerationPayloads) {
        try {
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, payload));

          expect(Array.isArray(result)).toBe(true);

          // Should not reveal column information
          expect(JSON.stringify(result)).not.toMatch(/password|email|username|role/);
          expect(JSON.stringify(result)).not.toMatch(/column_name|information_schema/);
        } catch (_error) {
          expect(error.message).not.toMatch(/column.*does not exist|ORDER BY position/i);
        }
      }
    });
  });

  describe('Privilege Escalation Through SQL Injection', () => {
    it('should prevent role modification through injection', async () => {
      const privilegeEscalationPayloads = [
        "'; UPDATE users SET role='admin' WHERE id=(SELECT id FROM users LIMIT 1); --",
        "'; INSERT INTO users (email, role) VALUES ('hacker@evil.com', 'admin'); --",
        "'; GRANT ALL PRIVILEGES ON ALL TABLES TO current_user; --",
      ];

      for (const payload of privilegeEscalationPayloads) {
        try {
          // Try to use injection to escalate privileges
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, payload));

          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);

          // Verify no unauthorized admin users were created
          const adminUsers = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.role, 'admin'));

          // Should not contain obviously malicious entries
          const suspiciousEmails = adminUsers.filter(
            (user) =>
              user.email.includes('hacker') ||
              user.email.includes('evil') ||
              user.email.includes('inject')
          );

          expect(suspiciousEmails.length).toBe(0);
        } catch (_error) {
          expect(error.message).not.toMatch(/permission denied|access denied|privilege/i);
        }
      }
    });
  });

  describe('Database-Specific Function Tests', () => {
    it('should prevent PostgreSQL-specific injection attacks', async () => {
      const postgresPayloads = [
        "'; SELECT lo_import('/etc/passwd'); --",
        "'; COPY users TO '/tmp/users.txt'; --",
        "'; CREATE OR REPLACE FUNCTION malicious() RETURNS void AS $$ BEGIN RAISE NOTICE 'Injected'; END $$ LANGUAGE plpgsql; --",
        "'; DO $$ BEGIN PERFORM pg_sleep(10); END $$; --",
      ];

      for (const payload of postgresPayloads) {
        try {
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, payload));

          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
        } catch (error) {
          // Should not reveal PostgreSQL-specific error details
          expect(error.message).not.toMatch(/lo_import|COPY|CREATE FUNCTION|plpgsql/i);
        }
      }
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle extremely long injection payloads', async () => {
      const longPayload = "' OR '1'='1" + ' --'.repeat(1000);

      try {
        const result = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, longPayload));

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      } catch (error) {
        // Should handle long input gracefully
        expect(error.message).not.toMatch(/input too long|buffer overflow/i);
      }
    });

    it('should handle null byte injection attempts', async () => {
      const nullBytePayloads = [
        "admin\x00' OR '1'='1",
        "test@example.com\x00'; DROP TABLE users; --",
      ];

      for (const payload of nullBytePayloads) {
        try {
          const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, payload));

          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
        } catch (error) {
          expect(error.message).not.toMatch(/null byte|invalid byte sequence/i);
        }
      }
    });
  });
});
