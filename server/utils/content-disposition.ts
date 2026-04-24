/**
 * Build a safe RFC 6266 / RFC 5987 compliant Content-Disposition header value.
 *
 * Naive interpolation like `attachment; filename="${name}"` crashes Node's HTTP
 * stack with `TypeError: Invalid character in header content` whenever the
 * filename contains characters that cannot legally appear in an HTTP header
 * value (quotes, control chars, non-ASCII bytes such as emoji or CJK).
 *
 * This helper:
 *   1. Strips dangerous characters from the ASCII fallback `filename` token
 *      (quotes, backslashes, control chars, and any non-ASCII bytes).
 *   2. Provides an RFC 5987 `filename*=UTF-8''<percent-encoded>` parameter so
 *      modern user agents still receive the original Unicode name.
 */
export type ContentDispositionType = 'attachment' | 'inline';

export interface BuildContentDispositionOptions {
  type?: ContentDispositionType;
  fallbackFilename?: string;
}

const DEFAULT_FALLBACK = 'download';

function sanitizeAsciiFilename(filename: string, fallback: string): string {
  let ascii = '';
  for (const ch of filename) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    if (code > 0x7e) {
      ascii += '_';
      continue;
    }
    // Quotes and backslashes are unsafe inside the quoted-string fallback.
    // Semicolons are technically legal inside a quoted-string, but some
    // intermediaries and download managers treat them as parameter
    // separators and truncate the filename — strip them in the ASCII
    // fallback and rely on the RFC 5987 extended form to preserve the
    // original name.
    if (ch === '"' || ch === '\\' || ch === ';') {
      ascii += '_';
      continue;
    }
    ascii += ch;
  }
  ascii = ascii.replace(/_+/g, '_').replace(/^[._\s]+|[._\s]+$/g, '').trim();
  return ascii.length > 0 ? ascii : fallback;
}

const VALID_DISPOSITION_TYPES: ReadonlySet<string> = new Set(['attachment', 'inline']);

function normalizeDispositionType(value: unknown): ContentDispositionType {
  return typeof value === 'string' && VALID_DISPOSITION_TYPES.has(value)
    ? (value as ContentDispositionType)
    : 'attachment';
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%(?:7C|60|5E)/g, (s) => decodeURIComponent(s));
}

export function buildContentDisposition(
  filename: string | null | undefined,
  options: BuildContentDispositionOptions = {}
): string {
  const type = normalizeDispositionType(options.type);
  const fallback = options.fallbackFilename ?? DEFAULT_FALLBACK;

  const raw = typeof filename === 'string' && filename.length > 0 ? filename : fallback;
  const ascii = sanitizeAsciiFilename(raw, fallback);

  let header = `${type}; filename="${ascii}"`;

  const needsExtended = raw !== ascii;
  if (needsExtended) {
    header += `; filename*=UTF-8''${encodeRfc5987(raw)}`;
  }

  return header;
}
