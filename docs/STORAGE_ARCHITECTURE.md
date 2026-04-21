# Document Storage Architecture

## Overview

Koveo Gestion uses a modern hierarchical file storage system that provides enterprise-grade organization, security, and role-based access control for all document types. This document outlines the complete storage architecture following the September 2025 reorganization.

## Hierarchical Storage Structure

### Canonical Path Format

All documents follow a standardized hierarchical path structure:

```
{type}/org_{organizationId}/building_{buildingId}/residence_{residenceId}/role_{userRole}/user_{userId}
```

**Path Components:**

- **`{type}`**: Document category (bills, buildings, residences, documents, maintenance, bugs, features)
- **`org_{organizationId}`**: Organization UUID with `org_` prefix
- **`building_{buildingId}`**: Building UUID with `building_` prefix (optional)
- **`residence_{residenceId}`**: Residence UUID with `residence_` prefix (optional)
- **`role_{userRole}`**: Normalized user role with `role_` prefix
- **`user_{userId}`**: User UUID with `user_` prefix (for tenant/resident private files)

### Example Paths

```bash
# Organization-level documents (Admin/Manager access)
documents/org_da67894c-fbbe-4f0f-b686-ee1d1cb13891/role_manager/

# Building-specific documents
buildings/org_da67894c-fbbe-4f0f-b686-ee1d1cb13891/building_21dcf337-cdbb-40c3-b7c5-619d7341e3ba/role_manager/

# Residence-specific documents
documents/org_da67894c-fbbe-4f0f-b686-ee1d1cb13891/building_21dcf337-cdbb-40c3-b7c5-619d7341e3ba/residence_4f8aed38-933c-4a4b-98f9-42c531271efa/role_manager/

# Private tenant files
documents/org_da67894c-fbbe-4f0f-b686-ee1d1cb13891/building_21dcf337-cdbb-40c3-b7c5-619d7341e3ba/residence_4f8aed38-933c-4a4b-98f9-42c531271efa/role_tenant/user_12345678-1234-1234-1234-123456789012/
```

## Document Type Mapping

Legacy document types are automatically mapped to standardized categories:

| Legacy Type | Modern Type | Description |
|-------------|-------------|-------------|
| `contracts` | `documents` | Legal contracts and agreements |
| `financial` | `documents` | Financial statements and reports |
| `insurance` | `documents` | Insurance policies and claims |
| `legal` | `documents` | Legal documents and notices |
| `meeting_minutes` | `documents` | Meeting minutes and proceedings |
| `permits` | `documents` | Building permits and licenses |
| `inspection` | `documents` | Inspection reports |
| `lease` | `documents` | Lease agreements |
| `correspondence` | `documents` | Official correspondence |
| `utilities` | `documents` | Utility bills and statements |
| `bylaw` | `documents` | Bylaws and regulations |
| `other` | `documents` | Miscellaneous documents |

## Role Normalization

User roles are normalized to handle demo environments and role prefixes:

| Input Role | Normalized Role | Storage Role |
|------------|----------------|--------------|
| `demo_manager` | `manager` | `role_manager` |
| `demo_admin` | `admin` | `role_admin` |
| `demo_resident` | `resident` | `role_resident` |
| `demo_tenant` | `tenant` | `role_tenant` |

## Access Control Patterns

### Role-Based Directory Access

- **Admin**: Full access to all directories across all organizations
- **Manager**: Access to their organization's directories only
- **Resident**: Access to their building/residence directories
- **Tenant**: View-only access to shared directories, write access to personal directories

### Security Implementation

```typescript
// generateStorageDirectory function ensures proper path generation
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

## File Resolver System

### Secure File Access

Documents are accessed through a secure file resolver endpoint that validates permissions and handles quarantine status:

```typescript
GET /api/documents/:id/file
```

**Response Handling:**
- **200 OK**: File found and accessible, returns file stream
- **404 Not Found**: Document not found in database
- **403 Forbidden**: User lacks permission to access document
- **410 Gone**: Document is quarantined (with recovery information)
- **500 Internal Server Error**: File system error or corruption

## Quarantine System

### Purpose

The quarantine system provides safe handling of legacy files during the storage reorganization process while maintaining data integrity.

### Quarantine Process

1. **Detection**: Files that don't match canonical path structure are flagged
2. **Quarantine**: Files moved to `uploads/_quarantine_YYYY-MM-DDTHH-MM-SS-sssZ/` with timestamp
3. **Database Marking**: Corresponding database records marked with `is_quarantined: true`
4. **Retention**: 30-day retention policy before permanent deletion
5. **Recovery**: Files can be restored during retention period

### Quarantine Directory Structure

```bash
uploads/
├── _quarantine_2025-09-16T13-03-05-559Z/
│   ├── directories/          # Legacy directory structure preserved
│   └── metadata/            # Migration metadata and logs
```

### Recovery Procedures

**Manual Recovery:**
1. Locate file in quarantine directory using original path
2. Copy to canonical path location
3. Update database record: `UPDATE documents SET is_quarantined = false WHERE id = ?`
4. Verify file accessibility through resolver endpoint

**Automated Recovery (if implemented):**
```bash
# Example recovery command (if CLI tools available)
npm run storage:recover-quarantined --document-id=<uuid>
```

## Migration Status

### Completed (September 2025)

- ✅ Migrated 156 active documents to modern structure
- ✅ Quarantined 3,375 legacy files with proper directory preservation
- ✅ Marked 804 database records as quarantined
- ✅ Implemented secure file resolver endpoint
- ✅ Fixed document viewer functionality
- ✅ Established comprehensive reconciliation system

### Configuration Files

- **Upload Configuration**: `shared/config/upload-config.ts`
- **Storage Interface**: `server/storage.ts`
- **File Resolver**: `server/api/documents.ts`

## Best Practices

### File Organization

1. **Always use canonical paths** for new uploads
2. **Validate upload context** before file storage
3. **Use generateStorageDirectory()** for path generation
4. **Check quarantine status** before file access
5. **Implement proper error handling** for missing files

### Security Considerations

1. **Role-based path validation** prevents unauthorized access
2. **Normalized roles** prevent demo/production conflicts
3. **Type mapping** ensures consistent categorization
4. **File resolver** provides secure access layer
5. **Quarantine system** protects against data loss

### Performance Optimization

1. **Hierarchical structure** improves file system performance
2. **Role-based directories** enable efficient access control
3. **Type segregation** allows for category-specific optimizations
4. **Canonical paths** provide predictable file locations

## Monitoring and Maintenance

### Health Checks

- Monitor quarantine directory growth
- Track file resolver error rates
- Validate canonical path compliance
- Check for orphaned files

### Regular Maintenance

- Review quarantined files before 30-day expiration
- Clean up empty directories
- Validate file-to-database consistency
- Update access control patterns as needed

---

*This document reflects the storage architecture as implemented in September 2025. For technical implementation details, see the codebase files referenced above.*