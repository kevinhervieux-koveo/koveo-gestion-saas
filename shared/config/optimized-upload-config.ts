/**
 * Optimized Upload Configuration System
 * 
 * Enhanced configuration with simplified directory structure,
 * performance optimizations, and intelligent caching.
 */

export interface OptimizedUploadContext {
  type: 'bills' | 'buildings' | 'residences' | 'bugs' | 'features' | 'documents' | 'maintenance';
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  projectId?: string;
  userRole?: string;
  userId?: string;
  // New optimization fields
  priority?: 'low' | 'normal' | 'high'; // For caching priorities
  expectedAccessFrequency?: 'rare' | 'normal' | 'frequent'; // Optimize storage location
}

export interface EnhancedUploadFormConfig {
  aiAnalysisEnabled: boolean;
  contextFields?: Record<string, any>;
  maxFileSize: number;
  allowedFileTypes: string[];
  showCamera: boolean;
  // New performance settings
  cachePolicy: 'aggressive' | 'normal' | 'minimal';
  compressionEnabled: boolean;
  optimizedStorage: boolean;
}

/**
 * Optimized configuration with performance tuning
 */
export const OPTIMIZED_UPLOAD_FORM_CONFIGS: Record<string, EnhancedUploadFormConfig> = {
  bills: {
    aiAnalysisEnabled: true,
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf'],
    showCamera: true,
    cachePolicy: 'aggressive', // Bills are frequently accessed
    compressionEnabled: true,
    optimizedStorage: true,
    contextFields: {
      category: 'string',
      vendor: 'string',
      amount: 'number',
      date: 'string'
    }
  },
  documents: {
    aiAnalysisEnabled: false,
    maxFileSize: 50,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    showCamera: true,
    cachePolicy: 'normal',
    compressionEnabled: false, // Keep original quality for documents
    optimizedStorage: true,
    contextFields: {
      category: 'string',
      accessLevel: 'string',
      description: 'string'
    }
  },
  maintenance: {
    aiAnalysisEnabled: false,
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf'],
    showCamera: true,
    cachePolicy: 'normal',
    compressionEnabled: true,
    optimizedStorage: true,
    contextFields: {
      priority: 'string',
      category: 'string',
      description: 'string'
    }
  },
  buildings: {
    aiAnalysisEnabled: false,
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    showCamera: true,
    cachePolicy: 'minimal',
    compressionEnabled: true,
    optimizedStorage: true,
    contextFields: {
      documentType: 'string',
      description: 'string'
    }
  },
  residences: {
    aiAnalysisEnabled: false,
    maxFileSize: 25,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    showCamera: true,
    cachePolicy: 'minimal',
    compressionEnabled: true,
    optimizedStorage: true,
    contextFields: {
      documentType: 'string',
      description: 'string'
    }
  },
  bugs: {
    aiAnalysisEnabled: false,
    maxFileSize: 15,
    allowedFileTypes: ['image/*', 'application/pdf', '.txt', '.log', '.json', '.csv'],
    showCamera: true,
    cachePolicy: 'minimal',
    compressionEnabled: false,
    optimizedStorage: true,
    contextFields: {
      category: 'string',
      priority: 'string',
      steps: 'string'
    }
  },
  features: {
    aiAnalysisEnabled: false,
    maxFileSize: 20,
    allowedFileTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    showCamera: true,
    cachePolicy: 'minimal',
    compressionEnabled: true,
    optimizedStorage: true,
    contextFields: {
      category: 'string',
      priority: 'string',
      description: 'string'
    }
  }
};

/**
 * FIXED: Secure role-based directory generation that preserves access patterns
 * Structure: {type}/org_{orgId}/building_{buildingId}/role_{role}/
 * Maximum 4 levels with clear access boundaries
 */
export function generateOptimizedStorageDirectory(context: OptimizedUploadContext): string {
  const { type, organizationId, buildingId, residenceId, userRole } = context;
  
  // Build secure directory structure that preserves role-based access
  const parts: string[] = [type];
  
  // Always include organization for isolation
  parts.push(`org_${organizationId || 'default'}`);
  
  // Include building for building-scoped files
  if (buildingId) {
    parts.push(`building_${buildingId}`);
  }
  
  // Include residence for residence-scoped files
  if (residenceId && buildingId) {
    parts.push(`residence_${residenceId}`);
  }
  
  // Always include role for access control
  parts.push(`role_${userRole || 'user'}`);
  
  return parts.join('/');
}

/**
 * Legacy hash-based directory generation for backward compatibility
 * This maintains the old problematic structure for lookup purposes only
 */
export function generateLegacyHashDirectory(context: OptimizedUploadContext): string {
  const { type, organizationId, buildingId, residenceId, userRole } = context;
  
  const contextData = {
    org: organizationId || 'default',
    building: buildingId || null,
    residence: residenceId || null,
    role: userRole || 'user'
  };
  
  const contextString = JSON.stringify(contextData);
  const hash = require('crypto').createHash('sha256').update(contextString).digest('hex');
  const shortHash = hash.substring(0, 8);
  
  return `${type}/${shortHash}`;
}

/**
 * FIXED: Enhanced backwards compatibility mapping
 * Handles both old deep structures and hash-based paths
 */
export function mapLegacyToOptimizedPath(legacyPath: string): string {
  const parts = legacyPath.split('/');
  
  if (parts.length <= 2) {
    return legacyPath; // Already optimized or simple
  }
  
  const type = parts[0];
  const context: OptimizedUploadContext = { type: type as any };
  
  // Handle hash-based legacy paths (problematic old format)
  if (parts.length === 2 && parts[1].length === 8 && /^[a-f0-9]+$/.test(parts[1])) {
    console.warn(`⚠️  Cannot reliably convert hash-based legacy path: ${legacyPath}`);
    return legacyPath; // Keep as-is, requires manual migration
  }
  
  // Handle deep directory legacy paths
  for (const part of parts) {
    if (part.startsWith('org_')) {
      context.organizationId = part.substring(4);
    } else if (part.startsWith('building_')) {
      context.buildingId = part.substring(9);
    } else if (part.startsWith('residence_')) {
      context.residenceId = part.substring(10);
    } else if (part.startsWith('role_')) {
      context.userRole = part.substring(5);
    } else if (part.startsWith('user_')) {
      context.userId = part.substring(5);
    }
  }
  
  return generateOptimizedStorageDirectory(context);
}

/**
 * FIXED: Enhanced caching strategy with security considerations
 * Reduced TTLs for permission-sensitive data to prevent security leaks
 */
export function getCachingStrategy(context: OptimizedUploadContext): {
  shouldCache: boolean;
  ttl: number; // Time to live in milliseconds
  priority: number; // 1-10, higher = more important to cache
  permissionTtl: number; // Shorter TTL for permission caching
} {
  const config = OPTIMIZED_UPLOAD_FORM_CONFIGS[context.type];
  const accessFreq = context.expectedAccessFrequency || 'normal';
  
  let ttl: number;
  let priority: number;
  let permissionTtl: number;
  
  // SECURITY FIX: Reduced TTLs and added separate permission TTL
  switch (config.cachePolicy) {
    case 'aggressive':
      ttl = accessFreq === 'frequent' ? 15 * 60 * 1000 : 10 * 60 * 1000; // Reduced from 30/15 to 15/10 min
      permissionTtl = 2 * 60 * 1000; // 2 minutes for permissions
      priority = accessFreq === 'frequent' ? 9 : 7;
      break;
    case 'normal':
      ttl = accessFreq === 'frequent' ? 10 * 60 * 1000 : 5 * 60 * 1000; // Reduced from 15/10 to 10/5 min
      permissionTtl = 90 * 1000; // 90 seconds for permissions
      priority = accessFreq === 'frequent' ? 6 : 4;
      break;
    case 'minimal':
      ttl = 2 * 60 * 1000; // Reduced from 5 to 2 min
      permissionTtl = 60 * 1000; // 1 minute for permissions
      priority = 2;
      break;
    default:
      ttl = 5 * 60 * 1000;
      permissionTtl = 90 * 1000;
      priority = 3;
  }
  
  return {
    shouldCache: config.cachePolicy !== 'minimal' || accessFreq === 'frequent',
    ttl,
    priority,
    permissionTtl // SECURITY: Separate shorter TTL for permission caching
  };
}

/**
 * Enhanced validation with performance considerations
 */
export function validateOptimizedUploadContext(context: OptimizedUploadContext, userRole: string): boolean {
  // Same security rules but with performance optimizations
  if (userRole === 'admin') return true;
  if (userRole === 'manager') return !!context.organizationId;
  if (userRole === 'resident') return !!(context.organizationId && (context.buildingId || context.residenceId));
  if (userRole === 'tenant') return !!(context.organizationId && context.buildingId && context.residenceId);
  return false;
}

/**
 * Get optimized upload configuration
 */
export function getOptimizedUploadConfig(formType: string): EnhancedUploadFormConfig {
  return OPTIMIZED_UPLOAD_FORM_CONFIGS[formType] || OPTIMIZED_UPLOAD_FORM_CONFIGS.documents;
}

/**
 * Performance monitoring configuration
 */
export const PERFORMANCE_CONFIG = {
  // Cache configurations
  FILE_PATH_CACHE_SIZE: 1000,
  METADATA_CACHE_SIZE: 500,
  PERMISSION_CACHE_SIZE: 1000,
  
  // SECURITY FIX: Reduced cache TTLs to prevent security leaks
  FILE_PATH_CACHE_TTL: 15 * 60 * 1000, // 15 minutes (kept for performance)
  METADATA_CACHE_TTL: 10 * 60 * 1000,  // 10 minutes (kept for performance)
  PERMISSION_CACHE_TTL: 2 * 60 * 1000,  // REDUCED to 2 minutes for security
  
  // Performance thresholds
  SLOW_OPERATION_THRESHOLD: 1000, // 1 second
  CACHE_HIT_RATIO_TARGET: 0.8,    // 80% cache hit ratio target
  
  // Batch processing
  BATCH_SIZE: 10,
  MAX_CONCURRENT_OPERATIONS: 5,
  
  // FIXED: File system optimization with secure structure
  MAX_DIRECTORY_DEPTH: 4, // Increased to accommodate role-based structure
  DIRECTORY_HASH_LENGTH: 8, // Kept for legacy compatibility
  USE_ROLE_BASED_STRUCTURE: true, // New secure structure enabled
  
  // Monitoring intervals
  METRICS_COLLECTION_INTERVAL: 60000, // 1 minute
  PERFORMANCE_LOG_INTERVAL: 300000,   // 5 minutes
};

/**
 * Utility to estimate file access frequency based on context
 */
export function estimateAccessFrequency(context: OptimizedUploadContext): 'rare' | 'normal' | 'frequent' {
  // Bills and maintenance documents are accessed more frequently
  if (context.type === 'bills') return 'frequent';
  if (context.type === 'maintenance') return 'normal';
  if (context.type === 'documents' && context.userRole === 'manager') return 'normal';
  
  // Admin files are accessed less frequently
  if (context.userRole === 'admin') return 'rare';
  
  // Feature requests and bugs are typically accessed rarely after creation
  if (context.type === 'bugs' || context.type === 'features') return 'rare';
  
  return 'normal';
}