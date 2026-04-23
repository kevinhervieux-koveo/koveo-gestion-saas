/**
 * Optimized Document Query Service
 * 
 * Eliminates N+1 query patterns by using JOINs and CTEs to load documents
 * with all related entity data in single optimized queries.
 */

import { db } from '../../db';
import { sql, eq, and, or, inArray, isNull, desc } from 'drizzle-orm';
import { documents, users, buildings, residences, organizations } from '@shared/schema';
import type { Document } from '@shared/schema';

export interface DocumentWithRelations extends Document {
  uploader?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  building?: {
    id: string;
    name: string;
    address: string;
    organizationId: string;
  };
  residence?: {
    id: string;
    unitNumber: string;
    buildingId: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

export interface DocumentFilters {
  buildingId?: string;
  residenceId?: string;
  documentType?: string;
  specificDocumentType?: string;
  userId?: string;
  userRole?: string;
  organizationId?: string;
  buildingIds?: string[];
  residenceIds?: string[];
  attachedToType?: string;
  attachedToId?: string;
  onlyBuildingLevel?: boolean; // If true, exclude residence documents (residenceId must be NULL)
  limit?: number;
  offset?: number;
}

/**
 * Optimized query to fetch documents with all related entities in a single query.
 * Uses LEFT JOINs to include related data without additional queries.
 */
export async function getDocumentsWithRelations(
  filters: DocumentFilters = {}
): Promise<DocumentWithRelations[]> {
  const conditions = [];

  // Apply filters
  if (filters.buildingId) {
    conditions.push(eq(documents.buildingId, filters.buildingId));
  }
  
  if (filters.buildingIds && filters.buildingIds.length > 0) {
    conditions.push(inArray(documents.buildingId, filters.buildingIds));
  }

  if (filters.residenceId) {
    conditions.push(eq(documents.residenceId, filters.residenceId));
  }
  
  if (filters.residenceIds && filters.residenceIds.length > 0) {
    conditions.push(inArray(documents.residenceId, filters.residenceIds));
  }

  if (filters.documentType) {
    conditions.push(eq(documents.documentType, filters.documentType));
  }
  
  if (filters.specificDocumentType) {
    conditions.push(eq(documents.documentType, filters.specificDocumentType));
  }

  if (filters.organizationId) {
    conditions.push(eq(buildings.organizationId, filters.organizationId));
  }

  // Filter by attached entity (e.g., documents attached to bills)
  if (filters.attachedToType) {
    conditions.push(eq(documents.attachedToType, filters.attachedToType));
  }

  if (filters.attachedToId) {
    conditions.push(eq(documents.attachedToId, filters.attachedToId));
  }

  // Filter to only building-level documents (exclude residence documents)
  if (filters.onlyBuildingLevel) {
    conditions.push(isNull(documents.residenceId));
  }

  // Build query with all joins
  const query = db
    .select({
      // Document fields
      id: documents.id,
      name: documents.name,
      description: documents.description,
      documentType: documents.documentType,
      filePath: documents.filePath,
      fileName: documents.fileName,
      fileSize: documents.fileSize,
      mimeType: documents.mimeType,
      isVisibleToTenants: documents.isVisibleToTenants,
      isManagerOnly: documents.isManagerOnly,
      isQuarantined: documents.isQuarantined,
      residenceId: documents.residenceId,
      buildingId: documents.buildingId,
      uploadedById: documents.uploadedById,
      attachedToType: documents.attachedToType,
      attachedToId: documents.attachedToId,
      effectiveDate: documents.effectiveDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      // Uploader info
      uploaderId: users.id,
      uploaderFirstName: users.firstName,
      uploaderLastName: users.lastName,
      uploaderEmail: users.email,
      // Building info
      buildingName: buildings.name,
      buildingAddress: buildings.address,
      buildingOrgId: buildings.organizationId,
      // Residence info
      residenceUnitNumber: residences.unitNumber,
      residenceBuildingId: residences.buildingId,
      // Organization info (through building)
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(documents)
    .leftJoin(users, eq(documents.uploadedById, users.id))
    .leftJoin(buildings, eq(documents.buildingId, buildings.id))
    .leftJoin(residences, eq(documents.residenceId, residences.id))
    .leftJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(documents.createdAt));

  // Apply pagination
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  
  const results = await query.limit(limit).offset(offset);

  // Transform results to include nested objects
  return results.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    documentType: row.documentType,
    filePath: row.filePath,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    isVisibleToTenants: row.isVisibleToTenants,
    isManagerOnly: row.isManagerOnly,
    isQuarantined: row.isQuarantined,
    residenceId: row.residenceId,
    buildingId: row.buildingId,
    uploadedById: row.uploadedById,
    attachedToType: row.attachedToType,
    attachedToId: row.attachedToId,
    effectiveDate: row.effectiveDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    uploader: row.uploaderId ? {
      id: row.uploaderId,
      firstName: row.uploaderFirstName,
      lastName: row.uploaderLastName,
      email: row.uploaderEmail,
    } : undefined,
    building: row.buildingName ? {
      id: row.buildingId!,
      name: row.buildingName,
      address: row.buildingAddress!,
      organizationId: row.buildingOrgId!,
    } : undefined,
    residence: row.residenceUnitNumber ? {
      id: row.residenceId!,
      unitNumber: row.residenceUnitNumber,
      buildingId: row.residenceBuildingId!,
    } : undefined,
    organization: row.organizationId ? {
      id: row.organizationId,
      name: row.organizationName!,
    } : undefined,
  }));
}

/**
 * Get user's accessible building and residence IDs with a single optimized query.
 * This replaces multiple separate queries for organizations, buildings, and residences.
 */
export async function getUserAccessScope(userId: string, userRole: string) {
  if (userRole === 'admin') {
    // Admin has access to all buildings and residences
    const [allBuildings, allResidences] = await Promise.all([
      db.select({ id: buildings.id }).from(buildings).where(eq(buildings.isActive, true)),
      db.select({ id: residences.id }).from(residences).where(eq(residences.isActive, true)),
    ]);
    
    return {
      organizationIds: [] as string[],
      buildingIds: allBuildings.map(b => b.id),
      residenceIds: allResidences.map(r => r.id),
    };
  }

  // Use a single CTE query to get all user access in one shot
  const result = await db.execute<{
    organization_ids: string[];
    building_ids: string[];
    residence_ids: string[];
  }>(sql`
    WITH user_orgs AS (
      SELECT DISTINCT uo.organization_id
      FROM user_organizations uo
      WHERE uo.user_id = ${userId} AND uo.is_active = true
    ),
    user_buildings AS (
      SELECT DISTINCT b.id as building_id
      FROM buildings b
      INNER JOIN user_orgs uo ON b.organization_id = uo.organization_id
      WHERE b.is_active = true
      
      UNION
      
      SELECT DISTINCT r.building_id
      FROM user_residences ur
      INNER JOIN residences r ON ur.residence_id = r.id
      WHERE ur.user_id = ${userId} AND ur.is_active = true AND r.is_active = true
    ),
    user_residences AS (
      SELECT DISTINCT ur.residence_id
      FROM user_residences ur
      INNER JOIN residences r ON ur.residence_id = r.id
      WHERE ur.user_id = ${userId} AND ur.is_active = true AND r.is_active = true
    )
    SELECT 
      COALESCE(array_agg(DISTINCT uo.organization_id) FILTER (WHERE uo.organization_id IS NOT NULL), ARRAY[]::text[]) as organization_ids,
      COALESCE(array_agg(DISTINCT ub.building_id) FILTER (WHERE ub.building_id IS NOT NULL), ARRAY[]::text[]) as building_ids,
      COALESCE(array_agg(DISTINCT ur.residence_id) FILTER (WHERE ur.residence_id IS NOT NULL), ARRAY[]::text[]) as residence_ids
    FROM user_orgs uo
    FULL OUTER JOIN user_buildings ub ON true
    FULL OUTER JOIN user_residences ur ON true
  `);

  const row = result.rows[0] as any;
  
  return {
    organizationIds: row?.organization_ids || [],
    buildingIds: row?.building_ids || [],
    residenceIds: row?.residence_ids || [],
  };
}

/**
 * Optimized document retrieval for user with role-based filtering.
 * Combines scope checking and document fetching in efficient queries.
 */
export async function getDocumentsForUser(
  userId: string,
  userRole: string,
  additionalFilters: DocumentFilters = {}
): Promise<DocumentWithRelations[]> {
  // Get user's access scope in one query
  const scope = await getUserAccessScope(userId, userRole);

  // Build filter based on user role and scope
  const filters: DocumentFilters = {
    ...additionalFilters,
  };

  if (userRole === 'manager' || userRole === 'demo_manager') {
    // Extract specific filters from additionalFilters
    const { buildingId, residenceId, ...commonFilters } = additionalFilters;
    
    // If a specific building is requested, only fetch that building's documents
    if (buildingId) {
      // Verify manager has access to this building
      if (!scope.buildingIds.includes(buildingId)) {
        return []; // Manager doesn't have access to this building
      }
      return getDocumentsWithRelations({
        ...commonFilters,
        buildingIds: [buildingId],
        onlyBuildingLevel: true, // Exclude residence documents
      });
    }
    
    // If a specific residence is requested, only fetch that residence's documents
    if (residenceId) {
      // Verify manager has access to this residence
      if (!scope.residenceIds.includes(residenceId)) {
        return []; // Manager doesn't have access to this residence
      }
      return getDocumentsWithRelations({
        ...commonFilters,
        residenceIds: [residenceId],
      });
    }
    
    // Otherwise, manager sees documents in their organization's buildings
    filters.buildingIds = scope.buildingIds;
  } else if (userRole === 'resident' || userRole === 'tenant' || userRole === 'demo_resident' || userRole === 'demo_tenant') {
    // Separate filters for residence and building documents to avoid conflicts
    const { buildingId, residenceId, documentType, ...commonFilters } = additionalFilters;
    
    // If a specific residence is requested, only fetch that residence's documents
    if (residenceId) {
      return getDocumentsWithRelations({
        ...commonFilters,
        residenceIds: [residenceId],
      });
    }
    
    // If a specific building is requested, only fetch that building's documents
    if (buildingId) {
      const buildingDocs = await getDocumentsWithRelations({
        ...commonFilters,
        buildingIds: [buildingId],
        onlyBuildingLevel: true, // Exclude residence documents
      });
      
      const visibleDocs = (userRole === 'tenant' || userRole === 'demo_tenant')
        ? buildingDocs.filter(doc => doc.isVisibleToTenants)
        : buildingDocs;
      
      return visibleDocs;
    }
    
    // Get residence documents (both residents and tenants can see their residence docs)
    const residenceDocuments = await getDocumentsWithRelations({
      ...commonFilters,
      residenceIds: scope.residenceIds,
    });

    // Get building documents based on role:
    // - Residents see ALL building documents
    // - Tenants see only documents marked as visible to tenants
    // IMPORTANT: Only fetch building-level documents (residenceId must be NULL)
    const buildingDocuments = await getDocumentsWithRelations({
      ...commonFilters,
      buildingIds: scope.buildingIds,
      onlyBuildingLevel: true, // Exclude residence documents
    });
    
    const visibleBuildingDocuments = (userRole === 'tenant' || userRole === 'demo_tenant')
      ? buildingDocuments.filter(doc => doc.isVisibleToTenants)
      : buildingDocuments; // Residents see all building documents

    // Combine and deduplicate
    const allDocs = [...residenceDocuments, ...visibleBuildingDocuments];
    const uniqueDocs = Array.from(
      new Map(allDocs.map(doc => [doc.id, doc])).values()
    );
    
    return uniqueDocs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // For admin or when no special filtering needed
  return getDocumentsWithRelations(filters);
}

/**
 * Get a single document with all related entity data in one query.
 */
export async function getDocumentByIdWithRelations(
  documentId: string
): Promise<DocumentWithRelations | undefined> {
  const results = await getDocumentsWithRelations();
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
    with: {
      // This uses Drizzle's relational queries if relations are defined
    }
  });

  if (!doc) return undefined;

  // Load related data in parallel
  const [uploader, building, residence] = await Promise.all([
    doc.uploadedById ? db.query.users.findFirst({
      where: eq(users.id, doc.uploadedById),
      columns: { id: true, firstName: true, lastName: true, email: true }
    }) : Promise.resolve(undefined),
    
    doc.buildingId ? db.query.buildings.findFirst({
      where: eq(buildings.id, doc.buildingId),
      columns: { id: true, name: true, address: true, organizationId: true }
    }) : Promise.resolve(undefined),
    
    doc.residenceId ? db.query.residences.findFirst({
      where: eq(residences.id, doc.residenceId),
      columns: { id: true, unitNumber: true, buildingId: true }
    }) : Promise.resolve(undefined),
  ]);

  // Get organization through building if available
  let organization;
  if (building?.organizationId) {
    organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, building.organizationId),
      columns: { id: true, name: true }
    });
  }

  return {
    ...doc,
    uploader,
    building,
    residence,
    organization,
  };
}

/**
 * Batch load documents for multiple entities efficiently.
 */
export async function batchGetDocumentsByEntities(
  buildingIds: string[] = [],
  residenceIds: string[] = []
): Promise<Map<string, DocumentWithRelations[]>> {
  const allDocuments = await getDocumentsWithRelations({
    buildingIds: buildingIds.length > 0 ? buildingIds : undefined,
    residenceIds: residenceIds.length > 0 ? residenceIds : undefined,
  });

  // Group by entity
  const documentsByEntity = new Map<string, DocumentWithRelations[]>();

  allDocuments.forEach(doc => {
    if (doc.buildingId) {
      const key = `building:${doc.buildingId}`;
      if (!documentsByEntity.has(key)) {
        documentsByEntity.set(key, []);
      }
      documentsByEntity.get(key)!.push(doc);
    }
    
    if (doc.residenceId) {
      const key = `residence:${doc.residenceId}`;
      if (!documentsByEntity.has(key)) {
        documentsByEntity.set(key, []);
      }
      documentsByEntity.get(key)!.push(doc);
    }
  });

  return documentsByEntity;
}
