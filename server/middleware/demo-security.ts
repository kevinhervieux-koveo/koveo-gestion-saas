import { Request, Response, NextFunction } from 'express';
import { canUserPerformWriteOperation, isOpenDemoUser } from '../rbac';

/**
 * Demo Security Middleware
 *
 * Enforces view-only restrictions for Open Demo users across all API endpoints.
 * Provides elegant, user-friendly error messages in both French and English.
 */

interface DemoSecurityRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    firstName: string;
    lastName: string;
    username?: string;
    password?: string;
    phone?: string;
    profileImage?: string;
    language?: string;
    isActive?: boolean;
    organizationId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

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
 * Checks if a request represents a write operation
 */
function isWriteOperation(method: string, path: string): boolean {
  // HTTP methods that modify data
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    return true;
  }

  // GET requests that perform write operations
  const writeGetPaths = [
    '/export',
    '/backup',
    '/restore',
    '/approve',
    '/assign',
    '/activate',
    '/deactivate',
  ];

  return writeGetPaths.some((writePath) => path.includes(writePath));
}

/**
 * Determines the user's preferred language from request headers
 */
function getPreferredLanguage(req: Request): 'en' | 'fr' {
  const acceptLanguage = req.headers['accept-language'];
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
    },
  };
}

/**
 * Middleware to enforce demo user restrictions
 */
export function enforceDemoSecurity() {
  return async (req: DemoSecurityRequest, res: Response, next: NextFunction) => {
    try {
      // Skip if user is not authenticated
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const isWriteOp = isWriteOperation(req.method, req.path);

      // Skip if this is not a write operation
      if (!isWriteOp) {
        return next();
      }

      // Check if user is an Open Demo user
      const isOpenDemo = await isOpenDemoUser(userId);

      if (isOpenDemo) {
        // Log the attempted violation for security monitoring
        console.warn(
          `🚫 Open Demo user ${userId} (${req.user.email}) attempted restricted action: ${req.method} ${req.path}`
        );

        // Return elegant restriction message
        const restrictionResponse = createDemoRestrictionResponse(req);
        return res.status(403).json(restrictionResponse);
      }

      // For regular users (including regular Demo users), check write operation permissions
      const canPerform = await canUserPerformWriteOperation(userId, 'create');

      if (!canPerform) {
        console.warn(
          `🚫 User ${userId} (${req.user.email}) denied write operation: ${req.method} ${req.path}`
        );

        const restrictionResponse = createDemoRestrictionResponse(req);
        return res.status(403).json(restrictionResponse);
      }

      // User is authorized, proceed
      next();
    } catch (error) {
      // In case of error, return a generic restriction message
      const restrictionResponse = createDemoRestrictionResponse(req);
      return res.status(403).json(restrictionResponse);
    }
  };
}

/**
 * Middleware specifically for file upload restrictions
 */
export function enforceFileUploadSecurity() {
  return async (req: DemoSecurityRequest, res: Response, next: NextFunction) => {
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
  return async (req: DemoSecurityRequest, res: Response, next: NextFunction) => {
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
  return async (req: DemoSecurityRequest, res: Response, next: NextFunction) => {
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
