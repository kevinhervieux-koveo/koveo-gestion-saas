import { ObjectStorageService } from '../objectStorage';

/**
 * Shape of an attachment payload accepted by the demand and demand-comment
 * write paths. Mirrors what REST callers send in `attachments[0]` and what the
 * MCP `attachment` parameter accepts: an object-storage URL/path, an optional
 * original filename, and an optional byte size.
 */
export interface DemandAttachmentInput {
  url?: string;
  originalName?: string;
  size?: number;
}

/**
 * Persisted shape of a single demand/comment attachment, matching the
 * `filePath` / `fileName` / `fileSize` columns shared by the `demands` and
 * `demands_comments` tables.
 */
export interface DemandAttachmentInfo {
  filePath?: string;
  fileName?: string;
  fileSize?: number;
}

/**
 * Normalize an attachment payload into the persisted column shape.
 * Returns an empty object when no attachment / no URL is supplied.
 */
export function normalizeAttachmentInput(
  attachment: DemandAttachmentInput | undefined | null
): DemandAttachmentInfo {
  if (!attachment || !attachment.url) return {};
  const filePath = attachment.url;
  const fileName = attachment.originalName || filePath.split('/').pop() || '';
  return {
    filePath,
    fileName: fileName || undefined,
    fileSize: attachment.size,
  };
}

/**
 * Mirror of the ACL ownership guard used by `POST /api/demands`: when the
 * supplied path is an object-storage entity, refuse to bind it if its ACL
 * already names a different owner. Failures from the storage layer are logged
 * (in development) and treated as "no existing ACL". Returns null when the
 * binding is acceptable; otherwise returns an error message string.
 */
export async function verifyAttachmentOwnership(
  filePath: string,
  userId: string,
  logPrefix: string = '[demand-attachment]'
): Promise<string | null> {
  if (!filePath.startsWith('/objects/')) return null;
  try {
    const svc = new ObjectStorageService();
    const existingAcl = await svc.getExistingObjectAcl(filePath);
    if (existingAcl && existingAcl.owner && existingAcl.owner !== userId) {
      return 'Access denied: object belongs to another user';
    }
  } catch (aclCheckError) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`${logPrefix} Failed to check ACL on attachment:`, aclCheckError);
    }
  }
  return null;
}

/**
 * Mirror of the post-insert ACL set used by `POST /api/demands`: bind the
 * object-storage entity to the calling user with private visibility. Failures
 * are logged (in development) but never bubble up — the row is already
 * inserted and callers treat this as best-effort.
 */
export async function applyAttachmentAcl(
  filePath: string,
  userId: string,
  logPrefix: string = '[demand-attachment]'
): Promise<void> {
  if (!filePath.startsWith('/objects/')) return;
  try {
    const svc = new ObjectStorageService();
    await svc.trySetObjectEntityAclPolicy(filePath, {
      visibility: 'private',
      owner: userId,
    });
  } catch (aclError) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`${logPrefix} Failed to set ACL on attachment:`, aclError);
    }
  }
}
