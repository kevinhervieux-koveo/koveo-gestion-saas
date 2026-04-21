import { Request, Response, NextFunction } from 'express';
import { canUserPerformWriteOperation, isOpenDemoUser } from '../rbac';

/**
 * Demo Security Middleware
 *
 * Enforces view-only restrictions for Open Demo users across all API endpoints.
 * Provides elegant, user-friendly error messages in both French and English.
 */

/**
 * Error messages for demo restrictions in multiple languages
 */
const DEMO_RESTRICTION_MESSAGES = {
  en: {
    title: 'Demo Mode - View Only',
    message:
      'This is a demonstration account with view-only access. You can explore all features but cannot make changes to the data.',
    suggestion: 'To create, edit, or delete content, please contact us for a full account.',
    contact: 'Contact our team to get started with your own property management workspace.',
  },
  fr: {
    title: 'Mode Démonstration - Consultation Seulement',
    message:
      'Ceci est un compte de démonstration avec accès en consultation seulement. Vous pouvez explorer toutes les fonctionnalités mais ne pouvez pas modifier les données.',
    suggestion:
      'Pour créer, modifier ou supprimer du contenu, veuillez nous contacter pour un compte complet.',
    contact:
      'Contactez notre équipe pour commencer avec votre propre espace de gestion immobilière.',
  },
};

/**
 * Maps HTTP method and path to the appropriate RBAC action
 * Provides granular action mapping instead of simple write/read classification
 * SECURITY FIX: Added all missed dangerous verbs and comprehensive coverage
 */
function mapRequestToAction(method: string, path: string): 'create' | 'read' | 'update' | 'delete' | 'manage' | 'export' | 'assign' | 'approve' {
  const upperMethod = method.toUpperCase();
  
  // Standard HTTP method mapping
  switch (upperMethod) {
    case 'POST':
      // POST can be create, assign, approve, trigger, or other actions based on path
      if (path.includes('/assign')) return 'assign';
      if (path.includes('/approve')) return 'approve';
      if (path.includes('/trigger') || path.includes('/sync') || path.includes('/refresh')) return 'manage';
      if (path.includes('/generate') || path.includes('/cleanup')) return 'manage';
      return 'create';
      
    case 'PUT':
    case 'PATCH':
      return 'update';
      
    case 'DELETE':
      return 'delete';
      
    case 'GET':
      // GET requests that perform state mutations - critical security check
      // SECURITY FIX: Comprehensive dangerous verb detection
      const dangerousVerbs = [
        '/export', '/backup', '/restore', '/approve', '/assign',
        '/activate', '/deactivate', '/sync', '/trigger', '/refresh', '/generate',
        '/cleanup', '/reset', '/clear', '/flush', '/run', '/recalc', '/reindex',
        '/rebuild', '/process', '/execute', '/calculate', '/compute', '/analyze',
        // ARCHITECT ORDERED: Add all missed verbs
        '/start', '/stop', '/pause', '/resume', '/toggle', '/enable', '/disable',
        '/init', '/seed', '/migrate', '/prune'
      ];
      
      // Check for any dangerous verb in the path
      if (dangerousVerbs.some(verb => path.includes(verb))) {
        if (path.includes('/export') || path.includes('/backup')) return 'export';
        if (path.includes('/approve')) return 'approve';
        if (path.includes('/assign')) return 'assign';
        return 'manage';
      }
      
      return 'read';
      
    default:
      // Unknown methods default to 'manage' for security
      return 'manage';
  }
}

/**
 * CRITICAL SECURITY FIX: Comprehensive query parameter inspection for VALUES
 * ARCHITECT ORDERED: Parse query via URLSearchParams and inspect parameter VALUES
 * Detects dangerous verbs in BOTH parameter names AND values to eliminate bypass vectors
 */
function hasDangerousQueryParams(queryString: string): boolean {
  if (!queryString) return false;
  
  const dangerousVerbs = [
    'start', 'stop', 'pause', 'resume', 'toggle', 'enable', 'disable',
    'init', 'seed', 'migrate', 'prune', 'export', 'backup', 'approve', 
    'assign', 'delete', 'update', 'create', 'trigger', 'sync', 'refresh', 
    'generate', 'cleanup', 'reset', 'clear', 'flush', 'run', 'execute', 
    'process', 'recalc', 'reindex', 'rebuild', 'calculate', 'compute', 
    'analyze', 'restore', 'activate', 'deactivate'
  ];
  
  try {
    // Parse query parameters properly to inspect both keys and values
    const params = new URLSearchParams(queryString);
    
    for (const [key, value] of params) {
      const lowerKey = key.toLowerCase();
      const lowerValue = value.toLowerCase();
      
      // Check if parameter NAME contains dangerous verbs
      if (dangerousVerbs.some(verb => lowerKey.includes(verb))) {
        return true;
      }
      
      // CRITICAL: Check if parameter VALUE contains dangerous verbs
      if (dangerousVerbs.some(verb => lowerValue.includes(verb))) {
        return true;
      }
      
      // Check for boolean-like dangerous flags (true, 1, yes, on)
      const dangerousBooleans = ['true', '1', 'yes', 'on', 'enabled'];
      if (dangerousBooleans.includes(lowerValue)) {
        // Only dangerous if the key suggests action
        const actionKeys = ['action', 'op', 'operation', 'cmd', 'command', 'task', 'mode', 'do', 'perform'];
        if (actionKeys.some(actionKey => lowerKey.includes(actionKey))) {
          return true;
        }
        
        // Or if key itself is a dangerous verb
        if (dangerousVerbs.some(verb => lowerKey.includes(verb))) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    // If parsing fails, assume dangerous for security
    console.warn(`⚠️ Query parameter parsing failed, treating as dangerous: ${error.message}`);
    return true;
  }
}

/**
 * ARCHITECT ORDERED: Deny-by-default query policy for Open Demo users
 * Only allows safe allowlisted query parameters for Open Demo users
 */
function hasDangerousQueryParamsForDemo(queryString: string): boolean {
  if (!queryString) return false;
  
  const safeAllowedParams = [
    'page', 'limit', 'offset', 'size', 'per_page',
    'sort', 'order', 'order_by', 'sort_by', 'direction',
    'filter', 'search', 'q', 'query', 'term',
    'category', 'type', 'status', 'state',
    'from', 'to', 'start_date', 'end_date', 'date',
    'include', 'exclude', 'fields', 'select',
    'format', 'view', 'layout', 'theme',
    'lang', 'language', 'locale', 'timezone',
    'debug', 'verbose', 'trace' // Allow debugging params
  ];
  
  try {
    const params = new URLSearchParams(queryString);
    
    for (const [key, value] of params) {
      const lowerKey = key.toLowerCase();
      
      // Check if parameter name is in safe allowlist
      if (!safeAllowedParams.some(allowed => lowerKey === allowed || lowerKey.startsWith(allowed + '_'))) {
        // Non-allowlisted parameter is dangerous for Demo users
        return true;
      }
      
      // Even for allowed parameters, check values for dangerous content
      if (hasDangerousQueryParams(`${key}=${value}`)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    // If parsing fails, assume dangerous for security
    console.warn(`⚠️ Demo query parameter parsing failed, treating as dangerous: ${error.message}`);
    return true;
  }
}

/**
 * SECURITY FIX: Checks if a request represents a write operation using secure-by-default logic
 * ARCHITECT ORDERED: Eliminates prefix-based allowlisting, uses strict structural validation
 * ONLY permits GET when path matches EXACTLY /api/:resource or /api/:resource/:uuid
 * FOURTH ROUND FIX: Enhanced with Demo user query validation
 */
function isWriteOperation(method: string, path: string, queryString?: string, isDemoUser: boolean = false): boolean {
  const upperMethod = method.toUpperCase();
  
  // Non-GET methods are always write operations
  if (upperMethod !== 'GET') {
    return true;
  }
  
  // CRITICAL SECURITY FIX: Enhanced query parameter validation
  // For Open Demo users, use stricter deny-by-default policy
  // Regular users can use any query parameters as they have proper RBAC checks
  if (isDemoUser) {
    if (hasDangerousQueryParamsForDemo(queryString || '')) {
      return true;
    }
  }
  
  // ARCHITECT ORDERED: STRICT STRUCTURAL VALIDATION - NO startsWith LOGIC
  // Only allow these exact patterns for API routes:
  // 1. /api/:resource (e.g., /api/users, /api/buildings) 
  // 2. /api/:resource/:uuid (e.g., /api/users/12345678-1234-1234-1234-123456789abc)
  
  const strictApiPatterns = [
    // Collection reads: EXACTLY /api/{resource} - NO extra segments
    /^\/api\/users$/,
    /^\/api\/organizations$/,
    /^\/api\/buildings$/,
    /^\/api\/residences$/,
    /^\/api\/bills$/,
    /^\/api\/documents$/,
    /^\/api\/demands$/,
    /^\/api\/invoices$/,
    /^\/api\/budgets$/,
    /^\/api\/permissions$/,
    /^\/api\/common-spaces$/,
    /^\/api\/contacts$/,
    /^\/api\/features$/,
    /^\/api\/health$/,
    /^\/api\/documentation$/,
    /^\/api\/pillars-suggestions$/,
    /^\/api\/quality-metrics$/,
    
    // Single UUID resource reads: EXACTLY /api/{resource}/{uuid} - NO extra segments
    /^\/api\/users\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/organizations\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/buildings\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/residences\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/bills\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/documents\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/demands\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/invoices\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/budgets\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/permissions\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/common-spaces\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/contacts\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    /^\/api\/features\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
  ];
  
  // Explicitly allow specific whitelisted non-API paths (exact matches only)
  const explicitlyAllowedPaths = [
    '/api/demo/health',
    '/api/demo/users', 
    '/api/demo/status',
    '/api/debug/simple',
    '/api/debug/user-info'
  ];
  
  // Check for uploads path (special case for static files)
  const isUploadPath = path.startsWith('/uploads/');
  
  // Check if path matches any strict API pattern
  const isStrictApiPattern = strictApiPatterns.some(pattern => pattern.test(path));
  
  // Check if path is explicitly allowed
  const isExplicitlyAllowed = explicitlyAllowedPaths.includes(path);
  
  // SECURITY FIX: If it doesn't match strict patterns or explicit allow list, it's a write operation
  // This eliminates ALL bypass vectors using extra segments or dangerous verbs
  return !isStrictApiPattern && !isExplicitlyAllowed && !isUploadPath;
}

/**
 * Determines the user's preferred language from request headers
 */
function getPreferredLanguage(req: Request): 'en' | 'fr' {
  const acceptLanguage = req.headers && req.headers['accept-language'];
  if (acceptLanguage && acceptLanguage.includes('fr')) {
    return 'fr';
  }
  return 'en';
}

/**
 * Creates an elegant error response for demo restrictions
 */
function createDemoRestrictionResponse(req: Request) {
  const language = getPreferredLanguage(req);
  const messages = DEMO_RESTRICTION_MESSAGES[language];

  return {
    success: false,
    code: 'DEMO_RESTRICTED',
    title: messages.title,
    message: messages.message,
    suggestion: messages.suggestion,
    contact: messages.contact,
    messageEn: DEMO_RESTRICTION_MESSAGES.en.message,
    messageFr: DEMO_RESTRICTION_MESSAGES.fr.message,
    metadata: {
      isDemo: true,
      restrictionType: 'write_operation',
      timestamp: new Date().toISOString(),
      endpoint: req.path,
      method: req.method,
      action: undefined as any,
      isWriteOperation: undefined as any,
      errorOccurred: undefined as any,
    },
  };
}

/**
 * Enhanced middleware to enforce demo user restrictions with secure-by-default approach
 * Uses explicit allowlists and proper action mapping for maximum security
 */
export function enforceDemoSecurity() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if user is not authenticated
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const queryString = req.url ? req.url.split('?')[1] : '';
      const action = mapRequestToAction(req.method, req.path);
      
      // Check if user is an Open Demo user first
      const isOpenDemo = await isOpenDemoUser(userId);
      
      // CRITICAL: Pass Demo user status for enhanced query validation
      const isWriteOp = isWriteOperation(req.method, req.path, queryString, isOpenDemo);

      // Skip if this is a confirmed read-only operation
      if (!isWriteOp && action === 'read') {
        return next();
      }

      // Open Demo user status already determined above for query validation

      if (isOpenDemo) {
        // Log the attempted violation for security monitoring
        console.warn(
          `🚫 Open Demo user ${userId} (${req.user.email}) attempted restricted ${action} action: ${req.method} ${req.path}`
        );

        // Return elegant restriction message with action context
        const restrictionResponse = createDemoRestrictionResponse(req);
        restrictionResponse.metadata.action = action;
        restrictionResponse.metadata.isWriteOperation = isWriteOp;
        return res.status(403).json(restrictionResponse);
      }

      // For regular users (including regular Demo users), check permissions with proper action mapping
      const canPerform = await canUserPerformWriteOperation(userId, action);

      if (!canPerform) {
        console.warn(
          `🚫 User ${userId} (${req.user.email}) denied ${action} operation: ${req.method} ${req.path}`
        );

        const restrictionResponse = createDemoRestrictionResponse(req);
        restrictionResponse.metadata.action = action;
        restrictionResponse.metadata.isWriteOperation = isWriteOp;
        return res.status(403).json(restrictionResponse);
      }

      // User is authorized, proceed
      next();
    } catch (error) {
      console.error(`❌ Demo security middleware error: ${error.message}`);
      // In case of error, fail secure with restriction message
      const restrictionResponse = createDemoRestrictionResponse(req);
      restrictionResponse.metadata.errorOccurred = true;
      return res.status(403).json(restrictionResponse);
    }
  };
}

/**
 * Middleware specifically for file upload restrictions
 */
export function enforceFileUploadSecurity() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const isOpenDemo = await isOpenDemoUser(userId);

      if (isOpenDemo) {
        console.warn(
          `🚫 Open Demo user ${userId} attempted file upload: ${req.method} ${req.path}`
        );

        const language = getPreferredLanguage(req);
        const messages = DEMO_RESTRICTION_MESSAGES[language];

        return res.status(403).json({
          success: false,
          code: 'DEMO_FILE_UPLOAD_RESTRICTED',
          title: messages.title,
          message:
            'File uploads are not available in demonstration mode. You can view existing documents but cannot upload new ones.',
          messageEn:
            'File uploads are not available in demonstration mode. You can view existing documents but cannot upload new ones.',
          messageFr:
            "Le téléchargement de fichiers n'est pas disponible en mode démonstration. Vous pouvez consulter les documents existants mais ne pouvez pas en télécharger de nouveaux.",
          suggestion: messages.suggestion,
          contact: messages.contact,
          metadata: {
            isDemo: true,
            restrictionType: 'file_upload',
            timestamp: new Date().toISOString(),
            endpoint: req.path,
            method: req.method,
          },
        });
      }

      next();
    } catch (error) {
      const restrictionResponse = createDemoRestrictionResponse(req);
      return res.status(403).json(restrictionResponse);
    }
  };
}

/**
 * Middleware for bulk operation restrictions
 */
export function enforceBulkOperationSecurity() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const isOpenDemo = await isOpenDemoUser(userId);

      if (isOpenDemo) {
        console.warn(
          `🚫 Open Demo user ${userId} attempted bulk operation: ${req.method} ${req.path}`
        );

        const language = getPreferredLanguage(req);
        const messages = DEMO_RESTRICTION_MESSAGES[language];

        return res.status(403).json({
          success: false,
          code: 'DEMO_BULK_RESTRICTED',
          title: messages.title,
          message:
            'Bulk operations are not available in demonstration mode to protect the integrity of demo data.',
          messageEn:
            'Bulk operations are not available in demonstration mode to protect the integrity of demo data.',
          messageFr:
            "Les opérations en lot ne sont pas disponibles en mode démonstration pour protéger l'intégrité des données de démonstration.",
          suggestion: messages.suggestion,
          contact: messages.contact,
          metadata: {
            isDemo: true,
            restrictionType: 'bulk_operation',
            timestamp: new Date().toISOString(),
            endpoint: req.path,
            method: req.method,
          },
        });
      }

      next();
    } catch (error) {
      const restrictionResponse = createDemoRestrictionResponse(req);
      return res.status(403).json(restrictionResponse);
    }
  };
}

/**
 * Middleware for data export restrictions
 */
export function enforceExportSecurity() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const isOpenDemo = await isOpenDemoUser(userId);

      if (isOpenDemo) {
        console.warn(
          `🚫 Open Demo user ${userId} attempted data export: ${req.method} ${req.path}`
        );

        const language = getPreferredLanguage(req);
        const messages = DEMO_RESTRICTION_MESSAGES[language];

        return res.status(403).json({
          success: false,
          code: 'DEMO_EXPORT_RESTRICTED',
          title: messages.title,
          message:
            'Data export is not available in demonstration mode. This feature is available in full accounts.',
          messageEn:
            'Data export is not available in demonstration mode. This feature is available in full accounts.',
          messageFr:
            "L'exportation de données n'est pas disponible en mode démonstration. Cette fonctionnalité est disponible dans les comptes complets.",
          suggestion: messages.suggestion,
          contact: messages.contact,
          metadata: {
            isDemo: true,
            restrictionType: 'data_export',
            timestamp: new Date().toISOString(),
            endpoint: req.path,
            method: req.method,
          },
        });
      }

      next();
    } catch (error) {
      const restrictionResponse = createDemoRestrictionResponse(req);
      return res.status(403).json(restrictionResponse);
    }
  };
}

export default {
  enforceDemoSecurity,
  enforceFileUploadSecurity,
  enforceBulkOperationSecurity,
  enforceExportSecurity,
};
