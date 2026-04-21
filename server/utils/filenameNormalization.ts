import path from 'path';

/**
 * Normalizes a filename by:
 * - Replacing French accented characters with their base equivalents
 * - Replacing special characters and spaces with underscores
 * - Removing consecutive underscores
 * - Converting to lowercase
 * - Preserving the file extension
 * 
 * @param filename - The original filename to normalize
 * @returns The normalized filename
 * 
 * @example
 * normalizeFilename("reçu purlift 2025.pdf") // returns "recu_purlift_2025.pdf"
 * normalizeFilename("Côté & Associés.docx") // returns "cote_associes.docx"
 */
export function normalizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename provided');
  }

  // Extract the extension
  const ext = path.extname(filename);
  const nameWithoutExt = filename.slice(0, filename.length - ext.length);

  // Map of French accented characters to their base equivalents
  const accentMap: Record<string, string> = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ñ': 'n',
    'ç': 'c',
    'œ': 'oe',
    'æ': 'ae',
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
    'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
    'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
    'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
    'Ý': 'Y', 'Ÿ': 'Y',
    'Ñ': 'N',
    'Ç': 'C',
    'Œ': 'OE',
    'Æ': 'AE',
  };

  // Replace accented characters with their base equivalents
  let normalized = nameWithoutExt.split('').map(char => accentMap[char] || char).join('');

  // Replace all special characters (anything that's not alphanumeric, hyphen, or underscore) with underscores
  normalized = normalized.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Remove consecutive underscores (replace multiple _ with single _)
  normalized = normalized.replace(/_+/g, '_');

  // Remove leading and trailing underscores
  normalized = normalized.replace(/^_+|_+$/g, '');

  // Convert to lowercase for consistency
  normalized = normalized.toLowerCase();

  // If the normalized name is empty, use a default
  if (!normalized) {
    normalized = 'document';
  }

  // Return with the original extension (lowercase)
  return normalized + ext.toLowerCase();
}
