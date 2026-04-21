/**
 * HTML sanitization utilities to prevent XSS attacks
 * 
 * SECURITY NOTE: These functions prevent XSS by escaping HTML entities.
 * They should be used whenever displaying user-generated content.
 */

/**
 * Sanitizes a string by encoding HTML entities to prevent XSS attacks
 * @param dirty - The potentially dangerous string to sanitize
 * @returns Sanitized string safe for display
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  
  return dirty
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes file names for safe display
 * @param fileName - The file name to sanitize
 * @returns Sanitized file name or fallback text
 */
export function sanitizeFileName(fileName: string | null | undefined): string {
  const sanitized = sanitizeHtml(fileName);
  return sanitized || 'Unnamed File';
}

/**
 * Sanitizes comment text for safe display
 * @param commentText - The comment text to sanitize
 * @returns Sanitized comment text
 */
export function sanitizeComment(commentText: string | null | undefined): string {
  return sanitizeHtml(commentText);
}

/**
 * Sanitizes user-generated descriptions for safe display
 * @param description - The description to sanitize
 * @returns Sanitized description
 */
export function sanitizeDescription(description: string | null | undefined): string {
  return sanitizeHtml(description);
}