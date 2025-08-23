/**
 * Database Integrity Tests
 * 
 * This comprehensive test suite validates database structure, relationships,
 * and business rules to ensure data consistency and integrity.
 */

import { describe, it, expect } from '@jest/globals';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

describe('Database Integrity Tests', () => {

  describe('Foreign Key Constraints', () => {
    it('should have all required foreign key relationships', async () => {
      const foreignKeys = await db.execute(sql`
        SELECT 
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `);

      expect(foreignKeys.rows.length).toBeGreaterThan(0);
      
      // Verify key relationships exist
      const relationshipMap = new Map();
      foreignKeys.rows.forEach((row: any) => {
        const key = `${row.table_name}.${row.column_name}`;
        const target = `${row.foreign_table_name}.${row.foreign_column_name}`;
        relationshipMap.set(key, target);
      });

      // Critical relationships that must exist
      const criticalRelationships = [
        'residences.building_id',
        'user_residences.user_id',
        'user_residences.residence_id',
        'buildings.organization_id',
        'demands.submitter_id',
        'demands.residence_id',
        'demands.building_id'
      ];

      criticalRelationships.forEach(relationship => {
        expect(relationshipMap.has(relationship)).toBe(true);
      });
    });
  });

  describe('Data Type Consistency', () => {
    it('should have consistent ID column types across related tables', async () => {
      const columnInfo = await db.execute(sql`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name LIKE '%_id'
        ORDER BY table_name, column_name
      `);

      expect(columnInfo.rows.length).toBeGreaterThan(0);

      // Group by column suffix to check consistency
      const idTypeMap = new Map();
      columnInfo.rows.forEach((row: any) => {
        const suffix = row.column_name.replace(/.*_/, '_'); // e.g., building_id -> _id
        if (!idTypeMap.has(suffix)) {
          idTypeMap.set(suffix, []);
        }
        idTypeMap.get(suffix).push({
          table: row.table_name,
          column: row.column_name,
          type: row.data_type
        });
      });

      // Verify related ID columns have the same type
      idTypeMap.forEach((columns, suffix) => {
        const types = [...new Set(columns.map((col: any) => col.data_type))];
        if (types.length > 1) {
          console.warn(`Inconsistent types for ${suffix} columns:`, columns);
        }
        // Allow for some flexibility but flag major inconsistencies
        expect(types.length).toBeLessThanOrEqual(2); // Allow uuid + character varying
      });
    });
  });

  describe('Business Rule Validation', () => {
    it('should not allow duplicate unit numbers within the same building', async () => {
      const duplicateUnits = await db.execute(sql`
        SELECT 
          building_id,
          unit_number,
          COUNT(*) as count
        FROM residences 
        WHERE is_active = true
        GROUP BY building_id, unit_number
        HAVING COUNT(*) > 1
      `);

      expect(duplicateUnits.rows.length).toBe(0);
      
      if (duplicateUnits.rows.length > 0) {
        console.error('Duplicate unit numbers found:', duplicateUnits.rows);
      }
    });

    it('should have valid email formats for all users', async () => {
      const invalidEmails = await db.execute(sql`
        SELECT id, email, first_name, last_name
        FROM users 
        WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
          AND is_active = true
      `);

      expect(invalidEmails.rows.length).toBe(0);
      
      if (invalidEmails.rows.length > 0) {
        console.error('Invalid email formats found:', invalidEmails.rows);
      }
    });

    it('should not have users assigned to residences in buildings from different organizations', async () => {
      const crossOrgAssignments = await db.execute(sql`
        SELECT 
          u.id as user_id,
          u.email,
          u.organization_id as user_org,
          r.id as residence_id,
          r.unit_number,
          b.organization_id as building_org
        FROM user_residences ur
        JOIN users u ON ur.user_id = u.id
        JOIN residences r ON ur.residence_id = r.id
        JOIN buildings b ON r.building_id = b.id
        WHERE u.organization_id != b.organization_id
          AND u.is_active = true
          AND r.is_active = true 
          AND b.is_active = true
      `);

      expect(crossOrgAssignments.rows.length).toBe(0);
      
      if (crossOrgAssignments.rows.length > 0) {
        console.error('Cross-organization assignments found:', crossOrgAssignments.rows);
      }
    });
  });

  describe('Index Coverage', () => {
    it('should have indexes on frequently queried columns', async () => {
      const indexes = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);

      expect(indexes.rows.length).toBeGreaterThan(0);

      // Check for critical indexes
      const indexDefs = indexes.rows.map((row: any) => row.indexdef.toLowerCase());
      const criticalIndexes = [
        'building_id',
        'organization_id',
        'user_id',
        'residence_id',
        'email'
      ];

      criticalIndexes.forEach(column => {
        const hasIndex = indexDefs.some(def => def.includes(column));
        expect(hasIndex).toBe(true);
      });
    });
  });

  describe('Cascade Delete Verification', () => {
    it('should have proper cascade relationships configured', async () => {
      const cascadeInfo = await db.execute(sql`
        SELECT 
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          rc.delete_rule
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);

      expect(cascadeInfo.rows.length).toBeGreaterThan(0);

      // Verify critical cascade rules
      const cascadeRules = new Map();
      cascadeInfo.rows.forEach((row: any) => {
        const key = `${row.table_name}.${row.column_name}`;
        cascadeRules.set(key, row.delete_rule);
      });

      // These relationships should have CASCADE or RESTRICT properly configured
      const criticalCascades = [
        'residences.building_id', // Should cascade when building is deleted
        'user_residences.residence_id', // Should cascade when residence is deleted
        'demands.residence_id' // Should cascade when residence is deleted
      ];

      criticalCascades.forEach(relationship => {
        expect(cascadeRules.has(relationship)).toBe(true);
        const rule = cascadeRules.get(relationship);
        expect(['CASCADE', 'RESTRICT', 'SET NULL']).toContain(rule);
      });
    });
  });

  describe('Data Consistency Checks', () => {
    it('should have consistent residence counts between buildings and actual residences', async () => {
      const consistencyCheck = await db.execute(sql`
        SELECT 
          b.id,
          b.name,
          b.total_units as declared_units,
          COUNT(r.id) as actual_residences
        FROM buildings b
        LEFT JOIN residences r ON b.id = r.building_id AND r.is_active = true
        WHERE b.is_active = true
        GROUP BY b.id, b.name, b.total_units
        HAVING b.total_units != COUNT(r.id)
      `);

      // Allow for some variance in newer buildings still being set up
      expect(consistencyCheck.rows.length).toBeLessThanOrEqual(2);
      
      if (consistencyCheck.rows.length > 0) {
        console.warn('Unit count inconsistencies found:', consistencyCheck.rows);
      }
    });

    it('should not have circular references in organizational hierarchy', async () => {
      // Check if there are any organizations that might reference themselves
      const circularRefs = await db.execute(sql`
        WITH RECURSIVE org_hierarchy AS (
          SELECT id, name, 1 as level
          FROM organizations
          WHERE is_active = true
          
          UNION ALL
          
          SELECT o.id, o.name, oh.level + 1
          FROM organizations o
          JOIN org_hierarchy oh ON o.id = oh.id
          WHERE oh.level < 10
        )
        SELECT id, name, level
        FROM org_hierarchy
        WHERE level > 5
      `);

      expect(circularRefs.rows.length).toBe(0);
    });
  });
});