/**
 * Database Orphan Detection Tests.
 *
 * This test suite detects orphaned records in the database where foreign key
 * relationships have been broken. These tests should be run regularly to ensure
 * data integrity after any database operations.
 */

import { describe, it, expect } from '@jest/globals';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

describe('Database Orphan Detection', () => {
  describe('Orphaned Residences', () => {
    it('should not have residences without valid buildings', async () => {
      const orphanedResidences = await db.execute(sql`
        SELECT 
          r.id as residence_id,
          r.unit_number,
          r.building_id,
          b.id as building_exists
        FROM residences r 
        LEFT JOIN buildings b ON r.building_id = b.id 
        WHERE b.id IS NULL
      `);

      expect(orphanedResidences.rows.length).toBe(0);

      if (orphanedResidences.rows.length > 0) {
        console.error('Orphaned residences found:', orphanedResidences.rows);
      }
    });
  });

  describe('Orphaned User-Residence Assignments', () => {
    it('should not have user_residences without valid users or residences', async () => {
      const orphanedUserResidences = await db.execute(sql`
        SELECT 
          ur.user_id,
          ur.residence_id,
          u.id as user_exists,
          r.id as residence_exists
        FROM user_residences ur 
        LEFT JOIN users u ON ur.user_id = u.id 
        LEFT JOIN residences r ON ur.residence_id = r.id 
        WHERE u.id IS NULL OR r.id IS NULL
      `);

      expect(orphanedUserResidences.rows.length).toBe(0);

      if (orphanedUserResidences.rows.length > 0) {
        console.error('Orphaned user-residence assignments found:', orphanedUserResidences.rows);
      }
    });
  });

  describe('Orphaned Buildings', () => {
    it('should not have buildings without valid organizations', async () => {
      const orphanedBuildings = await db.execute(sql`
        SELECT 
          b.id as building_id,
          b.name,
          b.organization_id,
          o.id as organization_exists
        FROM buildings b 
        LEFT JOIN organizations o ON b.organization_id = o.id 
        WHERE o.id IS NULL
      `);

      expect(orphanedBuildings.rows.length).toBe(0);

      if (orphanedBuildings.rows.length > 0) {
        console.error('Orphaned buildings found:', orphanedBuildings.rows);
      }
    });
  });

  describe('Orphaned Demands', () => {
    it('should not have demands without valid users, residences, or buildings', async () => {
      const orphanedDemands = await db.execute(sql`
        SELECT 
          d.id as demand_id,
          d.description,
          d.submitter_id,
          d.residence_id,
          d.building_id,
          u.id as user_exists,
          r.id as residence_exists,
          b.id as building_exists
        FROM demands d 
        LEFT JOIN users u ON d.submitter_id = u.id 
        LEFT JOIN residences r ON d.residence_id = r.id 
        LEFT JOIN buildings b ON d.building_id = b.id
        WHERE u.id IS NULL OR r.id IS NULL OR b.id IS NULL
      `);

      expect(orphanedDemands.rows.length).toBe(0);

      if (orphanedDemands.rows.length > 0) {
        console.error('Orphaned demands found:', orphanedDemands.rows);
      }
    });
  });

  describe('Orphaned Contacts', () => {
    it('should not have contacts without valid entity references', async () => {
      const orphanedContacts = await db.execute(sql`
        SELECT 
          c.id as contact_id,
          c.entity,
          c.entity_id,
          c.name,
          CASE 
            WHEN c.entity = 'building' THEN b.id
            WHEN c.entity = 'residence' THEN r.id
            WHEN c.entity = 'user' THEN u.id
          END as entity_exists
        FROM contacts c 
        LEFT JOIN buildings b ON c.entity = 'building' AND c.entity_id = b.id
        LEFT JOIN residences r ON c.entity = 'residence' AND c.entity_id = r.id
        LEFT JOIN users u ON c.entity = 'user' AND c.entity_id = u.id
        WHERE 
          (c.entity = 'building' AND b.id IS NULL) OR
          (c.entity = 'residence' AND r.id IS NULL) OR
          (c.entity = 'user' AND u.id IS NULL)
      `);

      expect(orphanedContacts.rows.length).toBe(0);

      if (orphanedContacts.rows.length > 0) {
        console.error('Orphaned contacts found:', orphanedContacts.rows);
      }
    });
  });

  describe('Orphaned Documents', () => {
    it('should not have documents without valid parent entities', async () => {
      // Check document_buildings for orphaned references
      const orphanedDocumentBuildings = await db.execute(sql`
        SELECT 
          db.document_id,
          db.building_id,
          d.id as document_exists,
          b.id as building_exists
        FROM document_buildings db
        LEFT JOIN documents d ON db.document_id = d.id
        LEFT JOIN buildings b ON db.building_id = b.id
        WHERE d.id IS NULL OR b.id IS NULL
      `);

      expect(orphanedDocumentBuildings.rows.length).toBe(0);

      if (orphanedDocumentBuildings.rows.length > 0) {
        console.error(
          'Orphaned document-building relationships found:',
          orphanedDocumentBuildings.rows
        );
      }

      // Check document_residents for orphaned references
      const orphanedDocumentResidents = await db.execute(sql`
        SELECT 
          dr.document_id,
          dr.user_id,
          d.id as document_exists,
          u.id as user_exists
        FROM document_residents dr
        LEFT JOIN documents d ON dr.document_id = d.id
        LEFT JOIN users u ON dr.user_id = u.id
        WHERE d.id IS NULL OR u.id IS NULL
      `);

      expect(orphanedDocumentResidents.rows.length).toBe(0);

      if (orphanedDocumentResidents.rows.length > 0) {
        console.error(
          'Orphaned document-resident relationships found:',
          orphanedDocumentResidents.rows
        );
      }
    });
  });

  describe('Orphaned Bills', () => {
    it('should not have bills without valid residences', async () => {
      const orphanedBills = await db.execute(sql`
        SELECT 
          b.id as bill_id,
          b.bill_number,
          b.residence_id,
          r.id as residence_exists
        FROM bills b 
        LEFT JOIN residences r ON b.residence_id = r.id 
        WHERE r.id IS NULL
      `);

      expect(orphanedBills.rows.length).toBe(0);

      if (orphanedBills.rows.length > 0) {
        console.error('Orphaned bills found:', orphanedBills.rows);
      }
    });
  });

  describe('Orphaned Maintenance Requests', () => {
    it('should not have maintenance requests without valid residences or users', async () => {
      const orphanedMaintenance = await db.execute(sql`
        SELECT 
          m.id as maintenance_id,
          m.title,
          m.residence_id,
          m.submitted_by,
          r.id as residence_exists,
          u.id as user_exists
        FROM maintenance_requests m 
        LEFT JOIN residences r ON m.residence_id = r.id 
        LEFT JOIN users u ON m.submitted_by = u.id
        WHERE r.id IS NULL OR u.id IS NULL
      `);

      expect(orphanedMaintenance.rows.length).toBe(0);

      if (orphanedMaintenance.rows.length > 0) {
        console.error('Orphaned maintenance requests found:', orphanedMaintenance.rows);
      }
    });
  });

  describe('Comprehensive Integrity Check', () => {
    it('should pass all orphan detection checks', async () => {
      // This test aggregates all potential orphan issues into one comprehensive report
      const integrityReport = await db.execute(sql`
        WITH orphan_summary AS (
          -- Count orphaned residences
          SELECT 'residences' as entity, COUNT(*) as count
          FROM residences r 
          LEFT JOIN buildings b ON r.building_id = b.id 
          WHERE b.id IS NULL
          
          UNION ALL
          
          -- Count orphaned user-residence assignments
          SELECT 'user_residences' as entity, COUNT(*) as count
          FROM user_residences ur 
          LEFT JOIN users u ON ur.user_id = u.id 
          LEFT JOIN residences r ON ur.residence_id = r.id 
          WHERE u.id IS NULL OR r.id IS NULL
          
          UNION ALL
          
          -- Count orphaned buildings
          SELECT 'buildings' as entity, COUNT(*) as count
          FROM buildings b 
          LEFT JOIN organizations o ON b.organization_id = o.id 
          WHERE o.id IS NULL
          
          UNION ALL
          
          -- Count orphaned demands
          SELECT 'demands' as entity, COUNT(*) as count
          FROM demands d 
          LEFT JOIN users u ON d.submitter_id = u.id 
          LEFT JOIN residences r ON d.residence_id = r.id 
          LEFT JOIN buildings b ON d.building_id = b.id
          WHERE u.id IS NULL OR r.id IS NULL OR b.id IS NULL
        )
        SELECT entity, count FROM orphan_summary WHERE count > 0
      `);

      expect(integrityReport.rows.length).toBe(0);

      if (integrityReport.rows.length > 0) {
        console.error('Database integrity issues found:', integrityReport.rows);
        integrityReport.rows.forEach((row: any) => {
          console.error(`- ${row.count} orphaned ${row.entity}`);
        });
      }
    });
  });
});
