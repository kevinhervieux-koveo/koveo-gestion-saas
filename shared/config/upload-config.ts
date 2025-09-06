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
  userRole?: string;
  userId?: string;
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
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
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
 * Generate secure storage directory path based on context and user role
 */
export function generateStorageDirectory(context: UploadContext): string {
  const { type, organizationId, buildingId, residenceId, userRole, userId } = context;
  
  // Base directory structure: uploads/{type}/{org_or_default}/{building?}/{residence?}/{user_role}
  const baseParts = ['uploads', type];
  
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
  
  return baseParts.join('/');
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
export function validateUploadContext(context: UploadContext, userRole: string): boolean {
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