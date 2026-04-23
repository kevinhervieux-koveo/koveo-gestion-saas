/**
 * Helper for the budget forecast endpoint that applies the per-project
 * `projectYearOverrides` map sent by the Budget page when the user is
 * previewing a project period shift before clicking Confirm.
 *
 * When an override is provided for a project, the project is treated as
 * if its `financialYear` is the override and the year of its
 * `plannedStartDate` is shifted by the same delta so the cost lands in
 * the equivalent month of the new financial year.
 *
 * Extracted into its own module so it can be unit-tested without
 * dragging in the database-backed forecast route.
 */

export interface OverridableProject {
  id: string;
  financialYear: number | null;
  plannedStartDate: string | null;
  // Allow the helper to be used with the wider project row shape from
  // the forecast handler (which carries totalBudget, estimatedCost, etc.)
  // without losing those extra fields in the result.
  [key: string]: unknown;
}

export function applyProjectYearOverrides<T extends OverridableProject>(
  projects: T[],
  projectYearOverrides: Record<string, number> | undefined,
): T[] {
  if (!projectYearOverrides || Object.keys(projectYearOverrides).length === 0) {
    return projects;
  }

  return projects.map(project => {
    const override = projectYearOverrides[project.id];
    if (override === undefined) return project;

    const baseYear = project.financialYear ?? null;
    let nextPlannedStartDate = project.plannedStartDate;
    if (project.plannedStartDate) {
      const original = new Date(project.plannedStartDate);
      if (!isNaN(original.getTime())) {
        const delta = baseYear !== null ? override - baseYear : 0;
        const shifted = new Date(
          original.getFullYear() + delta,
          original.getMonth(),
          original.getDate(),
        );
        nextPlannedStartDate = shifted.toISOString().split('T')[0];
      }
    }

    return {
      ...project,
      financialYear: override,
      plannedStartDate: nextPlannedStartDate,
    };
  });
}
