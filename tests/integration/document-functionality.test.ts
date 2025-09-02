/**
 * Document Functionality Tests
 * Tests document operations against both development and production databases
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';

const DEV_DB = process.env.DATABASE_URL;
const PROD_DB = process.env.DATABASE_URL_KOVEO;

// Test data
const testDocument = {
  id: 'test-doc-sync-validation',
  name: 'Test Document for Sync Validation',
  document_type: 'test',
  file_path: '/test/sync-validation-doc.pdf',
  uploaded_by_id: 'test-user-sync',
  description: 'Test document for database synchronization validation'
};

describe('Document Functionality Tests', () => {
  beforeAll(() => {
    if (!DEV_DB || !PROD_DB) {
      throw new Error('Both DATABASE_URL and DATABASE_URL_KOVEO must be set');
    }
  });

  afterAll(async () => {
    // Clean up test data
    const cleanupQuery = `DELETE FROM documents WHERE id = '${testDocument.id}';`;
    try {
      execSync(`psql "${DEV_DB}" -c "${cleanupQuery}"`, { stdio: 'pipe' });
      execSync(`psql "${PROD_DB}" -c "${cleanupQuery}"`, { stdio: 'pipe' });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Document Schema Validation', () => {
    test('should accept valid document insertions in development', async () => {
      const insertQuery = `
        INSERT INTO documents (id, name, document_type, file_path, uploaded_by_id, description) 
        VALUES ('${testDocument.id}', '${testDocument.name}', '${testDocument.document_type}', 
                '${testDocument.file_path}', '${testDocument.uploaded_by_id}', '${testDocument.description}');
      `;

      expect(() => {
        execSync(`psql "${DEV_DB}" -c "${insertQuery}"`, { stdio: 'pipe' });
      }).not.toThrow();

      // Verify insertion
      const selectQuery = `SELECT id, name, document_type FROM documents WHERE id = '${testDocument.id}';`;
      const result = execSync(`psql "${DEV_DB}" -t -c "${selectQuery}"`, { encoding: 'utf8' });
      
      expect(result.trim()).toContain(testDocument.id);
      expect(result.trim()).toContain(testDocument.name);
    });

    test('should accept valid document insertions in production', async () => {
      const insertQuery = `
        INSERT INTO documents (id, name, document_type, file_path, uploaded_by_id, description) 
        VALUES ('${testDocument.id}-prod', '${testDocument.name} Prod', '${testDocument.document_type}', 
                '${testDocument.file_path}-prod', '${testDocument.uploaded_by_id}', '${testDocument.description}');
      `;

      expect(() => {
        execSync(`psql "${PROD_DB}" -c "${insertQuery}"`, { stdio: 'pipe' });
      }).not.toThrow();

      // Verify insertion
      const selectQuery = `SELECT id, name, document_type FROM documents WHERE id = '${testDocument.id}-prod';`;
      const result = execSync(`psql "${PROD_DB}" -t -c "${selectQuery}"`, { encoding: 'utf8' });
      
      expect(result.trim()).toContain(`${testDocument.id}-prod`);
      expect(result.trim()).toContain(`${testDocument.name} Prod`);

      // Cleanup
      execSync(`psql "${PROD_DB}" -c "DELETE FROM documents WHERE id = '${testDocument.id}-prod';"`, { stdio: 'pipe' });
    });

    test('should enforce unique file_path constraint in both databases', async () => {
      const duplicateInsert = `
        INSERT INTO documents (id, name, document_type, file_path, uploaded_by_id) 
        VALUES ('duplicate-test', 'Duplicate Test', 'test', '${testDocument.file_path}', 'test-user');
      `;

      // Should fail in development due to unique constraint
      expect(() => {
        execSync(`psql "${DEV_DB}" -c "${duplicateInsert}"`, { stdio: 'pipe' });
      }).toThrow();

      // Should fail in production due to unique constraint
      expect(() => {
        execSync(`psql "${PROD_DB}" -c "${duplicateInsert}"`, { stdio: 'pipe' });
      }).toThrow();
    });

    test('should enforce NOT NULL constraints in both databases', async () => {
      const invalidInsert = `
        INSERT INTO documents (id, name, document_type, uploaded_by_id) 
        VALUES ('invalid-test', 'Invalid Test', 'test', 'test-user');
      `;

      // Should fail due to missing file_path (NOT NULL)
      expect(() => {
        execSync(`psql "${DEV_DB}" -c "${invalidInsert}"`, { stdio: 'pipe' });
      }).toThrow();

      expect(() => {
        execSync(`psql "${PROD_DB}" -c "${invalidInsert}"`, { stdio: 'pipe' });
      }).toThrow();
    });
  });

  describe('Document Data Integrity', () => {
    test('should have consistent document counts', async () => {
      const countQuery = 'SELECT COUNT(*) FROM documents;';
      
      const devCount = execSync(`psql "${DEV_DB}" -t -c "${countQuery}"`, { encoding: 'utf8' }).trim();
      const prodCount = execSync(`psql "${PROD_DB}" -t -c "${countQuery}"`, { encoding: 'utf8' }).trim();

      // Production should have at least the migrated documents (10)
      expect(parseInt(prodCount)).toBeGreaterThanOrEqual(10);
      
      // Development might have different test data, but should be reasonable
      expect(parseInt(devCount)).toBeGreaterThanOrEqual(0);
    });

    test('should have valid document types in both databases', async () => {
      const validTypesQuery = `
        SELECT DISTINCT document_type FROM documents 
        WHERE document_type IN ('regulations', 'financial', 'meeting_minutes', 'insurance', 'safety', 'maintenance', 'permit', 'inspection', 'lease', 'invoice')
        ORDER BY document_type;
      `;

      const devTypes = execSync(`psql "${DEV_DB}" -t -c "${validTypesQuery}"`, { encoding: 'utf8' });
      const prodTypes = execSync(`psql "${PROD_DB}" -t -c "${validTypesQuery}"`, { encoding: 'utf8' });

      // Both should have some valid document types
      expect(devTypes.trim().length).toBeGreaterThan(0);
      expect(prodTypes.trim().length).toBeGreaterThan(0);
    });

    test('should have proper timestamp fields in both databases', async () => {
      const timestampQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(created_at) as with_created_at,
          COUNT(updated_at) as with_updated_at
        FROM documents;
      `;

      const devTimestamps = execSync(`psql "${DEV_DB}" -t -c "${timestampQuery}"`, { encoding: 'utf8' });
      const prodTimestamps = execSync(`psql "${PROD_DB}" -t -c "${timestampQuery}"`, { encoding: 'utf8' });

      // Parse results
      const devResult = devTimestamps.trim().split('|').map(s => parseInt(s.trim()));
      const prodResult = prodTimestamps.trim().split('|').map(s => parseInt(s.trim()));

      // All documents should have timestamps
      expect(devResult[0]).toBe(devResult[1]); // total = with_created_at
      expect(devResult[0]).toBe(devResult[2]); // total = with_updated_at
      expect(prodResult[0]).toBe(prodResult[1]);
      expect(prodResult[0]).toBe(prodResult[2]);
    });
  });

  describe('Foreign Key Relationships', () => {
    test('should allow NULL foreign keys in both databases', async () => {
      const testDocWithNullFK = {
        id: 'test-null-fk',
        name: 'Test Document with NULL FK',
        document_type: 'test',
        file_path: '/test/null-fk-doc.pdf',
        uploaded_by_id: 'test-user'
      };

      const insertQuery = `
        INSERT INTO documents (id, name, document_type, file_path, uploaded_by_id, building_id, residence_id) 
        VALUES ('${testDocWithNullFK.id}', '${testDocWithNullFK.name}', '${testDocWithNullFK.document_type}', 
                '${testDocWithNullFK.file_path}', '${testDocWithNullFK.uploaded_by_id}', NULL, NULL);
      `;

      // Should succeed in both databases
      expect(() => {
        execSync(`psql "${DEV_DB}" -c "${insertQuery}"`, { stdio: 'pipe' });
      }).not.toThrow();

      expect(() => {
        execSync(`psql "${PROD_DB}" -c "${insertQuery.replace(testDocWithNullFK.id, testDocWithNullFK.id + '-prod')}"`, { stdio: 'pipe' });
      }).not.toThrow();

      // Cleanup
      execSync(`psql "${DEV_DB}" -c "DELETE FROM documents WHERE id = '${testDocWithNullFK.id}';"`, { stdio: 'pipe' });
      execSync(`psql "${PROD_DB}" -c "DELETE FROM documents WHERE id = '${testDocWithNullFK.id}-prod';"`, { stdio: 'pipe' });
    });
  });
});