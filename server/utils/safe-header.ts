/**
 * Helpers for building HTTP header values from untrusted (user-supplied or
 * DB-stored) data.
 *
 * Node's HTTP layer throws `TypeError: Invalid character in header content`
 * when an outgoing header value contains anything outside the printable
 * US-ASCII range (plus horizontal tab). Worse, naively forwarding strings
 * containing CR (`\r`) or LF (`\n`) into a header opens classic header /
 * response-splitting injection attacks (e.g. smuggling `Set-Cookie:` lines).
 *
 * RFC 7230 §3.2.6 restricts a `field-value` to:
 *
 *     field-vchar = VCHAR / obs-text   ; %x21-7E / %x80-FF
 *     field-value = *( field-vchar [ 1*( SP / HTAB ) field-vchar ] )
 *
 * Node enforces a stricter, ASCII-only subset and rejects bytes >= 0x80, so we
 * normalise to printable ASCII (0x20–0x7E plus HTAB) and replace anything else
 * — including CR, LF, NUL, and every other control byte — with `_`. Disallowed
 * characters are never preserved verbatim, so injection attempts (e.g. CRLF
 * smuggling a `Set-Cookie` line) cannot survive this helper.
 */

const HTAB = 0x09;
const SPACE = 0x20;
const TILDE = 0x7e;

/**
 * Normalise an arbitrary string into a value that is safe to pass to
 * `res.setHeader` / `res.set`. Control characters (including CR / LF) and any
 * byte outside printable US-ASCII are replaced with `_`. Surrounding
 * whitespace is trimmed. When the result would be empty, `fallback` is
 * returned instead.
 */
export function safeHeaderValue(
  value: string | null | undefined,
  fallback = ''
): string {
  if (value == null) return fallback;
  const raw = String(value);
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code === HTAB) {
      out += '\t';
      continue;
    }
    if (code < SPACE || code > TILDE) {
      out += '_';
      continue;
    }
    out += raw[i];
  }
  out = out.replace(/[\t ]+/g, ' ').trim();
  return out.length > 0 ? out : fallback;
}

/**
 * Strict-ish MIME type / `Content-Type` validator. Accepts a single
 * `type/subtype` token followed by zero or more `; param=value` segments,
 * matching the surface area we actually serve from the database. Anything
 * containing CR / LF, non-ASCII bytes, or characters outside the RFC 7231
 * `media-type` grammar is rejected and the supplied fallback is returned.
 */
const MIME_TOKEN = "[!#$%&'*+\\-.^_`|~0-9A-Za-z]+";
const MIME_QUOTED = '"(?:[^"\\\\\\r\\n]|\\\\.)*"';
const MIME_PARAM = `;\\s*${MIME_TOKEN}=(?:${MIME_TOKEN}|${MIME_QUOTED})`;
const MIME_RE = new RegExp(`^${MIME_TOKEN}/${MIME_TOKEN}(?:\\s*${MIME_PARAM})*$`);

export function safeMimeType(
  value: string | null | undefined,
  fallback = 'application/octet-stream'
): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return fallback;
  if (!MIME_RE.test(trimmed)) return fallback;
  return trimmed;
}

/**
 * Serialise an arbitrary value to JSON and force the result through
 * `safeHeaderValue`. Useful for diagnostic headers (e.g. `X-Storage-Metrics`)
 * whose payload is derived from runtime data and could otherwise contain
 * characters Node refuses to emit.
 */
export function safeJsonHeaderValue(value: unknown, fallback = '{}'): string {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return fallback;
  }
  if (typeof json !== 'string' || json.length === 0) return fallback;
  return safeHeaderValue(json, fallback);
}
