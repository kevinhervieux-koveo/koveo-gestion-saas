/**
 * Database Synchronization Validation Tests
 * Unit tests for database sync utilities and validation functions
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Sync Validation Tests', () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_KOVEO) {
      throw new Error('Both DATABASE_URL and DATABASE_URL_KOVEO must be set');
    }
  });

  describe('Sync Script Validation', () => {
    test('should have executable sync-db.sh script', () => {
      const scriptPath = path.join(process.cwd(), 'sync-db.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const stats = fs.statSync(scriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy(); // Check if executable
    });

    test('should have TypeScript sync script', () => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'sync-databases.ts');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('executeDualQuery');
      expect(content).toContain('pushDrizzleSchema');
      expect(content).toContain('verifySchemaSync');
    });

    test('sync-db.sh should display help when called without arguments', () => {
      const result = execSync('./sync-db.sh', { encoding: 'utf8' });
      expect(result).toContain('Database Synchronization Tool');
      expect(result).toContain('Commands:');
      expect(result).toContain('push');
      expect(result).toContain('verify');
      expect(result).toContain('execute');
    });
  });

  describe('Environment Validation', () => {
    test('should have different database URLs for dev and prod', () => {
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      expect(devDB).toBeDefined();
      expect(prodDB).toBeDefined();
      expect(devDB).not.toBe(prodDB);
    });

    test('should have valid PostgreSQL connection strings', () => {
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      expect(devDB).toMatch(/^postgresql:\/\//);
      expect(prodDB).toMatch(/^postgresql:\/\//);
    });

    test('should be able to connect to both databases', () => {
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      expect(() => {
        execSync(`psql "${devDB}" -c "SELECT 1;"`, { stdio: 'pipe' });
      }).not.toThrow();
      
      expect(() => {
        execSync(`psql "${prodDB}" -c "SELECT 1;"`, { stdio: 'pipe' });
      }).not.toThrow();
    });
  });

  describe('Critical Schema Elements', () => {
    test('should verify documents table exists in both environments', () => {
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      const tableQuery = "SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';";
      
      const devResult = execSync(`psql "${devDB}" -t -c "${tableQuery}"`, { encoding: 'utf8' });
      const prodResult = execSync(`psql "${prodDB}" -t -c "${tableQuery}"`, { encoding: 'utf8' });
      
      expect(devResult.trim()).toBe('1');
      expect(prodResult.trim()).toBe('1');
    });

    test('should verify critical unique constraints exist', () => {
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      const constraintQuery = `
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'documents' AND constraint_type = 'UNIQUE';
      `;
      
      const devConstraints = execSync(`psql "${devDB}" -t -c "${constraintQuery}"`, { encoding: 'utf8' });
      const prodConstraints = execSync(`psql "${prodDB}" -t -c "${constraintQuery}"`, { encoding: 'utf8' });
      
      expect(devConstraints.trim()).toContain('documents_file_path_key');
      expect(prodConstraints.trim()).toContain('documents_file_path_key');
    });

    test('should verify foreign key relationships are consistent', () => {
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      const fkQuery = `
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'documents' AND constraint_type = 'FOREIGN KEY';
      `;
      
      const devFKs = execSync(`psql "${devDB}" -t -c "${fkQuery}"`, { encoding: 'utf8' });
      const prodFKs = execSync(`psql "${prodDB}" -t -c "${fkQuery}"`, { encoding: 'utf8' });
      
      // Should have the same foreign key constraints
      expect(devFKs.trim()).toBe(prodFKs.trim());
    });
  });

  describe('Migration Verification', () => {
    test('should not have legacy document columns in production', () => {
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      const legacyColumnQuery = `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'documents' 
          AND column_name IN ('upload_date', 'type', 'buildings', 'residence', 'tenant');
      `;
      
      const result = execSync(`psql "${prodDB}" -t -c "${legacyColumnQuery}"`, { encoding: 'utf8' });
      expect(result.trim()).toBe('');
    });

    test('should have new document columns in both databases', () => {
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      const newColumnQuery = `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'documents' 
          AND column_name IN ('created_at', 'updated_at', 'document_type', 'file_path', 'is_visible_to_tenants')
        ORDER BY column_name;
      `;
      
      const devColumns = execSync(`psql "${devDB}" -t -c "${newColumnQuery}"`, { encoding: 'utf8' });
      const prodColumns = execSync(`psql "${prodDB}" -t -c "${newColumnQuery}"`, { encoding: 'utf8' });
      
      expect(devColumns.trim()).toBe(prodColumns.trim());
      expect(devColumns.trim()).toContain('created_at');
      expect(devColumns.trim()).toContain('document_type');
      expect(devColumns.trim()).toContain('file_path');
    });

    test('should have preserved document data in production', () => {
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      const dataQuery = "SELECT COUNT(*) FROM documents WHERE created_at IS NOT NULL;";
      const result = execSync(`psql "${prodDB}" -t -c "${dataQuery}"`, { encoding: 'utf8' });
      
      // Should have at least the 10 migrated documents
      expect(parseInt(result.trim())).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid SQL gracefully', () => {
      const devDB = process.env.DATABASE_URL;
      
      expect(() => {
        execSync(`psql "${devDB}" -c "INVALID SQL QUERY;"`, { stdio: 'pipe' });
      }).toThrow();
    });

    test('should detect schema mismatches', () => {
      // This test simulates what would happen if schemas diverged
      const devDB = process.env.DATABASE_URL;
      const prodDB = process.env.DATABASE_URL_KOVEO;
      
      const schemaQuery = `
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'documents'
        ORDER BY table_name, ordinal_position;
      `;
      
      const devSchema = execSync(`psql "${devDB}" -t -c "${schemaQuery}"`, { encoding: 'utf8' });
      const prodSchema = execSync(`psql "${prodDB}" -t -c "${schemaQuery}"`, { encoding: 'utf8' });
      
      // Schemas should match - if they don't, this test will fail and alert us
      expect(devSchema.trim()).toBe(prodSchema.trim());
    });
  });
});