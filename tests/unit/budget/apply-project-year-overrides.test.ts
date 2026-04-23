/**
 * @file Project period-shift preview tests
 * @description Locks in the server behaviour added by Task #309: when the
 * Budget page sends `projectYearOverrides` along with the forecast request
 * body, the targeted project is treated as if its financial year is the
 * override and its `plannedStartDate` year is shifted by the same delta so
 * the cost lands in the equivalent month of the new financial year.
 *
 * Also asserts the "no overrides sent" path is byte-identical to the prior
 * behaviour so a future refactor cannot silently regress the preview.
 */

import { describe, it, expect } from '@jest/globals';
import { applyProjectYearOverrides } from '../../../server/api/apply-project-year-overrides';

type ProjectRow = {
  id: string;
  totalBudget: string | null;
  estimatedCost: string | null;
  plannedStartDate: string | null;
  financialYear: number | null;
  status: string;
};

const baseProjects: ProjectRow[] = [
  {
    id: 'proj-a',
    totalBudget: '50000',
    estimatedCost: '48000',
    plannedStartDate: '2026-06-15',
    financialYear: 2026,
    status: 'planned',
  },
  {
    id: 'proj-b',
    totalBudget: '12000',
    estimatedCost: '11500',
    plannedStartDate: '2027-09-01',
    financialYear: 2027,
    status: 'planned',
  },
];

describe('applyProjectYearOverrides', () => {
  it('shifts the targeted project into the previewed financial year and moves plannedStartDate by the same delta', () => {
    const result = applyProjectYearOverrides(baseProjects, { 'proj-a': 2028 });

    const shifted = result.find(p => p.id === 'proj-a')!;
    expect(shifted.financialYear).toBe(2028);
    // 2026 -> 2028 is a +2 year delta; month/day must be preserved.
    expect(shifted.plannedStartDate).toBe('2028-06-15');

    // Untargeted project must be left alone (and identity-preserved is fine).
    const untouched = result.find(p => p.id === 'proj-b')!;
    expect(untouched).toEqual(baseProjects[1]);

    // Extra row fields (totalBudget, estimatedCost, status) survive the shift
    // so downstream forecast math still sees the same cost.
    expect(shifted.totalBudget).toBe('50000');
    expect(shifted.estimatedCost).toBe('48000');
    expect(shifted.status).toBe('planned');
  });

  it('handles a backwards shift (override earlier than the stored financial year)', () => {
    const result = applyProjectYearOverrides(baseProjects, { 'proj-b': 2025 });

    const shifted = result.find(p => p.id === 'proj-b')!;
    expect(shifted.financialYear).toBe(2025);
    // 2027 -> 2025 is a -2 year delta.
    expect(shifted.plannedStartDate).toBe('2025-09-01');
  });

  it('still applies the override when financialYear is null (no delta to apply, plannedStartDate untouched)', () => {
    const projects: ProjectRow[] = [
      {
        id: 'proj-c',
        totalBudget: '9000',
        estimatedCost: '9000',
        plannedStartDate: '2026-03-10',
        financialYear: null,
        status: 'planned',
      },
    ];

    const result = applyProjectYearOverrides(projects, { 'proj-c': 2030 });
    expect(result[0].financialYear).toBe(2030);
    // baseYear was null so delta is 0 — date is left as-is.
    expect(result[0].plannedStartDate).toBe('2026-03-10');
  });

  it('leaves plannedStartDate as null when the project has no planned start date', () => {
    const projects: ProjectRow[] = [
      {
        id: 'proj-d',
        totalBudget: '1000',
        estimatedCost: '1000',
        plannedStartDate: null,
        financialYear: 2026,
        status: 'planned',
      },
    ];

    const result = applyProjectYearOverrides(projects, { 'proj-d': 2028 });
    expect(result[0].financialYear).toBe(2028);
    expect(result[0].plannedStartDate).toBeNull();
  });

  it('returns the input array reference unchanged when no overrides are sent (byte-identical to prior behaviour)', () => {
    const snapshot = JSON.parse(JSON.stringify(baseProjects));

    const undefResult = applyProjectYearOverrides(baseProjects, undefined);
    expect(undefResult).toBe(baseProjects);

    const emptyResult = applyProjectYearOverrides(baseProjects, {});
    expect(emptyResult).toBe(baseProjects);

    // And the rows themselves were not mutated in place.
    expect(baseProjects).toEqual(snapshot);
  });

  it('ignores overrides for project ids that are not in the included set', () => {
    const result = applyProjectYearOverrides(baseProjects, { 'proj-not-here': 2030 });
    expect(result).toEqual(baseProjects);
  });
});
