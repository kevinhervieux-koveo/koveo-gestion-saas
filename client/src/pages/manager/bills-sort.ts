/**
 * Sort bills by issue date with the rule that bills missing an issue date
 * always sort to the end, regardless of direction. When sortField is not
 * 'issueDate', the original ordering is preserved.
 *
 * Extracted from bills.tsx so it can be unit tested without mounting the
 * entire bills page.
 */
export function sortBillsByIssueDate<T extends { issueDate?: unknown }>(
  bills: T[],
  sortField?: string,
  sortDirection?: 'asc' | 'desc',
): T[] {
  if (sortField !== 'issueDate') return bills;
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...bills].sort((a, b) => {
    const aHas = !!a.issueDate;
    const bHas = !!b.issueDate;
    // NULL issue dates always sort to the end regardless of direction
    if (!aHas && !bHas) return 0;
    if (!aHas) return 1;
    if (!bHas) return -1;
    const aTime = new Date(a.issueDate as unknown as string).getTime();
    const bTime = new Date(b.issueDate as unknown as string).getTime();
    return (aTime - bTime) * direction;
  });
}
