/**
 * Unified bill-number format helpers (Task #255).
 *
 * Target format: {ORG_CODE}-{YYYYMM}-{CAT}-{SEQ4}
 *   Example: MCP1-202607-UTIL-0042
 *
 * Recurring child bills append a part suffix:
 *   {ORG_CODE}-{YYYYMM}-{CAT}-{SEQ4}-P01, -P02, ...
 *
 * The `source` (mcp / auto / api / import) is stored in its own column on
 * `bills` and is intentionally NOT baked into the number.
 */

/**
 * Mapping from `bill_category` enum values to a stable 4-char CAT code used
 * inside the bill number. Unknown or missing categories fall back to `GENL`.
 */
export const BILL_CATEGORY_CAT_CODES: Record<string, string> = {
  administration: 'ADMN',
  cleaning: 'CLEN',
  construction: 'CNST',
  consulting: 'CNSL',
  equipment_rental: 'EQRT',
  insurance: 'INSR',
  landscaping: 'LAND',
  legal_services: 'LEGL',
  maintenance: 'MAIN',
  professional_services: 'PROF',
  repairs: 'REPR',
  reserves: 'RESV',
  salary: 'SALY',
  security: 'SECR',
  supplies: 'SUPL',
  taxes: 'TAXS',
  technology: 'TECH',
  utilities: 'UTIL',
  other: 'OTHR',
};

export const FALLBACK_CAT_CODE = 'GENL';

/**
 * Resolve the CAT code for a bill category enum value.
 * Returns `GENL` for null, undefined, or unknown values.
 */
export function categoryToCatCode(category: string | null | undefined): string {
  if (!category) {
    return FALLBACK_CAT_CODE;
  }
  return BILL_CATEGORY_CAT_CODES[category] ?? FALLBACK_CAT_CODE;
}

/**
 * Format a Date or YYYY-MM-DD string into the YYYYMM segment used by the
 * bill-number format. Uses UTC components when given a Date object so that
 * the result matches what the caller stored in the bill's `startDate`
 * (which is a date-only column).
 */
export function billingPeriodToYyyyMm(billingPeriod: Date | string): string {
  if (typeof billingPeriod === 'string') {
    // Expecting YYYY-MM-DD or YYYY-MM-... — take first two parts.
    const [year, month] = billingPeriod.split('-');
    if (year && month && /^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
      return `${year}${month}`;
    }
    // Fall through to Date parsing for unusual formats.
    const d = new Date(billingPeriod);
    if (!Number.isNaN(d.getTime())) {
      return billingPeriodToYyyyMm(d);
    }
    throw new Error(`Invalid billing period string: ${billingPeriod}`);
  }
  const y = billingPeriod.getUTCFullYear();
  const m = String(billingPeriod.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/**
 * Allowed values for the `source` column on `bills`.
 */
export const BILL_SOURCES = ['mcp', 'auto', 'api', 'import'] as const;
export type BillSource = (typeof BILL_SOURCES)[number];

/**
 * Assemble the base bill number from already-resolved components. Used by
 * the server-side generator after it has allocated a sequence number.
 */
export function assembleBillNumber(
  orgCode: string,
  yyyymm: string,
  catCode: string,
  seq: number,
): string {
  const seq4 = String(seq).padStart(4, '0');
  return `${orgCode}-${yyyymm}-${catCode}-${seq4}`;
}

/**
 * Build a child (installment / fiscal-year-split) bill number from a parent.
 * Appends `-P01`, `-P02`, ... — `partIndex` is zero-based, so partIndex=0
 * yields `-P01`.
 */
export function generateChildBillNumber(parentNumber: string, partIndex: number): string {
  const part = String(partIndex + 1).padStart(2, '0');
  return `${parentNumber}-P${part}`;
}

/**
 * Loose regex matching the new V2 base format. Used by tests and by the
 * source-inference backfill to distinguish V2 numbers from legacy ones.
 * NOTE: callers must NOT use this to parse meaning out of a bill number —
 * historical legacy numbers will not match.
 */
export const BILL_NUMBER_V2_BASE_REGEX = /^[A-Z0-9]{2,8}-\d{6}-[A-Z]{4}-\d{4}$/;
export const BILL_NUMBER_V2_REGEX = /^[A-Z0-9]{2,8}-\d{6}-[A-Z]{4}-\d{4}(-P\d{2})?$/;
