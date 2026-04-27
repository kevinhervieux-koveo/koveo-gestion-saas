/**
 * parsePeriodHint — converts the screening AI's `periodHint` string into a
 * `Date` (midnight UTC on the first day of the detected period), or `null`
 * when the hint is not parseable as a date.
 *
 * Supported formats (documented in Task #1003):
 *
 * | Pattern                          | Example            | Result               |
 * |----------------------------------|--------------------|----------------------|
 * | ISO date                         | "2021-10-15"       | 2021-10-15           |
 * | Calendar year                    | "2022"             | 2022-01-01           |
 * | Fiscal-year range (dash)         | "2022-2023"        | 2022-01-01           |
 * | Fiscal-year range (slash)        | "2022/2023"        | 2022-01-01           |
 * | Fiscal-year range with prefix    | "FY 2022-2023"     | 2022-01-01           |
 * | Quarter (year first)             | "2023 Q3"          | 2023-07-01           |
 * | Quarter (Q first)                | "Q3 2023"          | 2023-07-01           |
 * | ISO month                        | "2023-07"          | 2023-07-01           |
 * | Month-year (long name)           | "July 2023"        | 2023-07-01           |
 * | Month-year (short name)          | "Jul 2023"         | 2023-07-01           |
 * | Anything else                    | "INV-2024-042"     | null                 |
 *
 * Fiscal-year ranges use the **first** year combined with the building's
 * fiscal-year-start month (Task #1030). When `fiscalYearStartMonth` is omitted
 * (or invalid) the parser falls back to January, which is the documented
 * historical default. Many Canadian condos start their fiscal year in April,
 * so passing `4` for "FY 2022-2023" yields 2022-04-01 instead of 2022-01-01.
 *
 * All `Date` values are constructed with UTC semantics (no local-timezone drift).
 *
 * @param hint - The raw `periodHint` string from screening, or null/undefined.
 * @param fiscalYearStartMonth - Optional 1-indexed month (1-12) marking the
 *   start of the building's fiscal year. Only affects the fiscal-year-range
 *   patterns; ignored for ISO dates, quarters, calendar years, etc.
 * @returns A `Date` at midnight UTC, or `null` when the hint is not a date.
 */
export function parsePeriodHint(
  hint: string | null | undefined,
  fiscalYearStartMonth?: number | null,
): Date | null {
  if (!hint || typeof hint !== 'string') return null;
  const trimmed = hint.trim();
  if (!trimmed) return null;

  // 1. ISO date: "2021-10-15"
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDate) {
    const y = parseInt(isoDate[1], 10);
    const m = parseInt(isoDate[2], 10);
    const d = parseInt(isoDate[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, m - 1, d));
    }
    return null;
  }

  // 1b. Comma-separated ISO date range: "YYYY-MM-DD,YYYY-MM-DD" (Task #1454).
  // The screening AI commonly emits fiscal-year ranges in this form
  // (e.g. "2021-10-01,2022-09-30"). We resolve to the **start** date
  // of the range for consistency with how fiscal-year ranges already
  // pre-fill the picker. Both halves must be valid ISO dates and the
  // start must be on or before the end; otherwise we return null.
  const isoRange = /^(\d{4}-\d{2}-\d{2})\s*,\s*(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (isoRange) {
    const parseIso = (s: string): Date | null => {
      const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (!m2) return null;
      const y = parseInt(m2[1], 10);
      const mo = parseInt(m2[2], 10);
      const d = parseInt(m2[3], 10);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return new Date(Date.UTC(y, mo - 1, d));
    };
    const startDate = parseIso(isoRange[1]);
    const endDate = parseIso(isoRange[2]);
    if (startDate && endDate && startDate <= endDate) {
      return startDate;
    }
    return null;
  }

  // 2. ISO month: "2023-07"
  const isoMonth = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (isoMonth) {
    const y = parseInt(isoMonth[1], 10);
    const m = parseInt(isoMonth[2], 10);
    if (m >= 1 && m <= 12) {
      return new Date(Date.UTC(y, m - 1, 1));
    }
    return null;
  }

  // 3. Fiscal-year range with optional prefix: "FY 2022-2023", "2022-2023", "2022/2023"
  // Must be parsed BEFORE the calendar-year check so "2022-2023" doesn't match ISO date.
  const fyRange = /^(?:FY\s*)?(\d{4})[-/](\d{4})$/i.exec(trimmed);
  if (fyRange) {
    const y1 = parseInt(fyRange[1], 10);
    const y2 = parseInt(fyRange[2], 10);
    // Require year2 to be year1+1 to avoid matching arbitrary year ranges that
    // look like other identifiers (e.g. "2020-2024").
    if (y2 === y1 + 1) {
      // Task #1030: honour the building's fiscal-year-start month when the
      // caller knows it. Anything outside 1-12 falls back to January so a
      // bad value can never throw or shift dates wildly.
      const startMonthIndex =
        typeof fiscalYearStartMonth === 'number'
          && Number.isInteger(fiscalYearStartMonth)
          && fiscalYearStartMonth >= 1
          && fiscalYearStartMonth <= 12
          ? fiscalYearStartMonth - 1
          : 0;
      return new Date(Date.UTC(y1, startMonthIndex, 1));
    }
    // If years aren't consecutive, fall through to null (not a fiscal-year range).
  }

  // 4. Calendar year: "2022"
  const year = /^(\d{4})$/.exec(trimmed);
  if (year) {
    const y = parseInt(year[1], 10);
    if (y >= 1900 && y <= 2100) {
      return new Date(Date.UTC(y, 0, 1));
    }
    return null;
  }

  // 5. Quarter (year first): "2023 Q3"
  const qYearFirst = /^(\d{4})\s+Q([1-4])$/i.exec(trimmed);
  if (qYearFirst) {
    const y = parseInt(qYearFirst[1], 10);
    const q = parseInt(qYearFirst[2], 10);
    return new Date(Date.UTC(y, (q - 1) * 3, 1));
  }

  // 6. Quarter (Q first): "Q3 2023"
  const qFirst = /^Q([1-4])\s+(\d{4})$/i.exec(trimmed);
  if (qFirst) {
    const q = parseInt(qFirst[1], 10);
    const y = parseInt(qFirst[2], 10);
    return new Date(Date.UTC(y, (q - 1) * 3, 1));
  }

  // 7. Month-year (long or short English name): "July 2023", "Jul 2023"
  const MONTHS: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };
  const monthYear = /^([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (monthYear) {
    const monthKey = monthYear[1].toLowerCase();
    const y = parseInt(monthYear[2], 10);
    const m = MONTHS[monthKey];
    if (m !== undefined) {
      return new Date(Date.UTC(y, m, 1));
    }
  }

  // Anything else (invoice numbers, free-form labels, etc.) → null.
  return null;
}
