/**
 * Universal Upload Configuration System
 * 
 * Defines AI analysis settings, storage directories, and form configurations
 * for all document upload functionality across the application.
 */

export interface UploadContext {
  type: 'bills' | 'buildings' | 'residences' | 'bugs' | 'features' | 'documents' | 'maintenance';
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  projectId?: string; // For project-specific organization
  userRole?: string;
  userId?: string;
}

/**
 * Map legacy document types to allowed upload types
 */
export function mapLegacyDocumentType(documentType: string): 'bills' | 'buildings' | 'residences' | 'bugs' | 'features' | 'documents' | 'maintenance' {
  // Map legacy types to allowed types
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

export interface UploadFormConfig {
  /** Whether AI analysis is enabled for this form type */
  aiAnalysisEnabled: boolean;
  /** Custom fields specific to this upload context */
  contextFields?: Record<string, any>;
  /** Maximum file size in MB */
  maxFileSize: number;
  /** Allowed file types */
  allowedFileTypes: string[];
  /** Whether to show camera option for mobile uploads */
  showCamera: boolean;
}

/**
 * Configuration for each upload form type
 */
export const UPLOAD_FORM_CONFIGS: Record<string, UploadFormConfig> = {
  bills: {
    aiAnalysisEnabled: true, // Bills have AI enabled by default
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf'],
    showCamera: true,
    contextFields: {
      category: 'string',
      vendor: 'string',
      amount: 'number',
      date: 'string'
    }
  },
  buildings: {
    aiAnalysisEnabled: false, // Disabled by default
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    showCamera: true,
    contextFields: {
      documentType: 'string',
      description: 'string'
    }
  },
  residences: {
    aiAnalysisEnabled: false, // Disabled by default
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    showCamera: true,
    contextFields: {
      documentType: 'string',
      description: 'string'
    }
  },
  bugs: {
    aiAnalysisEnabled: false, // Disabled by default
    maxFileSize: 15,
    allowedFileTypes: ['image/*', 'application/pdf', '.txt', '.log', '.json', '.csv'],
    showCamera: true,
    contextFields: {
      category: 'string',
      priority: 'string',
      steps: 'string'
    }
  },
  features: {
    aiAnalysisEnabled: false, // Disabled by default
    maxFileSize: 20,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'application/json', 'text/csv'],
    showCamera: true,
    contextFields: {
      category: 'string',
      priority: 'string',
      description: 'string'
    }
  },
  documents: {
    aiAnalysisEnabled: false, // Disabled by default
    maxFileSize: 50,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    showCamera: true,
    contextFields: {
      category: 'string',
      accessLevel: 'string',
      description: 'string'
    }
  },
  maintenance: {
    aiAnalysisEnabled: false, // Disabled by default
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf'],
    showCamera: true,
    contextFields: {
      priority: 'string',
      category: 'string',
      description: 'string'
    }
  }
};

/**
 * Normalize user role to handle demo roles and role prefixes
 */
export function normalizeUserRole(role: string): string {
  if (!role) return 'user';
  
  // Handle demo_ prefixed roles
  if (role.startsWith('demo_')) {
    return role.substring(5); // Remove 'demo_' prefix
  }
  
  // Handle other role normalization if needed
  return role;
}

/**
 * Generate secure storage directory path based on context and user role
 */
export function generateStorageDirectory(context: UploadContext): string {
  const { type, organizationId, buildingId, residenceId, projectId, userRole: rawUserRole, userId } = context;
  
  // Normalize the user role to handle demo roles and prefixes
  const userRole = normalizeUserRole(rawUserRole || 'user');
  
  // For maintenance projects, organize files under documents with project structure
  if (type === 'maintenance' && projectId) {
    const baseParts: string[] = ['documents']; // Store maintenance project files under documents
    
    // Organization level
    const orgId = organizationId || 'default';
    baseParts.push(`org_${orgId}`);
    
    // Building level (if applicable)
    if (buildingId) {
      baseParts.push(`building_${buildingId}`);
    }
    
    // Project-specific folder
    baseParts.push(`project_${projectId}`);
    
    // Role-based access control
    if (userRole) {
      baseParts.push(`role_${userRole}`);
    }
    
    // User-specific directory for private uploads (if needed)
    if (userRole === 'tenant' || userRole === 'resident') {
      baseParts.push(`user_${userId}`);
    }
    
    return baseParts.join('/').replace(/\\/g, '/');
  }
  
  // Base directory structure: {type}/{org_or_default}/{building?}/{residence?}/{user_role}
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
  
  // User-specific directory for private uploads (if needed)
  if (userRole === 'tenant' || userRole === 'resident') {
    baseParts.push(`user_${userId}`);
  }
  
  // Ensure POSIX-style path separators
  return baseParts.join('/').replace(/\\/g, '/');
}

/**
 * Get upload configuration for a specific form type
 */
export function getUploadConfig(formType: string): UploadFormConfig {
  return UPLOAD_FORM_CONFIGS[formType] || UPLOAD_FORM_CONFIGS.documents;
}

/**
 * Check if AI analysis is enabled for a specific context
 */
export function isAiAnalysisEnabled(formType: string): boolean {
  const config = getUploadConfig(formType);
  return config.aiAnalysisEnabled;
}

/**
 * Validate upload context and ensure proper access control
 */
export function validateUploadContext(context: UploadContext, rawUserRole: string): boolean {
  // Normalize the role to handle demo roles
  const userRole = normalizeUserRole(rawUserRole);
  
  // Admin can upload to any context
  if (userRole === 'admin') {
    return true;
  }
  
  // Manager can upload to their organization's buildings and residences
  if (userRole === 'manager') {
    return !!context.organizationId;
  }
  
  // Resident can upload to their specific building/residence
  if (userRole === 'resident') {
    return !!(context.organizationId && (context.buildingId || context.residenceId));
  }
  
  // Tenant can only upload to their specific residence
  if (userRole === 'tenant') {
    return !!(context.organizationId && context.buildingId && context.residenceId);
  }
  
  return false;
}