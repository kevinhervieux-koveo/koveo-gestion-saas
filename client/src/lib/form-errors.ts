import type { UseFormReturn, FieldPath, FieldValues } from 'react-hook-form';
import { ApiError } from '@/lib/queryClient';

/**
 * If `error` is a DANGEROUS_INPUT 400 from the input-sanitization
 * middleware (Task #166) AND the offending field exists in `form`,
 * attach the server's field-level error inline and return true.
 *
 * When the field is not present in the form (e.g. the offender was a
 * nested/hidden value the user cannot directly edit) or the error is
 * of any other shape, return false and let the caller fall back to
 * its existing toast / banner / setLoginError behaviour.
 *
 * The goal is a surgical improvement: users stop seeing the generic
 * "The request contains potentially harmful content" toast and
 * instead see a red underline on the exact input that tripped the
 * heuristic, with the server's French, field-named message.
 */
export function applyDangerousInputFieldError<TFieldValues extends FieldValues>(
  error: unknown,
  form: UseFormReturn<TFieldValues>,
): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code !== 'DANGEROUS_INPUT') return false;
  if (!error.fieldPath) return false;

  // The server returns dotted paths like `profile.firstName`;
  // react-hook-form addresses nested fields the same way, so the
  // string can be passed through unchanged. Array segments like
  // `tags[0]` are also RHF-compatible.
  const fieldName = error.fieldPath as FieldPath<TFieldValues>;

  // Only target fields the form actually knows about — otherwise the
  // red-underline would attach to nothing and the user would see no
  // feedback at all. RHF tracks every `register()`ed path on
  // `control._fields` (for nested objects) and `control._names.mount`
  // (flat set of mounted names). We probe both so optional fields
  // whose current value is legitimately `undefined` are still
  // recognised as registered — the previous `getValues(...) !==
  // undefined` heuristic would silently skip those.
  const control = form.control as unknown as {
    _fields?: Record<string, unknown>;
    _names?: { mount?: Set<string> };
  };
  const mounted = control._names?.mount;
  const knownByName = mounted instanceof Set && mounted.has(fieldName);
  const knownByFields =
    !!control._fields &&
    Object.prototype.hasOwnProperty.call(control._fields, fieldName.split('.')[0]);
  if (!knownByName && !knownByFields) return false;

  form.setError(fieldName, {
    type: 'server',
    message: error.message,
  });
  // Focus the offender so the red outline is immediately visible on
  // small screens where the field may be scrolled off.
  try {
    form.setFocus(fieldName);
  } catch {
    // setFocus throws if the input is unmounted; silently ignore.
  }
  return true;
}
