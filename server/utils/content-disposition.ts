/**
 * RFC 6266 / RFC 5987 compliant `Content-Disposition` header builder.
 *
 * The naive `${disposition}; filename="${name}"` pattern breaks when the
 * filename contains:
 *   - literal double quotes or backslashes (corrupts the quoted-string),
 *   - semicolons or other separators (browsers truncate the value),
 *   - control characters (HTTP forbids them in field values),
 *   - non-Latin-1 code points (Node's HTTP layer throws
 *     `TypeError: Invalid character in header content`).
 *
 * This helper always emits a safe ASCII `filename=` parameter and adds a
 * `filename*=UTF-8''<percent-encoded>` form whenever the original name
 * contains anything outside the printable ASCII subset that quoted-string
 * tolerates. Both download endpoints share this helper so they cannot
 * drift apart.
 */

const DISPOSITION_TYPE_RE = /^[a-zA-Z]+$/;

/**
 * Returns true when the character is safe to appear inside an RFC 6266
 * `quoted-string` value without backslash-escaping and without forcing
 * the encoded `filename*` fallback. We intentionally exclude characters
 * that browsers historically mishandle (CR/LF, the high-bit Latin-1
 * range, control chars) so the ASCII fallback is always a usable name.
 */
function isSafeQuotedChar(code: number): boolean {
  // Printable ASCII excluding DEL (0x7F). The following are technically
  // legal inside a quoted-string but are flagged as unsafe so the ASCII
  // fallback never carries a value that real-world clients mis-parse:
  //   - 0x22 `"` and 0x5C `\` (would require backslash-escaping which
  //     older Safari handles incorrectly),
  //   - 0x3B `;` (the RFC allows it inside quotes, but several
  //     intermediaries and download managers treat it as a parameter
  //     separator and truncate the filename).
  if (code < 0x20 || code >= 0x7f) return false;
  if (code === 0x22 || code === 0x5c || code === 0x3b) return false;
  return true;
}

function buildAsciiFallback(filename: string): string {
  let out = '';
  for (const ch of filename) {
    const code = ch.codePointAt(0)!;
    if (isSafeQuotedChar(code)) {
      out += ch;
    } else {
      out += '_';
    }
  }
  // Collapse the underscore runs we just introduced so the fallback
  // stays readable (e.g. an emoji surrogate pair becomes a single `_`).
  out = out.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return out || 'download';
}

/**
 * Build a safe `Content-Disposition` header value.
 *
 * @param disposition `"inline"` or `"attachment"` (any RFC 6266 token).
 * @param filename    The user-visible filename. May contain anything.
 */
export function buildContentDisposition(
  disposition: string,
  filename: string
): string {
  const dispToken = DISPOSITION_TYPE_RE.test(disposition) ? disposition : 'attachment';
  const safeName = typeof filename === 'string' && filename.length > 0 ? filename : 'download';

  const ascii = buildAsciiFallback(safeName);

  // Always emit the `filename*` form when the original name differs from
  // the ASCII fallback. RFC 5987 requires UTF-8, percent-encoding every
  // byte that is not in the `attr-char` set.
  const needsExtended = ascii !== safeName;

  const header = `${dispToken}; filename="${ascii}"`;
  if (!needsExtended) return header;

  // `encodeURIComponent` already percent-encodes everything outside
  // `A-Za-z0-9-_.!~*'()`; we additionally encode the few characters it
  // leaves alone that are NOT in RFC 5987's `attr-char` set
  // (`! # $ & + - . ^ _ ` | ~` plus alphanumerics).
  const extended = encodeURIComponent(safeName).replace(
    /['()*!]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );

  return `${header}; filename*=UTF-8''${extended}`;
}
