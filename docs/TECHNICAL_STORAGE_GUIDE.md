# Technical Storage Implementation Guide

## Overview

This guide provides technical implementation details for the modern hierarchical document storage system implemented in September 2025.

## Core Functions

### generateStorageDirectory()

Located in `shared/config/upload-config.ts`, this function generates canonical storage paths:

```typescript
export function generateStorageDirectory(context: UploadContext): string {
  const { type, organizationId, buildingId, residenceId, userRole: rawUserRole, userId } = context;
  
  // Normalize the user role to handle demo roles and prefixes
  const userRole = normalizeUserRole(rawUserRole || 'user');
  
  const baseParts: string[] = [type];
  
  // Organization level
  const orgId = organizationId || 'default';
  baseParts.push(`org_${orgId}`);
  
  // Building level (if applicable)
  if (buildingId) {
    baseParts.push(`building_${buildingId}`);
  }
  
  // Residence level (if applicable)
  if (residenceId) {
    baseParts.push(`residence_${residenceId}`);
  }
  
  // Role-based access control
  if (userRole) {
    baseParts.push(`role_${userRole}`);
  }
  
  // User-specific directory for private uploads
  if (userRole === 'tenant' || userRole === 'resident') {
    baseParts.push(`user_${userId}`);
  }
  
  return baseParts.join('/').replace(/\\/g, '/');
}
```

**Usage:**
```typescript
const context: UploadContext = {
  type: 'documents',
  organizationId: 'da67894c-fbbe-4f0f-b686-ee1d1cb13891',
  buildingId: '21dcf337-cdbb-40c3-b7c5-619d7341e3ba',
  residenceId: '4f8aed38-933c-4a4b-98f9-42c531271efa',
  userRole: 'demo_manager',
  userId: '12345678-1234-1234-1234-123456789012'
};

const storagePath = generateStorageDirectory(context);
// Result: "documents/org_da67894c-fbbe-4f0f-b686-ee1d1cb13891/building_21dcf337-cdbb-40c3-b7c5-619d7341e3ba/residence_4f8aed38-933c-4a4b-98f9-42c531271efa/role_manager"
```

### normalizeUserRole()

Handles role normalization for demo environments:

```typescript
export function normalizeUserRole(role: string): string {
  if (!role) return 'user';
  
  // Handle demo_ prefixed roles
  if (role.startsWith('demo_')) {
    return role.substring(5); // Remove 'demo_' prefix
  }
  
  return role;
}
```

### mapLegacyDocumentType()

Maps legacy document categories to modern types:

```typescript
export function mapLegacyDocumentType(documentType: string): 'bills' | 'buildings' | 'residences' | 'bugs' | 'features' | 'documents' | 'maintenance' {
  const typeMapping: Record<string, string> = {
    'contracts': 'documents',
    'financial': 'documents', 
    'insurance': 'documents',
    'legal': 'documents',
    'meeting_minutes': 'documents',
    'permits': 'documents',
    'inspection': 'documents',
    'lease': 'documents',
    'correspondence': 'documents',
    'utilities': 'documents',
    'bylaw': 'documents',
    'other': 'documents',
    // Keep existing allowed types as-is
    'bills': 'bills',
    'buildings': 'buildings', 
    'residences': 'residences',
    'bugs': 'bugs',
    'features': 'features',
    'documents': 'documents',
    'maintenance': 'maintenance'
  };
  
  return (typeMapping[documentType] || 'documents') as any;
}
```

## Database Schema Changes

### Documents Table

The `documents` table includes quarantine support:

```sql
-- Added quarantine flag (existing schema)
ALTER TABLE documents ADD COLUMN is_quarantined BOOLEAN DEFAULT FALSE;

-- Example quarantined document query
SELECT * FROM documents WHERE is_quarantined = TRUE;

-- Recovery query
UPDATE documents SET is_quarantined = FALSE WHERE id = $1;
```

### Migration Tracking

Migration process tracks:
- Original file paths
- New canonical paths
- Quarantine timestamps
- Recovery procedures

## File Resolver Implementation

### Secure File Access

Located in `server/api/documents.ts`:

```typescript
// GET /api/documents/:id/file endpoint
app.get('/api/documents/:id/file', requireAuth, async (req, res) => {
  try {
    const documentId = req.params.id;
    const document = await storage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check quarantine status
    if (document.is_quarantined) {
      return res.status(410).json({
        success: false,
        message: 'Document is quarantined',
        quarantine_info: {
          quarantined_at: document.quarantined_at,
          expires_at: new Date(document.quarantined_at.getTime() + 30 * 24 * 60 * 60 * 1000),
          recovery_possible: true,
          quarantine_reason: 'storage_reorganization'
        }
      });
    }
    
    // Permission validation
    const hasAccess = await validateDocumentAccess(document, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    // Serve file
    const filePath = path.join(process.cwd(), 'uploads', document.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({
        success: false,
        message: 'File not found on filesystem'
      });
    }
    
    // Set appropriate headers and stream file
    res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('File resolver error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
```

## Quarantine System Implementation

### Quarantine Process

1. **Detection Phase:**
```typescript
// Identify non-canonical paths
const isCanonicalPath = (filePath: string): boolean => {
  const pathPattern = /^(bills|buildings|residences|documents|maintenance|bugs|features)\/org_[\w-]+/;
  return pathPattern.test(filePath);
};
```

2. **Quarantine Phase:**
```typescript
// Move files to quarantine
const quarantineDirectory = `uploads/_quarantine_${new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')}Z`;
await fs.mkdir(quarantineDirectory, { recursive: true });

// Preserve directory structure
const quarantinePath = path.join(quarantineDirectory, 'directories', originalPath);
await fs.rename(originalPath, quarantinePath);

// Update database
await db.update(documents)
  .set({ is_quarantined: true, quarantined_at: new Date() })
  .where(eq(documents.id, documentId));
```

3. **Recovery Process:**
```typescript
// Manual recovery procedure
const recoverQuarantinedDocument = async (documentId: string): Promise<void> => {
  const document = await storage.getDocument(documentId);
  
  if (!document.is_quarantined) {
    throw new Error('Document is not quarantined');
  }
  
  // Generate new canonical path
  const context = {
    type: mapLegacyDocumentType(document.category),
    organizationId: document.organization_id,
    buildingId: document.building_id,
    residenceId: document.residence_id,
    userRole: document.uploaded_by_role,
    userId: document.uploaded_by
  };
  
  const canonicalPath = generateStorageDirectory(context);
  const newFilePath = path.join(canonicalPath, document.original_name);
  
  // Move file from quarantine
  await fs.mkdir(path.dirname(newFilePath), { recursive: true });
  await fs.rename(document.quarantine_path, newFilePath);
  
  // Update database
  await db.update(documents)
    .set({ 
      is_quarantined: false,
      file_path: newFilePath,
      quarantined_at: null 
    })
    .where(eq(documents.id, documentId));
};
```

## Security Considerations

### Path Validation

```typescript
const validateStoragePath = (filePath: string): boolean => {
  // Prevent path traversal
  if (filePath.includes('..') || filePath.includes('~')) {
    return false;
  }
  
  // Ensure canonical structure
  const pathParts = filePath.split('/');
  if (pathParts.length < 2 || !pathParts[1].startsWith('org_')) {
    return false;
  }
  
  return true;
};
```

### Access Control Implementation

```typescript
const validateDocumentAccess = async (document: Document, user: User): Promise<boolean> => {
  // Admin has full access
  if (user.role === 'admin') {
    return true;
  }
  
  // Manager access to organization documents
  if (user.role === 'manager' && document.organization_id === user.organization_id) {
    return true;
  }
  
  // Resident access to building/residence documents
  if (user.role === 'resident') {
    const userResidences = await getUserResidences(user.id);
    return userResidences.some(r => 
      r.building_id === document.building_id || 
      r.id === document.residence_id
    );
  }
  
  // Tenant access to own residence documents
  if (user.role === 'tenant') {
    const userResidences = await getUserResidences(user.id);
    return userResidences.some(r => r.id === document.residence_id);
  }
  
  return false;
};
```

## Maintenance and Monitoring

### Health Check Queries

```sql
-- Check quarantine directory size
SELECT COUNT(*) as quarantined_count FROM documents WHERE is_quarantined = true;

-- Find files approaching quarantine expiration
SELECT id, name, quarantined_at 
FROM documents 
WHERE is_quarantined = true 
AND quarantined_at < NOW() - INTERVAL '25 days';

-- Validate file system consistency
SELECT d.id, d.name, d.file_path
FROM documents d
WHERE NOT EXISTS (
  SELECT 1 FROM file_system_check(d.file_path)
) AND d.is_quarantined = false;
```

### Cleanup Procedures

```typescript
// Automated cleanup (runs daily)
const cleanupExpiredQuarantine = async (): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const expiredDocuments = await db.select()
    .from(documents)
    .where(
      and(
        eq(documents.is_quarantined, true),
        lt(documents.quarantined_at, thirtyDaysAgo)
      )
    );
  
  for (const doc of expiredDocuments) {
    // Remove from quarantine directory
    if (doc.quarantine_path && fs.existsSync(doc.quarantine_path)) {
      await fs.unlink(doc.quarantine_path);
    }
    
    // Mark as permanently deleted
    await db.delete(documents).where(eq(documents.id, doc.id));
  }
  
  console.log(`Cleaned up ${expiredDocuments.length} expired quarantined documents`);
};
```

## Performance Optimization

### Directory Structure Benefits

- **Reduced file system lookups**: Hierarchical structure improves performance
- **Role-based optimization**: Files grouped by access patterns
- **Predictable paths**: Enables efficient caching strategies

### Caching Strategy

```typescript
// File path caching
const pathCache = new Map<string, string>();

const getCachedStoragePath = (context: UploadContext): string => {
  const cacheKey = JSON.stringify(context);
  
  if (!pathCache.has(cacheKey)) {
    pathCache.set(cacheKey, generateStorageDirectory(context));
  }
  
  return pathCache.get(cacheKey)!;
};
```

## Testing

### Unit Tests

```typescript
// Test canonical path generation
describe('generateStorageDirectory', () => {
  it('should generate correct path for manager role', () => {
    const context = {
      type: 'documents',
      organizationId: 'test-org-id',
      buildingId: 'test-building-id',
      userRole: 'demo_manager'
    };
    
    const result = generateStorageDirectory(context);
    expect(result).toBe('documents/org_test-org-id/building_test-building-id/role_manager');
  });
});
```

### Integration Tests

```typescript
// Test file resolver endpoint
describe('GET /api/documents/:id/file', () => {
  it('should return 410 for quarantined documents', async () => {
    const quarantinedDoc = await createQuarantinedDocument();
    
    const response = await request(app)
      .get(`/api/documents/${quarantinedDoc.id}/file`)
      .expect(410);
    
    expect(response.body.quarantine_info).toBeDefined();
  });
});
```

---

*This technical guide provides implementation details for the modern storage system. For architectural overview, see `STORAGE_ARCHITECTURE.md`.*